import io
import csv
import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import pandas as pd

from app.core.database import get_db
from app.models.models import (
    Holiday, HolidayException, Organization, Department, Schedule,
    RequirementSlot, Assignment, Person, AuditLog, Notification
)
from app.schemas.schemas import HolidayCreate, HolidayUpdate, HolidayExceptionCreate

router = APIRouter(prefix="/holidays", tags=["holidays"])

# --- Verified Official Calendar Presets ---
VERIFIED_CALENDARS = {
    "us_standard_2026": {
        "id": "us_standard_2026",
        "title": "US Federal & National Holidays (2026)",
        "description": "Standard 11 official public holidays observed in the United States.",
        "holidays": [
            {"name": "New Year's Day", "holiday_type": "public", "start_date": "2026-01-01", "end_date": "2026-01-01", "is_partial_day": False, "essential_staffing_allowed": True},
            {"name": "Martin Luther King Jr. Day", "holiday_type": "public", "start_date": "2026-01-19", "end_date": "2026-01-19", "is_partial_day": False, "essential_staffing_allowed": True},
            {"name": "Washington's Birthday (Presidents' Day)", "holiday_type": "public", "start_date": "2026-02-16", "end_date": "2026-02-16", "is_partial_day": False, "essential_staffing_allowed": True},
            {"name": "Memorial Day", "holiday_type": "public", "start_date": "2026-05-25", "end_date": "2026-05-25", "is_partial_day": False, "essential_staffing_allowed": True},
            {"name": "Juneteenth National Independence Day", "holiday_type": "public", "start_date": "2026-06-19", "end_date": "2026-06-19", "is_partial_day": False, "essential_staffing_allowed": True},
            {"name": "Independence Day", "holiday_type": "public", "start_date": "2026-07-04", "end_date": "2026-07-04", "is_partial_day": False, "essential_staffing_allowed": True},
            {"name": "Labor Day", "holiday_type": "public", "start_date": "2026-09-07", "end_date": "2026-09-07", "is_partial_day": False, "essential_staffing_allowed": True},
            {"name": "Columbus Day / Indigenous Peoples' Day", "holiday_type": "public", "start_date": "2026-10-12", "end_date": "2026-10-12", "is_partial_day": False, "essential_staffing_allowed": True},
            {"name": "Veterans Day", "holiday_type": "public", "start_date": "2026-11-11", "end_date": "2026-11-11", "is_partial_day": False, "essential_staffing_allowed": True},
            {"name": "Thanksgiving Day", "holiday_type": "public", "start_date": "2026-11-26", "end_date": "2026-11-26", "is_partial_day": False, "essential_staffing_allowed": True},
            {"name": "Christmas Day", "holiday_type": "public", "start_date": "2026-12-25", "end_date": "2026-12-25", "is_partial_day": False, "essential_staffing_allowed": True},
        ]
    },
    "academic_calendar_2026": {
        "id": "academic_calendar_2026",
        "title": "Academic / University Calendar (2026)",
        "description": "Semester breaks, midterm evaluation reading days, and institutional holidays.",
        "holidays": [
            {"name": "Spring Semester Reading Day", "holiday_type": "organization", "start_date": "2026-03-06", "end_date": "2026-03-06", "is_partial_day": False, "essential_staffing_allowed": False},
            {"name": "Spring Break", "holiday_type": "organization", "start_date": "2026-03-16", "end_date": "2026-03-20", "is_partial_day": False, "essential_staffing_allowed": False},
            {"name": "Summer Session Intermission", "holiday_type": "organization", "start_date": "2026-06-29", "end_date": "2026-07-03", "is_partial_day": False, "essential_staffing_allowed": False},
            {"name": "Fall Faculty Colloquium (Half-Day)", "holiday_type": "organization", "start_date": "2026-10-14", "end_date": "2026-10-14", "is_partial_day": True, "partial_start_time": "13:00", "partial_end_time": "18:00", "essential_staffing_allowed": False},
            {"name": "Fall Semester Break", "holiday_type": "organization", "start_date": "2026-11-23", "end_date": "2026-11-27", "is_partial_day": False, "essential_staffing_allowed": False},
            {"name": "Winter Recess", "holiday_type": "organization", "start_date": "2026-12-21", "end_date": "2026-12-31", "is_partial_day": False, "essential_staffing_allowed": False},
        ]
    },
    "healthcare_continuous_2026": {
        "id": "healthcare_continuous_2026",
        "title": "Healthcare Continuous Operations & Essential Rota (2026)",
        "description": "Hospital holidays with mandatory essential clinical coverage clearances.",
        "holidays": [
            {"name": "New Year Holiday Coverage", "holiday_type": "public", "start_date": "2026-01-01", "end_date": "2026-01-01", "is_partial_day": False, "essential_staffing_allowed": True, "authorized_roles": ["Chief Resident", "Staff Physician", "Registered Nurse (RN)", "Triage Nurse"]},
            {"name": "Memorial Day Emergency Rota", "holiday_type": "public", "start_date": "2026-05-25", "end_date": "2026-05-25", "is_partial_day": False, "essential_staffing_allowed": True, "authorized_roles": ["Critical Care Specialist", "Registered Nurse (RN)"]},
            {"name": "Hospital Founders Day (Afternoon Seminar)", "holiday_type": "organization", "start_date": "2026-09-18", "end_date": "2026-09-18", "is_partial_day": True, "partial_start_time": "14:00", "partial_end_time": "18:00", "essential_staffing_allowed": True},
            {"name": "Thanksgiving Clinical Minimum Staffing", "holiday_type": "public", "start_date": "2026-11-26", "end_date": "2026-11-26", "is_partial_day": False, "essential_staffing_allowed": True, "authorized_roles": ["Staff Physician", "Registered Nurse (RN)"]},
            {"name": "Christmas Day Essential Care", "holiday_type": "public", "start_date": "2026-12-25", "end_date": "2026-12-25", "is_partial_day": False, "essential_staffing_allowed": True, "authorized_roles": ["Chief Resident", "Registered Nurse (RN)"]},
        ]
    }
}

