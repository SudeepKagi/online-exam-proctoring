# Functional Specification (Source of Truth)

## 1. Roles & Access Control
- **`student`:** Authenticate, view assigned exams on a light dashboard (`#fbfcfd` canvas with `#edecfb` exam cards), start an active exam within its window, answer questions with real-time autosave and offline fallback, submit once, and view released scores.
- **`teacher`:** Create/edit exams, define start/end windows and duration, configure question types (single-choice, multi-select with partial credit, negative marking), publish exams, and inspect student attempts/scores.
- **`admin`:** Manage user accounts, assign roles, view audit logs and system health metrics.

## 2. Five Core End-to-End Flows
1. **Student Exam Happy Path:** `Login -> Student Dashboard -> Start Exam -> Answer Questions -> Submit Exam -> View Result Summary`
2. **Mid-Exam Resilience (Refresh & Offline Drop):** `Start Exam -> Answer Q1-Q3 -> Simulate Offline / Page Reload -> Verify Answers & Server Timer Restored -> Reconnect & Sync -> Submit`
3. **Server-Side Expiration Auto-Submit:** `Start Exam -> Answer Q1 -> Close Tab -> Server Clock Passes expiresAt -> Background Worker Auto-Submits & Grades -> Student Logs In & Views Auto-Submitted Score`
4. **Teacher Exam Creation & Grading Verification:** `Teacher Login -> Create Exam (with Partial + Negative Marking) -> Publish -> Student Submits -> Teacher Views Breakdown`
5. **Security & Boundary Enforcement:** `Block Early/Late Exam Start (403) -> Block 2nd Attempt (409) -> Block Double Submit (Idempotent 200) -> Block Answer Key Leakage -> Block Student Accessing Teacher Routes (403)`
