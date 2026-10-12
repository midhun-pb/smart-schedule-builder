import pytest
import datetime
from app.core.time_utils import (
    calculate_shift_duration_minutes,
    calculate_shift_duration_hours,
    is_overnight_shift,
    is_valid_shift_time,
    get_slot_datetime_interval,
    is_overlapping_interval,
    check_rest_period_violation
)

def test_daytime_shift_durations():
    # 9 AM to 5 PM
    assert calculate_shift_duration_minutes("09:00", "17:00") == 480
    assert calculate_shift_duration_hours("09:00", "17:00") == 8.0
    assert not is_overnight_shift("09:00", "17:00")

    # Half hour shift
    assert calculate_shift_duration_minutes("10:00", "10:30") == 30
    assert calculate_shift_duration_hours("10:00", "10:30") == 0.5

    # Morning to afternoon
    assert calculate_shift_duration_minutes("07:00", "15:00") == 480

def test_overnight_shift_durations():
    # 11 PM to 7 AM (8 hours overnight)
    assert calculate_shift_duration_minutes("23:00", "07:00") == 480
    assert calculate_shift_duration_hours("23:00", "07:00") == 8.0
    assert is_overnight_shift("23:00", "07:00")

    # 10 PM to 6 AM (8 hours overnight)
    assert calculate_shift_duration_minutes("22:00", "06:00") == 480
    assert calculate_shift_duration_hours("22:00", "06:00") == 8.0
    assert is_overnight_shift("22:00", "06:00")

    # 8 PM to 2 AM (6 hours overnight)
    assert calculate_shift_duration_minutes("20:00", "02:00") == 360
    assert calculate_shift_duration_hours("20:00", "02:00") == 6.0
    assert is_overnight_shift("20:00", "02:00")

    # Late night to morning
    assert calculate_shift_duration_minutes("23:30", "08:00") == 510
    assert calculate_shift_duration_hours("23:30", "08:00") == 8.5

def test_shift_validation():
    # Valid daytime
    valid, _ = is_valid_shift_time("09:00", "17:00")
    assert valid

    # Valid overnight
    valid, _ = is_valid_shift_time("23:00", "07:00")
    assert valid

    # Invalid: same start and end
    valid, msg = is_valid_shift_time("09:00", "09:00")
    assert not valid
    assert "identical" in msg

def test_overnight_crossing_weekdays_and_months():
    # Crossing from Monday (Oct 12) to Tuesday (Oct 13)
    start_dt, end_dt, dur = get_slot_datetime_interval("2026-10-12", "23:00", "07:00")
    assert start_dt == datetime.datetime(2026, 10, 12, 23, 0)
    assert end_dt == datetime.datetime(2026, 10, 13, 7, 0)
    assert dur == 480

    # Crossing month boundary: Oct 31 to Nov 1
    start_dt, end_dt, dur = get_slot_datetime_interval("2026-10-31", "22:00", "06:00")
    assert start_dt == datetime.datetime(2026, 10, 31, 22, 0)
    assert end_dt == datetime.datetime(2026, 11, 1, 6, 0)
    assert dur == 480

    # Crossing year boundary: Dec 31 to Jan 1
    start_dt, end_dt, dur = get_slot_datetime_interval("2026-12-31", "21:00", "05:00")
    assert start_dt == datetime.datetime(2026, 12, 31, 21, 0)
    assert end_dt == datetime.datetime(2027, 1, 1, 5, 0)
    assert dur == 480

def test_overlap_detection_with_overnight_shifts():
    # Shift 1: Monday Oct 12, 23:00 to Tuesday Oct 13, 07:00
    s1_start, s1_end, _ = get_slot_datetime_interval("2026-10-12", "23:00", "07:00")

    # Shift 2: Tuesday Oct 13, 06:00 to 14:00 (Overlaps 06:00 - 07:00)
    s2_start, s2_end, _ = get_slot_datetime_interval("2026-10-13", "06:00", "14:00")
    assert is_overlapping_interval(s1_start, s1_end, s2_start, s2_end)

    # Shift 3: Tuesday Oct 13, 07:00 to 15:00 (Back-to-back, does NOT overlap)
    s3_start, s3_end, _ = get_slot_datetime_interval("2026-10-13", "07:00", "15:00")
    assert not is_overlapping_interval(s1_start, s1_end, s3_start, s3_end)

    # Shift 4: Monday Oct 12, 15:00 to 23:00 (Back-to-back before, does NOT overlap)
    s4_start, s4_end, _ = get_slot_datetime_interval("2026-10-12", "15:00", "23:00")
    assert not is_overlapping_interval(s1_start, s1_end, s4_start, s4_end)

    # Shift 5: Monday Oct 12, 22:00 to Tuesday Oct 13, 06:00 (Overlaps)
    s5_start, s5_end, _ = get_slot_datetime_interval("2026-10-12", "22:00", "06:00")
    assert is_overlapping_interval(s1_start, s1_end, s5_start, s5_end)

def test_rest_period_violation():
    # Shift ending at 07:00, next shift starting at 12:00 (5 hours rest < 8 hours min)
    end_dt = datetime.datetime(2026, 10, 13, 7, 0)
    start_dt = datetime.datetime(2026, 10, 13, 12, 0)
    is_violation, rest_hours = check_rest_period_violation(end_dt, start_dt, min_rest_hours=8.0)
    assert is_violation
    assert rest_hours == 5.0

    # Next shift starting at 16:00 (9 hours rest >= 8 hours min)
    start_dt_ok = datetime.datetime(2026, 10, 13, 16, 0)
    is_violation, rest_hours = check_rest_period_violation(end_dt, start_dt_ok, min_rest_hours=8.0)
    assert not is_violation
    assert rest_hours == 9.0
