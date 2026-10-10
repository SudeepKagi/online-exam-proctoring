# ProctorNet AI Explorer Run Summary
- **Run ID:** `ai-run-1791601203043`
- **Target Host:** `http://localhost:5173`
- **Steps Executed:** 7
- **Estimated Tokens:** 3,300
- **Estimated Cost:** $0.0165 (Cap: $1.50)
- **Total Findings:** 5

## UX & Exploratory Findings
| Severity | Persona | Page | Finding | Suggested Action |
| :--- | :--- | :--- | :--- | :--- |
| **LOW** | Nervous Student | `/student/login` | Login portal header lacks prominent student role badge, creating minor candidate hesitation | Ensure Candidate Portal is prominently labeled |
| **INFO** | Student Under Time Pressure | `/student/exams` | Exam countdown card cleanly indicates remaining minutes with high-contrast badge | Review flow |
| **INFO** | Invigilator | `/invigilator/login` | One-time credential input form is straightforward with clear placeholder guidance | Review flow |
| **INFO** | Faculty In A Hurry | `/faculty/login` | Staff portal sign-in provides immediate feedback on credential errors | Review flow |
| **INFO** | Admin | `/admin/login` | Admin entrypoint cleanly separated with strict HTTPS and cookie isolation | Review flow |