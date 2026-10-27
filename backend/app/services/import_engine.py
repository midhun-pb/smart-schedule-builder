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

        # Existing people in org to check duplicates against DB
        existing_emails = {
            p.email.lower() for p in db.query(Person.email).filter(Person.org_id == org_id).all() if p.email
        }
        existing_codes = {
            p.employee_code.lower() for p in db.query(Person.employee_code).filter(Person.org_id == org_id).all() if p.employee_code
        }

        # Existing departments in org - never silently invent missing departments
        existing_depts = {}
        for d in db.query(Department).filter(Department.org_id == org_id).all():
            existing_depts[d.name.strip().lower()] = d.id
            if d.code:
                existing_depts[d.code.strip().lower()] = d.id

        seen_file_emails = set()
        seen_file_codes = set()

        records = []
        all_warnings = []
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
            row_warnings = []

            if not name:
                row_errors.append("Missing required field: Name")
                all_warnings.append({
                    "row_number": row_num,
                    "field": "name",
                    "reason": "Staff member name is mandatory for identification.",
                    "can_import_safely": False
                })

            if not email or "@" not in email:
                row_errors.append("Invalid or missing email format")
                all_warnings.append({
                    "row_number": row_num,
                    "field": "email",
                    "reason": "Valid email address is required for communication and unique identification.",
                    "can_import_safely": False
                })

            # Duplicate checks (DB & within file)
            if email:
                e_lower = email.lower()
                if e_lower in existing_emails:
                    row_errors.append(f"Duplicate email already exists in system ({email})")
                    all_warnings.append({
                        "row_number": row_num,
                        "field": "email",
                        "reason": f"Email '{email}' is already registered to an existing person in the organization.",
                        "can_import_safely": False
                    })
                elif e_lower in seen_file_emails:
                    row_errors.append(f"Duplicate email repeated within file ({email})")
                    all_warnings.append({
                        "row_number": row_num,
                        "field": "email",
                        "reason": f"Email '{email}' appears more than once in this upload.",
                        "can_import_safely": False
                    })
                else:
                    seen_file_emails.add(e_lower)

            if emp_code:
                c_lower = emp_code.lower()
                if c_lower in existing_codes:
                    row_errors.append(f"Duplicate employee code already exists ({emp_code})")
                    all_warnings.append({
                        "row_number": row_num,
                        "field": "employee_code",
                        "reason": f"Employee code '{emp_code}' is already assigned to someone else.",
                        "can_import_safely": False
                    })
                elif c_lower in seen_file_codes:
                    row_errors.append(f"Duplicate employee code repeated within file ({emp_code})")
                    all_warnings.append({
                        "row_number": row_num,
                        "field": "employee_code",
                        "reason": f"Employee code '{emp_code}' is repeated in this file.",
                        "can_import_safely": False
                    })
                else:
                    seen_file_codes.add(c_lower)

            # Department reference check: never silently invent missing departments
            dept_raw = record_dict.get("department", "").strip()
            dept_id = None
            if dept_raw:
                dept_clean = dept_raw.lower()
                if dept_clean in existing_depts:
                    dept_id = existing_depts[dept_clean]
                else:
                    row_errors.append(f"Referenced department '{dept_raw}' does not exist in the organization.")
                    all_warnings.append({
                        "row_number": row_num,
                        "field": "department",
                        "reason": f"Department '{dept_raw}' is not configured in this organization. You must create the department first or update the CSV.",
                        "can_import_safely": False
                    })
            else:
                row_warnings.append("Department not specified; will be left unassigned.")
                all_warnings.append({
                    "row_number": row_num,
                    "field": "department",
                    "reason": "Department is blank. The profile can be imported without an assigned department.",
                    "can_import_safely": True
                })

            # Hours limit check
            max_hours_val = 40.0
            if "max_hours" in record_dict and record_dict["max_hours"]:
                try:
                    parsed_hrs = float(record_dict["max_hours"])
                    if parsed_hrs < 1.0 or parsed_hrs > 80.0:
                        row_errors.append(f"Invalid weekly hours limit: {parsed_hrs}. Must be between 1 and 80.")
                        all_warnings.append({
                            "row_number": row_num,
                            "field": "max_hours",
                            "reason": f"Weekly hours value {parsed_hrs} is outside realistic boundaries (1 to 80 hrs/wk).",
                            "can_import_safely": False
                        })
                    else:
                        max_hours_val = parsed_hrs
                except ValueError:
                    row_errors.append(f"Non-numeric weekly hours limit: {record_dict['max_hours']}")
                    all_warnings.append({
                        "row_number": row_num,
                        "field": "max_hours",
                        "reason": "Weekly hours limit must be a valid number.",
                        "can_import_safely": False
                    })

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
                "department": dept_raw or "Unassigned",
                "department_id": dept_id,
                "phone": record_dict.get("phone", ""),
                "skills": skills_list,
                "qualifications": quals_list,
                "max_hours": max_hours_val,
                "errors": row_errors,
                "warnings": row_warnings,
                "quality_score": row_quality,
                "is_valid": len(row_errors) == 0,
                "can_import_safely": len(row_errors) == 0
            })

        overall_quality = round((valid_rows / max(1, total_rows)) * 100.0, 1) if total_rows > 0 else 0.0

        return {
            "success": True,
            "filename": filename,
            "total_rows": total_rows,
            "valid_rows": valid_rows,
            "invalid_rows": total_rows - valid_rows,
            "column_mapping": col_mapping,
            "overall_quality_score": overall_quality,
            "warnings": all_warnings,
            "preview": records[:20],
            "full_records": records
        }

    @classmethod
    def commit_import(
        cls,
        org_id: int,
        records: List[Dict[str, Any]],
        db: Session,
        mode: str = "continue_valid"
    ) -> Dict[str, Any]:
        """
        Transactional import: commits verified records to the database.
        mode="continue_valid": imports only rows where is_valid=True, records skipped rows.
        mode="strict": cancels entire import if any row has errors.
        Never silently invents missing departments, subjects, or skills.
        """
        from app.services.skill_engine import SkillEngine

        invalid_records = [r for r in records if not r.get("is_valid", False)]
        if mode == "strict" and invalid_records:
            return {
                "success": False,
                "total_rows_processed": len(records),
                "successful_imports": 0,
                "imported_count": 0,
                "skipped_rows": len(records),
                "skipped_details": [
                    {
                        "row_number": r.get("row_number", "?"),
                        "name": r.get("name", "Unknown"),
                        "reason": "; ".join(r.get("errors", ["Validation failure"]))
                    }
                    for r in records
                ],
                "message": f"Import cancelled in strict mode due to {len(invalid_records)} invalid rows."
            }

        # Departments lookup: only use existing departments
        departments = {}
        for d in db.query(Department).filter(Department.org_id == org_id).all():
            departments[d.name.strip().lower()] = d.id
            if d.code:
                departments[d.code.strip().lower()] = d.id

        imported_count = 0
        skipped_details = []

        try:
            for rec in records:
                if not rec.get("is_valid", False):
                    skipped_details.append({
                        "row_number": rec.get("row_number", "?"),
                        "name": rec.get("name", "Unknown"),
                        "reason": "; ".join(rec.get("errors", ["Skipped due to validation errors"]))
                    })
                    continue

                dept_id = rec.get("department_id")
                if not dept_id and rec.get("department"):
                    dept_id = departments.get(rec["department"].strip().lower())

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

            # Record audit log
            audit = AuditLog(
                org_id=org_id,
                action="CSV_DATA_IMPORTED",
                entity_type="import",
                entity_id="bulk_staff",
                details={
                    "total_processed": len(records),
                    "imported_count": imported_count,
                    "skipped_count": len(skipped_details),
                    "mode": mode
                }
            )
            db.add(audit)
            db.commit()

            return {
                "success": True,
                "total_rows_processed": len(records),
                "successful_imports": imported_count,
                "imported_count": imported_count,
                "skipped_rows": len(skipped_details),
                "skipped_details": skipped_details,
                "message": f"Successfully imported {imported_count} staff profiles. {len(skipped_details)} skipped."
            }
        except Exception as e:
            db.rollback()
            return {
                "success": False,
                "total_rows_processed": len(records),
                "successful_imports": 0,
                "imported_count": 0,
                "skipped_rows": len(records),
                "skipped_details": [{"row_number": "all", "name": "all", "reason": f"Database transaction error: {str(e)}"}],
                "error": f"Import transaction rolled back: {str(e)}",
                "message": f"Transaction failed and was safely rolled back: {str(e)}"
            }
