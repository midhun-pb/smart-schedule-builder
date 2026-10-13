import pytest
from fastapi.testclient import TestClient
from app.main import app, seed_database, seed_subjects_if_needed
from app.core.database import SessionLocal
from app.models.models import Organization, Subject, Semester, Person, TeacherSubjectAssignment

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    seed_database()
    seed_subjects_if_needed()

def test_create_teacher_with_multi_semester_assignments():
    db = SessionLocal()
    org = db.query(Organization).filter(Organization.type == "college").first()
    assert org is not None, "College organization must exist"

    # Fetch subjects
    subs = db.query(Subject).filter(Subject.org_id == org.id).all()
    assert len(subs) >= 2, "Subjects must exist"
    sub1 = subs[0]
    sub2 = subs[1]

    # Create teacher with multi-semester assignments atomically
    create_payload = {
        "org_id": org.id,
        "name": "Dr. Alan Turing",
        "email": "alan.turing@cambridge.edu",
        "employee_code": "FAC-TEST-001",
        "role_title": "Professor of Computing",
        "profession_type": "college",
        "department_id": sub1.department_id,
        "max_hours_per_week": 35.0,
        "qualifications": ["Ph.D Mathematics", "Fellow RS"],
        "skills": [{"name": "Algorithms", "level": "Expert", "verified": True, "years": 10.0}],
        "teacher_assignments": [
            {
                "semester": "S3",
                "subject_id": sub1.id,
                "required_periods": 4,
                "period_duration": "1 hour",
                "allowed_working_days": [0, 1, 2, 3, 4],
                "preferred_periods": ["Period 1", "Period 2"]
            },
            {
                "semester": "S5",
                "subject_id": sub2.id,
                "required_periods": 3,
                "period_duration": "1 hour",
                "allowed_working_days": [0, 2, 4],
                "preferred_periods": ["Period 3"]
            }
        ]
    }

    resp = client.post("/api/profiles", json=create_payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["name"] == "Dr. Alan Turing"
    assert data["employee_code"] == "FAC-TEST-001"
    assert "teacher_assignments" in data
    assert len(data["teacher_assignments"]) == 2

    # Verify assignments details
    assigned_semesters = [a["semester"] for a in data["teacher_assignments"]]
    assert "S3" in assigned_semesters
    assert "S5" in assigned_semesters

    for a in data["teacher_assignments"]:
        assert a["period_duration"] == "1 hour"
        assert a["person_id"] == data["id"]
        assert a["org_id"] == org.id

    person_id = data["id"]

    # Verify GET /profiles/{person_id}
    get_resp = client.get(f"/api/profiles/{person_id}")
    assert get_resp.status_code == 200
    get_data = get_resp.json()
    assert get_data["id"] == person_id
    assert len(get_data["teacher_assignments"]) == 2

    # Verify GET /profiles includes teacher_assignments
    list_resp = client.get(f"/api/profiles?org_id={org.id}")
    assert list_resp.status_code == 200
    people_list = list_resp.json()
    turing = next((p for p in people_list if p["id"] == person_id), None)
    assert turing is not None
    assert len(turing["teacher_assignments"]) == 2

    # Test update_person: update teacher details and sync assignments
    update_payload = {
        "name": "Dr. Alan M. Turing",
        "email": "alan.turing@cambridge.edu",
        "employee_code": "FAC-TEST-001",
        "role_title": "Distinguished Chair",
        "department_id": sub1.department_id,
        "max_hours_per_week": 30.0,
        "status": "active",
        "teacher_assignments": [
            {
                "semester": "S3",
                "subject_id": sub1.id,
                "required_periods": 5,
                "period_duration": "1.5 hours",
                "allowed_working_days": [0, 1, 2, 3]
            }
        ]
    }

    put_resp = client.put(f"/api/profiles/{person_id}", json=update_payload)
    assert put_resp.status_code == 200
    updated_data = put_resp.json()
    assert updated_data["name"] == "Dr. Alan M. Turing"
    assert updated_data["role_title"] == "Distinguished Chair"
    assert len(updated_data["teacher_assignments"]) == 1
    assert updated_data["teacher_assignments"][0]["semester"] == "S3"
    assert updated_data["teacher_assignments"][0]["required_periods"] == 5
    assert updated_data["teacher_assignments"][0]["period_duration"] == "1.5 hours"

    # Verify in DB
    db_assignments = db.query(TeacherSubjectAssignment).filter(TeacherSubjectAssignment.person_id == person_id).all()
    assert len(db_assignments) == 1
    assert db_assignments[0].required_periods == 5
    assert db_assignments[0].period_duration == "1.5 hours"
    db.close()

def test_glixon_with_multi_semester_teacher_assignments():
    db = SessionLocal()
    org = db.query(Organization).filter(Organization.type == "college").first()
    assert org is not None

    glixon_req = {
        "org_id": org.id,
        "title": "Glixon Semester Test Timetable",
        "period_start": "2026-10-19",
        "period_end": "2026-10-23",
        "preview": True
    }

    resp = client.post("/api/schedules/glixon-generate", json=glixon_req)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["success"] is True
    assert "assignments" in data
    assert len(data["assignments"]) > 0

    # Ensure assignments contain semester and subject info
    for a in data["assignments"]:
        assert "teacher_name" in a
        assert "subject_name" in a
        assert "semester" in a
        assert "start_time" in a
        assert "end_time" in a

    db.close()

def test_wizard_step3_teacher_with_three_semesters_persistence():
    """
    Validates Requirement 12:
    Creating a teacher with three semesters (S3, S5, S7), saving, refreshing/reopening,
    and verifying each semester retains its subject and periods independently without crosstalk.
    """
    db = SessionLocal()
    org = db.query(Organization).filter(Organization.type == "college").first()
    assert org is not None

    # Find or create subjects for S3, S5, S7
    sub_s3 = db.query(Subject).filter(Subject.org_id == org.id, Subject.semester == "S3").first()
    sub_s5 = db.query(Subject).filter(Subject.org_id == org.id, Subject.semester == "S5").first()
    sub_s7 = db.query(Subject).filter(Subject.org_id == org.id, Subject.semester == "S7").first()

    if not sub_s3:
        sub_s3 = Subject(org_id=org.id, name="Data Structures and Algorithms", code="CS201", semester="S3", required_hours_per_week=4.0)
        db.add(sub_s3)
    if not sub_s5:
        sub_s5 = Subject(org_id=org.id, name="Database Management Systems", code="CS301", semester="S5", required_hours_per_week=3.0)
        db.add(sub_s5)
    if not sub_s7:
        sub_s7 = Subject(org_id=org.id, name="Machine Learning", code="CS401", semester="S7", required_hours_per_week=2.0)
        db.add(sub_s7)
    db.commit()

    teacher_payload = {
        "org_id": org.id,
        "name": "Prof. Margaret Hamilton",
        "email": "margaret.hamilton@apollo.edu",
        "employee_code": "FAC-STEP3-001",
        "role_title": "Director of Software Engineering",
        "profession_type": "college",
        "department_id": sub_s3.department_id,
        "max_hours_per_week": 40.0,
        "qualifications": ["B.A. Mathematics", "Doctorate of Science"],
        "skills": [{"name": "Software Engineering", "level": "Expert", "verified": True, "years": 15.0}],
        "teacher_assignments": [
            {
                "semester": "S3",
                "subject_id": sub_s3.id,
                "required_periods": 4,
                "period_duration": "1 hour",
                "allowed_working_days": [0, 1, 2, 3, 4],
                "preferred_periods": ["Period 1", "Period 2"]
            },
            {
                "semester": "S5",
                "subject_id": sub_s5.id,
                "required_periods": 3,
                "period_duration": "1 hour",
                "allowed_working_days": [0, 1, 3],
                "preferred_periods": ["Period 3"]
            },
            {
                "semester": "S7",
                "subject_id": sub_s7.id,
                "required_periods": 2,
                "period_duration": "1.5 hours",
                "allowed_working_days": [2, 4],
                "preferred_periods": ["Period 4"]
            }
        ]
    }

    # Step 1: Save teacher in Step 3
    post_res = client.post("/api/profiles", json=teacher_payload)
    assert post_res.status_code == 200, post_res.text
    teacher_data = post_res.json()
    teacher_id = teacher_data["id"]

    assert len(teacher_data["teacher_assignments"]) == 3
    assignments_by_sem = {a["semester"]: a for a in teacher_data["teacher_assignments"]}
    assert assignments_by_sem["S3"]["subject_id"] == sub_s3.id
    assert assignments_by_sem["S3"]["required_periods"] == 4
    assert assignments_by_sem["S5"]["subject_id"] == sub_s5.id
    assert assignments_by_sem["S5"]["required_periods"] == 3
    assert assignments_by_sem["S7"]["subject_id"] == sub_s7.id
    assert assignments_by_sem["S7"]["required_periods"] == 2
    assert assignments_by_sem["S7"]["period_duration"] == "1.5 hours"

    # Step 2: Simulate Refresh / Reopening Step 3 (GET /profiles?org_id={org_id})
    list_res = client.get(f"/api/profiles?org_id={org.id}")
    assert list_res.status_code == 200
    all_teachers = list_res.json()
    hamilton = next((p for p in all_teachers if p["id"] == teacher_id), None)
    assert hamilton is not None
    assert len(hamilton["teacher_assignments"]) == 3

    # Step 3: Simulate clicking Edit (GET /profiles/{id} or loading saved assignments)
    detail_res = client.get(f"/api/profiles/{teacher_id}")
    assert detail_res.status_code == 200
    loaded_teacher = detail_res.json()
    loaded_by_sem = {a["semester"]: a for a in loaded_teacher["teacher_assignments"]}
    assert len(loaded_by_sem) == 3
    assert loaded_by_sem["S3"]["subject_id"] == sub_s3.id
    assert loaded_by_sem["S5"]["subject_id"] == sub_s5.id
    assert loaded_by_sem["S7"]["subject_id"] == sub_s7.id

    # Step 4: Verify modifying S5 does NOT alter S3 or S7
    updated_assignments = [
        loaded_by_sem["S3"],
        {
            "id": loaded_by_sem["S5"]["id"],
            "semester": "S5",
            "subject_id": sub_s5.id,
            "required_periods": 5,  # modified
            "period_duration": "50 mins",
            "allowed_working_days": [0, 1, 2, 3, 4]
        },
        loaded_by_sem["S7"]
    ]
    update_res = client.put(f"/api/profiles/{teacher_id}", json={
        "name": "Prof. Margaret Hamilton",
        "teacher_assignments": updated_assignments
    })
    assert update_res.status_code == 200
    updated_teacher = update_res.json()
    new_by_sem = {a["semester"]: a for a in updated_teacher["teacher_assignments"]}
    assert new_by_sem["S3"]["required_periods"] == 4  # Unchanged
    assert new_by_sem["S5"]["required_periods"] == 5  # Updated
    assert new_by_sem["S5"]["period_duration"] == "50 mins"
    assert new_by_sem["S7"]["required_periods"] == 2  # Unchanged
    assert new_by_sem["S7"]["period_duration"] == "1.5 hours"

    db.close()

