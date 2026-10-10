import io
import datetime
import pytest
from fastapi.testclient import TestClient
from app.main import app, seed_database
from app.models.models import Organization, Holiday, HolidayException, Schedule, RequirementSlot, Assignment, Person
from app.core.database import SessionLocal

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    seed_database()

def test_holiday_crud_and_presets():
    # 1. List verified presets
    presets_resp = client.get("/api/holidays/presets/list")
    assert presets_resp.status_code == 200
    presets = presets_resp.json()
    assert len(presets) >= 3
    preset_ids = [p["id"] for p in presets]
    assert "us_standard_2026" in preset_ids

    # 2. Load verified preset into org 1
    load_resp = client.post("/api/holidays/presets/load", json={"org_id": 1, "preset_id": "us_standard_2026"})
    assert load_resp.status_code == 200
    load_data = load_resp.json()
    assert load_data["success"] is True

    # 3. Create a custom emergency closure holiday
    closure_payload = {
        "org_id": 1,
        "name": "Severe Blizzard Emergency Campus Closure",
        "holiday_type": "emergency_closure",
        "start_date": "2026-11-05",
        "end_date": "2026-11-06",
        "is_partial_day": False,
        "essential_staffing_allowed": True,
        "authorized_roles": ["Facilities Lead", "Security Officer"]
    }
    create_resp = client.post("/api/holidays", json=closure_payload)
    assert create_resp.status_code == 200
    c_data = create_resp.json()
    assert c_data["success"] is True
    holiday_id = c_data["holiday"]["id"]

    # 4. Create partial-day holiday
    partial_payload = {
        "org_id": 1,
        "name": "Founders Day Colloquium (Afternoon Session)",
        "holiday_type": "organization",
        "start_date": "2026-11-12",
        "end_date": "2026-11-12",
        "is_partial_day": True,
        "partial_start_time": "13:00",
        "partial_end_time": "17:00",
        "essential_staffing_allowed": False
    }
    p_resp = client.post("/api/holidays", json=partial_payload)
    assert p_resp.status_code == 200
    p_holiday_id = p_resp.json()["holiday"]["id"]

    # 5. List holidays with filters
    list_resp = client.get("/api/holidays?org_id=1&holiday_type=emergency_closure")
    assert list_resp.status_code == 200
    closures = list_resp.json()
    assert any(h["id"] == holiday_id for h in closures)

    # 6. Update holiday
    update_resp = client.put(f"/api/holidays/{holiday_id}", json={"name": "Severe Winter Weather Campus Closure"})
    assert update_resp.status_code == 200
    assert update_resp.json()["holiday"]["name"] == "Severe Winter Weather Campus Closure"

    # 7. Authorize Exception
    db = SessionLocal()
    try:
        eleanor = db.query(Person).filter(Person.org_id == 1).first()
        assert eleanor is not None

        exc_resp = client.post(f"/api/holidays/{holiday_id}/exceptions", json={
            "org_id": 1,
            "holiday_id": holiday_id,
            "person_id": eleanor.id,
            "reason": "Authorized essential research facility supervision"
        })
        assert exc_resp.status_code == 200
        exc_data = exc_resp.json()
        assert exc_data["success"] is True
        exception_id = exc_data["exception"]["id"]

        # 8. Check Impact endpoint
        impact_resp = client.get("/api/holidays/impact?org_id=1")
        assert impact_resp.status_code == 200
        assert "total_holidays" in impact_resp.json()

        # 9. Delete Exception
        del_exc_resp = client.delete(f"/api/holidays/exceptions/{exception_id}")
        assert del_exc_resp.status_code == 200
    finally:
        db.close()

    # 10. Delete Holiday
    del_resp = client.delete(f"/api/holidays/{holiday_id}")
    assert del_resp.status_code == 200
    del_p_resp = client.delete(f"/api/holidays/{p_holiday_id}")
    assert del_p_resp.status_code == 200


def test_holiday_csv_import_and_export():
    unique_id = int(datetime.datetime.now().timestamp() * 1000)
    fest_name = f"State Heritage Festival {unique_id}"
    csv_data = (
        "Name,Type,Start Date,End Date,Partial Day,Partial Start Time,Partial End Time,Essential Staffing Allowed\n"
        f"{fest_name},regional,2026-11-18,2026-11-18,No,,,No\n"
        f"Winter Solstice Reading Day {unique_id},organization,2026-12-21,2026-12-21,No,,,No\n"
        f"Department Town Hall {unique_id},department_specific,2026-11-20,2026-11-20,Yes,14:00,16:00,No\n"
    )

    # 1. Preview Import
    files = {"file": ("test_holidays.csv", csv_data.encode("utf-8"), "text/csv")}
    data = {"org_id": 1}
    prev_resp = client.post("/api/holidays/import/preview", data=data, files=files)
    assert prev_resp.status_code == 200
    prev_json = prev_resp.json()
    assert prev_json["success"] is True
    assert prev_json["valid_rows"] == 3
    assert len(prev_json["preview"]) == 3

    # 2. Commit Import
    commit_payload = {
        "org_id": 1,
        "holidays": prev_json["preview"]
    }
    commit_resp = client.post("/api/holidays/import/commit", json=commit_payload)
    assert commit_resp.status_code == 200
    assert commit_resp.json()["imported_count"] == 3

    # 3. Export CSV
    export_resp = client.get("/api/holidays/export?org_id=1")
    assert export_resp.status_code == 200
    assert "text/csv" in export_resp.headers["content-type"]
    assert fest_name in export_resp.text


def test_holiday_scheduling_constraint_and_prepublish_validation():
    """
    Verifies that:
    1. Scheduling engine respects holiday restrictions
    2. Pre-publish validation blocks publication when holiday conflicts exist
    """
    db = SessionLocal()
    try:
        # Create a special working day and a mandatory holiday
        h_work = Holiday(
            org_id=1,
            name="Compensatory Special Working Day",
            holiday_type="special_working_day",
            start_date="2026-11-07",
            end_date="2026-11-07",
            is_partial_day=False,
            status="active"
        )
        h_block = Holiday(
            org_id=1,
            name="Compulsory System Closure",
            holiday_type="public",
            start_date="2026-11-09",
            end_date="2026-11-09",
            is_partial_day=False,
            essential_staffing_allowed=False,
            status="active"
        )
        db.add_all([h_work, h_block])
        db.commit()

        # Generate schedule for this period
        gen_payload = {
            "org_id": 1,
            "title": "Holiday Constraint Verification Schedule",
            "period_start": "2026-11-07",
            "period_end": "2026-11-10",
            "fairness_weight": 1.0,
            "preference_weight": 1.0,
            "overtime_penalty_weight": 1.0
        }
        gen_resp = client.post("/api/schedules/generate", json=gen_payload)
        assert gen_resp.status_code == 200
        sched_id = gen_resp.json()["schedule_id"]

        # Check pre-publish validation on this schedule
        val_resp = client.get(f"/api/schedules/{sched_id}/validate")
        assert val_resp.status_code == 200
        val_data = val_resp.json()
        assert "holiday_conflicts" in val_data
        assert "can_publish" in val_data

        # Cleanup
        db.delete(h_work)
        db.delete(h_block)
        db.commit()
    finally:
        db.close()
