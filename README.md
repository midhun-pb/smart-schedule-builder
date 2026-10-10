# Smart Schedule Builder 🗓️✨

A complete, production-grade full-stack web application designed with an **Apple-inspired Liquid Glass** UI aesthetic. Smart Schedule Builder provides constraint-based automated timetable optimization (using **Google OR-Tools CP-SAT**), natural language information retrieval (NLP/TF-IDF), full emergency absence & replacement lifecycles, and workload fairness distribution across 15 organization types.

---

## 🌟 Key Features

### 1. Apple Liquid Glass UI Design
- Three appearance modes:
  - **Light Glass**: White and frosted-white surfaces, silver borders, dark crisp typography.
  - **Dark Glass**: Black and graphite backgrounds, translucent panels, luminous text.
  - **Auto**: Follows the host device's appearance settings automatically.
- Touch **Haptic Feedback** integration with user preference toggles.
- Accessibility with `@media (prefers-reduced-motion)` respect and high contrast typography.
- Fully responsive across Desktop, Tablet, and Mobile devices (with mobile drawer and bottom navigation).

### 2. Multi-Profession Organizational Setup
- 15 Pre-configured Organization Presets + Custom Organization:
  - **College / University** (Semester timetables, faculty workload limits, theory vs lab capability)
  - **Company / Office** (Sprint squads, business hours, on-call rotations)
  - **Hospital / Healthcare** (24/7 ER/ICU shifts, doctor specialties, triage ratios)
  - **Factory / Manufacturing** (Assembly lines, machine maintenance, shift handovers)
  - **Airline / Aviation** (Flight crew pairing, FAA rest limits, pilot ratings)
  - **Railway / Transit**, **Hotel / Hospitality**, **Restaurant / Dining**, **Police**, **Fire Department**, **Logistics**, **Retail**, **Construction**, **IT / Project Team**, and **Custom**.
- Shared constraint satisfaction engine adapting configurable rules per profession.

### 3. Left Sidebar Modules
1. **Dashboard**: High-level operational metrics (Coverage %, Gini Fairness, Headcount, Issues), quick NLP search, active swaps alert banner, and upcoming timetable preview.
2. **Organization Setup**: Choose preset or create custom organizations with auto-provisioned departments, shift templates, and resources.
3. **Profiles**:
   - Filterable staff roster with verified skills, auto-inferred hidden skills, and qualifications.
   - Dynamic profession-specific profile forms (College teachers: semesters, theory/lab capability; Company staff: role, skills, shifts).
   - Real **Excel (.xlsx) and CSV import** with automatic column mapping, preview, duplicate detection, missing-field validation, and database persistence.
   - Real-time **Data Quality Score** (0–100%) audit.
4. **Schedule & Main Timetable**:
   - Day, Week, and Month timetable matrix views.
   - Filter by department, staff member, and room/lab.
   - **Show replacements directly in timetable** (e.g. `Anu → DBMS, 10–11 AM, Temporary Replacement`).
   - **Active Swaps panel at bottom-left of the timetable**.
   - Conflict warning badges.
   - Interactive manual assignment editor.
   - One-click timetable publication.
5. **Intelligent Search (IR/NLP)**:
   - Natural language queries (e.g. *"Find a DBMS teacher for S5 CSE on Monday at 10 AM"*).
   - Entity extraction: skills, dates, times, qualifications, experience, and semester.
   - TF-IDF vector similarity and hard/soft constraint candidate ranking with percentage scores, explanations, and rejection reasons.
6. **Swaps & Replacements**:
   - Active Swaps tracker with live status.
   - **Pending Returns**: Returning staff ready for restoration.
   - **7-Step Replacement Wizard**: (1) Identify affected slots → (2) Search qualified candidates → (3) Rank candidates → (4) Recommend best candidate → (5) Authorize → (6) Update timetable → (7) Record history log.
   - Safe Return-to-Work restoration with conflict verification.
   - Peer swap proposals and approvals.
