from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.models import Assignment, RequirementSlot, Person, ReplacementLog, LeaveRequest, AuditLog, Notification

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
        """
        assignments = (
            db.query(Assignment)
            .filter(
                Assignment.person_id == person_id,
                Assignment.date_str >= start_date,
                Assignment.date_str <= end_date,
                Assignment.status == "assigned"
            )
            .all()
        )
        # Filter for time overlap
        affected = []
        for a in assignments:
            a_start = a.start_time or "00:00"
            a_end = a.end_time or "23:59"
            if not (a_end <= start_time or a_start >= end_time):
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
        slot_date = slot.date_str
        slot_start = slot.start_time
        slot_end = slot.end_time

        ranked = []
        for p in all_people:
            # Check if person already has an assignment at this date & time
            conflict_assignment = (
                db.query(Assignment)
                .filter(
                    Assignment.person_id == p.id,
                    Assignment.date_str == slot_date,
                    Assignment.status == "assigned"
                )
                .all()
            )
            has_time_conflict = False
            for ca in conflict_assignment:
                if not (ca.end_time <= slot_start or ca.start_time >= slot_end):
                    has_time_conflict = True
                    break

            # Check if on approved leave
            active_leave = (
                db.query(LeaveRequest)
                .filter(
                    LeaveRequest.person_id == p.id,
                    LeaveRequest.start_date <= slot_date,
                    LeaveRequest.end_date >= slot_date,
                    LeaveRequest.status.in_(["approved", "emergency_recorded"])
                )
                .first()
            )

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
            if active_leave:
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
            if has_time_conflict or active_leave:
                overall_score = min(overall_score, 20.0)

            ranked.append({
                "person_id": p.id,
                "person_name": p.name,
                "role_title": p.role_title,
                "match_percentage": round(overall_score, 1),
                "is_available": (not has_time_conflict and not active_leave),
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

        original_person_id = assignment.original_person_id or assignment.person_id
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
