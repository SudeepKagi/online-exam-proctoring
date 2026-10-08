# ProctorNet CI Excluded Test Registry (§1 CI-A, C1.6)

This document tracks all tests temporarily excluded from CI runs.
Under the **§0 Anti-Loop Protocol**, tests may only be excluded with a valid root-cause categorization, fix issue/plan reference, and an expiration date (strictly ≤ 7 days).

CI will **FAIL IMMEDIATELY** if any entry in this registry has passed its expiration date.

---

| Test File | Failure Category | Fix Plan / Issue | Expiration Date | Status |
| :--- | :--- | :--- | :--- | :--- |
| *None* | — | — | — | Active (0 Excluded) |

---

### Excluded Entry Schema Requirements
Any added entry must adhere to the format:
```markdown
- file: tests/path-to-test.test.js
  category: <Schema-Drift|Leaked-State|Hanging-Handle|Missing-Fixture|Environment-Mismatch>
  reason: <Specific root-cause explanation>
  issue: <Link to issue or fix plan>
  expires: YYYY-MM-DD (max 7 days from addition)
```
