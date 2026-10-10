import io
import pandas as pd
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.models import Person, Department, AuditLog

class ImportEngine:
    """
    Real Excel (.xlsx) and CSV Data Import Engine.
    Features:
      - Automatic column mapping
      - Duplicate detection (by email / employee code)
      - Missing field validation & error reporting
      - Data quality score calculation (0-100%)
      - Database persistence
    """

    COLUMN_SYNONYMS = {
        "name": ["name", "full name", "employee name", "staff name", "teacher name", "candidate"],
        "email": ["email", "email address", "e-mail", "mail", "contact email"],
        "employee_code": ["employee code", "emp code", "code", "emp id", "id", "staff id", "badge"],
        "role_title": ["role", "role title", "designation", "job title", "title", "position"],
        "department": ["department", "dept", "division", "unit", "branch"],
        "skills": ["skills", "skill", "technologies", "competencies", "expertise", "subjects"],
        "qualifications": ["qualifications", "qualification", "degree", "education", "degrees"],
        "phone": ["phone", "mobile", "telephone", "phone number", "contact"],
        "max_hours": ["max hours", "weekly hours", "hours limit", "max hours per week"],
    }

    @classmethod
    def auto_map_columns(cls, df_columns: List[str]) -> Dict[str, str]:
        """
        Maps incoming spreadsheet columns to standard schema fields.
        """
        mapping = {}
        for col in df_columns:
            clean_col = str(col).strip().lower()
            for std_field, synonyms in cls.COLUMN_SYNONYMS.items():
                if any(clean_col == syn or syn in clean_col for syn in synonyms):
                    mapping[col] = std_field
                    break
        return mapping

    @classmethod
    def parse_and_validate(
        cls,
        file_bytes: bytes,
        filename: str,
        org_id: int,
        db: Session
    ) -> Dict[str, Any]:
        """
        Parses Excel/CSV bytes, applies column mapping, performs validation,
        detects duplicates, and computes data quality scores.
        """
        # 1. Read DataFrame
        try:
            if filename.endswith(".csv"):
                df = pd.read_csv(io.BytesIO(file_bytes))
            else:
                df = pd.read_excel(io.BytesIO(file_bytes))
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to parse spreadsheet: {str(e)}",
                "preview": [],
                "quality_score": 0.0
            }

        col_mapping = cls.auto_map_columns(list(df.columns))

        # Existing people in org to check duplicates
        existing_emails = {
            p.email.lower() for p in db.query(Person.email).filter(Person.org_id == org_id).all() if p.email
        }
        existing_codes = {
            p.employee_code.lower() for p in db.query(Person.employee_code).filter(Person.org_id == org_id).all() if p.employee_code
        }

        records = []
        errors = []
        warnings = []
        valid_rows = 0
        total_rows = len(df)

        for idx, row in df.iterrows():
            row_num = idx + 2  # Excel 1-indexed header is row 1
            record_dict = {}
            for orig_col, std_field in col_mapping.items():
                val = row[orig_col]
                if pd.notna(val):
                    record_dict[std_field] = str(val).strip()

            # Required field checks
            name = record_dict.get("name")
            email = record_dict.get("email")
            emp_code = record_dict.get("employee_code") or f"EMP-{1000 + idx}"

            row_errors = []
            if not name:
                row_errors.append("Missing name")
            if not email or "@" not in email:
                row_errors.append("Invalid or missing email")

            # Duplicate check
            is_duplicate = False
            if email and email.lower() in existing_emails:
                row_errors.append(f"Duplicate email already exists in system ({email})")
                is_duplicate = True
            if emp_code and emp_code.lower() in existing_codes:
                row_errors.append(f"Duplicate employee code already exists ({emp_code})")
                is_duplicate = True

            # Format skills
            skills_raw = record_dict.get("skills", "")
            skills_list = [
                {"name": s.strip(), "level": "Intermediate", "verified": True, "years": 2.0}
                for s in skills_raw.replace(";", ",").split(",")
                if s.strip()
            ]

            # Format qualifications
            quals_raw = record_dict.get("qualifications", "")
            quals_list = [q.strip() for q in quals_raw.replace(";", ",").split(",") if q.strip()]

            # Calculate individual row quality
            row_quality = 100
            if not record_dict.get("role_title"):
                row_quality -= 15
            if not skills_list:
                row_quality -= 25
            if not quals_list:
                row_quality -= 10
            if row_errors:
                row_quality -= 50
            row_quality = max(0, row_quality)

            if not row_errors:
                valid_rows += 1

            records.append({
                "row_number": row_num,
                "name": name or "Unnamed",
                "email": email or f"user{idx}@organization.org",
                "employee_code": emp_code,
                "role_title": record_dict.get("role_title", "Staff Member"),
                "department": record_dict.get("department", "General"),
                "phone": record_dict.get("phone", ""),
                "skills": skills_list,
                "qualifications": quals_list,
                "max_hours": float(record_dict.get("max_hours", 40.0) or 40.0),
                "errors": row_errors,
                "quality_score": row_quality,
                "is_valid": len(row_errors) == 0
            })

        overall_quality = round((valid_rows / max(1, total_rows)) * 100.0, 1) if total_rows > 0 else 0.0

        return {
            "success": True,
            "filename": filename,
            "total_rows": total_rows,
            "valid_rows": valid_rows,
            "column_mapping": col_mapping,
            "overall_quality_score": overall_quality,
            "preview": records[:20],  # preview top 20
            "full_records": records
        }

    @classmethod
    def commit_import(cls, org_id: int, records: List[Dict[str, Any]], db: Session) -> Dict[str, Any]:
        """
        Commits valid imported records into the database.
        """
        imported_count = 0
        from app.services.skill_engine import SkillEngine

        # Map department names to department entities
        departments = {d.name.lower(): d.id for d in db.query(Department).filter(Department.org_id == org_id).all()}

        for rec in records:
            if not rec.get("is_valid"):
                continue

            dept_name = rec.get("department", "General").lower()
            dept_id = departments.get(dept_name)
            if not dept_id:
                # Create department if not present
                new_dept = Department(org_id=org_id, name=rec.get("department", "General"), code=rec.get("department", "GEN")[:4].upper())
                db.add(new_dept)
                db.flush()
                departments[dept_name] = new_dept.id
                dept_id = new_dept.id

            direct_skills = rec.get("skills", [])
            inferred = SkillEngine.infer_hidden_skills(direct_skills)

            person = Person(
                org_id=org_id,
                department_id=dept_id,
                name=rec["name"],
                email=rec["email"],
                phone=rec.get("phone", ""),
                role_title=rec.get("role_title", "Staff Member"),
                employee_code=rec["employee_code"],
                qualifications=rec.get("qualifications", []),
                skills=direct_skills,
                inferred_skills=inferred,
                max_hours_per_week=rec.get("max_hours", 40.0),
                data_quality_score=rec.get("quality_score", 95.0),
                status="active"
            )
            db.add(person)
            imported_count += 1

        db.commit()
        return {
            "success": True,
            "imported_count": imported_count,
            "message": f"Successfully imported {imported_count} staff profiles."
        }
