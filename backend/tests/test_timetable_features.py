import pytest
import datetime
from fastapi.testclient import TestClient
from app.main import app, seed_database
from app.core.database import SessionLocal
from app.models.models import Organization, Person, Schedule, RequirementSlot, Assignment, Resource

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    seed_database()

def test_timetable_swap_dry_run_and_execution():
    db = SessionLocal()
    sched = db.query(Schedule).filter(Schedule.org_id == 1).first()
    assert sched is not None

    slots = db.query(RequirementSlot).filter(RequirementSlot.schedule_id == sched.id).all()
    assert len(slots) >= 2

    slot1 = slots[0]
    slot2 = slots[1]

    # Test dry run preview
    swap_payload = {
        "schedule_id": sched.id,
        "source_slot_id": slot1.id,
        "target_slot_id": slot2.id,
        "reason": "Test swap",
        "dry_run": True,
        "approved_by": "Test Manager"
    }
    preview_resp = client.post("/api/replacements/timetable-swap", json=swap_payload)
    assert preview_resp.status_code == 200
    preview_data = preview_resp.json()
    assert "preview" in preview_data
    assert "valid" in preview_data

    # Test actual swap execution
    exec_payload = {
        "schedule_id": sched.id,
        "source_slot_id": slot1.id,
        "target_slot_id": slot2.id,
        "reason": "Peer teaching exchange",
        "dry_run": False,
        "approved_by": "Department Head"
    }
    exec_resp = client.post("/api/replacements/timetable-swap", json=exec_payload)
    assert exec_resp.status_code == 200
    exec_data = exec_resp.json()
    assert "success" in exec_data

    # Swap back to preserve clean test database state for subsequent workflow tests
    revert_payload = {
        "schedule_id": sched.id,
        "source_slot_id": slot2.id,
        "target_slot_id": slot1.id,
        "reason": "Revert peer teaching exchange",
        "dry_run": False,
        "approved_by": "Department Head"
    }
    client.post("/api/replacements/timetable-swap", json=revert_payload)

def test_timetable_swap_same_slot_invalid():
    db = SessionLocal()
    sched = db.query(Schedule).filter(Schedule.org_id == 1).first()
    slot1 = db.query(RequirementSlot).filter(RequirementSlot.schedule_id == sched.id).first()

    payload = {
        "schedule_id": sched.id,
        "source_slot_id": slot1.id,
        "target_slot_id": slot1.id,
        "dry_run": True
    }
    resp = client.post("/api/replacements/timetable-swap", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is False
    assert any("itself" in err.lower() for err in data["errors"])

def test_add_lab_session_college():
    db = SessionLocal()
    sched = db.query(Schedule).filter(Schedule.org_id == 1).first()
    teacher = db.query(Person).filter(Person.org_id == 1).first()
    lab_res = db.query(Resource).filter(Resource.org_id == 1, Resource.type == "lab").first()

    # Clean up any leftover test slots on this test window if rerun
    existing_slots = db.query(RequirementSlot).filter(
        RequirementSlot.schedule_id == sched.id,
        RequirementSlot.title.like("Data Structures Hands-on Lab%")
    ).all()
    for es in existing_slots:
        db.query(Assignment).filter(Assignment.slot_id == es.id).delete()
        db.delete(es)
    db.commit()

    lab_payload = {
        "teacher_id": teacher.id,
        "subject": "Data Structures Hands-on",
        "date_str": "2026-10-16",
        "start_time": "14:00",
        "end_time": "16:00",
        "resource_id": lab_res.id if lab_res else None,
        "semester": "S3",
        "class_name": "CSE-B"
    }

    resp = client.post(f"/api/schedules/{sched.id}/add-lab", json=lab_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "slot_id" in data
    assert "assignment_id" in data

    # Clean up created lab slot to maintain clean DB state
    db.query(Assignment).filter(Assignment.id == data["assignment_id"]).delete()
    db.query(RequirementSlot).filter(RequirementSlot.id == data["slot_id"]).delete()
    db.commit()
