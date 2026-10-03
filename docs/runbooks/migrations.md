# Production Database Migration Runbook: Expand-Migrate-Contract

This runbook defines the required protocol for executing schema migrations on ProctorNet without downtime or breaking active client sessions.

---

## 1. Principles of Non-Breaking Migrations

Database changes must follow the **Expand $\to$ Migrate $\to$ Contract** three-phase lifecycle:

```
[Phase 1: EXPAND]     --> Deploy additive schema changes (new nullable columns, new tables)
                          App writes to both old and new columns, reads from old.
[Phase 2: MIGRATE]    --> Backfill historical records asynchronously in small batches.
                          App reads from new columns, writes to both.
[Phase 3: CONTRACT]   --> Remove old columns/tables once all app instances use new columns.
```

---

## 2. Safe vs. Unsafe Operations in PostgreSQL

| Operation | Safety Level | Strategy |
| :--- | :--- | :--- |
| **Add column (`NULL` or default)** | SAFE | Postgres 11+ stores defaults in metadata instantly without rewriting tables. |
| **Add non-concurrent index** | UNSAFE on live tables | In P3 tables were empty so `CREATE INDEX` was instant. On live systems (>10k rows), always use `CREATE INDEX CONCURRENTLY` outside transactions. |
| **Drop column** | POTENTIALLY BREAKING | Must deprecate column in code first, deploy code, verify zero reads/writes, then execute `ALTER TABLE ... DROP COLUMN`. |
| **Rename column** | UNSAFE | Never rename a column directly on a live table. Add new column $\to$ dual write $\to$ backfill $\to$ cutover read $\to$ drop old column. |
| **Add CHECK constraint** | SAFE via `NOT VALID` | Add with `NOT VALID` (instant lock), then run `ALTER TABLE ... VALIDATE CONSTRAINT` in background without table lock. |

---

## 3. Rollback & Forward-Fix Policy

1. **Rollback Policy**:
   - Because additive migrations ("Expand" phase) do not remove or alter existing columns, rolling back an application deployment to the previous commit is always safe.
   - Database rollbacks via `prisma migrate down` are discouraged in production because schema rollbacks can destroy data accumulated since deployment.
2. **Forward-Fix Policy**:
   - If a migration defect is detected after contract, execute a new compensating migration rather than editing historical migration files.
   - Historical migration files in `prisma/migrations/**` are immutable once merged to `main`.
