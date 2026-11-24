# ProctorNet Documentation

Welcome to the ProctorNet documentation. This portal provides setup guides, architectural overviews, role manuals, and operational instructions.

## Documentation Overview

- [Getting Started](GETTING_STARTED.md): How to install prerequisites, configure environment variables, and run ProctorNet locally.
- [Architecture](ARCHITECTURE.md): System components, data models, real-time messaging, and high-level architectural design.
- [User Guide](USER_GUIDE.md): Feature walkthroughs and operational workflows for student, faculty, invigilator, and admin roles.
- [Secure Browser](SECURE_BROWSER.md): Overview, administrator setup, candidate pre-check, troubleshooting, and implementation status for Safe Exam Browser.
- [Deployment](DEPLOYMENT.md): Production server requirements, process orchestration, reverse proxy configuration, and deployment pipelines.
- [Testing](TESTING.md): Instructions for running unit tests, integration test suites, and Playwright end-to-end browser journeys.
- [Security and Privacy](SECURITY_AND_PRIVACY.md): Telemetry collection, biometric face matching policies, evidence storage, and audit log access rules.

## Glossary of Terms

- **Student**: An authenticated exam candidate who completes system diagnostics, verifies identity, and answers exam questions.
- **Faculty**: An academic educator who authors exams, manages question banks, configures scoring rules, and reviews submissions.
- **Invigilator**: A proctor who oversees examination sessions in real time and handles candidate malpractice warnings.
- **Admin**: An institutional administrator who manages user accounts, configures institutional policies, and monitors system health.
- **Secure Browser**: A specialized application that locks down the candidate computer to prevent external application usage during exams.
- **Exam Arena**: The student exam-taking view containing questions, options, bookmark controls, and an authoritative server countdown timer.
- **Pre-Check**: A mandatory diagnostic step where candidates test their camera, microphone, operating system, and biometric face match.
- **Invigilator Console**: A real-time web dashboard displaying live student webcam snapshots, connectivity indicators, and violation alerts.
- **Proctoring Telemetry**: Automated logs generated during exams, such as window blurs, tab switches, and camera anomalies.
- **Idempotent Submission**: An exam submission mechanism ensuring that rapid duplicate clicks do not produce duplicate grades or server errors.
