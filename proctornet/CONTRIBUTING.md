# ProctorNet Engineering & Contribution Guidelines

This document establishes the architecture standards, file-size limits, security principles, and testing requirements for the ProctorNet repository.

---

## 1. Architectural Patterns

### Backend: Tiered Service-Layer Architecture
All backend endpoints must adhere to the 4-tier request lifecycle:
```
Routes (HTTP Method/Path + Middleware)
  └── Controllers (Request Parsing, Status Code Mapping, Audit Logging)
        └── Services (Business Logic, Domain Validation, Aggregations)
              └── Database (Prisma ORM Client / External Microservices)
```

- **Rule 1.1 — Controllers Must Be Thin Adapters**: Controllers must never make direct `prisma.*` database queries. Database operations belong strictly inside domain services (`src/services/*Service.js`).
- **Rule 1.2 — Single Export Per Function Name**: Do not define duplicate function names in controller files. Regression tests (`npm test`) assert zero duplicate declarations.
- **Rule 1.3 — Service Independence**: Services return pure data or throw errors with status codes (e.g. `err.status = 404`). Controllers catch errors and format HTTP responses.

---

## 2. File Size & Modular Decomposition Guidelines

Large monolithic files increase cognitive overhead, make merge conflicts painful, and hide dead code.

- **Controllers**: Target **<300 lines** (hard limit: 500 lines). Extract reusable domain operations into services.
- **Frontend Pages**: Target **<250 lines** (hard limit: 400 lines). Split large pages into:
  - Custom React Hooks (`src/hooks/use*`) for sockets, WebRTC, timers, and sensor polling.
  - Subcomponents (`src/components/feature/*`) for headers, modals, cards, and grids.
- **Services**: Keep domain-focused (e.g., `examService.js`, `verificationService.js`, `collusionService.js`).

---

## 3. Security & Integrity (Fail-Closed Default)

ProctorNet protects high-stakes examination integrity. Any security-critical check must **fail closed**:

- **Biometric & Face Matching**: If the AI microservice, CompreFace, or network connection fails/times out, the verification status must evaluate to `verified: false` and `matchScore: 0`. Never return `true` or mock passing scores on error.
- **Proctoring Telemetry**: Fullscreen exit, tab switches, and window blurs must be logged as evidence events with throttled client timestamps.
- **Auditing**: Administrative actions (approvals, suspensions, exam terminations) must invoke `logAudit()` with IP address and target identifiers.

---

## 4. Testing & Code Quality Guardrails

Before submitting pull requests or pushing code:

1. **Linting**:
   ```bash
   cd proctornet/backend && npm run lint
   cd proctornet/frontend && npm run lint
   ```
2. **Automated Unit & Architecture Tests**:
   ```bash
   cd proctornet/backend && npm test
   ```
   Must pass 100% of test suites (Domain logic, Fail-closed checks, Zero direct Prisma in controllers).
3. **Frontend Production Build**:
   ```bash
   cd proctornet/frontend && npm run build
   ```
