import datetime
from typing import Tuple, Optional, Dict, Any

def parse_time_to_minutes(time_str: str) -> int:
    """
    Parses a 'HH:MM' string into minutes from midnight (0..1439).
    """
    if not time_str:
        return 0
    try:
        parts = time_str.strip().split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return 0

def calculate_shift_duration_minutes(start_time: str, end_time: str) -> int:
    """
    Calculates duration in minutes between start_time (HH:MM) and end_time (HH:MM).
    If end_time <= start_time and start_time != end_time, the shift crosses midnight
    into the following calendar day.
    
    Examples:
      - '09:00' to '17:00' -> 480 min (8 hours)
      - '23:00' to '07:00' -> 480 min (8 hours overnight)
      - '22:00' to '06:00' -> 480 min (8 hours overnight)
      - '20:00' to '02:00' -> 360 min (6 hours overnight)
      - '00:00' to '08:00' -> 480 min (8 hours)
    """
    start_m = parse_time_to_minutes(start_time)
    end_m = parse_time_to_minutes(end_time)
    
    if start_m == end_m:
        return 0
    
    if end_m > start_m:
        return end_m - start_m
    else:
        # Crosses midnight into next day
        return (1440 - start_m) + end_m

def calculate_shift_duration_hours(start_time: str, end_time: str) -> float:
    """
    Returns duration in decimal hours (e.g. 8.0, 7.5).
    """
    return round(calculate_shift_duration_minutes(start_time, end_time) / 60.0, 2)

def is_overnight_shift(start_time: str, end_time: str) -> bool:
    """
    Returns True if the shift crosses midnight (start_time > end_time).
    """
    start_m = parse_time_to_minutes(start_time)
    end_m = parse_time_to_minutes(end_time)
    return start_m > end_m

def is_valid_shift_time(start_time: str, end_time: str) -> Tuple[bool, str]:
    """
    Validates shift times. Supports daytime, evening, and overnight shifts.
    The only invalid state is identical start and end times (zero duration).
    """
    if not start_time or not end_time:
        return False, "Start time and end time are required."
    start_m = parse_time_to_minutes(start_time)
    end_m = parse_time_to_minutes(end_time)
    if start_m == end_m:
        return False, "Start time and end time cannot be identical."
    return True, "Valid shift time."

def get_slot_datetime_interval(
    date_str: Optional[str],
    start_time: str,
    end_time: str,
    day_of_week: Optional[int] = None,
    reference_monday: Optional[datetime.date] = None
) -> Tuple[datetime.datetime, datetime.datetime, int]:
    """
    Constructs concrete start and end datetime instances for a slot.
    Handles shifts crossing midnight, weekdays, months, and years.
    Returns (start_dt, end_dt, duration_minutes).
    """
    dur_m = calculate_shift_duration_minutes(start_time, end_time)
    
    if date_str:
        try:
            start_d = datetime.datetime.strptime(date_str.strip(), "%Y-%m-%d").date()
        except Exception:
            start_d = datetime.date(2026, 10, 12)
    elif day_of_week is not None:
        ref_mon = reference_monday or datetime.date(2026, 10, 12)
        # reference_monday is Monday (day 0)
        start_d = ref_mon + datetime.timedelta(days=(day_of_week % 7))
    else:
        start_d = datetime.date(2026, 10, 12)
    
    start_h = int(start_time.split(":")[0]) if ":" in start_time else 0
    start_min = int(start_time.split(":")[1]) if ":" in start_time else 0
    start_dt = datetime.datetime(start_d.year, start_d.month, start_d.day, start_h, start_min)
    end_dt = start_dt + datetime.timedelta(minutes=dur_m)
    
    return start_dt, end_dt, dur_m

def is_overlapping_interval(
    start1: datetime.datetime,
    end1: datetime.datetime,
    start2: datetime.datetime,
    end2: datetime.datetime
) -> bool:
    """
    Checks if two datetime intervals strictly overlap:
    start1 < end2 AND start2 < end1.
    Back-to-back shifts (where end1 == start2) do NOT overlap.
    """
    return start1 < end2 and start2 < end1

def check_rest_period_violation(
    end_dt_earlier: datetime.datetime,
    start_dt_later: datetime.datetime,
    min_rest_hours: float = 8.0
) -> Tuple[bool, float]:
    """
    Checks if two consecutive shifts have enough rest time between them.
    Returns (is_violation, actual_rest_hours).
    """
    if start_dt_later < end_dt_earlier:
        return True, 0.0  # They overlap
    rest_seconds = (start_dt_later - end_dt_earlier).total_seconds()
    actual_hours = rest_seconds / 3600.0
    return actual_hours < min_rest_hours, round(actual_hours, 2)
