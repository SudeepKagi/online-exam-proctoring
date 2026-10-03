# ADR 008: BigInt Identity Primary Keys for Append-Heavy Tables

## Status
Accepted

## Date
2026-10-03

## Context
In the legacy schema, every entity utilized `String @default(uuid())` mapped to PostgreSQL `text` columns (36 bytes per value). For high-frequency, append-heavy tables such as `violation_events`, `audit_logs`, `verification_audit_logs`, and `outbox_events`, using random UUIDs causes significant B-tree index page fragmentation (random insertion locations across the index tree), rapid memory cache churn, and oversized secondary indexes.

Furthermore, paginating millions of violation logs using offset/limit (`skip`/`take`) on UUID keys leads to full sequential scans.

## Decision
1. **Append-Heavy Event Tables**:
   - `violation_events`, `audit_logs`, `outbox_events`, and related timeline streams use `BIGINT GENERATED ALWAYS AS IDENTITY` as the clustered primary key (`id BigInt @id @default(autoincrement())`).
   - If an external unguessable identifier is required (e.g., for public API references), maintain a secondary indexed UUID column (`event_id String @default(uuid()) @db.Uuid`).
2. **Sequential Inserts and Keyset Pagination**:
   - BigInt identity ensures strictly monotonic sequential inserts at the end of the B-tree leaf pages, eliminating page splits, minimizing index bloat, and ensuring high write cache locality.
   - Enables fast, constant-time keyset pagination:
     ```sql
     SELECT * FROM violation_events
     WHERE attempt_id = $1 AND id < $last_seen_id
     ORDER BY id DESC
     LIMIT 50;
     ```
3. **Core Domain Entities**:
   - Entities such as `Exam`, `Student`, `Faculty`, and `ExamAttempt` continue using native UUIDs (`@db.Uuid`, 16 bytes storage instead of 36 bytes text) to prevent enumeration attacks and support distributed client generation.

## Consequences
### Positive
- Substantially higher insert throughput on event logging hot paths.
- Index size for append-heavy tables reduced by over 60%.
- Constant-time `O(1)` cursor/keyset pagination replaces degrading `O(N)` offset scans.

### Negative
- Client code must serialize BigInt values to strings when transmitting via JSON to prevent JavaScript 64-bit float precision loss.

## Notion Step-13 Alignment
Directly implements Notion 13.5 and 13.7 database architecture recommendations for write-heavy audit and violation stores.