def evaluate_holiday_impact_on_assignments(db: Session, org_id: int, holiday: Holiday) -> List[Dict[str, Any]]:
    """
    Identifies all existing timetable slots and assignments that overlap with
    the holiday dates, partial-day hours, and department restrictions.
    Never silently deletes assignments.
    """
    query = (
        db.query(RequirementSlot)
        .filter(
            RequirementSlot.org_id == org_id,
            RequirementSlot.date_str >= holiday.start_date,
            RequirementSlot.date_str <= holiday.end_date,
        )
    )

    if holiday.department_id:
        query = query.filter(RequirementSlot.department_id == holiday.department_id)

    slots = query.all()
    impacted = []

    for slot in slots:
        # Check partial day time overlap
        if holiday.is_partial_day and holiday.partial_start_time and holiday.partial_end_time:
            s_start = slot.start_time
            s_end = slot.end_time
            h_start = holiday.partial_start_time
            h_end = holiday.partial_end_time
            if s_end <= h_start or s_start >= h_end:
                continue

        # Check existing exceptions for this slot
        has_exception = (
            db.query(HolidayException)
            .filter(
                HolidayException.holiday_id == holiday.id,
                HolidayException.slot_id == slot.id
            )
            .first()
            is not None
        )

        for a in slot.assignments:
            p = a.person
            # Check person-level exception
            if not has_exception and p:
                has_exception = (
                    db.query(HolidayException)
                    .filter(
                        HolidayException.holiday_id == holiday.id,
                        HolidayException.person_id == p.id
                    )
                    .first()
                    is not None
                )

            is_essential_covered = False
            if holiday.essential_staffing_allowed and p and p.role_title:
                auth_roles = holiday.authorized_roles or []
                if any(r.lower() in p.role_title.lower() for r in auth_roles):
                    is_essential_covered = True

            status_tag = "special_working_day" if holiday.holiday_type == "special_working_day" else (
                "authorized_exception" if has_exception else (
                    "essential_clearance" if is_essential_covered else "conflict"
                )
            )

            impacted.append({
                "slot_id": slot.id,
                "slot_title": slot.title,
                "date_str": slot.date_str,
                "start_time": slot.start_time,
                "end_time": slot.end_time,
                "department_id": slot.department_id,
                "assignment_id": a.id,
                "person_id": p.id if p else None,
                "person_name": p.name if p else "Unassigned",
                "person_role": p.role_title if p else "",
                "status_tag": status_tag,
                "has_exception": has_exception,
                "is_essential_covered": is_essential_covered,
                "holiday_name": holiday.name,
                "holiday_type": holiday.holiday_type
            })

    return impacted


