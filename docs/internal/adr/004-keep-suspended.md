# ADR 004: Retaining SUSPENDED Attempt State with Compensatory Time Extension

## Status
Accepted

## Date
2026-10-03

## Context
Notion Step 13 section 13.6 models attempt lifecycle states as:
`READY -> ACTIVE -> {SUBMITTED, TERMINATED, EXPIRED}`.

However, ProctorNet is designed for proctored lab environments where network anomalies, temporary VPN drops, or invigilator manual pauses occur. If an attempt is immediately terminated or allowed to burn exam time while a student is locked out due to network issues, candidate fairness is compromised. ProctorNet currently implements an explicit `SUSPENDED` state that allows invigilators to pause an attempt and later resume it.

## Decision
1. Retain the `SUSPENDED` state in the attempt state machine:
   - Valid lifecycle transitions:
     `READY -> ACTIVE`
     `ACTIVE <-> SUSPENDED`
     `ACTIVE -> {SUBMITTED, TERMINATED, EXPIRED}`
     `SUSPENDED -> {TERMINATED, EXPIRED, ACTIVE}`
2. **Server-Authoritative Time Compensation**:
   - Suspended time is **not** consumed by the candidate.
   - When transitioning `ACTIVE -> SUSPENDED`, record `suspended_at = NOW()`.
   - When transitioning `SUSPENDED -> ACTIVE`, calculate `duration = NOW() - suspended_at`.
   - Increment `total_suspended_duration_ms += duration` and extend `expires_at = expires_at + duration`.
   - **Hard Cap**: `expires_at` can never exceed the overall exam `end_time + 5 minutes grace period`.
3. In-flight autosaves or answer submissions arriving while `status == SUSPENDED` are rejected with HTTP 423 (Locked).

## Consequences
### Positive
- Fair and resilient exam experience under flaky campus or Wi-Fi connectivity.
- Maintains strict server authority over exam timers (client clock cannot tamper with deadlines).
- Prevents race conditions during proctor pause actions.

### Negative
- Requires additional timestamp tracking (`suspended_at`, `total_suspended_duration_ms`) on the attempt model.

## Notion Step-13 Alignment
Extends Notion 13.6 attempt state machine to incorporate real-world proctoring pause/resume requirements.
