# ADR 009: Parameterized Raw SQL Repositories for Hot Paths

## Status
Accepted

## Date
2026-10-03

## Context
Prisma ORM provides excellent developer ergonomics, type safety, and migration scaffolding for administrative CRUD workflows. However, on high-frequency, latency-critical hot write paths:
1. Prisma generates multi-query waterfalls (e.g., `findUnique` -> validate in JS -> `upsert` -> increment count, creating 3–4 round trips per answer save).
2. Bulk operations in Prisma (`upsert` in loops or `Promise.all` with individual queries) exhaust database connection pools during synchronised candidate spikes (Finding B-03).
3. Complex business invariants (optimistic revision CAS, deadline enforcement, stable question ownership) cannot be expressed in a single atomic statement using Prisma's standard API, requiring multi-statement transactions with locking overhead.

## Decision
1. **Prisma Retention Scope**:
   - Retain Prisma for general administrative queries, entity definitions, migrations, and low-traffic CRUD (faculty exam creation, student profile lookup, account management).
2. **Dedicated Hot-Path Repositories**:
   - Encapsulate the 6 latency-critical paths into dedicated repository modules using `prisma.$queryRaw` tagged templates (strictly parameterized, zero string concatenation):
     1. **Exam Start Burst**: Conditional atomic activation `READY -> ACTIVE`, assigning timestamps and returning pre-warmed questions in one round trip.
     2. **Single Answer Save**: Atomic upsert with revision CAS (`revision = revision + 1 WHERE revision = $client_rev`) and `NOW() <= expires_at` check.
     3. **Batch Autosave**: Multi-row upsert in a single round trip using PostgreSQL `unnest($1::uuid[], $2::uuid[], $3::int[])`.
     4. **Exam Submission**: Atomic transition to `SUBMITTED`, flushing remaining answers and inserting a transactional outbox record in a single short transaction (< 5ms lock hold).
     5. **Micro-Batched Violation Ingestion**: Bulk append of queued violation signals with server timestamps.
     6. **Invigilator Roster & Summary Aggregation**: Single set-based query calculating active candidate counts, violation aggregates, and progress metrics without loading full entities into Node memory.

## Consequences
### Positive
- Reduces database round trips on critical paths from 3–5 to exactly 1.
- Eliminates connection pool contention and deadlocks during start/submit storms.
- Ensures atomic enforcement of business invariants directly inside PostgreSQL engine.

### Negative
- Requires maintaining raw SQL queries alongside Prisma schemas.
- Requires manual mapping of SQL result sets to domain DTOs.

## Notion Step-13 Alignment
Fully satisfies Notion 13.7 section 5 ("Hot Paths use Parameterized Raw SQL inside Repositories").
