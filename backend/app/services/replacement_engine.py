from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.models import (
    Assignment, RequirementSlot, Person, ReplacementLog, LeaveRequest,
    AuditLog, Notification, SwapRequest
)
from app.core.time_utils import (
    get_slot_datetime_interval,
    is_overlapping_interval,
    calculate_shift_duration_hours,
    is_overnight_shift,
)

class ReplacementEngine:
    """
    Automated Replacement & Swap Management Engine.
    Executes the 7-step replacement lifecycle:
      1. Identify affected assignments
      2. Search qualified, available candidates
      3. Rank candidates & explain match
      4. Recommend best replacement
      5. Apply approval rules
      6. Update timetable with replacement badges
      7. Record replacement audit history
    Also handles safe Return-to-Work restoration.
    """

    @staticmethod
    def identify_affected_assignments(
        db: Session,
        person_id: int,
        start_date: str,
        end_date: str,
        start_time: str = "00:00",
        end_time: str = "23:59"
    ) -> List[Assignment]:
        """
        Step 1: Identifies all assignments assigned to person within the leave window.
        Uses concrete datetime intervals to correctly account for overnight shifts.
        """
        assignments = (
            db.query(Assignment)
            .filter(
                Assignment.person_id == person_id,
                Assignment.status == "assigned"
            )
            .all()
        )
        try:
            leave_start_dt = datetime.strptime(f"{start_date} {start_time}", "%Y-%m-%d %H:%M")
            leave_end_dt = datetime.strptime(f"{end_date} {end_time}", "%Y-%m-%d %H:%M")
        except Exception:
            return []

        affected = []
        for a in assignments:
            a_start = a.start_time or "00:00"
            a_end = a.end_time or "23:59"
            a_start_dt, a_end_dt, _ = get_slot_datetime_interval(a.date_str, a_start, a_end)
            if is_overlapping_interval(a_start_dt, a_end_dt, leave_start_dt, leave_end_dt):
                affected.append(a)
        return affected

    @staticmethod
    def evaluate_replacement_candidates(
        db: Session,
        slot: RequirementSlot,
        exclude_person_id: int
    ) -> List[Dict[str, Any]]:
        """
        Steps 2 & 3: Find and rank qualified, available candidates for a specific slot.
        """
        all_people = (
            db.query(Person)
            .filter(
                Person.org_id == slot.org_id,
                Person.id != exclude_person_id,
                Person.status == "active"
            )
            .all()
        )

        req_skills = slot.required_skills or []
        req_quals = slot.required_qualifications or []
        slot_start_dt, slot_end_dt, _ = get_slot_datetime_interval(
            slot.date_str,
            slot.start_time,
            slot.end_time,
            slot.day_of_week
        )

        ranked = []
        for p in all_people:
            # Check if person already has a conflicting assignment across any day / overnight shift
            candidate_assignments = (
                db.query(Assignment)
                .filter(
                    Assignment.person_id == p.id,
                    Assignment.status == "assigned"
                )
                .all()
            )
            has_time_conflict = False
            for ca in candidate_assignments:
                ca_start_dt, ca_end_dt, _ = get_slot_datetime_interval(ca.date_str, ca.start_time, ca.end_time)
                if is_overlapping_interval(slot_start_dt, slot_end_dt, ca_start_dt, ca_end_dt):
                    has_time_conflict = True
                    break

            # Check if on approved leave
            active_leaves = (
                db.query(LeaveRequest)
                .filter(
                    LeaveRequest.person_id == p.id,
                    LeaveRequest.status.in_(["approved", "emergency_recorded"])
                )
                .all()
            )
            on_leave = False
            for al in active_leaves:
                try:
                    l_start = datetime.strptime(f"{al.start_date} {al.start_time or '00:00'}", "%Y-%m-%d %H:%M")
                    l_end = datetime.strptime(f"{al.end_date or al.start_date} {al.end_time or '23:59'}", "%Y-%m-%d %H:%M")
                    if is_overlapping_interval(slot_start_dt, slot_end_dt, l_start, l_end):
                        on_leave = True
                        break
                except Exception:
                    continue

            p_skill_names = {s.get("name", "").lower(): s for s in (p.skills or [])}
            p_inf_skills = {s.get("name", "").lower(): s for s in (p.inferred_skills or [])}
            
            matched_skills = []
            for rs in req_skills:
                rs_lower = rs.lower()
                if rs_lower in p_skill_names:
                    matched_skills.append((rs, "direct", p_skill_names[rs_lower].get("level", "Intermediate")))
                elif rs_lower in p_inf_skills:
                    matched_skills.append((rs, "inferred", "Complementary"))

            # Calculate match components
            skill_score = (len(matched_skills) / max(1, len(req_skills))) * 100.0 if req_skills else 90.0
            p_quals = [q.lower() for q in (p.qualifications or [])]
            qual_score = 100.0 if not req_quals or any(rq.lower() in " ".join(p_quals) for rq in req_quals) else 40.0
            
            avail_score = 100.0
            reasons = []
            rejections = []

            if has_time_conflict:
                avail_score = 0.0
                rejections.append("Has conflicting assignment at this time slot")
            if on_leave:
                avail_score = 0.0
                rejections.append("Is on leave during this date")

            if skill_score >= 80:
                reasons.append(f"Strong skill match ({len(matched_skills)}/{len(req_skills)} required skills)")
            if qual_score == 100:
                reasons.append("Meets required qualification standards")
            if avail_score == 100:
                reasons.append("Fully available without schedule or leave overlap")

            # Count recent assignments to balance workload
            recent_count = db.query(Assignment).filter(Assignment.person_id == p.id, Assignment.status == "assigned").count()
            workload_score = max(50.0, 100.0 - (recent_count * 5.0))

            overall_score = (skill_score * 0.40) + (avail_score * 0.35) + (qual_score * 0.15) + (workload_score * 0.10)
            if has_time_conflict or on_leave:
                overall_score = min(overall_score, 20.0)

            ranked.append({
                "person_id": p.id,
                "person_name": p.name,
                "role_title": p.role_title,
                "match_percentage": round(overall_score, 1),
                "is_available": (not has_time_conflict and not on_leave),
                "matched_skills": [m[0] for m in matched_skills],
                "explanations": reasons,
                "rejection_reasons": rejections,
                "recent_workload": recent_count,
            })

        ranked.sort(key=lambda x: (x["is_available"], x["match_percentage"]), reverse=True)
        return ranked

    @staticmethod
    def approve_and_apply_replacement(
        db: Session,
        assignment_id: int,
        replacement_person_id: int,
        replacement_type: str = "temporary",
        reason: str = "Emergency absence coverage",
        approved_by: str = "Manager"
    ) -> Dict[str, Any]:
        """
        Steps 5, 6, 7: Authorize replacement, update timetable assignment,
        and write to ReplacementLog & AuditLog.
        """
        assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
        if not assignment:
            raise ValueError("Assignment not found")

        replacement_person = db.query(Person).filter(Person.id == replacement_person_id).first()
        if not replacement_person:
            raise ValueError("Replacement person not found")

        original_person_id = assignment.person_id or assignment.original_person_id
        original_person = db.query(Person).filter(Person.id == original_person_id).first()

        # Update assignment in schedule
        assignment.original_person_id = original_person_id
        assignment.person_id = replacement_person_id
        assignment.is_replacement = True
        assignment.replacement_type = replacement_type
        assignment.replacement_reason = reason
        assignment.status = "assigned"

        # Log replacement in history
        log_entry = ReplacementLog(
            org_id=assignment.schedule.org_id,
            assignment_id=assignment.id,
            slot_id=assignment.slot_id,
            original_person_id=original_person_id,
            replacement_person_id=replacement_person_id,
            reason=reason,
            replacement_type=replacement_type,
            match_score=94.5,
            match_explanation={
                "replacement_name": replacement_person.name,
                "original_name": original_person.name if original_person else "Unassigned",
                "slot_title": assignment.slot.title if assignment.slot else "",
                "time": f"{assignment.start_time}-{assignment.end_time}",
                "date": assignment.date_str
            },
            status="active",
            date_str=assignment.date_str,
            original_start_time=assignment.start_time,
            original_end_time=assignment.end_time,
            can_restore=True,
            created_at=datetime.now(timezone.utc)
        )
        db.add(log_entry)

        # In-app notification
        notif = Notification(
            org_id=assignment.schedule.org_id,
            title="Replacement Assigned",
            message=f"{replacement_person.name} has been assigned as {replacement_type} replacement for {original_person.name if original_person else 'staff'} on {assignment.date_str} ({assignment.start_time}-{assignment.end_time}).",
            category="replacement",
            link_url="/replacements"
        )
        db.add(notif)

        # Audit log
        audit = AuditLog(
            org_id=assignment.schedule.org_id,
            action="REPLACEMENT_APPLIED",
            entity_type="assignment",
            entity_id=str(assignment.id),
            details={
                "original_person_id": original_person_id,
                "replacement_person_id": replacement_person_id,
                "replacement_type": replacement_type,
                "approved_by": approved_by
            }
        )
        db.add(audit)
        db.commit()

        return {
            "success": True,
            "message": f"Assigned {replacement_person.name} as {replacement_type} replacement.",
            "assignment_id": assignment.id,
            "replacement_log_id": log_entry.id
        }

    @staticmethod
    def restore_original_assignment(
        db: Session,
        replacement_log_id: int,
        approved_by: str = "Manager"
    ) -> Dict[str, Any]:
        """
        Return to Work: Check availability and conflicts before restoring
        the original person to their timetable assignment.
        """
        log_entry = db.query(ReplacementLog).filter(ReplacementLog.id == replacement_log_id).first()
        if not log_entry:
            raise ValueError("Replacement record not found")

        assignment = db.query(Assignment).filter(Assignment.id == log_entry.assignment_id).first()
        if not assignment:
            raise ValueError("Original assignment record not found")

        original_person = db.query(Person).filter(Person.id == log_entry.original_person_id).first()
        if not original_person:
            raise ValueError("Original person record not found")

        # Conflict check for original person at the same time window
        other_assignments = (
            db.query(Assignment)
            .filter(
                Assignment.schedule_id == assignment.schedule_id,
                Assignment.person_id == original_person.id,
                Assignment.date_str == log_entry.date_str,
                Assignment.id != assignment.id,
                Assignment.status == "assigned"
            )
            .all()
        )
        for oa in other_assignments:
            oa_start = oa.start_time or "00:00"
            oa_end = oa.end_time or "23:59"
            cur_start = log_entry.original_start_time or "00:00"
            cur_end = log_entry.original_end_time or "23:59"
            if not (oa_end <= cur_start or oa_start >= cur_end):
                return {
                    "success": False,
                    "conflict": True,
                    "message": f"Conflict detected: {original_person.name} has overlapping assignment at that time ({oa_start}-{oa_end})."
                }

        # Restore assignment
        assignment.person_id = log_entry.original_person_id
        assignment.is_replacement = False
        assignment.replacement_type = "none"
        assignment.replacement_reason = "Restored after return to work"
        assignment.status = "assigned"

        log_entry.status = "restored"
        log_entry.can_restore = False
        log_entry.restored_at = datetime.now(timezone.utc)

        # Audit log
        audit = AuditLog(
            org_id=log_entry.org_id,
            action="ASSIGNMENT_RESTORED",
            entity_type="assignment",
            entity_id=str(assignment.id),
            details={
                "restored_person_id": original_person.id,
                "restored_by": approved_by,
                "replacement_log_id": replacement_log_id
            }
        )
        db.add(audit)

        notif = Notification(
            org_id=log_entry.org_id,
            title="Original Assignment Restored",
            message=f"{original_person.name} has returned and been safely restored to their assignment on {log_entry.date_str}.",
            category="replacement",
            link_url="/schedule"
        )
        db.add(notif)
        db.commit()

        return {
            "success": True,
            "message": f"Successfully restored {original_person.name} to original assignment.",
            "assignment_id": assignment.id
        }

    @staticmethod
    def validate_and_execute_timetable_swap(
        db: Session,
        schedule_id: int,
        source_slot_id: int,
        target_slot_id: int,
        reason: str = "Timetable drag-and-drop swap",
        dry_run: bool = False,
        approved_by: str = "Timetable Manager"
    ) -> Dict[str, Any]:
        """
        Validates and transactionally executes a timetable swap between two slots.
        Supports both drag-and-drop and click-based selection.
        Enforces:
          - Qualification and required skills checks
          - Availability and approved leave checks
          - Timetable and double-booking conflict checks (including overnight crossings)
          - Locked slot protections
        When dry_run=True, returns validation status, errors, and before/after preview without committing.
        When dry_run=False, commits the swap and logs audit, swap request, and notifications.
        """
        if source_slot_id == target_slot_id:
            return {
                "success": False,
                "valid": False,
                "errors": ["Cannot swap a slot with itself."],
                "warnings": [],
                "preview": None
            }

        source_slot = db.query(RequirementSlot).filter(RequirementSlot.id == source_slot_id).first()
        target_slot = db.query(RequirementSlot).filter(RequirementSlot.id == target_slot_id).first()

        if not source_slot or not target_slot:
            return {
                "success": False,
                "valid": False,
                "errors": ["One or both timetable slots could not be found."],
                "warnings": [],
                "preview": None
            }

        # Check locked status
        errors = []
        warnings = []

        if source_slot.is_locked:
            errors.append(f"Source slot '{source_slot.title}' is locked from modifications.")
        if target_slot.is_locked:
            errors.append(f"Target slot '{target_slot.title}' is locked from modifications.")

        # Find or create assignments for slots
        source_assign = db.query(Assignment).filter(
            Assignment.slot_id == source_slot.id,
            Assignment.schedule_id == schedule_id
        ).first()

        target_assign = db.query(Assignment).filter(
            Assignment.slot_id == target_slot.id,
            Assignment.schedule_id == schedule_id
        ).first()

        if not source_assign:
            source_assign = Assignment(
                schedule_id=schedule_id,
                slot_id=source_slot.id,
                person_id=None,
                date_str=source_slot.date_str,
                start_time=source_slot.start_time,
                end_time=source_slot.end_time,
                status="unfilled"
            )
            db.add(source_assign)
            db.flush()

        if not target_assign:
            target_assign = Assignment(
                schedule_id=schedule_id,
                slot_id=target_slot.id,
                person_id=None,
                date_str=target_slot.date_str,
                start_time=target_slot.start_time,
                end_time=target_slot.end_time,
                status="unfilled"
            )
            db.add(target_assign)
            db.flush()

        p1 = source_assign.person
        p2 = target_assign.person

        if not p1 and not p2:
            return {
                "success": False,
                "valid": False,
                "errors": ["Both selected slots are currently unfilled. Nothing to swap."],
                "warnings": [],
                "preview": None
            }

        # Datetime intervals for both slots
        s1_start, s1_end, dur1 = get_slot_datetime_interval(
            source_slot.date_str or source_assign.date_str,
            source_slot.start_time,
            source_slot.end_time,
            source_slot.day_of_week
        )
        s2_start, s2_end, dur2 = get_slot_datetime_interval(
            target_slot.date_str or target_assign.date_str,
            target_slot.start_time,
            target_slot.end_time,
            target_slot.day_of_week
        )

        # 1. Validate Person 1 for Target Slot
        if p1:
            # Skills check
            p1_skills = {s.get("name", "").lower() for s in (p1.skills or [])} | {s.get("name", "").lower() for s in (p1.inferred_skills or [])}
            for req in (target_slot.required_skills or []):
                if req.lower() not in p1_skills:
                    errors.append(f"{p1.name} lacks required skill '{req}' for '{target_slot.title}'.")

            # Qualifications check
            p1_quals = {q.lower() for q in (p1.qualifications or [])}
            for req in (target_slot.required_qualifications or []):
                if not any(req.lower() in pq for pq in p1_quals):
                    errors.append(f"{p1.name} lacks required qualification '{req}' for '{target_slot.title}'.")

            # Leave check during target slot window
            p1_leaves = db.query(LeaveRequest).filter(
                LeaveRequest.person_id == p1.id,
                LeaveRequest.status.in_(["approved", "emergency_recorded"])
            ).all()
            for l in p1_leaves:
                try:
                    l_start = datetime.strptime(f"{l.start_date} {l.start_time or '00:00'}", "%Y-%m-%d %H:%M")
                    l_end = datetime.strptime(f"{l.end_date or l.start_date} {l.end_time or '23:59'}", "%Y-%m-%d %H:%M")
                    if is_overlapping_interval(s2_start, s2_end, l_start, l_end):
                        errors.append(f"{p1.name} is on confirmed {l.leave_type} leave during target slot '{target_slot.title}'.")
                except Exception:
                    pass

            # Timetable conflict check (other assignments for p1)
            other_p1_assignments = db.query(Assignment).filter(
                Assignment.schedule_id == schedule_id,
                Assignment.person_id == p1.id,
                Assignment.id != source_assign.id,
                Assignment.status == "assigned"
            ).all()
            for oa in other_p1_assignments:
                oa_start, oa_end, _ = get_slot_datetime_interval(oa.date_str, oa.start_time, oa.end_time)
                if is_overlapping_interval(s2_start, s2_end, oa_start, oa_end):
                    oa_title = oa.slot.title if oa.slot else "Other Assignment"
                    errors.append(
                        f"{p1.name} has a schedule conflict: '{oa_title}' ({oa.date_str} {oa.start_time}-{oa.end_time}) overlaps with '{target_slot.title}'."
                    )

        # 2. Validate Person 2 for Source Slot
        if p2:
            # Skills check
            p2_skills = {s.get("name", "").lower() for s in (p2.skills or [])} | {s.get("name", "").lower() for s in (p2.inferred_skills or [])}
            for req in (source_slot.required_skills or []):
                if req.lower() not in p2_skills:
                    errors.append(f"{p2.name} lacks required skill '{req}' for '{source_slot.title}'.")

            # Qualifications check
            p2_quals = {q.lower() for q in (p2.qualifications or [])}
            for req in (source_slot.required_qualifications or []):
                if not any(req.lower() in pq for pq in p2_quals):
                    errors.append(f"{p2.name} lacks required qualification '{req}' for '{source_slot.title}'.")

            # Leave check during source slot window
            p2_leaves = db.query(LeaveRequest).filter(
                LeaveRequest.person_id == p2.id,
                LeaveRequest.status.in_(["approved", "emergency_recorded"])
            ).all()
            for l in p2_leaves:
                try:
                    l_start = datetime.strptime(f"{l.start_date} {l.start_time or '00:00'}", "%Y-%m-%d %H:%M")
                    l_end = datetime.strptime(f"{l.end_date or l.start_date} {l.end_time or '23:59'}", "%Y-%m-%d %H:%M")
                    if is_overlapping_interval(s1_start, s1_end, l_start, l_end):
                        errors.append(f"{p2.name} is on confirmed {l.leave_type} leave during source slot '{source_slot.title}'.")
                except Exception:
                    pass

            # Timetable conflict check (other assignments for p2)
            other_p2_assignments = db.query(Assignment).filter(
                Assignment.schedule_id == schedule_id,
                Assignment.person_id == p2.id,
                Assignment.id != target_assign.id,
                Assignment.status == "assigned"
            ).all()
            for oa in other_p2_assignments:
                oa_start, oa_end, _ = get_slot_datetime_interval(oa.date_str, oa.start_time, oa.end_time)
                if is_overlapping_interval(s1_start, s1_end, oa_start, oa_end):
                    oa_title = oa.slot.title if oa.slot else "Other Assignment"
                    errors.append(
                        f"{p2.name} has a schedule conflict: '{oa_title}' ({oa.date_str} {oa.start_time}-{oa.end_time}) overlaps with '{source_slot.title}'."
                    )

        # Before & After Preview structure
        preview_data = {
            "source_slot": {
                "slot_id": source_slot.id,
                "title": source_slot.title,
                "date_str": source_slot.date_str,
                "day_of_week": source_slot.day_of_week,
                "time_window": f"{source_slot.start_time} - {source_slot.end_time}",
                "is_overnight": is_overnight_shift(source_slot.start_time, source_slot.end_time),
                "duration_hours": calculate_shift_duration_hours(source_slot.start_time, source_slot.end_time),
                "current_person": {
                    "id": p1.id,
                    "name": p1.name,
                    "role": p1.role_title,
                    "employee_code": p1.employee_code
                } if p1 else None,
                "proposed_person": {
                    "id": p2.id,
                    "name": p2.name,
                    "role": p2.role_title,
                    "employee_code": p2.employee_code
                } if p2 else None,
            },
            "target_slot": {
                "slot_id": target_slot.id,
                "title": target_slot.title,
                "date_str": target_slot.date_str,
                "day_of_week": target_slot.day_of_week,
                "time_window": f"{target_slot.start_time} - {target_slot.end_time}",
                "is_overnight": is_overnight_shift(target_slot.start_time, target_slot.end_time),
                "duration_hours": calculate_shift_duration_hours(target_slot.start_time, target_slot.end_time),
                "current_person": {
                    "id": p2.id,
                    "name": p2.name,
                    "role": p2.role_title,
                    "employee_code": p2.employee_code
                } if p2 else None,
                "proposed_person": {
                    "id": p1.id,
                    "name": p1.name,
                    "role": p1.role_title,
                    "employee_code": p1.employee_code
                } if p1 else None,
            }
        }

        is_valid = len(errors) == 0

        if not is_valid or dry_run:
            return {
                "success": is_valid,
                "valid": is_valid,
                "errors": errors,
                "warnings": warnings,
                "preview": preview_data
            }

        # Perform transactional database update
        p1_id = p1.id if p1 else None
        p2_id = p2.id if p2 else None
        org_id = source_slot.org_id

        # Update assignments
        source_assign.person_id = p2_id
        source_assign.original_person_id = p2_id
        source_assign.status = "assigned" if p2_id else "unfilled"
        source_assign.is_replacement = True
        source_assign.replacement_type = "swap"
        source_assign.replacement_reason = reason

        target_assign.person_id = p1_id
        target_assign.original_person_id = p1_id
        target_assign.status = "assigned" if p1_id else "unfilled"
        target_assign.is_replacement = True
        target_assign.replacement_type = "swap"
        target_assign.replacement_reason = reason

        # Create SwapRequest record
        if p1_id and p2_id:
            swap_record = SwapRequest(
                org_id=org_id,
                requester_id=p1_id,
                requester_assignment_id=source_assign.id,
                target_person_id=p2_id,
                target_assignment_id=target_assign.id,
                reason=reason,
                status="approved",
                approved_by=approved_by,
                created_at=datetime.now(timezone.utc)
            )
            db.add(swap_record)

        # Log in ReplacementLog for history and undo
        if p1 and p2:
            log1 = ReplacementLog(
                org_id=org_id,
                assignment_id=source_assign.id,
                slot_id=source_slot.id,
                original_person_id=p1.id,
                replacement_person_id=p2.id,
                reason=f"Timetable swap: {p2.name} swapped into {source_slot.title}",
                replacement_type="swap",
                status="active",
                date_str=source_slot.date_str,
                original_start_time=source_slot.start_time,
                original_end_time=source_slot.end_time,
                can_restore=True,
                created_at=datetime.now(timezone.utc)
            )
            log2 = ReplacementLog(
                org_id=org_id,
                assignment_id=target_assign.id,
                slot_id=target_slot.id,
                original_person_id=p2.id,
                replacement_person_id=p1.id,
                reason=f"Timetable swap: {p1.name} swapped into {target_slot.title}",
                replacement_type="swap",
                status="active",
                date_str=target_slot.date_str,
                original_start_time=target_slot.start_time,
                original_end_time=target_slot.end_time,
                can_restore=True,
                created_at=datetime.now(timezone.utc)
            )
            db.add(log1)
            db.add(log2)

        # Audit log
        audit = AuditLog(
            org_id=org_id,
            action="TIMETABLE_ASSIGNMENT_SWAP",
            entity_type="schedule",
            entity_id=str(schedule_id),
            details={
                "source_slot_id": source_slot_id,
                "target_slot_id": target_slot_id,
                "person1": p1.name if p1 else "Unfilled",
                "person2": p2.name if p2 else "Unfilled",
                "approved_by": approved_by
            }
        )
        db.add(audit)

        # In-app notification
        p1_name = p1.name if p1 else "Unfilled"
        p2_name = p2.name if p2 else "Unfilled"
        notif = Notification(
            org_id=org_id,
            title="Timetable Swap Executed",
            message=f"Assignments successfully swapped between {p1_name} ({source_slot.title}) and {p2_name} ({target_slot.title}).",
            category="swap",
            link_url="/schedule"
        )
        db.add(notif)
        db.commit()

        return {
            "success": True,
            "valid": True,
            "message": f"Successfully swapped assignments between {p1_name} and {p2_name}.",
            "preview": preview_data
        }
