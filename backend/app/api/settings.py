from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
from app.core.database import get_db
from app.models.models import Organization, OrgSetting, AuditLog
from pydantic import BaseModel

router = APIRouter(prefix="/settings", tags=["settings"])

class UpdateSettingsPayload(BaseModel):
    org_id: int
    settings: Dict[str, Any]

@router.get("/{org_id}")
def get_settings(org_id: int, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    default_settings = {
        "fairness_weight": 1.0,
        "preference_weight": 1.0,
        "overtime_penalty_weight": 1.5,
        "max_weekly_hours": 40.0,
        "allow_emergency_self_report": True,
        "require_manager_approval_for_swap": True,
        "auto_replacement_search": True,
        "haptic_feedback_enabled": True,
        "theme": "dark",
        "profession_label": org.settings_json.get("profession_label", "Staff") if org.settings_json else "Staff"
    }
    
    current = org.settings_json or {}
    merged = {**default_settings, **current}
    return merged

@router.put("")
def update_settings(payload: UpdateSettingsPayload, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == payload.org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    current = org.settings_json or {}
    org.settings_json = {**current, **payload.settings}
    
    audit = AuditLog(
        org_id=payload.org_id,
        action="SETTINGS_UPDATED",
        entity_type="settings",
        entity_id=str(payload.org_id),
        details=payload.settings
    )
    db.add(audit)
    db.commit()

    return {"success": True, "settings": org.settings_json}
