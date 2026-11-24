# ProctorNet Architecture & Security Findings

- `startAttempt` has no assignment or eligibility check. The dashboard rule is a visibility filter, not access control. Revisit after SEB with faculty input.
- Dev `.env` points at a WSL IP (`172.24.171.5`) that changes on reboot. Note only.
- Commit `7a781db` was titled "fix: complete baseline test stabilization and isolation" but bundled multiple concerns together: a product security fix (`startAttempt` rejecting non-published exams with `403 EXAM_NOT_PUBLISHED`), a frontend UI text fix (`PreExamCheckPage.jsx` exam title fallback), and multiple test fixture adjustments. From now on, strictly adhere to one concern per conventional commit.

