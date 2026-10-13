import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.security import hash_password
from app.models.models import (
    Organization, Department, User, Person, Resource, ShiftTemplate,
    RequirementSlot, Schedule, Assignment, LeaveRequest, Notification, AuditLog, Holiday,
    ScheduleVersion, Subject, Semester, TeacherSubjectAssignment
)
from app.api import (
    auth, organizations, profiles, data_import, schedules, search,
    replacements, leave, intelligence, fairness, issues, team_builder,
    analytics, history, notifications, settings as api_settings, holidays
)
from app.services.scheduling_engine import SchedulingEngine
from app.services.skill_engine import SkillEngine

from sqlalchemy import text

# Safe schema migrations for existing SQLite database
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE requirement_slots ADD COLUMN subject_id INTEGER"))
        conn.commit()
except Exception:
    pass

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE subjects ADD COLUMN semester_id INTEGER"))
        conn.commit()
except Exception:
    pass

for col, col_t in [
    ("required_periods", "INTEGER DEFAULT 4"),
    ("allowed_working_days", "JSON"),
    ("preferred_periods", "JSON"),
    ("unavailable_periods", "JSON"),
    ("max_periods_per_day", "INTEGER DEFAULT 2"),
    ("assignment_status", "VARCHAR(50) DEFAULT 'active'"),
]:
    try:
        with engine.connect() as conn:
            conn.execute(text(f"ALTER TABLE teacher_subject_assignments ADD COLUMN {col} {col_t}"))
            conn.commit()
    except Exception:
        pass

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Full-stack Smart Schedule Builder API with Apple Liquid Glass aesthetic and real constraint optimization.",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(organizations.router, prefix=settings.API_V1_STR)
app.include_router(profiles.router, prefix=settings.API_V1_STR)
app.include_router(data_import.router, prefix=settings.API_V1_STR)
app.include_router(schedules.router, prefix=settings.API_V1_STR)
app.include_router(search.router, prefix=settings.API_V1_STR)
app.include_router(replacements.router, prefix=settings.API_V1_STR)
app.include_router(leave.router, prefix=settings.API_V1_STR)
app.include_router(intelligence.router, prefix=settings.API_V1_STR)
app.include_router(fairness.router, prefix=settings.API_V1_STR)
app.include_router(issues.router, prefix=settings.API_V1_STR)
app.include_router(team_builder.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(history.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(api_settings.router, prefix=settings.API_V1_STR)
app.include_router(holidays.router, prefix=settings.API_V1_STR)

from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
import os

@app.get("/api/health")
def api_health():
    return {
        "status": "online",
        "app": "Smart Schedule Builder API",
        "docs": "/docs",
        "version": "1.0.0"
    }

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))

class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as ex:
            if ex.status_code == 404:
                return await super().get_response("index.html", scope)
            raise ex
        if response.status_code == 404:
            return await super().get_response("index.html", scope)
        return response

if os.path.exists(frontend_dist):
    app.mount("/", SPAStaticFiles(directory=frontend_dist, html=True), name="static")
else:
    @app.get("/")
    def root():
        return {
            "status": "online",
            "app": "Smart Schedule Builder API",
            "docs": "/docs",
            "version": "1.0.0"
        }

