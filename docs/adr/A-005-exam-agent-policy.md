# ADR A-005: Granular Exam Policy Enforcement and Staff Waivers

## Status
Accepted

## Date
2026-10-07

## Context
Different examinations carry varying degrees of proctoring rigor. High-stakes final assessments require strict local OS process auditing, whereas low-stakes diagnostic quizzes or practice sessions may permit pure browser-based sandboxing. Additionally, in rare legitimate hardware scenarios (e.g. specialized accessibility tools triggering false flags or hardware anomalies), proctoring staff require an audited mechanism to waive agent requirements for individual candidates.

## Decision
1. **Exam Policy Configuration**:
   - Introduce `device_agent_policy` on `exams` table with three discrete values:
     - `REQUIRED`: Pre-exam check blocks start until agent is `HEALTHY` with zero `BLOCK_START` findings. Disconnects trigger attempt suspension after grace period.
     - `OPTIONAL`: Agent check runs and records findings, but candidates may start without an active companion.
     - `OFF`: Companion agent check is bypassed entirely; interface presents standard browser-only security check.
2. **Staff-Audited Waivers**:
   - Authorized invigilator/admin roles can grant a one-time waiver (`device_agent_waivers`) scoped to a specific candidate's exam attempt.
   - Waivers require an explicit justification string and record the staff member's ID and timestamp in immutable audit logs.
   - The start gate treats a valid waiver as meeting the companion requirement.

## Consequences
### Positive
- Prevents rigid all-or-nothing constraints across institutional exam categories.
- Ensures human invigilators can resolve emergency candidate hardware issues without canceling the assessment.
- Full traceability for compliance and accreditation reviews.

### Negative
- Requires UI workflows in both Faculty exam configuration and Invigilator monitoring grids.
