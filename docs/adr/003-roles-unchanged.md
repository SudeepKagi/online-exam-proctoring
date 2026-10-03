# ADR 003: Retention of Existing Role and Credential Model

## Status
Accepted

## Date
2026-10-03

## Context
Notion Step 13 section 13.5 proposes a unified `users` and `user_roles` polymorphic database design. However, the current ProctorNet system operates with four distinct roles:
1. `admin`: Global administrative portal access.
2. `faculty`: Exam authoring, scheduling, and results management.
3. `student`: Enrolled candidate taking examinations.
4. `invigilator`: Per-exam ephemeral credential (`invId` and password hash generated on exam creation, JWT carrying `examId`).

Unifying these roles into a single identity table would require an extensive, high-risk refactoring of authentication, middleware, token issuance, and frontend authorization models, yielding zero performance or scalability benefits on a single-node host.

## Decision
1. Retain the existing role model and entity separation:
   - Separate tables: `Admin`, `Faculty`, `Student`.
   - Ephemeral invigilator auth: `invId` and `invPasswordHash` stored directly on the `Exam` entity.
   - JWT tokens continue to encode `id`, `role`, and optional `examId` (for invigilators).
2. Defer unified identity migration until multi-tenant or identity-provider (SSO/SAML/OAuth) integrations are introduced in a future major version.

## Consequences
### Positive
- Preserves all battle-tested auth, cookie issuance, and RBAC middleware without regression risk.
- Zero disruption to invigilator exam-scoped access control.
- Keeps engineering effort laser-focused on scalability, reliability, media streaming, and hot write-path optimization.

### Negative
- Four distinct login routes and controllers remain in the codebase.
- Cross-role user accounts (e.g., faculty also acting as admin) must maintain separate credential records.

## Notion Step-13 Alignment
Deliberate, documented divergence from Notion 13.5's unified user model, preserving existing product semantics as explicitly instructed by project authority.
