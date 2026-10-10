# Project Status: Smart Schedule Builder 🗓️

## 1. Project Overview & Role
Built a production-grade full-stack Smart Schedule Builder application featuring:
- **Apple Liquid Glass UI**: Light Glass, Dark Glass, and Auto themes, frosted surfaces, elegant typography, responsive layouts.
- **15 Supported Organization Types**: College/University, Company/Office, Hospital, Factory, Airline, Railway, Hotel, Restaurant, Police, Fire Department, Transport/Logistics, Retail, Construction, IT/Project Team, and Custom Organization.
- **Independent 7-Day Configuration**: Independent Monday through Sunday schedule rules, configurable hours, periods, breaks, lunches, staffing, exceptions, and overnight shifts.
- **Complete Timetable & Dynamic Date Handling**: Day, Week, and Month views, plus Employee, Department, Resource, and Holiday views. Dynamic calculation of all dates (e.g., "Thursday, 1 October 2026", "Monday, 12 October 2026 – Sunday, 18 October 2026", "10 October 2026, 22:00 – 11 October 2026, 06:00").
- **Real Constraint Optimization**: Google OR-Tools CP-SAT scheduling engine respecting qualifications, verified skills, availability, leaves, breaks, working hours, and locked slots.
- **Intelligent Search (IR/NLP)**: Scikit-learn TF-IDF vectorizer and BM25-style keyword matching with detailed candidate scoring and rejection explanations.
- **End-to-End Leave & Emergency Absence Lifecycle**: Instant leave recording, overlapping slot detection, replacement ranking and recommendation, approval, timetable badge updates, Return-to-Work availability checks, and safe restoration.
- **Active Swaps & Replacements Panel**: Live panel located at the bottom-left of the timetable.
- **Holiday Management Module**: Public, regional, organizational, departmental, optional, recurring, multi-day, partial-day, emergency closure, and special working days. Pre-publish validation blocks unexempted holiday conflicts.
- **Publish Checklist & Version Snapshot / Rollback**: Pre-publish validation enforcing 0 conflicts, with snapshot creation and safe transactional rollback.
- **Relational Models & Security**: Relational schema in SQLite with clean PostgreSQL migration path, JWT authentication, and RBAC (Administrator, Manager, Employee).

---

## 2. Completed Modules & Files Changed
### Backend (`backend/`):
- `backend/app/models/models.py`: Relational models for `Organization`, `Department`, `User`, `Person`, `Resource`, `ShiftTemplate`, `RequirementSlot` (with `min_staff`, `target_staff`, `max_staff`, `slot_order`, `is_locked`, `period_type`), `Schedule`, `Assignment`, `LeaveRequest`, `ReplacementLog`, `SwapRequest`, `Holiday`, `HolidayException`, `ScheduleVersion`, `AuditLog`, `Notification`.
- `backend/app/core/database.py`, `backend/app/core/config.py`, `backend/app/core/security.py`: Database engine, settings, password hashing, and JWT tokens.
- `backend/app/services/scheduling_engine.py`: Google OR-Tools CP-SAT solver with hard constraints (no double booking, leave blocks, skill matching) and multi-objective soft constraints (fairness, preferences, overtime penalty).
- `backend/app/services/search_engine.py`: Scikit-learn TF-IDF vectorizer, entity extraction regex, cosine similarity, candidate scoring and explanation.
- `backend/app/services/replacement_engine.py`: 7-step emergency leave and replacement workflow, candidate ranking, and conflict-checked safe return-to-work restoration.
- `backend/app/services/skill_engine.py`: Domain skill inference, co-occurrence matrix, gap detection, and training recommendations.
- `backend/app/services/fairness_engine.py`: Gini coefficient calculation, workload variance, and equity distribution metrics.
- `backend/app/services/import_engine.py`: CSV/XLSX file ingestion, header mapping, validation, duplicate detection, and batch persistence.
- `backend/app/api/`:
  - `organizations.py`: 15 organization presets, 7-day configuration, departments, and resources.
  - `schedules.py`: Timetable generation, drag-drop assignment, pre-publish validation checklist, publishing, slot locking, and week copy.
  - `holidays.py`: Holiday CRUD, CSV import/export, impact analysis, exception authorization.
  - `leave.py`: Emergency leave submission, day-off requests, approvals, return-to-work handling.
  - `replacements.py`: Replacement recommendations, approvals, active swaps/replacements, and safe restoration.
  - `profiles.py`, `data_import.py`, `search.py`, `intelligence.py`, `fairness.py`, `issues.py`, `team_builder.py`, `analytics.py`, `history.py`, `notifications.py`, `settings.py`.
- `backend/app/main.py`: Lifespan database initialization, seed data with verified baseline schedule, version snapshot, holidays, notifications, and static mount.
- `backend/tests/`:
  - `test_workflow.py`: End-to-end tests covering presets, profiles, natural language search, OR-Tools generation, emergency leave lifecycle, fairness, CSV imports, pre-publish checks, version snapshots & rollback, and shift swaps.
  - `test_holidays.py`: Holiday CRUD, presets loading, CSV import/export, scheduling constraints, and pre-publish validation.

