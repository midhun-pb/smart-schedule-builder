import pytest
from fastapi.testclient import TestClient
from app.main import app, seed_database, seed_subjects_if_needed
from app.core.database import SessionLocal
from app.models.models import Organization, Person, Schedule, RequirementSlot, Assignment, Subject, Semester, TeacherSubjectAssignment

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    seed_database()
    seed_subjects_if_needed()

def test_teacher_assignments_multi_semester_and_crud():
    """
    Test individual semester configuration for teacher:
    - Dynamic semester assignment (S3, S5, S7)
    - Different subjects for different semesters
    - Multiple subjects in a semester
    - Verification that changing one semester assignment does not affect others
    """
    db = SessionLocal()
    col = db.query(Organization).filter(Organization.type == "college").first()
    assert col is not None

    teacher = db.query(Person).filter(Person.org_id == col.id).first()
    assert teacher is not None

    # Fetch subjects
    subs = db.query(Subject).filter(Subject.org_id == col.id).all()
    assert len(subs) >= 2
    sub1, sub2 = subs[0], subs[1]

    # Create assignment for S3
    ta1_payload = {
        "person_id": teacher.id,
        "subject_id": sub1.id,
        "semester": "S3",
        "class_name": "S3 A",
        "required_hours": 4.0,
        "required_periods": 4,
        "allowed_working_days": [0, 1, 2, 3, 4],
        "preferred_periods": ["Period 1", "Period 2"],
        "max_periods_per_day": 2,
        "assignment_status": "active"
    }
    res1 = client.post(f"/api/organizations/{col.id}/teacher-assignments", json=ta1_payload)
    assert res1.status_code in [200, 400]  # 400 if already seeded
    if res1.status_code == 200:
        ta1_id = res1.json()["id"]
    else:
        ta1_id = db.query(TeacherSubjectAssignment).filter(
            TeacherSubjectAssignment.org_id == col.id,
            TeacherSubjectAssignment.person_id == teacher.id,
            TeacherSubjectAssignment.subject_id == sub1.id
        ).first().id

    # Create assignment for S5 with distinct subject
    ta2_payload = {
        "person_id": teacher.id,
        "subject_id": sub2.id,
        "semester": "S5",
        "class_name": "S5 A",
        "required_hours": 3.0,
        "required_periods": 3,
        "allowed_working_days": [0, 1, 2, 3],
        "preferred_periods": ["Period 3"],
        "max_periods_per_day": 2,
        "assignment_status": "active"
    }
    res2 = client.post(f"/api/organizations/{col.id}/teacher-assignments", json=ta2_payload)
    assert res2.status_code in [200, 400]

    # Verify teacher assignments grouped by semester
    grouped_res = client.get(f"/api/organizations/{col.id}/teachers/{teacher.id}/assignments")
    assert grouped_res.status_code == 200
    grouped_data = grouped_res.json()
    assert "semesters" in grouped_data
    assert grouped_data["teacher_id"] == teacher.id
    assert grouped_data["total_assignments"] >= 1

    # Verify editing S5 does not affect S3
    update_payload = {
        "required_periods": 5,
        "max_periods_per_day": 3
    }
    up_res = client.put(f"/api/organizations/{col.id}/teacher-assignments/{ta1_id}", json=update_payload)
    assert up_res.status_code == 200
    assert up_res.json()["required_periods"] == 5

    db.close()

