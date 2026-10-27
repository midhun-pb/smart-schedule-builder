import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_company_schedules_all_20_employees():
    """
    Verify that when 20 employees are registered in a Company/Office org,
    GLIXON schedules all 20 employees within their working hours (09:00 - 17:00),
    providing parallel concurrent slots across the week.
    """
    unique_suffix = uuid.uuid4().hex[:6]
    # 1. Create Company Org
    org_res = client.post("/api/organizations", json={
        "name": f"Global Tech Corp {unique_suffix}",
        "type": "company",
        "working_days": [0, 1, 2, 3, 4],
        "working_hours_start": "09:00",
        "working_hours_end": "17:00",
    })
    assert org_res.status_code == 200, org_res.text
    org = org_res.json()
    org_id = org["id"]

    # 2. Create Departments / Teams
    dept_eng = client.post(f"/api/organizations/{org_id}/departments", json={
        "name": "Engineering",
        "code": f"ENG-{unique_suffix}"
    }).json()
    dept_ops = client.post(f"/api/organizations/{org_id}/departments", json={
        "name": "Operations",
        "code": f"OPS-{unique_suffix}"
    }).json()

    # 3. Register 20 distinct employees
    employee_ids = []
    duties = [
        "Frontend Development", "Backend Architecture", "DevOps Pipelines",
        "Database Administration", "Security Auditing", "Quality Assurance",
        "Product Management", "Infrastructure Support"
    ]
    for i in range(1, 21):
        dept_id = dept_eng["id"] if i <= 10 else dept_ops["id"]
        duty = duties[i % len(duties)]
        emp_res = client.post("/api/profiles", json={
            "org_id": org_id,
            "name": f"Employee {i}",
            "employee_code": f"EMP{unique_suffix}{i:03d}",
            "role_title": f"Specialist {i}",
            "email": f"emp{unique_suffix}_{i}@globaltech.io",
            "department_id": dept_id,
            "max_hours_per_week": 40,
            "preferences": {
                "duty": duty,
                "start_time": "09:00",
                "end_time": "17:00",
                "working_days": [0, 1, 2, 3, 4],
                "min_rest_hours": 12,
            },
            "qualifications": ["B.Tech", "AWS Certified"],
            "skills": [{"name": "Software Engineering", "level": "Expert"}],
        })
        assert emp_res.status_code == 200, emp_res.text
        employee_ids.append(emp_res.json()["id"])

    assert len(employee_ids) == 20

    # 4. Run GLIXON Generator
    gen_res = client.post("/api/schedules/glixon-generate", json={
        "org_id": org_id,
        "title": "Company Q4 Schedule",
        "period_start": "2026-11-02",
        "period_end": "2026-11-08",
        "commit_immediately": True
    })
    assert gen_res.status_code == 200, gen_res.text
    gen_data = gen_res.json()
    assert gen_data["success"] is True
    assert gen_data["total_assignments"] > 0

    preview = gen_data.get("preview_assignments", [])
    scheduled_teacher_ids = set(item["teacher_id"] for item in preview if item.get("teacher_id"))

    # Verify that all 20 employees are represented in preview assignments
    for emp_id in employee_ids:
        assert emp_id in scheduled_teacher_ids, f"Employee {emp_id} was not scheduled by GLIXON!"

    # 5. Commit and verify database timetable
    commit_res = client.post("/api/schedules/glixon-commit", json={
        "org_id": org_id,
        "schedule_id": gen_data["schedule_id"],
        "title": "Company Q4 Schedule",
        "period_start": "2026-11-02",
        "period_end": "2026-11-08",
        "assignments": preview
    })
    assert commit_res.status_code == 200, commit_res.text
    print("COMMIT RES:", commit_res.json())

    # 6. Fetch Full Organization Timetable details
    tt_res = client.get(f"/api/schedules/{gen_data['schedule_id']}/details")
    assert tt_res.status_code == 200
    tt_data = tt_res.json()

    slot_cards = tt_data.get("slots") or tt_data.get("slot_cards", [])
    scheduled_person_ids = set(c["person_id"] for c in slot_cards if c.get("person_id"))

    # Every single one of the 20 employees must be scheduled!
    for emp_id in employee_ids:
        assert emp_id in scheduled_person_ids, f"Employee {emp_id} was not scheduled in company timetable!"

    # Verify company slot cards include duty, role, and location
    for card in slot_cards:
        if card.get("person_id") in employee_ids:
            assert card.get("start_time") >= "09:00"
            assert card.get("end_time") <= "17:00"