def seed_database():
    """
    Seeds realistic sample organization data with teachers and company staff.
    """
    db = SessionLocal()
    try:
        if db.query(Organization).count() > 0:
            return

        # 1. Apex Institute of Technology (College)
        apex = Organization(
            name="Apex Institute of Technology",
            type="college",
            code="APEX-TECH",
            description="Leading engineering & technology university with semester timetables, theory/lab sections, and faculty research.",
            settings_json={
                "profession_label": "Faculty / Teacher",
                "overtime_allowed": True,
                "max_weekly_hours": 36,
                "auto_approve_replacements": False,
                "theme": "dark",
                "haptic_feedback_enabled": True,
                "working_days_schedule": organizations.get_default_working_days_schedule("college")
            }
        )
        db.add(apex)
        db.flush()

        # Departments
        dept_cse = Department(org_id=apex.id, name="Computer Science & Eng", code="CSE", description="Core computing and AI department")
        dept_ece = Department(org_id=apex.id, name="Electronics & Comm", code="ECE", description="Circuits and communications")
        dept_math = Department(org_id=apex.id, name="Applied Mathematics", code="MATH", description="Discrete structures and statistics")
        db.add_all([dept_cse, dept_ece, dept_math])
        db.flush()

        # Resources
        res_lh1 = Resource(org_id=apex.id, name="Lecture Hall 101", type="room", capacity=60, location="Building A, Floor 1")
        res_lh2 = Resource(org_id=apex.id, name="Lecture Hall 102", type="room", capacity=60, location="Building A, Floor 1")
        res_lab1 = Resource(org_id=apex.id, name="Systems Lab Alpha", type="lab", capacity=40, location="Building B, Floor 2")
        res_lab2 = Resource(org_id=apex.id, name="AI Research Lab", type="lab", capacity=30, location="Building B, Floor 3")
        db.add_all([res_lh1, res_lh2, res_lab1, res_lab2])
        db.flush()

        # Faculty Profiles
        faculty_data = [
            {
                "name": "Dr. Eleanor Vance",
                "email": "eleanor.vance@apex.edu",
                "phone": "+1-555-0192",
                "role_title": "Associate Professor",
                "employee_code": "FAC-101",
                "profession_type": "college",
                "department_id": dept_cse.id,
                "qualifications": ["M.Tech CSE", "Ph.D AI"],
                "skills": [
                    {"name": "DBMS", "level": "Expert", "verified": True, "years": 8.0},
                    {"name": "SQL", "level": "Expert", "verified": True, "years": 8.0},
                    {"name": "Python", "level": "Intermediate", "verified": True, "years": 4.0}
                ],
                "preferences": {"preferred_shifts": ["morning"], "avoid_days": []},
                "profession_metadata": {"semesters": ["S5", "S7"], "theory_lab": "both", "classes": ["CSE-A"]},
                "max_hours_per_week": 36.0,
                "data_quality_score": 98.0
            },
            {
                "name": "Prof. David K. Chen",
                "email": "david.chen@apex.edu",
                "phone": "+1-555-0172",
                "role_title": "Assistant Professor",
                "employee_code": "FAC-102",
                "profession_type": "college",
                "department_id": dept_cse.id,
                "qualifications": ["M.Tech CSE"],
                "skills": [
                    {"name": "Python", "level": "Expert", "verified": True, "years": 6.0},
                    {"name": "Machine Learning", "level": "Intermediate", "verified": True, "years": 3.0},
                    {"name": "Data Structures", "level": "Expert", "verified": True, "years": 5.0}
                ],
                "preferences": {"preferred_shifts": ["morning", "afternoon"], "avoid_days": []},
                "profession_metadata": {"semesters": ["S3", "S5"], "theory_lab": "both", "classes": ["CSE-B"]},
                "max_hours_per_week": 40.0,
                "data_quality_score": 96.0
            },
            {
                "name": "Dr. Anita Roy",
                "email": "anita.roy@apex.edu",
                "phone": "+1-555-0181",
                "role_title": "Professor",
                "employee_code": "FAC-103",
                "profession_type": "college",
                "department_id": dept_cse.id,
                "qualifications": ["Ph.D Networks", "M.Tech"],
                "skills": [
                    {"name": "Computer Networks", "level": "Expert", "verified": True, "years": 12.0},
                    {"name": "Operating Systems", "level": "Expert", "verified": True, "years": 10.0}
                ],
                "preferences": {"preferred_shifts": ["morning"], "avoid_days": [4]},
                "profession_metadata": {"semesters": ["S5"], "theory_lab": "theory", "classes": ["CSE-A", "CSE-B"]},
                "max_hours_per_week": 32.0,
                "data_quality_score": 95.0
            },
            {
                "name": "Marcus Thorne",
                "email": "marcus.t@apex.edu",
                "phone": "+1-555-0144",
                "role_title": "Lab Instructor",
                "employee_code": "FAC-104",
                "profession_type": "college",
                "department_id": dept_cse.id,
                "qualifications": ["B.Tech CSE"],
                "skills": [
                    {"name": "Python", "level": "Expert", "verified": True, "years": 5.0},
                    {"name": "DBMS", "level": "Intermediate", "verified": True, "years": 3.0},
                    {"name": "Data Structures", "level": "Intermediate", "verified": True, "years": 4.0}
                ],
                "preferences": {"preferred_shifts": ["afternoon"], "avoid_days": []},
                "profession_metadata": {"semesters": ["S3", "S5"], "theory_lab": "lab", "classes": ["CSE-A", "CSE-B"]},
                "max_hours_per_week": 40.0,
                "data_quality_score": 92.0
            },
            {
                "name": "Priya Nair",
                "email": "priya.nair@apex.edu",
                "phone": "+1-555-0163",
                "role_title": "Assistant Professor",
                "employee_code": "FAC-105",
                "profession_type": "college",
                "department_id": dept_cse.id,
                "qualifications": ["M.Tech CSE"],
                "skills": [
                    {"name": "DBMS", "level": "Expert", "verified": True, "years": 5.0},
                    {"name": "Web Tech", "level": "Intermediate", "verified": True, "years": 3.0},
                    {"name": "Cloud", "level": "Intermediate", "verified": True, "years": 2.0}
                ],
                "preferences": {"preferred_shifts": ["morning", "afternoon"], "avoid_days": []},
                "profession_metadata": {"semesters": ["S5"], "theory_lab": "both", "classes": ["CSE-B"]},
                "max_hours_per_week": 38.0,
                "data_quality_score": 94.0
            },
            {
                "name": "Dr. Rajesh Kumar",
                "email": "rajesh.kumar@apex.edu",
                "phone": "+1-555-0137",
                "role_title": "Professor & HOD",
                "employee_code": "FAC-106",
                "profession_type": "college",
                "department_id": dept_cse.id,
                "qualifications": ["Ph.D Algorithms", "M.Tech"],
                "skills": [
                    {"name": "Algorithms", "level": "Expert", "verified": True, "years": 15.0},
                    {"name": "Data Structures", "level": "Expert", "verified": True, "years": 14.0}
                ],
                "preferences": {"preferred_shifts": ["morning"], "avoid_days": []},
                "profession_metadata": {"semesters": ["S3", "S7"], "theory_lab": "theory", "classes": ["CSE-A"]},
                "max_hours_per_week": 30.0,
                "data_quality_score": 97.0
            }
        ]

        created_people = []
        for pdata in faculty_data:
            inferred = SkillEngine.infer_hidden_skills(pdata["skills"])
            person = Person(
                org_id=apex.id,
                department_id=pdata["department_id"],
                name=pdata["name"],
                email=pdata["email"],
                phone=pdata["phone"],
                role_title=pdata["role_title"],
                employee_code=pdata["employee_code"],
                profession_type=pdata["profession_type"],
                qualifications=pdata["qualifications"],
                skills=pdata["skills"],
                inferred_skills=inferred,
                preferences=pdata["preferences"],
                profession_metadata=pdata["profession_metadata"],
                max_hours_per_week=pdata["max_hours_per_week"],
                data_quality_score=pdata["data_quality_score"],
                status="active"
            )
            db.add(person)
            created_people.append(person)

        db.flush()

        # Seed Users
        admin_user = User(
            org_id=apex.id,
            email="admin@smartsched.io",
            full_name="Administrator",
            hashed_password=hash_password("admin123"),
            role="admin"
        )
        manager_user = User(
            org_id=apex.id,
            email="manager@smartsched.io",
            full_name="Academic Dean / Manager",
            hashed_password=hash_password("manager123"),
            role="manager"
        )
        eleanor_user = User(
            org_id=apex.id,
            email="eleanor@smartsched.io",
            full_name="Dr. Eleanor Vance",
            hashed_password=hash_password("faculty123"),
            role="employee",
            person_id=created_people[0].id
        )
        db.add_all([admin_user, manager_user, eleanor_user])
        db.flush()

        # Seed Schedule and Slots for upcoming week
        today = datetime.date.today()
        # Find next Monday
        start_date = today + datetime.timedelta(days=(7 - today.weekday()) % 7)
        end_date = start_date + datetime.timedelta(days=4)  # Friday

        schedule = Schedule(
            org_id=apex.id,
            title="Fall Semester CSE Master Timetable",
            period_start=start_date.strftime("%Y-%m-%d"),
            period_end=end_date.strftime("%Y-%m-%d"),
            status="published",
            version=1,
            fairness_score=94.2
        )
        db.add(schedule)
        db.flush()

        slot_defs = [
            ("DBMS Lecture (S5 CSE-A)", ["DBMS", "SQL"], ["M.Tech"], 0, "10:00", "11:30", res_lh1.id, {"subject": "DBMS", "semester": "S5", "class": "CSE-A", "lab": False}),
            ("Python Lab (S3 CSE-B)", ["Python"], ["B.Tech"], 0, "13:30", "15:30", res_lab1.id, {"subject": "Python", "semester": "S3", "class": "CSE-B", "lab": True}),
            ("Computer Networks (S5 CSE-B)", ["Computer Networks"], ["M.Tech"], 1, "11:30", "13:00", res_lh2.id, {"subject": "CN", "semester": "S5", "class": "CSE-B", "lab": False}),
            ("Algorithms (S3 CSE-A)", ["Algorithms"], ["M.Tech"], 1, "09:00", "10:30", res_lh1.id, {"subject": "Algorithms", "semester": "S3", "class": "CSE-A", "lab": False}),
            ("AI & Machine Learning (S7 CSE-A)", ["Python", "Machine Learning"], ["Ph.D"], 2, "14:00", "16:00", res_lab2.id, {"subject": "AI", "semester": "S7", "class": "CSE-A", "lab": True}),
            ("Operating Systems (S5 CSE-A)", ["Operating Systems"], ["M.Tech"], 3, "10:00", "11:30", res_lh1.id, {"subject": "OS", "semester": "S5", "class": "CSE-A", "lab": False}),
            ("Data Structures Theory (S3 CSE-A)", ["Data Structures"], ["M.Tech"], 4, "09:00", "10:30", res_lh2.id, {"subject": "DS", "semester": "S3", "class": "CSE-A", "lab": False}),
        ]

        slot_objects = []
        for title, sk, q, day_offset, st, et, rid, meta in slot_defs:
            cur_d = start_date + datetime.timedelta(days=day_offset)
            s_obj = RequirementSlot(
                org_id=apex.id,
                schedule_id=schedule.id,
                title=title,
                date_str=cur_d.strftime("%Y-%m-%d"),
                day_of_week=cur_d.weekday(),
                start_time=st,
                end_time=et,
                resource_id=rid,
                required_skills=sk,
                required_qualifications=q,
                profession_metadata=meta
            )
            db.add(s_obj)
            slot_objects.append(s_obj)

        db.flush()

        # Run OR-Tools solver on these slots
        slot_dicts = [
            {
                "id": s.id,
                "title": s.title,
                "date_str": s.date_str,
                "day_of_week": s.day_of_week,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "required_skills": s.required_skills,
                "required_qualifications": s.required_qualifications,
                "profession_metadata": s.profession_metadata
            }
            for s in slot_objects
        ]

        people_dicts = [
            {
                "id": p.id,
                "name": p.name,
                "skills": p.skills,
                "inferred_skills": p.inferred_skills,
                "qualifications": p.qualifications,
                "preferences": p.preferences,
                "profession_metadata": p.profession_metadata,
                "max_hours_per_week": p.max_hours_per_week
            }
            for p in created_people
        ]

        engine_inst = SchedulingEngine()
        sol = engine_inst.solve(slot_dicts, people_dicts, [])

        for a in sol["assignments"]:
            db.add(Assignment(
                schedule_id=schedule.id,
                slot_id=a["slot_id"],
                person_id=a["person_id"],
                original_person_id=a["person_id"],
                date_str=a["date_str"],
                start_time=a["start_time"],
                end_time=a["end_time"],
                status="assigned"
            ))

        schedule.fairness_score = sol["fairness_score"]
        schedule.total_assignments = len(sol["assignments"])

        # Seed initial ScheduleVersion snapshot (version 1)
        v1 = ScheduleVersion(
            org_id=apex.id,
            schedule_id=schedule.id,
            version_number=1,
            snapshot_json={
                "fairness_score": sol["fairness_score"],
                "total_assignments": len(sol["assignments"]),
                "assignments": [
                    {
                        "slot_id": a["slot_id"],
                        "person_id": a["person_id"],
                        "date_str": a["date_str"],
                        "start_time": a["start_time"],
                        "end_time": a["end_time"]
                    }
                    for a in sol["assignments"]
                ]
            },
            change_summary="Initial automated baseline generation with OR-Tools constraint satisfaction.",
            created_by="System"
        )
        db.add(v1)

        # Seed sample verified holidays
        h1 = Holiday(
            org_id=apex.id,
            name="Thanksgiving Holiday Recess",
            holiday_type="public",
            start_date="2026-11-26",
            end_date="2026-11-27",
            is_partial_day=False,
            essential_staffing_allowed=False,
            description="Official state public holiday. Classes and lectures suspended."
        )
        h2 = Holiday(
            org_id=apex.id,
            name="Winter Recess & Colloquium",
            holiday_type="organization",
            start_date="2026-12-24",
            end_date="2026-12-25",
            is_partial_day=False,
            essential_staffing_allowed=False,
            description="Institutional winter holiday period."
        )
        db.add_all([h1, h2])

        # Seed initial notification
        notif = Notification(
            org_id=apex.id,
            title="System Ready: Apex Institute Timetable Active",
            message="Fall Semester timetable initialized with 100% constraint satisfaction using OR-Tools.",
            category="schedule",
            link_url="/schedule"
        )
        db.add(notif)

        db.commit()
    finally:
        db.close()