# --- Endpoints ---

@router.get("")
def list_holidays(
    org_id: int,
    department_id: Optional[int] = None,
    holiday_type: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Holiday).filter(Holiday.org_id == org_id)

    if department_id:
        query = query.filter((Holiday.department_id == department_id) | (Holiday.department_id == None))
    if holiday_type and holiday_type != "all":
        query = query.filter(Holiday.holiday_type == holiday_type)
    if search:
        s = f"%{search}%"
        query = query.filter((Holiday.name.ilike(s)) | (Holiday.location.ilike(s)) | (Holiday.description.ilike(s)))
    if start_date:
        query = query.filter(Holiday.end_date >= start_date)
    if end_date:
        query = query.filter(Holiday.start_date <= end_date)

    holidays = query.order_by(Holiday.start_date.asc()).all()

    dept_map = {d.id: d.name for d in db.query(Department).filter(Department.org_id == org_id).all()}

    results = []
    for h in holidays:
        exc_count = db.query(HolidayException).filter(HolidayException.holiday_id == h.id).count()
        results.append({
            "id": h.id,
            "org_id": h.org_id,
            "department_id": h.department_id,
            "department_name": dept_map.get(h.department_id, "All Departments") if h.department_id else "All Departments",
            "name": h.name,
            "holiday_type": h.holiday_type,
            "start_date": h.start_date,
            "end_date": h.end_date,
            "is_partial_day": h.is_partial_day,
            "partial_start_time": h.partial_start_time,
            "partial_end_time": h.partial_end_time,
            "is_recurring": h.is_recurring,
            "location": h.location,
            "description": h.description,
            "essential_staffing_allowed": h.essential_staffing_allowed,
            "authorized_roles": h.authorized_roles or [],
            "status": h.status,
            "exceptions_count": exc_count,
            "created_at": h.created_at.isoformat() if h.created_at else None
        })

    return results


