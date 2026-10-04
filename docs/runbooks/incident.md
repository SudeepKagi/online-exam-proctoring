# Incident Triage & Emergency Operations Runbook

**Goal**: Systematic diagnostics and recovery for production emergencies during live exams.

---

## 1. High CPU / Event Loop Lag on API Pods

### Symptoms
- Prometheus gauge `nodejs_eventloop_delay_seconds > 0.05` (50 ms).
- Elevated HTTP request durations (p95 > 500 ms).

### Diagnostics
```bash
# 1. Identify which container is consuming CPU
docker stats --no-stream

# 2. Inspect active Node.js processes inside the container
docker compose -f docker-compose.prod.yml exec api-1 top
```

### Remediation
1. **Load Shedding**: Verify load shedding middleware is rejecting non-critical requests:
   ```bash
   grep "Load shedding active" /var/log/proctornet/api.log
   ```
2. **Horizontal Scaling**: Scale up a third API container immediately:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --scale api-1=2
   ```
3. **Inspect Slow Database Queries**:
   ```sql
   SELECT pid, query, age(clock_timestamp(), query_start) 
   FROM pg_stat_activity 
   WHERE state != 'idle' ORDER BY age DESC LIMIT 5;
   ```

---

## 2. Database Connection Pool Exhaustion

### Symptoms
- Application throws Prisma error `P2024: Timed out fetching a new connection from the pool`.
- `/readyz` probe starts failing with PostgreSQL timeouts.

### Diagnostics
```sql
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
```

### Remediation
1. **Terminate Hanging/Idle In Transaction Sessions**:
   ```sql
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE state = 'idle in transaction' 
     AND age(clock_timestamp(), state_change) > interval '15 seconds';
   ```
2. **Verify Max Connections**: Ensure application pool size does not exceed PostgreSQL `max_connections = 100` (60 active pool connection limit recommended per Appendix C).

---

## 3. Redis Memory Saturation & Eviction

### Symptoms
- Candidates receive 500 errors on autosave or session lookup.
- Redis logs indicate `OOM command not allowed when used memory > 'maxmemory'`.

### Diagnostics
```bash
docker compose -f docker-compose.prod.yml exec redis redis-cli -a "$REDIS_PASSWORD" info memory
```

### Remediation
1. Check eviction policy:
   ```bash
   docker compose -f docker-compose.prod.yml exec redis redis-cli -a "$REDIS_PASSWORD" config get maxmemory-policy
   # Should be: volatile-lru
   ```
2. Flush non-essential cache keys:
   ```bash
   # Flush only query cache keys (preserving candidate session state)
   docker compose -f docker-compose.prod.yml exec redis redis-cli -a "$REDIS_PASSWORD" --scan --pattern "pn:cache:*" | xargs -r redis-cli -a "$REDIS_PASSWORD" del
   ```

---

## 4. LiveKit SFU Video Traversal / Media Dropouts

### Symptoms
- Invigilators report frozen black screens on video tiles.
- Candidates receive WebRTC connection failures.

### Diagnostics
```bash
# Check LiveKit container logs
docker compose -f docker-compose.prod.yml logs --tail=100 livekit

# Verify UDP media port is open and receiving packets
sudo tcpdump -n -i any udp port 7882 -c 10
```

### Remediation
1. Ensure Linux host firewall (`nftables` or `ufw`) is not filtering UDP ports:
   ```bash
   sudo ufw allow 7882/udp
   sudo ufw allow 3478/udp
   ```
2. Confirm candidates are able to fallback to TURN over TLS (port 5349) if restrictive campus firewalls block UDP.