def seed_subjects_if_needed():
    db = SessionLocal()
    try:
        colleges = db.query(Organization).filter(Organization.type.in_(["college", "university"])).all()
        for col in colleges:
            # 1. Seed Semesters if needed
            sem_data = [
                ("Semester 1", "S1", "2026-2027"),
                ("Semester 3", "S3", "2026-2027"),
                ("Semester 5", "S5", "2026-2027"),
                ("Semester 7", "S7", "2026-2027"),
            ]
            sem_map = {}
            for s_name, s_code, a_yr in sem_data:
                sem = db.query(Semester).filter(Semester.org_id == col.id, Semester.code == s_code).first()
                if not sem:
                    sem = Semester(
                        org_id=col.id,
                        name=s_name,
                        code=s_code,
                        academic_year=a_yr,
                        is_active=True
                    )
                    db.add(sem)
                    db.flush()
                sem_map[s_code] = sem.id
            db.commit()

            # 2. Seed Subjects if needed
            if db.query(Subject).filter(Subject.org_id == col.id).count() == 0:
                cse_dept = db.query(Department).filter(Department.org_id == col.id, Department.code == "CSE").first()
                c_id = cse_dept.id if cse_dept else None
                default_subs = [
                    ("Database Management Systems", "CS301", "S5", "CSE-A", 4.0, False, "Core relational databases, SQL, and normalization."),
                    ("Data Structures & Algorithms", "CS201", "S3", "CSE-A", 4.0, False, "Linear & non-linear structures, algorithmic complexity."),
                    ("Computer Networks", "CS302", "S5", "CSE-B", 4.0, False, "OSI stack, TCP/IP routing, network security."),
                    ("Artificial Intelligence & ML", "CS401", "S7", "CSE-A", 4.0, False, "Search heuristics, supervised learning, neural nets."),
                    ("Operating Systems", "CS303", "S5", "CSE-A", 4.0, False, "Kernel architectures, concurrency, memory paging."),
                    ("Python Programming Lab", "CS202L", "S3", "CSE-B", 2.0, True, "Hands-on scripting, data pipelines, automation."),
                    ("Database Systems Practical Lab", "CS304L", "S5", "CSE-A", 2.0, True, "Practical PostgreSQL query tuning and transactions.")
                ]
                for name, code, sem_code, cname, hrs, is_lab, desc in default_subs:
                    sub = Subject(
                        org_id=col.id,
                        department_id=c_id,
                        semester_id=sem_map.get(sem_code),
                        name=name,
                        code=code,
                        semester=sem_code,
                        class_name=cname,
                        required_hours_per_week=hrs,
                        is_lab=is_lab,
                        description=desc
                    )
                    db.add(sub)
                db.commit()

            # 3. Ensure all subjects have semester_id populated
            subs = db.query(Subject).filter(Subject.org_id == col.id).all()
            for s in subs:
                if not s.semester_id and s.semester in sem_map:
                    s.semester_id = sem_map[s.semester]
            db.commit()

            # 4. Seed TeacherSubjectAssignments if none exist
            if db.query(TeacherSubjectAssignment).filter(TeacherSubjectAssignment.org_id == col.id).count() == 0:
                people = {p.name: p for p in db.query(Person).filter(Person.org_id == col.id).all()}
                sub_dict = {s.name: s for s in subs}
                faculty_assignments = [
                    ("Dr. Eleanor Vance", "Database Management Systems", "S5", "CSE-A", 4.0),
                    ("Dr. Anita Roy", "Computer Networks", "S5", "CSE-B", 4.0),
                    ("Dr. Anita Roy", "Operating Systems", "S5", "CSE-A", 4.0),
                    ("Marcus Thorne", "Python Programming Lab", "S3", "CSE-B", 2.0),
                    ("Priya Nair", "Database Systems Practical Lab", "S5", "CSE-A", 2.0),
                    ("Dr. Rajesh Kumar", "Data Structures & Algorithms", "S3", "CSE-A", 4.0),
                ]
                for t_name, s_name, sem_code, cname, hrs in faculty_assignments:
                    t = people.get(t_name)
                    s = sub_dict.get(s_name)
                    if t and s:
                        tsa = TeacherSubjectAssignment(
                            org_id=col.id,
                            person_id=t.id,
                            subject_id=s.id,
                            department_id=s.department_id,
                            semester_id=s.semester_id,
                            semester=sem_code,
                            class_name=cname,
                            required_hours=hrs,
                            is_primary=True
                        )
                        db.add(tsa)
                db.commit()

            # 5. Link existing slots to subjects and populate metadata
            slots = db.query(RequirementSlot).filter(RequirementSlot.org_id == col.id).all()
            for sl in slots:
                if not sl.subject_id:
                    for s in subs:
                        if s.name.lower() in sl.title.lower() or (sl.profession_metadata and sl.profession_metadata.get("subject", "").lower() in s.name.lower()):
                            sl.subject_id = s.id
                            sl.department_id = s.department_id
                            meta = dict(sl.profession_metadata or {})
                            meta["subject"] = s.name
                            meta["semester"] = s.semester
                            meta["class"] = s.class_name
                            sl.profession_metadata = meta
                            break
            db.commit()
    finally:
        db.close()

# Run seed on application startup
@app.on_event("startup")
def on_startup():
    seed_database()
    seed_subjects_if_needed()