@router.post("")
def create_holiday(data: HolidayCreate, db: Session = Depends(get_db)):
    if data.start_date > data.end_date:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date")

    holiday = Holiday(
        org_id=data.org_id,
        department_id=data.department_id,
        name=data.name.strip(),
        holiday_type=data.holiday_type,
        start_date=data.start_date,
        end_date=data.end_date,
        is_partial_day=data.is_partial_day,
        partial_start_time=data.partial_start_time if data.is_partial_day else None,
        partial_end_time=data.partial_end_time if data.is_partial_day else None,
        is_recurring=data.is_recurring,
        location=data.location,
        description=data.description,
        essential_staffing_allowed=data.essential_staffing_allowed,
        authorized_roles=data.authorized_roles or [],
        status="active"
    )
    db.add(holiday)
    db.commit()
    db.refresh(holiday)

    # Evaluate impact on existing schedule assignments
    impacted = evaluate_holiday_impact_on_assignments(db, data.org_id, holiday)
    conflicts = [item for item in impacted if item["status_tag"] == "conflict"]

    # Audit log
    audit = AuditLog(
        org_id=data.org_id,
        action="HOLIDAY_CREATED",
        entity_type="holiday",
        entity_id=str(holiday.id),
        details={
            "name": holiday.name,
            "type": holiday.holiday_type,
            "dates": f"{holiday.start_date} to {holiday.end_date}",
            "conflicts_identified": len(conflicts)
        }
    )
    db.add(audit)

    # If there are conflicts, create an informative system notification
    if conflicts:
        notif = Notification(
            org_id=data.org_id,
            title=f"Holiday Schedule Impact: {holiday.name}",
            message=f"Added '{holiday.name}'. {len(conflicts)} assigned shift(s) overlap with this holiday and require review or essential authorization.",
            category="holiday",
            link_url="/holidays"
        )
        db.add(notif)

    db.commit()

    h_dict = {
        "id": holiday.id,
        "org_id": holiday.org_id,
        "department_id": holiday.department_id,
        "name": holiday.name,
        "holiday_type": holiday.holiday_type,
        "start_date": holiday.start_date,
        "end_date": holiday.end_date,
        "is_partial_day": holiday.is_partial_day,
        "partial_start_time": holiday.partial_start_time,
        "partial_end_time": holiday.partial_end_time,
        "is_recurring": holiday.is_recurring,
        "location": holiday.location,
        "description": holiday.description,
        "essential_staffing_allowed": holiday.essential_staffing_allowed,
        "authorized_roles": holiday.authorized_roles or [],
        "status": holiday.status,
        "created_at": holiday.created_at.isoformat() if holiday.created_at else None
    }

    return {
        "success": True,
        "holiday": h_dict,
        "impact_analysis": {
            "total_impacted_slots": len(impacted),
            "conflicts_count": len(conflicts),
            "conflict_details": conflicts[:10],
            "essential_covered_count": len([i for i in impacted if i["status_tag"] == "essential_clearance"]),
            "exceptions_count": len([i for i in impacted if i["status_tag"] == "authorized_exception"])
        }
    }


# Static routes defined before dynamic /{holiday_id} to ensure proper URL resolution

@router.get("/impact")
def get_all_holidays_schedule_impact(org_id: int, db: Session = Depends(get_db)):
    """
    Scans entire timetable against all active holidays for the organization.
    Identifies assignments affected by holiday restrictions.
    """
    holidays = db.query(Holiday).filter(Holiday.org_id == org_id, Holiday.status == "active").all()
    all_impacted = []

    for h in holidays:
        impacted = evaluate_holiday_impact_on_assignments(db, org_id, h)
        all_impacted.extend(impacted)

    conflicts = [i for i in all_impacted if i["status_tag"] == "conflict"]
    return {
        "total_holidays": len(holidays),
        "total_impacted_assignments": len(all_impacted),
        "total_conflicts": len(conflicts),
        "conflicts": conflicts,
        "impacted_assignments": all_impacted
    }


@router.get("/presets/list")
def list_verified_calendar_presets():
    """
    Returns list of official, verified holiday calendar presets.
    """
    return [
        {
            "id": k,
            "title": v["title"],
            "description": v["description"],
            "holiday_count": len(v["holidays"]),
            "preview": v["holidays"][:3]
        }
        for k, v in VERIFIED_CALENDARS.items()
    ]


class LoadPresetRequest(BaseModel):
    org_id: int
    preset_id: str

@router.post("/presets/load")
def load_verified_calendar_preset(req: LoadPresetRequest, db: Session = Depends(get_db)):
    """
    Imports verified official calendar preset into the organization's database.
    """
    preset = VERIFIED_CALENDARS.get(req.preset_id)
    if not preset:
        raise HTTPException(status_code=404, detail="Calendar preset not found")

    existing_holidays = {
        (h.name.lower(), h.start_date)
        for h in db.query(Holiday.name, Holiday.start_date).filter(Holiday.org_id == req.org_id).all()
    }

    added_count = 0
    skipped_count = 0

    for item in preset["holidays"]:
        key = (item["name"].lower(), item["start_date"])
        if key in existing_holidays:
            skipped_count += 1
            continue

        h = Holiday(
            org_id=req.org_id,
            name=item["name"],
            holiday_type=item["holiday_type"],
            start_date=item["start_date"],
            end_date=item["end_date"],
            is_partial_day=item.get("is_partial_day", False),
            partial_start_time=item.get("partial_start_time"),
            partial_end_time=item.get("partial_end_time"),
            is_recurring=False,
            essential_staffing_allowed=item.get("essential_staffing_allowed", False),
            authorized_roles=item.get("authorized_roles", []),
            status="active",
            description=f"Verified calendar preset: {preset['title']}"
        )
        db.add(h)
        added_count += 1

    db.commit()

    return {
        "success": True,
        "message": f"Loaded '{preset['title']}': {added_count} holidays added, {skipped_count} existing skipped.",
        "added_count": added_count,
        "skipped_count": skipped_count
    }


