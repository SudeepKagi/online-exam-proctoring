# Security and Privacy Policy

This document describes how ProctorNet handles candidate data, identity photos, proctoring logs, and institutional course materials.

## Data Collected During Examinations

ProctorNet collects only data required to verify candidate identity and ensure examination fairness:

1. **Pre-Check Identity Photo**: A single live webcam photo captured during pre-exam verification to match against institutional records.
2. **Violation Snapshots**: Web camera and screen captures recorded only when an anomaly occurs, such as a tab switch or secondary person detection.
3. **Activity Logs**: Timestamps recording question navigation, answer auto-saving, browser focus loss, and submission events.
4. **Hardware Telemetry**: Diagnostic ratings for camera access, microphone feed, operating system family, and network latency.

Continuous unflagged video feeds are processed in memory and are not permanently saved.

## Course Material & AI Question Generation

Faculty members may upload course syllabus PDFs to generate examination questions.

- Uploaded PDF documents are processed by the configured AI provider (Google Gemini or OpenAI).
- The documents are used solely to extract text concepts and author draft questions.
- Course materials are never shared with third parties or used for external model training.

## Access Permissions and Privacy

Proctoring evidence and personal data are strictly isolated using role-based access control:

- **Students**: Can view their own exam results, submission scores, and registered profile details.
- **Faculty & Invigilators**: Can view telemetry logs, incident alerts, and photographic violation snapshots for assigned exams.
- **Administrators**: Can inspect audit logs and user status records for institutional oversight.

Student data is encrypted in transit using TLS and stored in access-controlled object storage.

## Data Retention and Automatic Purging

- Identity photos and violation snapshots are stored in private cloud storage.
- Storage policies retain examination media for a configurable academic audit window (typically 30 to 90 days).
- Background cleanup jobs purge expired evidence files and temporary telemetry logs permanently after the audit window closes.
