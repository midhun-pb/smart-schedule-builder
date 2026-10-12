import pytest
import datetime
from fastapi.testclient import TestClient
from app.main import app, seed_database, seed_subjects_if_needed
from app.core.database import SessionLocal
from app.models.models import Organization, Person, Schedule, RequirementSlot, Assignment, Resource, Subject, Semester, TeacherSubjectAssignment

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    seed_database()
    seed_subjects_if_needed()

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

def test_roster_readiness_checklist():
    resp = client.get("/api/organizations/1/roster-readiness")
    assert resp.status_code == 200
    data = resp.json()
    assert "can_generate" in data
    assert "checklist" in data
    assert any(c["key"] == "staff" for c in data["checklist"])

def test_department_crud():
    # 1. Create
    create_payload = {"name": "Electrical & Electronics Engineering", "code": "EEE"}
    resp = client.post("/api/organizations/1/departments", json=create_payload)
    assert resp.status_code == 200
    dept = resp.json()
    assert dept["name"] == "Electrical & Electronics Engineering"
    dept_id = dept["id"]

    # 2. Update
    update_payload = {"name": "EEE Department", "code": "EE"}
    up_resp = client.put(f"/api/organizations/1/departments/{dept_id}", json=update_payload)
    assert up_resp.status_code == 200
    up_dept = up_resp.json()
    assert up_dept["name"] == "EEE Department"

    # 3. Delete
    del_resp = client.delete(f"/api/organizations/1/departments/{dept_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

def test_subject_crud():
    # 1. Create subject
    subject_payload = {
        "name": "Cloud Computing Architecture",
        "code": "CS601",
        "semester": "S6",
        "class_name": "CSE-A",
        "required_hours_per_week": 3,
        "is_lab": False,
        "description": "Enterprise cloud services and architecture"
    }
    resp = client.post("/api/organizations/1/subjects", json=subject_payload)
    assert resp.status_code == 200
    created = resp.json()
    assert created["code"] == "CS601"
    sub_id = created["id"]

    # 2. List subjects with semester filter
    list_resp = client.get("/api/organizations/1/subjects?semester=S6")
    assert list_resp.status_code == 200
    subjects = list_resp.json()
    assert any(s["id"] == sub_id for s in subjects)

    # 3. Update subject
    up_payload = {"name": "Advanced Cloud Computing", "required_hours_per_week": 4}
    up_resp = client.put(f"/api/organizations/1/subjects/{sub_id}", json=up_payload)
    assert up_resp.status_code == 200
    assert up_resp.json()["name"] == "Advanced Cloud Computing"

    # 4. Delete subject
    del_resp = client.delete(f"/api/organizations/1/subjects/{sub_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

def test_slot_subject_assignment_and_retrieval():
    db = SessionLocal()
    sched = db.query(Schedule).filter(Schedule.org_id == 1).first()

    # Create slot with subject
    slot_payload = {
        "org_id": 1,
        "schedule_id": sched.id,
        "title": "Algorithms Lecture",
        "day_of_week": 2,
        "start_time": "10:00",
        "end_time": "11:00",
        "period_type": "work",
        "subject_name": "Design & Analysis of Algorithms",
        "min_staff": 1,
        "target_staff": 1,
        "max_staff": 2,
        "required_skills": ["Algorithms"]
    }
    create_resp = client.post("/api/schedules/slots", json=slot_payload)
    assert create_resp.status_code == 200
    created_slot = create_resp.json()
    slot_id = created_slot["slot"]["id"]

    # Retrieve schedule details and verify prominent subject appears in slot_cards
    details_resp = client.get(f"/api/schedules/{sched.id}/details")
    assert details_resp.status_code == 200
    details = details_resp.json()
    matched = [s for s in details["slots"] if s["slot_id"] == slot_id]
    assert len(matched) == 1
    assert matched[0]["subject"] == "Design & Analysis of Algorithms"

    # Clean up created slot
    del_slot_resp = client.delete(f"/api/schedules/slots/{slot_id}")
    assert del_slot_resp.status_code == 200

def test_semester_management_crud():
    # 1. List existing semesters (seeded S1, S3, S5, S7)
    list_resp = client.get("/api/organizations/1/semesters")
    assert list_resp.status_code == 200
    sems = list_resp.json()
    assert len(sems) >= 4
    codes = [s["code"] for s in sems]
    assert "S1" in codes
    assert "S3" in codes
    assert "S5" in codes

    # 2. Create new semester
    create_resp = client.post("/api/organizations/1/semesters", json={
        "name": "Semester 9 (Postgrad)",
        "code": "S9",
        "academic_year": "2026-2027",
        "is_active": True
    })
    assert create_resp.status_code == 200
    created = create_resp.json()
    sem_id = created["id"]
    assert created["code"] == "S9"

    # 3. Update semester
    up_resp = client.put(f"/api/organizations/1/semesters/{sem_id}", json={
        "name": "Semester 9 (Advanced Research)"
    })
    assert up_resp.status_code == 200
    assert up_resp.json()["name"] == "Semester 9 (Advanced Research)"

    # 4. Delete semester
    del_resp = client.delete(f"/api/organizations/1/semesters/{sem_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

def test_teacher_subject_assignment_workflow():
    db = SessionLocal()
    teacher = db.query(Person).filter(Person.org_id == 1, Person.status == "active").first()
    subject = db.query(Subject).filter(Subject.org_id == 1, Subject.semester == "S3").first()
    assert teacher is not None
    assert subject is not None

    # 1. Assign teacher to subject
    assign_payload = {
        "person_id": teacher.id,
        "subject_id": subject.id,
        "semester": "S3",
        "class_name": "S3 A",
        "required_hours": 4.0,
        "is_primary": True
    }
    assign_resp = client.post("/api/organizations/1/teacher-assignments", json=assign_payload)
    # May already exist or succeed:
    if assign_resp.status_code == 400:
        assert "already assigned" in assign_resp.json()["detail"].lower()
    else:
        assert assign_resp.status_code == 200
        assigned_data = assign_resp.json()
        assert assigned_data["teacher_name"] == teacher.name
        assert assigned_data["subject_name"] == subject.name
        assert assigned_data["class_name"] == "S3 A"
        assert assigned_data["semester"] == "S3"

        # 2. Duplicate assignment rejection
        dup_resp = client.post("/api/organizations/1/teacher-assignments", json=assign_payload)
        assert dup_resp.status_code == 400
        assert "already assigned" in dup_resp.json()["detail"].lower()

        # 3. Retrieve assignments list
        list_resp = client.get(f"/api/organizations/1/teacher-assignments?person_id={teacher.id}")
        assert list_resp.status_code == 200
        records = list_resp.json()
        assert any(r["subject_id"] == subject.id for r in records)

        # 4. Clean up assignment
        assign_id = assigned_data["id"]
        del_resp = client.delete(f"/api/organizations/1/teacher-assignments/{assign_id}")
        assert del_resp.status_code == 200
        assert del_resp.json()["success"] is True

def test_timetable_matrix_semester_enrichment():
    db = SessionLocal()
    sched = db.query(Schedule).filter(Schedule.org_id == 1).first()
    assert sched is not None

    details_resp = client.get(f"/api/schedules/{sched.id}/details")
    assert details_resp.status_code == 200
    data = details_resp.json()
    slots = data["slots"]
    assert len(slots) > 0

    # Verify that work slots contain subject, semester, class_name, and department_name
    work_slots = [s for s in slots if s["period_type"] == "work"]
    assert len(work_slots) > 0
    for s in work_slots:
        assert "subject" in s
        assert "subject_name" in s
        assert "semester" in s
        assert "class_name" in s
        assert "department_name" in s
        # Prominent subject is not None
        assert s["subject"] is not None