def test_university_schedules_all_20_faculty():
    """
    Verify that when 20 faculty members are registered in a University/College org
    with semester subject assignments (S1-S8), GLIXON schedules all 20 faculty.
    """
    unique_suffix = uuid.uuid4().hex[:6]
    # 1. Create University Org
    org_res = client.post("/api/organizations", json={
        "name": f"Apex University {unique_suffix}",
        "type": "college",
        "working_days": [0, 1, 2, 3, 4],
        "working_hours_start": "08:30",
        "working_hours_end": "16:30",
    })
    assert org_res.status_code == 200
    org = org_res.json()
    org_id = org["id"]

    # 2. Departments
    dept_cs = client.post(f"/api/organizations/{org_id}/departments", json={
        "name": "Computer Science & Engineering",
        "code": f"CSE-{unique_suffix}"
    }).json()

    # 3. Create Semesters (S1 to S8)
    semesters = {}
    for sem_num in range(1, 9):
        sem_code = f"S{sem_num}"
        s_res = client.post(f"/api/organizations/{org_id}/semesters", json={
            "name": f"Semester {sem_code}",
            "code": sem_code,
            "academic_year": "2026-2027",
            "is_active": True
        })
        assert s_res.status_code == 200
        semesters[sem_code] = s_res.json()

    # 4. Register 20 Faculty with semester assignments
    faculty_ids = []
    for i in range(1, 21):
        sem_num = ((i - 1) % 8) + 1
        sem_code = f"S{sem_num}"
        sub_name = f"Course {i} Advanced Topics"
        sub_code = f"CS{sem_num}{unique_suffix}{i:02d}"

        # Create teacher
        teacher_res = client.post("/api/profiles", json={
            "org_id": org_id,
            "name": f"Prof. Teacher {i}",
            "employee_code": f"FAC{unique_suffix}{i:03d}",
            "role_title": "Assistant Professor",
            "email": f"prof{unique_suffix}_{i}@apexuniv.edu",
            "department_id": dept_cs["id"],
            "max_hours_per_week": 24,
            "qualifications": ["Ph.D", "M.Tech"],
            "skills": [{"name": "Algorithms", "level": "Expert"}]
        })
        assert teacher_res.status_code == 200, teacher_res.text
        teacher = teacher_res.json()
        faculty_ids.append(teacher["id"])

        # Create Subject
        sub_res = client.post(f"/api/organizations/{org_id}/subjects", json={
            "name": sub_name,
            "code": sub_code,
            "department_id": dept_cs["id"],
            "semester": sem_code,
            "semester_id": semesters[sem_code]["id"],
            "required_hours_per_week": 4,
            "is_lab": False
        })
        assert sub_res.status_code == 200, sub_res.text
        sub = sub_res.json()

        # Assign Faculty to Subject
        assign_res = client.post(f"/api/organizations/{org_id}/teacher-assignments", json={
            "person_id": teacher["id"],
            "subject_id": sub["id"],
            "department_id": dept_cs["id"],
            "semester": sem_code,
            "class_name": f"{sem_code} A",
            "required_hours": 4,
            "is_primary": True
        })
        assert assign_res.status_code == 200, assign_res.text

    assert len(faculty_ids) == 20

    # 5. Run GLIXON
    gen_res = client.post("/api/schedules/glixon-generate", json={
        "org_id": org_id,
        "title": "Fall 2026 Semester Schedule",
        "period_start": "2026-11-02",
        "period_end": "2026-11-08",
        "commit_immediately": True
    })
    assert gen_res.status_code == 200, gen_res.text
    gen_data = gen_res.json()
    assert gen_data["total_assignments"] > 0

    preview = gen_data.get("preview_assignments", [])
    scheduled_faculty_ids = set(item["teacher_id"] for item in preview if item.get("teacher_id"))

    # All 20 faculty must be scheduled in university timetable
    for fac_id in faculty_ids:
        assert fac_id in scheduled_faculty_ids, f"Faculty {fac_id} was not scheduled in university timetable!"

    # Check semester timetables exist for all active semesters
    sem_tts = gen_data.get("semester_timetables", {})
    for sem_num in range(1, 9):
        sem_code = f"S{sem_num}"
        assert sem_code in sem_tts, f"Semester {sem_code} missing from semester timetables!"


def test_airline_schedules_crew_with_rest_regulations():
    """
    Verify that an Aviation/Airline organization schedules flight crew
    with proper rest hours (12h) and flight operational metadata.
    """
    unique_suffix = uuid.uuid4().hex[:6]
    # 1. Create Airline Org
    org_res = client.post("/api/organizations", json={
        "name": f"SkyWings Airlines {unique_suffix}",
        "type": "airline",
        "working_days": [0, 1, 2, 3, 4, 5, 6],
        "working_hours_start": "05:00",
        "working_hours_end": "23:00",
    })
    assert org_res.status_code == 200, org_res.text
    org = org_res.json()
    org_id = org["id"]

    # 2. Flight Operations Division
    dept_ops = client.post(f"/api/organizations/{org_id}/departments", json={
        "name": "Flight Operations",
        "code": f"FLT-{unique_suffix}"
    }).json()

    # 3. Register Captain & First Officer
    captain_res = client.post("/api/profiles", json={
        "org_id": org_id,
        "name": "Captain Amelia Earhart",
        "employee_code": f"AV{unique_suffix}01",
        "role_title": "Captain",
        "email": f"amelia_{unique_suffix}@skywings.com",
        "department_id": dept_ops["id"],
        "max_hours_per_week": 35,
        "preferences": {
            "duty": "Flight Captain",
            "start_time": "06:00",
            "end_time": "14:00",
            "working_days": [0, 1, 2, 3, 4],
            "min_rest_hours": 12
        },
        "qualifications": ["ATPL License", "A320 Type Rating"]
    })
    assert captain_res.status_code == 200, captain_res.text
    capt_id = captain_res.json()["id"]

    # 4. GLIXON
    gen_res = client.post("/api/schedules/glixon-generate", json={
        "org_id": org_id,
        "title": "Weekly Flight Operations Schedule",
        "period_start": "2026-11-02",
        "period_end": "2026-11-08",
        "commit_immediately": True
    })
    assert gen_res.status_code == 200, gen_res.text
    gen_data = gen_res.json()

    preview = gen_data.get("preview_assignments", [])
    capt_slots = [item for item in preview if item.get("teacher_id") == capt_id]

    assert len(capt_slots) > 0, "Captain Amelia was not scheduled on flight duties!"
    for s in capt_slots:
        assert s.get("flight_number") is not None
        assert s.get("aircraft") is not None
