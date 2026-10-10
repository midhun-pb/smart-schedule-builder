from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.models import ScheduleVersion, Schedule, Assignment, AuditLog

router = APIRouter(prefix="/history", tags=["history"])

@router.get("/versions/{schedule_id}")
def get_schedule_versions(schedule_id: int, db: Session = Depends(get_db)):
    versions = db.query(ScheduleVersion).filter(ScheduleVersion.schedule_id == schedule_id).order_by(ScheduleVersion.version_number.desc()).all()
    return versions

@router.post("/rollback/{version_id}")
def rollback_schedule_version(version_id: int, db: Session = Depends(get_db)):
    """
    Safely rolls back schedule to an earlier verified snapshot version.
    """
    version = db.query(ScheduleVersion).filter(ScheduleVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Schedule version not found")

    sched = db.query(Schedule).filter(Schedule.id == version.schedule_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Clear current assignments and re-apply from snapshot
    db.query(Assignment).filter(Assignment.schedule_id == sched.id).delete()

    snapshot_data = version.snapshot_json
    assignments_data = snapshot_data.get("assignments", [])

    for a in assignments_data:
        db.add(Assignment(
            schedule_id=sched.id,
            slot_id=a["slot_id"],
            person_id=a["person_id"],
            original_person_id=a["person_id"],
            date_str=a.get("date_str"),
            start_time=a.get("start_time"),
            end_time=a.get("end_time"),
            is_replacement=False,
            status="assigned"
        ))

    sched.version += 1
    sched.fairness_score = snapshot_data.get("fairness_score", 90.0)

    # Audit log
    audit = AuditLog(
        org_id=version.org_id,
        action="SCHEDULE_ROLLBACK",
        entity_type="schedule",
        entity_id=str(sched.id),
        details={"restored_version": version.version_number, "new_version": sched.version}
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "message": f"Successfully rolled back schedule to Version {version.version_number}.",
        "new_version": sched.version
    }

@router.get("/audit-logs")
def get_audit_logs(
    org_id: int,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog).filter(AuditLog.org_id == org_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)

    logs = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return logs
