from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("")
def list_notifications(org_id: int, db: Session = Depends(get_db)):
    notifs = (
        db.query(Notification)
        .filter(Notification.org_id == org_id)
        .order_by(Notification.created_at.desc())
        .limit(30)
        .all()
    )
    unread_count = sum(1 for n in notifs if not n.is_read)
    return {
        "unread_count": unread_count,
        "notifications": notifs
    }

@router.post("/{notification_id}/read")
def mark_notification_read(notification_id: int, db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"success": True}

@router.post("/read-all")
def mark_all_read(org_id: int, db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.org_id == org_id, Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"success": True}
