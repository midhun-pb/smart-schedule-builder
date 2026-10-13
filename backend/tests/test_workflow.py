import pytest
import datetime
from fastapi.testclient import TestClient
from app.main import app, seed_database
from app.core.database import SessionLocal
from app.models.models import Organization, Person, Schedule, Assignment, LeaveRequest, ReplacementLog

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    seed_database()

def test_root_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

    # Also test static root returns 200
    root_resp = client.get("/")
    assert root_resp.status_code == 200

def test_organizations_presets():
    response = client.get("/api/organizations/presets")
    assert response.status_code == 200
    presets = response.json()
    assert len(presets) == 3
    types = [p["type"] for p in presets]
    assert "college" in types
    assert "company" in types
    assert "airline" in types

def test_profiles_and_quality():
    # Test listing people for org 1 (Apex)
    response = client.get("/api/profiles?org_id=1")
    assert response.status_code == 200
    people = response.json()
    assert len(people) >= 6
    assert any("DBMS" in [s["name"] for s in p["skills"]] for p in people)

    # Test data quality score endpoint
    q_resp = client.get("/api/profiles/quality-stats?org_id=1")
    assert q_resp.status_code == 200
    stats = q_resp.json()
    assert stats["average_score"] >= 80.0

def test_natural_language_search():
    # "Find a DBMS teacher for S5 CSE on Monday at 10 AM"
    search_payload = {
        "org_id": 1,
        "query": "Find a DBMS teacher for S5 CSE on Monday at 10 AM",
        "top_k": 3
    }
    response = client.post("/api/search", json=search_payload)
    assert response.status_code == 200
    data = response.json()
    assert "DBMS" in data["parsed_entities"]["skills"]
    assert len(data["results"]) > 0
    top_candidate = data["results"][0]
    assert top_candidate["match_percentage"] >= 70.0
    assert "person" in top_candidate