### Frontend (`frontend/`):
- `src/types/index.ts`: TypeScript contracts for all models including `TimetableSlot`, `Department`, `Holiday`, `HolidayException`, `Person`, `Resource`.
- `src/api/client.ts`: Typed API client handling auth, organizations, profiles, schedules, search, replacements, leave, holidays, and imports.
- `src/context/AppContext.tsx`: State management for active organization, user roles, toast notifications, unread counts, and Apple Liquid Glass theme modes (Light Glass, Dark Glass, Auto with dynamic system preference listener).
- `src/components/common/Header.tsx`, `Sidebar.tsx`, `ToastContainer.tsx`: Apple-inspired navigation, role switcher, organization selector, theme toggle, and notification bell.
- `src/components/modules/`:
  - `ScheduleModule.tsx`: Fully interactive Day, Week, and Month views, plus Employee, Department, Resource, and Holiday views. Month calendar with leap year handling, prev/next/today navigation, complete dates formatting, overnight shift detection, drag-and-drop staff palette, slot lock toggles, manual slot editor, OR-Tools generator modal with selective day controls, pre-publish checklist modal, and Active Swaps & Replacements bottom-left panel.
  - `OrgSelectionModule.tsx`: Multi-step organization setup supporting 15 presets, independent 7-day schedule configuration, periods, breaks, lunches, min/target staffing, and copy-to-all-days feature.
  - `ProfilesModule.tsx`: Staff roster, verified skills vs inferred skills, qualifications, data quality score, and CSV/Excel import/export with preview.
  - `HolidayManagementModule.tsx`: Public, regional, emergency closure, and partial-day holidays, CSV/XLSX import/export, impact analysis, and staff clearance exception management.
  - `ReplacementsModule.tsx`: 7-step emergency leave replacement wizard, active replacements tracker, pending return-to-work queue, safe restoration, and swap requests.
  - `AvailabilityLeaveModule.tsx`: Availability preference matrix (avoid to prefer), emergency absence reporter, day-off review queue, and approval table.
  - `IntelligentSearchModule.tsx`: NLP search query bar, TF-IDF ranking, match percentage cards, verified qualification vs inferred skill distinction, and explanation modal.
  - `FairnessModule.tsx`: Gini coefficient fairness gauge, workload distribution charts, and night/weekend equity breakdown.
  - `IntelligenceModule.tsx`: Supply vs demand analysis, skill gap warnings, and training suggestions.
  - `ScheduleIssuesModule.tsx`: Unfilled slots, double booking collisions, and leave conflict audit with 1-click resolution.
  - `TeamBuilderModule.tsx`: Squad formation by skills, compatibility scoring, and project allocation.
  - `AnalyticsModule.tsx`: Schedule coverage metrics, active headcount, leave trends, and replacement frequencies.
  - `HistoryModule.tsx`: Schedule version snapshots, change diffs, 1-click safe rollback, and system audit logs.
  - `NotificationsModule.tsx`: Categorized notifications with unread counts and direct deep-links.
  - `SettingsModule.tsx`: Solver objective weight sliders, approval policy toggles, and appearance controls.

---

## 3. Test Verification Results
- **Backend Pytest Suite**: 15 / 15 tests PASSED (100% pass rate).
  ```
  backend/tests/test_holidays.py::test_holiday_crud_and_presets PASSED
  backend/tests/test_holidays.py::test_holiday_csv_import_and_export PASSED
  backend/tests/test_holidays.py::test_holiday_scheduling_constraint_and_prepublish_validation PASSED
  backend/tests/test_workflow.py::test_root_endpoint PASSED
  backend/tests/test_workflow.py::test_organizations_presets PASSED
  backend/tests/test_workflow.py::test_profiles_and_quality PASSED
  backend/tests/test_workflow.py::test_natural_language_search PASSED
  backend/tests/test_workflow.py::test_schedule_and_ortools_generation PASSED
  backend/tests/test_workflow.py::test_complete_emergency_leave_and_replacement_lifecycle PASSED
  backend/tests/test_workflow.py::test_fairness_and_intelligence PASSED
  backend/tests/test_workflow.py::test_organization_setup_hospital_preset PASSED
  backend/tests/test_workflow.py::test_data_import_csv_and_commit PASSED
  backend/tests/test_workflow.py::test_schedule_pre_publish_validation PASSED
  backend/tests/test_workflow.py::test_schedule_version_snapshot_and_rollback PASSED
  backend/tests/test_workflow.py::test_shift_swap_exchange PASSED
  ======================= 15 passed in 2.15s =======================
  ```
- **Frontend Production Build**: `npm.cmd run build` (tsc -b && vite build) executed cleanly with 0 errors.

---

## 4. Exact Windows Execution Commands
### Terminal 1: Backend Server (FastAPI)
```powershell
cd C:\Users\USER\.gemini\antigravity\scratch\smart-schedule-builder
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --app-dir backend
```

### Terminal 2: Frontend Server (Vite)
```powershell
cd C:\Users\USER\.gemini\antigravity\scratch\smart-schedule-builder\frontend
npm.cmd run dev
```

### Run Automated Test Suite
```powershell
cd C:\Users\USER\.gemini\antigravity\scratch\smart-schedule-builder
.\venv\Scripts\pytest backend\tests -v
```
