# ProctorNet Architecture & Security Findings

- `startAttempt` has no assignment or eligibility check. The dashboard rule is a visibility filter, not access control. Revisit after SEB with faculty input.
- Dev `.env` points at a WSL IP (`172.24.171.5`) that changes on reboot. Note only.