def test_schedule_and_ortools_generation():
    today = datetime.date.today()
    start_d = today.strftime("%Y-%m-%d")
    end_d = (today + datetime.timedelta(days=4)).strftime("%Y-%m-%d")

    payload = {
        "org_id": 1,
        "title": "Automated OR-Tools Test Timetable",
        "period_start": start_d,
        "period_end": end_d,
        "fairness_weight": 1.0,
        "preference_weight": 1.0,
        "overtime_penalty_weight": 1.0
    }
    response = client.post("/api/schedules/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["total_assigned"] > 0
    assert data["fairness_score"] >= 70.0

def test_complete_emergency_leave_and_replacement_lifecycle():
    """
    Test complete lifecycle:
    1. Employee files emergency leave
    2. Affected slots identified
    3. Replacement recommended & ranked
    4. Replacement approved and timetable updated
    5. Employee returns to work
    6. Original assignment safely restored
    7. History verified
    """
    db = SessionLocal()
    try:
        # Find Dr. Eleanor Vance (id 1)
        eleanor = db.query(Person).filter(Person.email == "eleanor.vance@apex.edu").first()
        assert eleanor is not None

        # Find an assignment for Eleanor
        assign = db.query(Assignment).filter(Assignment.person_id == eleanor.id).first()
        if not assign:
            candidate_a = db.query(Assignment).filter(Assignment.schedule_id == 2).first()
            if candidate_a:
                candidate_a.person_id = eleanor.id
                candidate_a.original_person_id = eleanor.id
                candidate_a.status = "assigned"
                db.commit()
                assign = candidate_a

        assert assign is not None

        assign_date = assign.date_str or datetime.date.today().strftime("%Y-%m-%d")

        # 1. Submit emergency leave
        leave_payload = {
            "person_id": eleanor.id,
            "org_id": 1,
            "leave_type": "emergency",
            "start_date": assign_date,
            "end_date": assign_date,
            "start_time": "00:00",
            "end_time": "23:59",
            "reason": "Sudden medical emergency"
        }
        leave_resp = client.post("/api/leave/emergency", json=leave_payload)
        assert leave_resp.status_code == 200
        leave_data = leave_resp.json()
        assert leave_data["success"] is True
        assert leave_data["status"] == "emergency_recorded"
        assert leave_data["affected_count"] >= 1
        leave_id = leave_data["leave_id"]

        # 2. Get replacement recommendation for affected assignment
        rec_payload = {
            "org_id": 1,
            "assignment_id": assign.id
        }
        rec_resp = client.post("/api/replacements/recommend", json=rec_payload)
        assert rec_resp.status_code == 200
        rec_data = rec_resp.json()
        assert len(rec_data["candidates"]) > 0

        # Choose the top available candidate
        best_cand = next((c for c in rec_data["candidates"] if c["is_available"]), rec_data["candidates"][0])
        replacement_person_id = best_cand["person_id"]

        # 3. Approve replacement
        app_payload = {
            "org_id": 1,
            "assignment_id": assign.id,
            "replacement_person_id": replacement_person_id,
            "replacement_type": "temporary",
            "reason": "Coverage for Dr. Eleanor Vance emergency absence"
        }
        app_resp = client.post("/api/replacements/approve", json=app_payload)
        assert app_resp.status_code == 200
        app_data = app_resp.json()
        assert app_data["success"] is True
        log_id = app_data["replacement_log_id"]

        # 4. Check active swaps / replacements
        active_resp = client.get("/api/replacements/active?org_id=1")
        assert active_resp.status_code == 200
        active_list = active_resp.json()
        assert any(item["assignment_id"] == assign.id for item in active_list)

        # 5. Return to Work
        ret_payload = {
            "org_id": 1,
            "leave_request_id": leave_id,
            "person_id": eleanor.id
        }
        ret_resp = client.post("/api/leave/return-to-work", json=ret_payload)
        assert ret_resp.status_code == 200
        assert ret_resp.json()["success"] is True

        # 6. Restore original assignment
        rest_resp = client.post(f"/api/replacements/restore/{log_id}")
        assert rest_resp.status_code == 200
        rest_data = rest_resp.json()
        assert rest_data["success"] is True

        # 7. Verify assignment is back to original person
        db.commit()
        db.expire_all()
        refreshed_assign = db.query(Assignment).filter(Assignment.id == assign.id).first()
        assert refreshed_assign.person_id == eleanor.id
        assert refreshed_assign.is_replacement is False

        # 8. Verify history log
        hist_resp = client.get("/api/replacements/history?org_id=1")
        assert hist_resp.status_code == 200
        hist_items = hist_resp.json()
        restored_item = next((h for h in hist_items if h["id"] == log_id), None)
        assert restored_item is not None
        assert restored_item["status"] == "restored"
    finally:
        db.close()

def test_fairness_and_intelligence():
    fairness_resp = client.get("/api/fairness?org_id=1")
    assert fairness_resp.status_code == 200
    f_data = fairness_resp.json()
    assert "fairness_score" in f_data
    assert "workload_distribution" in f_data

    intel_resp = client.get("/api/intelligence/skills?org_id=1")
    assert intel_resp.status_code == 200
    i_data = intel_resp.json()
    assert "gap_analysis" in i_data
    assert "relationships" in i_data

def test_organization_setup_hospital_preset():
    """
    Test setting up a brand-new organization with custom shifts,
    departments, and Mon-Sun 24/7 timetable.
    """
    unique_suffix = int(datetime.datetime.now().timestamp() * 1000)
    payload = {
        "name": f"Metro General Hospital {unique_suffix}",
        "type": "hospital",
        "code": f"METRO-GH-{unique_suffix}",
        "description": "Tier-1 acute trauma and medical center.",
        "departments": ["Emergency Dept (ED)", "Intensive Care Unit (ICU)", "Cardiology"],
        "roles": ["Emergency Physician", "Critical Care RN", "Triage Nurse", "Cardiologist"],
        "resources": ["Trauma Bay 1", "Trauma Bay 2", "ICU Bed Block A", "Cath Lab 1"],
        "working_days_schedule": {
            "0": {
                "day_name": "Monday",
                "is_working_day": True,
                "periods": [
                    {"name": "Day Shift", "type": "work", "start_time": "07:00", "end_time": "15:00", "min_staff": 2, "target_staff": 3, "max_staff": 4},
                    {"name": "Handover", "type": "break", "start_time": "15:00", "end_time": "15:30", "min_staff": 0, "target_staff": 0, "max_staff": 0},
                    {"name": "Night Shift", "type": "work", "start_time": "15:30", "end_time": "23:30", "min_staff": 2, "target_staff": 2, "max_staff": 3}
                ]
            },
            "1": {
                "day_name": "Tuesday",
                "is_working_day": True,
                "periods": [
                    {"name": "Day Shift", "type": "work", "start_time": "07:00", "end_time": "15:00", "min_staff": 2, "target_staff": 3, "max_staff": 4}
                ]
            }
        },
        "settings_json": {
            "overtime_allowed": True,
            "max_weekly_hours": 48,
            "auto_approve_replacements": False
        }
    }
    response = client.post("/api/organizations/setup", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == f"Metro General Hospital {unique_suffix}"
    assert data["type"] == "hospital"
    new_org_id = data["id"]

    # Verify departments created
    depts_resp = client.get(f"/api/organizations/{new_org_id}/departments")
    assert depts_resp.status_code == 200
    depts = depts_resp.json()
    assert len(depts) == 3
    dept_names = [d["name"] for d in depts]
    assert "Emergency Dept (ED)" in dept_names

    # Verify initial schedule and slots created
    sched_resp = client.get(f"/api/schedules?org_id={new_org_id}")
    assert sched_resp.status_code == 200
    schedules = sched_resp.json()
    assert len(schedules) >= 1

def test_data_import_csv_and_commit():
    """
    Test uploading a CSV string, previewing column detection, and committing the records.
    """
    unique_id = int(datetime.datetime.now().timestamp() * 1000)
    target_name = f"Dr. Gregory House {unique_id}"
    csv_str = (
        f"Name,Email,Employee Code,Role,Department,Skills,Qualifications,Phone,Weekly Hours Limit\n"
        f"{target_name},house_{unique_id}@metro.org,DOC-{unique_id},Diagnostician,Intensive Care Unit (ICU),\"Diagnostics, Nephrology, Pathology\",\"MD, Board Certified\",+1-555-9001,40\n"
        f"Dr. Allison Cameron {unique_id},cameron_{unique_id}@metro.org,DOC-{unique_id+1},Immunologist,Intensive Care Unit (ICU),\"Immunology, Critical Care, Triage\",\"MD\",+1-555-9002,36\n"
    )
    csv_bytes = csv_str.encode("utf-8")

    # 1. Preview
    files = {"file": ("staff_import.csv", csv_bytes, "text/csv")}
    preview_resp = client.post("/api/data-import/preview", data={"org_id": 1}, files=files)
    assert preview_resp.status_code == 200
    p_data = preview_resp.json()
    assert p_data["total_rows"] == 2
    assert p_data["valid_rows"] == 2
    assert len(p_data["column_mapping"]) >= 5

    # 2. Commit records
    records_to_commit = p_data["full_records"]
    commit_payload = {
        "org_id": 1,
        "records": records_to_commit
    }
    commit_resp = client.post("/api/data-import/commit", json=commit_payload)
    assert commit_resp.status_code == 200
    c_data = commit_resp.json()
    assert c_data["imported_count"] == 2

    # 3. Verify in profiles
    prof_resp = client.get("/api/profiles?org_id=1")
    assert prof_resp.status_code == 200
    names = [p["name"] for p in prof_resp.json()]
    assert target_name in names

def test_schedule_pre_publish_validation():
    """
    Test the pre-publish checklist validation for existing schedule.
    """
    sched_resp = client.get("/api/schedules?org_id=1")
    assert sched_resp.status_code == 200
    schedules = sched_resp.json()
    assert len(schedules) > 0
    sched_id = schedules[0]["id"]

    check_resp = client.get(f"/api/schedules/{sched_id}/pre-publish-check")
    assert check_resp.status_code == 200
    data = check_resp.json()
    assert "coverage_rate" in data
    assert "total_work_slots" in data
    assert "unfilled_count" in data
    assert "conflicts" in data
    assert "can_publish" in data

def test_schedule_version_snapshot_and_rollback():
    """
    Test version history retrieval and rollback to an earlier version.
    """
    sched_resp = client.get("/api/schedules?org_id=1")
    schedules = sched_resp.json()
    sched_id = schedules[0]["id"]

    # Check versions across schedules or commit
    versions = client.get(f"/api/history/versions/{sched_id}").json()
    if not versions:
        for s in schedules:
            check_v = client.get(f"/api/history/versions/{s['id']}").json()
            if check_v:
                sched_id = s["id"]
                versions = check_v
                break
        if not versions:
            commit_payload = {
                "schedule_id": sched_id,
                "org_id": 1,
                "period_start": "2026-10-19",
                "period_end": "2026-10-23",
                "assignments": []
            }
            client.post("/api/schedules/glixon-commit", json=commit_payload)
            versions = client.get(f"/api/history/versions/{sched_id}").json()

    assert len(versions) >= 1

    target_v = versions[0]
    rollback_resp = client.post(f"/api/history/rollback/{target_v['id']}")
    assert rollback_resp.status_code == 200
    rb_data = rollback_resp.json()
    assert rb_data["success"] is True
    assert rb_data["new_version"] > target_v["version_number"]

def test_shift_swap_exchange():
    """
    Test creating a shift swap between two staff members and approving it.
    """
    db = SessionLocal()
    try:
        assigns = db.query(Assignment).filter(Assignment.person_id.isnot(None)).limit(2).all()
        assert len(assigns) >= 2
        a1, a2 = assigns[0], assigns[1]
        p1_id, p2_id = a1.person_id, a2.person_id

        # 1. Create swap request
        swap_payload = {
            "org_id": 1,
            "requester_id": p1_id,
            "requester_assignment_id": a1.id,
            "target_person_id": p2_id,
            "target_assignment_id": a2.id,
            "reason": "Personal family engagement on scheduled slot"
        }
        create_resp = client.post("/api/replacements/swaps", json=swap_payload)
        assert create_resp.status_code == 200
        swap_obj = create_resp.json()
        swap_id = swap_obj["id"]

        # 2. List active swaps
        list_resp = client.get("/api/replacements/swaps?org_id=1")
        assert list_resp.status_code == 200
        swaps = list_resp.json()
        assert any(s["id"] == swap_id for s in swaps)

        # 3. Approve swap
        app_resp = client.post(f"/api/replacements/swaps/{swap_id}/approve")
        assert app_resp.status_code == 200
        assert app_resp.json()["success"] is True

        # 4. Check that assignments exchanged persons
        db.refresh(a1)
        db.refresh(a2)
        assert a1.person_id == p2_id
        assert a2.person_id == p1_id
        assert a1.is_replacement is True
        assert a2.is_replacement is True
    finally:
        db.close()