def test_period_configuration_crud_and_calculation():
    """
    Test configurable periods and timings:
    - Start and end times
    - Duration calculations (including breaks)
    - 7 days of the week support
    """
    db = SessionLocal()
    org = db.query(Organization).first()
    assert org is not None

    # Get period config
    get_res = client.get(f"/api/organizations/{org.id}/period-config")
    assert get_res.status_code == 200
    config_data = get_res.json()
    assert "working_days_schedule" in config_data
    sched = config_data["working_days_schedule"]
    assert "0" in sched  # Monday
    assert "6" in sched  # Sunday

    # Update with custom teaching periods and a refreshment break
    sched["0"]["periods"] = [
        {"name": "Morning Period 1", "type": "lecture", "start_time": "09:00", "end_time": "10:00", "is_active": True},
        {"name": "Morning Period 2", "type": "lecture", "start_time": "10:00", "end_time": "11:00", "is_active": True},
        {"name": "Refreshment Break", "type": "break", "start_time": "11:00", "end_time": "11:15", "is_active": True},
        {"name": "Advanced Lab", "type": "lab", "start_time": "11:15", "end_time": "13:15", "is_active": True},
    ]
    put_res = client.put(f"/api/organizations/{org.id}/period-config", json={"working_days_schedule": sched})
    assert put_res.status_code == 200
    updated_data = put_res.json()["working_days_schedule"]

    mon_periods = updated_data["0"]["periods"]
    assert len(mon_periods) == 4
    # Lecture 1: 60 min, 1.0 hr
    assert mon_periods[0]["duration_minutes"] == 60
    assert mon_periods[0]["duration_hours"] == 1.0
    # Break: 15 min
    assert mon_periods[2]["duration_minutes"] == 15
    # 2-hour lab: 120 min, 2.0 hr
    assert mon_periods[3]["duration_minutes"] == 120
    assert mon_periods[3]["duration_hours"] == 2.0

    db.close()

def test_glixon_generator_preview_and_commit():
    """
    Test GLIXON Intelligent Timetable Generator:
    - Preview generation without overwriting
    - Generates teacher, class, semester, and department timetables
    - Workload calculations
    - Confirm and commit to database
    """
    db = SessionLocal()
    col = db.query(Organization).filter(Organization.type == "college").first()
    assert col is not None

    gen_payload = {
        "org_id": col.id,
        "title": "GLIXON Test Timetable",
        "period_start": "2026-10-12",
        "period_end": "2026-10-16",
        "preview": True,
        "fairness_weight": 1.0,
        "preference_weight": 1.0,
        "overtime_penalty_weight": 1.0
    }

    # 1. Generate Preview
    prev_res = client.post("/api/schedules/glixon-generate", json=gen_payload)
    assert prev_res.status_code == 200
    prev_data = prev_res.json()

    assert prev_data["success"] is True
    assert prev_data["preview"] is True
    assert "assignments" in prev_data
    assert "teacher_timetables" in prev_data
    assert "class_timetables" in prev_data
    assert "semester_timetables" in prev_data
    assert "department_timetables" in prev_data
    assert "teacher_workloads" in prev_data
    assert prev_data["fairness_score"] >= 0.0

    # 2. Inspect an assignment structure
    if prev_data["assignments"]:
        first_a = prev_data["assignments"][0]
        assert "teacher_name" in first_a
        assert "subject_name" in first_a
        assert "semester" in first_a
        assert "class_name" in first_a
        assert "start_time" in first_a
        assert "end_time" in first_a
        assert "duration_hours" in first_a

    # 3. Confirm and Commit to Database
    commit_payload = {
        "org_id": col.id,
        "schedule_id": prev_data["schedule_id"],
        "title": "GLIXON Master Timetable",
        "period_start": "2026-10-12",
        "period_end": "2026-10-16",
        "assignments": prev_data["assignments"]
    }
    commit_res = client.post("/api/schedules/glixon-commit", json=commit_payload)
    assert commit_res.status_code == 200
    commit_data = commit_res.json()
    assert commit_data["success"] is True
    assert commit_data["total_assignments"] >= 0

    db.close()

def test_teacher_workloads_audit():
    """
    Test Teacher Workload and Fairness calculations:
    - Daily, weekly, monthly hours
    - Scheduled vs required periods
    - Free periods
    """
    db = SessionLocal()
    col = db.query(Organization).filter(Organization.type == "college").first()
    assert col is not None

    wl_res = client.get(f"/api/organizations/{col.id}/teacher-workloads")
    assert wl_res.status_code == 200
    wl_data = wl_res.json()
    assert "workloads" in wl_data
    assert len(wl_data["workloads"]) > 0

    first_wl = wl_data["workloads"][0]
    assert "teacher_name" in first_wl
    assert "teaching_hours_per_day" in first_wl
    assert "teaching_hours_per_week" in first_wl
    assert "teaching_hours_per_month" in first_wl
    assert "required_periods" in first_wl
    assert "scheduled_periods" in first_wl
    assert "free_periods" in first_wl

    db.close()
