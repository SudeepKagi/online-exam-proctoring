# ADR 001: Single-Node Multi-Process Topology with Redis Adapter

## Status
Accepted

## Date
2026-10-03

## Context
Node.js runs single-threaded per process. A single Express instance cannot leverage multi-core processors (such as the target 8-core host) and presents a single point of failure if an uncaught exception or event-loop stall occurs. Furthermore, Socket.IO in-memory room management cannot scale across multiple Node processes without a distributed messaging bus.

We need an architecture that maximizes resource saturation on a single dedicated node while remaining horizontally portable to multi-node deployments in the future without requiring an application rewrite.

## Decision
1. **Multi-Process Container Architecture**:
   - `nginx`: Reverse proxy handling TLS termination, HTTP/2, brotli/gzip compression, static SPA asset serving, connection limiting, and WebSocket connection upgrade routing.
   - `api` (`min(vCPU - 2, 4)` replicas, e.g. 4 containers): Stateless Express + Socket.IO API containers. Node run flags `--max-old-space-size=640`, `UV_THREADPOOL_SIZE=8`.
   - `worker` (1–2 containers): Background job runners handling transactional outbox publishing, asynchronous exam grading, S3 evidence processing/thumbnailing, attempt expiry sweeps, and VPN peer reconciliation.
   - `postgresql` (1 container): Co-located PostgreSQL 16 container tuned for host memory (4 GB `shared_buffers`).
   - `redis` (1 container): In-memory cache, rate limiter, and Socket.IO Redis adapter (`@socket.io/redis-adapter`). Configured with `maxmemory 512mb`, `volatile-lru`, no persistence.
   - `rabbitmq` (1 container): Durable queue with dead-letter queue (DLQ) and exponential backoff retry.
   - `livekit` (1 container on host networking): High-performance Selective Forwarding Unit (SFU) for WebRTC media streams.

2. **WebSocket Transports**:
   - Socket.IO is configured **WebSocket-only** (`transports: ['websocket']`).
   - HTTP long-polling fallback is disabled. This eliminates sticky session requirements at the load balancer, allowing N API processes to share room events seamlessly through the Redis pub/sub adapter.

## Consequences
### Positive
- Fully utilizes all host CPU cores while capping memory per process to prevent V8 GC thrashing.
- Zero sticky sessions required at nginx, allowing round-robin / least-connected load distribution.
- Node process crash does not sever connections across other replicas.
- Completely portable: splitting Redis, PostgreSQL, or workers onto independent hosts later requires only changing environment connection strings.

### Negative
- Introduces Redis as an operational dependency for Socket.IO room coordination.
- Slightly higher local setup complexity compared to a monolithic single Node process.

## Notion Step-13 Alignment
Directly aligns with Notion 13.12 ("Phase 2 — Low-cost AWS / Co-located Topology"), where Redis and RabbitMQ are co-located on internal Docker networks without public ingress.
