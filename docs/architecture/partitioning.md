# Architectural Decision & Thresholds: PostgreSQL Partitioning Strategy

## Status: DEFERRED (with explicit trigger thresholds)

---

## 1. Architectural Rationale for Deferring Partitioning

In Phase P3, table partitioning for append-heavy stores (`violation_events`, `audit_logs`) has been deliberately deferred.

### Why Partitioning Too Early Hurts Performance:
1. **Query Planning Overhead**: The PostgreSQL query planner must inspect partition metadata for every query unless partition pruning can be statically proven.
2. **Global Foreign Key & Index Limitations**: PostgreSQL does not support global unique indexes across partitioned tables unless the partition key is part of the primary key and all foreign keys.
3. **Write Path Cost**: Tuples must be routed to partition child tables via tuple routing logic, introducing CPU overhead for high-frequency inserts.
4. **Current Scale**: With B-tree indexes and `BIGINT` identity keys, modern NVMe PostgreSQL easily handles tables up to 20–50 million rows with index depths of 3–4 levels ($<1\text{ ms}$ index traversal).

---

## 2. Partitioning Trigger Thresholds

Partitioning must be implemented when any of the following triggers are met:

| Table | Trigger Metric | Threshold | Action |
| :--- | :--- | :--- | :--- |
| **`violation_events`** | Row Count | $> 50,000,000\text{ rows}$ | Implement Declarative Range Partitioning by `server_timestamp` (Monthly). |
| **`violation_events`** | Retention Policy | $> 90\text{ days}$ retention | Use `DROP TABLE` on old month partition instead of expensive `DELETE` scans. |
| **`audit_logs`** | Row Count | $> 25,000,000\text{ rows}$ | Implement Range Partitioning by `timestamp` (Quarterly). |
| **Index Size** | Table Working Set | Index size $> 50\%$ of `shared_buffers` ($>2\text{ GB}$) | Partition to maintain index leaf cache residency in RAM. |

---

## 3. Future Partitioning Implementation Blueprint

When `violation_events` crosses 50M rows, adopt Declarative Range Partitioning:

```sql
CREATE TABLE violation_events_partitioned (
  id BIGINT GENERATED ALWAYS AS IDENTITY,
  attempt_id UUID NOT NULL,
  event_type "ViolationType" NOT NULL,
  severity "Severity" NOT NULL,
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_timestamp TIMESTAMPTZ,
  source TEXT DEFAULT 'CLIENT_EVENT',
  metadata JSONB,
  evidence_key TEXT,
  evidence_status "EvidenceStatus" DEFAULT 'NONE',
  inv_action TEXT,
  inv_action_note TEXT,
  PRIMARY KEY (server_timestamp, id)
) PARTITION BY RANGE (server_timestamp);

-- Monthly child partitions
CREATE TABLE violation_events_y2026m10 PARTITION OF violation_events_partitioned
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');
```
