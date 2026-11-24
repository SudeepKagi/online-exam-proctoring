# ADR 007: Database Co-Location and Portable PostgreSQL Configuration

## Status
Accepted

## Date
2026-10-03

## Context
Running the primary database on a remote cloud managed tier (such as Supabase free tier across WAN links) introduces 30–120ms network round-trip time (RTT) for every query. In high-concurrency exam scenarios with synchronous transactions or bursts of autosaves, WAN latency dominates response times, saturates connection pools, and artificially restricts throughput.

Simultaneously, the codebase must retain full migration compatibility with Supabase or managed RDS instances without application-level vendor lock-in.

## Decision
1. **Primary Deployment Topology**:
   - Run a co-located PostgreSQL 16 container (`postgres:16-alpine`) on the single deployment node via Docker Compose.
   - Connected via Docker internal bridge network (`proctornet-net`) with zero WAN round-trip latency (< 0.2ms local RTT).
   - Tuned for the host hardware profile (e.g., 4 GB `shared_buffers`, 12 GB `effective_cache_size`, `work_mem = 64MB`, `synchronous_commit = off` for non-critical logs or tuned WAL buffers).
2. **Portability Discipline**:
   - Use standard PostgreSQL features only. Strictly prohibit proprietary vendor extensions or non-standard SQL dialects.
   - External providers (Supabase, AWS RDS, Neon) remain supported via standard environment variables:
     - `DATABASE_URL`: Connection-pooled URI for application runtime.
     - `DIRECT_URL`: Direct unpooled URI for Prisma migrations and DDL.

## Consequences
### Positive
- Sub-millisecond database round-trip times allow hot-path writes and short transactions to complete in under 5ms.
- Full operational control over connection limits, autovacuum thresholds, and memory allocations.
- Easily testable in local development, CI, and staging environments with identical database engines.

### Negative
- Responsibility for volume backups, persistence storage mapping, and WAL management falls on the host Docker infrastructure.

## Notion Step-13 Alignment
Directly adheres to Notion 13.12 ("Migration Discipline: Co-location removes network RTT from every query while keeping SQL portable").