@router.post("/import/preview")
async def preview_holiday_import(
    org_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Parses CSV/XLSX holiday file, checks dates, maps columns, and checks duplicates.
    """
    if not (file.filename.endswith(".csv") or file.filename.endswith(".xlsx") or file.filename.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are supported")

    content = await file.read()
    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse spreadsheet: {str(e)}")

    synonyms = {
        "name": ["holiday name", "name", "title", "holiday", "event"],
        "holiday_type": ["type", "holiday type", "category"],
        "start_date": ["start date", "start", "date", "from date"],
        "end_date": ["end date", "end", "to date", "until"],
        "is_partial_day": ["partial day", "is partial", "half day", "partial"],
        "partial_start_time": ["start time", "partial start", "from time"],
        "partial_end_time": ["end time", "partial end", "to time"],
        "essential_staffing_allowed": ["essential staffing", "essential", "staffing allowed", "continuity"]
    }

    col_map = {}
    for col in df.columns:
        clean = str(col).strip().lower()
        for field, syns in synonyms.items():
            if any(clean == s or s in clean for s in syns):
                col_map[col] = field
                break

    existing = {
        (h.name.lower(), h.start_date)
        for h in db.query(Holiday.name, Holiday.start_date).filter(Holiday.org_id == org_id).all()
    }

    preview_rows = []
    valid_count = 0
    duplicate_count = 0

    for idx, row in df.iterrows():
        r_dict = {}
        for orig, field in col_map.items():
            val = row[orig]
            if pd.notna(val):
                r_dict[field] = str(val).strip()

        name = r_dict.get("name")
        start_d = r_dict.get("start_date")
        end_d = r_dict.get("end_date") or start_d
        h_type = r_dict.get("holiday_type", "public").lower()
        if h_type not in ["public", "regional", "organization", "department_specific", "optional", "custom", "emergency_closure", "special_working_day"]:
            h_type = "public"

        is_partial = str(r_dict.get("is_partial_day", "")).lower() in ["true", "1", "yes", "half"]
        p_start = r_dict.get("partial_start_time") if is_partial else None
        p_end = r_dict.get("partial_end_time") if is_partial else None
        essential = str(r_dict.get("essential_staffing_allowed", "")).lower() in ["true", "1", "yes"]

        row_errors = []
        if not name:
            row_errors.append("Missing holiday name")
        if not start_d:
            row_errors.append("Missing start date")

        if start_d:
            try:
                start_d = pd.to_datetime(start_d).strftime("%Y-%m-%d")
            except Exception:
                row_errors.append("Invalid start date format (use YYYY-MM-DD)")

        if end_d:
            try:
                end_d = pd.to_datetime(end_d).strftime("%Y-%m-%d")
            except Exception:
                end_d = start_d

        is_dup = (name.lower() if name else "", start_d) in existing if name and start_d else False
        if is_dup:
            duplicate_count += 1
            row_errors.append("Duplicate holiday already exists in organization")

        is_valid = len(row_errors) == 0
        if is_valid:
            valid_count += 1

        preview_rows.append({
            "row_index": idx + 1,
            "name": name or "Unnamed",
            "holiday_type": h_type,
            "start_date": start_d or "",
            "end_date": end_d or "",
            "is_partial_day": is_partial,
            "partial_start_time": p_start,
            "partial_end_time": p_end,
            "essential_staffing_allowed": essential,
            "is_duplicate": is_dup,
            "is_valid": is_valid,
            "errors": row_errors
        })

    return {
        "success": True,
        "total_rows": len(df),
        "valid_rows": valid_count,
        "duplicate_rows": duplicate_count,
        "preview": preview_rows
    }


class CommitHolidayImportRequest(BaseModel):
    org_id: int
    holidays: List[Dict[str, Any]]

@router.post("/import/commit")
def commit_holiday_import(req: CommitHolidayImportRequest, db: Session = Depends(get_db)):
    added = 0
    for h_data in req.holidays:
        if not h_data.get("is_valid") and not h_data.get("name"):
            continue

        h = Holiday(
            org_id=req.org_id,
            name=h_data["name"].strip(),
            holiday_type=h_data.get("holiday_type", "public"),
            start_date=h_data["start_date"],
            end_date=h_data.get("end_date") or h_data["start_date"],
            is_partial_day=h_data.get("is_partial_day", False),
            partial_start_time=h_data.get("partial_start_time"),
            partial_end_time=h_data.get("partial_end_time"),
            essential_staffing_allowed=h_data.get("essential_staffing_allowed", False),
            status="active"
        )
        db.add(h)
        added += 1

    db.commit()

    return {
        "success": True,
        "message": f"Successfully imported and saved {added} holidays to database.",
        "imported_count": added
    }


@router.get("/export")
def export_holidays_csv(org_id: int, db: Session = Depends(get_db)):
    """
    Exports verified list of holidays to standard CSV.
    """
    holidays = db.query(Holiday).filter(Holiday.org_id == org_id).order_by(Holiday.start_date.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Name", "Type", "Start Date", "End Date", "Partial Day",
        "Partial Start Time", "Partial End Time", "Essential Staffing Allowed", "Location", "Description"
    ])

    for h in holidays:
        writer.writerow([
            h.name,
            h.holiday_type,
            h.start_date,
            h.end_date,
            "Yes" if h.is_partial_day else "No",
            h.partial_start_time or "",
            h.partial_end_time or "",
            "Yes" if h.essential_staffing_allowed else "No",
            h.location or "",
            h.description or ""
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=holidays_export_org_{org_id}.csv"}
    )


@router.delete("/exceptions/{exception_id}")
def delete_holiday_exception(exception_id: int, db: Session = Depends(get_db)):
    exc = db.query(HolidayException).filter(HolidayException.id == exception_id).first()
    if not exc:
        raise HTTPException(status_code=404, detail="Exception not found")

    db.delete(exc)
    db.commit()
    return {"success": True, "message": "Authorized exception revoked"}


# Parameterized /{holiday_id} routes defined below static routes

@router.get("/{holiday_id}")
def get_holiday(holiday_id: int, db: Session = Depends(get_db)):
    h = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Holiday not found")

    impacted = evaluate_holiday_impact_on_assignments(db, h.org_id, h)
    exceptions = db.query(HolidayException).filter(HolidayException.holiday_id == h.id).all()

    h_dict = {
        "id": h.id,
        "org_id": h.org_id,
        "department_id": h.department_id,
        "name": h.name,
        "holiday_type": h.holiday_type,
        "start_date": h.start_date,
        "end_date": h.end_date,
        "is_partial_day": h.is_partial_day,
        "partial_start_time": h.partial_start_time,
        "partial_end_time": h.partial_end_time,
        "is_recurring": h.is_recurring,
        "location": h.location,
        "description": h.description,
        "essential_staffing_allowed": h.essential_staffing_allowed,
        "authorized_roles": h.authorized_roles or [],
        "status": h.status,
        "created_at": h.created_at.isoformat() if h.created_at else None
    }

    return {
        "holiday": h_dict,
        "exceptions": [
            {
                "id": e.id,
                "person_id": e.person_id,
                "person_name": e.person.name if e.person else "Unknown",
                "slot_id": e.slot_id,
                "reason": e.reason,
                "authorized_by": e.authorized_by,
                "created_at": e.created_at.isoformat() if e.created_at else None
            }
            for e in exceptions
        ],
        "impact_analysis": {
            "total_impacted_slots": len(impacted),
            "conflicts_count": len([i for i in impacted if i["status_tag"] == "conflict"]),
            "impacted_details": impacted
        }
    }


@router.put("/{holiday_id}")
def update_holiday(holiday_id: int, data: HolidayUpdate, db: Session = Depends(get_db)):
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")

    update_dict = data.model_dump(exclude_unset=True) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(holiday, field, val)

    db.commit()
    db.refresh(holiday)

    impacted = evaluate_holiday_impact_on_assignments(db, holiday.org_id, holiday)
    conflicts = [item for item in impacted if item["status_tag"] == "conflict"]

    h_dict = {
        "id": holiday.id,
        "org_id": holiday.org_id,
        "department_id": holiday.department_id,
        "name": holiday.name,
        "holiday_type": holiday.holiday_type,
        "start_date": holiday.start_date,
        "end_date": holiday.end_date,
        "is_partial_day": holiday.is_partial_day,
        "partial_start_time": holiday.partial_start_time,
        "partial_end_time": holiday.partial_end_time,
        "is_recurring": holiday.is_recurring,
        "location": holiday.location,
        "description": holiday.description,
        "essential_staffing_allowed": holiday.essential_staffing_allowed,
        "authorized_roles": holiday.authorized_roles or [],
        "status": holiday.status,
        "created_at": holiday.created_at.isoformat() if holiday.created_at else None
    }

    return {
        "success": True,
        "holiday": h_dict,
        "impact_analysis": {
            "total_impacted_slots": len(impacted),
            "conflicts_count": len(conflicts),
            "conflict_details": conflicts[:10]
        }
    }


@router.delete("/{holiday_id}")
def delete_holiday(holiday_id: int, db: Session = Depends(get_db)):
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")

    org_id = holiday.org_id
    h_name = holiday.name

    db.delete(holiday)
    db.commit()

    audit = AuditLog(
        org_id=org_id,
        action="HOLIDAY_DELETED",
        entity_type="holiday",
        entity_id=str(holiday_id),
        details={"name": h_name}
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": f"Holiday '{h_name}' deleted successfully"}


@router.post("/{holiday_id}/exceptions")
def create_holiday_exception(holiday_id: int, data: HolidayExceptionCreate, db: Session = Depends(get_db)):
    """
    Authorizes an essential staffing exception for a staff member or specific slot on a holiday.
    """
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")

    person = db.query(Person).filter(Person.id == data.person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    exc = HolidayException(
        org_id=data.org_id,
        holiday_id=holiday_id,
        person_id=data.person_id,
        slot_id=data.slot_id,
        reason=data.reason,
        authorized_by=data.authorized_by
    )
    db.add(exc)

    audit = AuditLog(
        org_id=data.org_id,
        action="HOLIDAY_EXCEPTION_AUTHORIZED",
        entity_type="holiday_exception",
        entity_id=str(holiday_id),
        details={"person_name": person.name, "holiday_name": holiday.name, "reason": data.reason}
    )
    db.add(audit)
    db.commit()
    db.refresh(exc)

    return {"success": True, "exception": exc}


@router.get("/{holiday_id}/exceptions")
def list_holiday_exceptions(holiday_id: int, db: Session = Depends(get_db)):
    exceptions = db.query(HolidayException).filter(HolidayException.holiday_id == holiday_id).all()
    return [
        {
            "id": e.id,
            "holiday_id": e.holiday_id,
            "person_id": e.person_id,
            "person_name": e.person.name if e.person else "Unknown",
            "slot_id": e.slot_id,
            "reason": e.reason,
            "authorized_by": e.authorized_by,
            "created_at": e.created_at.isoformat() if e.created_at else None
        }
        for e in exceptions
    ]