7. **Availability & Leave Management**:
   - **My Availability Grid**: Regular working hours per weekday with preference levels (1=Avoid to 5=Strongly Prefer).
   - **Emergency Leave**: Promptly records emergency absences, notifies managers, flags affected slots, and triggers replacement search.
   - **Request a Day Off**: Planned leave submitted for review (not auto-approved).
   - **Return to Work**: Availability confirmation and safe restoration.
   - **Leave Approvals Table**: For managers to approve/reject requests.
8. **Skill Intelligence**:
   - Skill analysis (supply vs demand).
   - **Hidden Skills Matrix**: Domain co-occurrence inference with confidence scores (inferred skills kept distinct from verified qualifications).
   - Skill Gaps identification (critical shortages and single-points-of-failure).
   - Actionable training recommendations.
9. **Fairness & Workload**:
   - Gini coefficient equity gauge.
   - Individual workload distribution and variance charts.
   - Night and weekend shift balance.
   - Mathematical fairness explanations.
10. **Schedule Issues**:
    - Unfilled assignments detector with 1-click candidate search.
    - Double-booking overlap detector.
    - Leave collision alerts.
11. **Team Builder**:
    - Multi-role project squad assembler.
    - Complementary skill scoring and viability ratings.
12. **Analytics**:
    - Schedule coverage, active headcount, leave trends, replacement frequencies, and daily demand fulfillment.
13. **History & Rollback**:
    - Immutable schedule version snapshots.
    - 1-Click safe rollback to earlier versions.
    - Forensic audit log of system actions.
14. **Notifications**:
    - Persistent in-app notifications with category filters (Leave, Replacement, Schedule, System) and unread counts.
15. **Settings**:
    - OR-Tools constraint weights (Fairness, Preferences, Overtime).
    - Leave and swap approval policies.
    - Theme and haptic feedback controls.

---

## 🛠️ Technology Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0, SQLite.
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide React.
- **Optimization Solver**: Google OR-Tools CP-SAT (with intelligent greedy fallback).
- **Intelligent Search**: Scikit-Learn TF-IDF Vectorizer, Cosine Similarity, Regex NLP.
- **Data Processing**: Pandas, OpenPyXL.
- **Testing**: Pytest, HTTPX, FastAPI TestClient.

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 2. Setup Backend & Virtual Environment

```bash
cd smart-schedule-builder
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/macOS
source venv/bin/activate

pip install -r backend/requirements.txt
```

### 3. Build Frontend

```bash
cd frontend
npm install
npm run build
```

The built frontend assets in `frontend/dist` are automatically served by FastAPI on `http://localhost:8000`.

### 4. Run the Full-Stack Application

From the root directory:
```bash
venv\Scripts\python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

- **Web Application**: [http://localhost:8000](http://localhost:8000)
- **Interactive API Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

### 5. Running Automated Tests

```powershell
cd C:\Users\USER\.gemini\antigravity\scratch\smart-schedule-builder
.\venv\Scripts\pytest backend\tests -v
```

All 15 core workflow integration tests pass with 100% verification, covering:
- API health and production static mount
- 15 organization presets with customized rules & independent 7-day configuration
- Multi-profession profiles & data quality score
- Natural language TF-IDF / BM25 candidate search & ranking
- Google OR-Tools CP-SAT timetable generation
- Complete emergency leave, replacement recommendation, authorization, return-to-work, and original assignment restoration lifecycle
- Workload fairness & skill intelligence
- Multi-step hospital preset setup with custom shifts
- CSV spreadsheet import preview, validation, and database commit
- Pre-publish validation checklist (coverage, conflicts, and blocking)
- Schedule version snapshot and safe rollback
- Shift swap marketplace proposal and reciprocal exchange approval
- Holiday CRUD, verified preset loading, and CSV import/export
- Holiday scheduling constraint enforcement and pre-publish blocking


