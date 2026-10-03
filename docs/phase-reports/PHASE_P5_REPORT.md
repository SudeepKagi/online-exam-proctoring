# Phase P5 Report — Storage & Evidence Pipeline (S3, Compression, Direct Upload)

**Branch:** `feature/p5-storage-and-evidence-pipeline`  
**Execution Date:** October 3, 2026  
**Status:** Completed & Validated  

---

## 1. Executive Summary

Phase P5 replaces legacy heterogeneous file upload mechanisms (Cloudinary, ad-hoc local disk `/uploads`, and fragmented MinIO services) with a hardened, production-grade **S3-compatible direct-upload evidence pipeline**. 

In accordance with **ADR-011 ("Keys, Not URLs")**, raw image bytes **never transit the application server** during student submissions or proctoring snapshots. Candidates upload directly to object storage using short-lived S3 Presigned POST policies with strict boundary constraints. The application tier only validates metadata, stores storage keys (never URLs), and lazily signs read URLs with a deterministic 5-minute time window rounding algorithm to maximize edge and browser cache hits.

Heavy image processing (decoding, magic byte validation, 320 px WebP thumbnail generation) is strictly offloaded to asynchronous background workers (`pn.evidence`) with concurrency bounds and input pixel limits.

---

## 2. Legacy Removal & Unified S3 Client

### 2.1 Complete Legacy Cleanup
- **Deleted Legacy Code**:
  - Removed `src/services/cloudinary.service.js`.
  - Removed separate `src/services/minio.service.js`.
  - Removed local disk storage directory `backend/uploads/` and express static route `/uploads`.
  - Removed `uploadToCloudinary` and `uploadToS3` aliases and legacy `readFileSync` multi-part paths.
- **Dependency Pruning**:
  - Uninstalled `cloudinary` and `streamifier` packages.
  - Installed `@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post`, `@aws-sdk/s3-request-presigner`, `sharp`, and `opossum`.
- **Environment & Compose Hardening**:
  - Shifted `minio` in `proctornet/docker-compose.yml` under compose profile `dev` (`profiles: ["dev"]`). MinIO is strictly a local dev/test target (`S3_ENDPOINT`, `S3_FORCE_PATH_STYLE=true`), removing it from production stacks.

### 2.2 Unified S3 Client (`src/infra/s3/s3.client.js`)
- Configured using `@aws-sdk/client-s3` with `NodeHttpHandler` connection pooling:
  - `maxAttempts: 3` with exponential backoff.
  - `connectionTimeout: 2000 ms`, `socketTimeout: 5000 ms`.
  - Persistent keep-alive agent with `maxSockets: 100`.
- **Credential Provider Chain**:
  - In production (`NODE_ENV === 'production'`), static credentials are strictly omitted, letting the AWS SDK resolve IAM Instance Profiles or ECS Task Roles via the default credential provider chain.
  - Development and test environments support local keys and custom endpoints (`http://127.0.0.1:9000`).

---

## 3. Storage Keys, Not URLs (ADR-011)

### 3.1 Canonical Key Hierarchy
All storage paths follow predictable, structured prefixes:
- **Identity Photos**: `identity/{studentId}/{kind}-{uuid}.webp` (`kind`: `profile`, `id-card`)
- **Proctoring Evidence**: `evidence/{examId}/{attemptId}/{uuid}.webp`
- **Generated Thumbnails**: `thumbs/{examId}/{attemptId}/{uuid}.webp`
- **Exam Question Media**: `questions/{examId}/{uuid}.webp`

### 3.2 5-Minute Window-Rounded Presigning
Persisting presigned URLs in relational databases creates stale links, database bloat, and security vulnerabilities. Instead, database columns store only the canonical `key`.

When serializing DTOs for client consumption (e.g., student roster, proctor dashboards, audit logs), URLs are generated dynamically on read:
```javascript
// Rounds signing timestamp down to 5-minute boundaries
const epochMs = Date.now();
const roundedMs = Math.floor(epochMs / (5 * 60 * 1000)) * (5 * 60 * 1000);
const signingDate = new Date(roundedMs);

const command = new GetObjectCommand({ Bucket: bucket, Key: key });
return await getSignedUrl(s3Client, command, {
  expiresIn: 600, // 10 minutes
  signingDate
});
```
- **Browser/CDN Cache Coalescence**: All clients requesting evidence within the same 5-minute window receive bit-for-bit identical URLs with matching AWS signatures, preventing redundant fetches and offloading bandwidth to browser/CDN caches.
- **Zero I/O Presigning**: URL generation is purely local HMAC-SHA256 mathematical calculation; no round trip to S3 or MinIO occurs.
- **Batch Signing**: The `batchPresignReadUrls` utility signs multiple assets in parallel with a shared `signingDate`.

---

## 4. Direct Upload Pipeline & Policy Gates

### 4.1 Presigned Upload Initiation (`POST /api/v1/uploads/presign`)
Clients request upload permission from the API before transmitting bytes:
- **Strict Policy Constraints (`createPresignedPost`)**:
  - `key`: Bound to the server-generated canonical path.
  - `Content-Type`: Starts-with `image/` (`image/webp`, `image/jpeg`, `image/png`).
  - `content-length-range`:
    - Evidence screenshots: $100\text{ B} \le \text{size} \le 300\text{ KB}$.
    - Profile & ID photos: $100\text{ B} \le \text{size} \le 2\text{ MB}$.
  - `x-amz-server-side-encryption`: Enforces `AES256` (SSE-S3).
  - `Expires`: 120 seconds.
- **Authorization & Security Checks**:
  - Candidates can only request upload tickets for their own active, non-expired exam attempts (BOLA guard).
  - Attempt budget caps (default 30 screenshots) and cooldown limits (10s) prevent storage exhaustion.
  - Faculty can only upload media to their own exams.

### 4.2 Direct Upload Finalization (`POST /api/v1/uploads/complete`)
Once the client POSTs directly to S3 and receives HTTP 204:
1. Client calls `/api/v1/uploads/complete` with `{ key, attemptId, eventType, clientTimestamp }`.
2. The API inserts a violation record into `violation_events` with `evidence_status = 'PENDING'`.
3. Within the **same database transaction**, an outbox record is inserted into `outbox_events` with `eventType = 'evidence.uploaded'`.
4. The API responds immediately ($< 15\text{ ms}$). The database never waits for image decoding or S3 network operations.

---

## 5. Asynchronous Evidence Worker (`pn.evidence`)

The `EvidenceWorker` consumes `evidence.uploaded` events:
1. **Metadata & HeadObject Verification**: Confirms object existence, content length, and Content-Type.
2. **Magic Byte Validation**: Reads the initial 12 bytes of the S3 object stream to verify authentic binary file signatures (`RIFF...WEBP`, `FF D8 FF`, `89 50 4E 47`). Disguised executables or script files are immediately rejected.
3. **Sharp Processing Safeguards**:
   - `sharp.concurrency(2)`: Restricts worker CPU contention.
   - Limit input pixels (`limitInputPixels: 1920 * 1080`): Protects against "decompression bomb" attacks.
   - `failOn: 'error'`: Traps truncated or corrupt payloads.
4. **Thumbnail Generation**: Downsamples to a 320 px width WebP thumbnail (`quality: 70`), streams the result back to `thumbs/...` in S3.
5. **Idempotency & Status Transition**:
   - Updates `violation_events.evidence_status = 'UPLOADED'` and sets `thumb_key`.
   - If executed multiple times for the same event, it detects the existing thumbnail/status and skips processing (`ALREADY_PROCESSED`).
   - If the image is corrupt, the worker marks `evidence_status = 'FAILED'`, but the **violation record remains intact** for academic integrity audits.

---

## 6. Client-Side Image Compression & EXIF Stripping

Located in `proctornet/frontend/src/lib/imageCompress.js`:
- **OffscreenCanvas & Web Worker**: Offloads image decoding and compression from the main UI thread to prevent video stutter or UI lockups.
- **Resolution Capping**:
  - Evidence screenshots: Bounded to maximum $1280 \times 720$ preserving aspect ratio.
  - Profile photos: Bounded to maximum $1024 \times 1024$.
- **Re-encoding & EXIF Sanitization**: Re-encoding to WebP/JPEG completely discards EXIF, GPS coordinates, and camera metadata.
- **Adaptive Quality Loop**:
  - Begins encoding at WebP `0.6` quality (target $\le 120\text{ KB}$).
  - Dynamically lowers quality down to `0.4` if necessary to strictly stay below the hard $300\text{ KB}$ ceiling.

---

## 7. Evidence Policy Configuration (`src/shared/evidencePolicy.js`)

Centralized rules governing client and server snapshot budgets:
- **Triggered Event Types**: `LOOKING_AWAY`, `MULTIPLE_FACES`, `NO_FACE`, `PHONE_DETECTED`, `SUSPICIOUS_OBJECT`, `BOOK_NOTES`.
- **Budgets & Cooldowns**:
  - `maxEvidencePerAttempt`: 30 snapshots per attempt.
  - `cooldownSeconds`: 10-second minimum gap between automatic violation uploads.
  - `fallbackSnapshotIntervalSeconds`: 120 seconds ($\pm 20\text{ s}$ random jitter) when WebRTC SFU streaming is disconnected.

---

## 8. Bucket Hardening & Infrastructure as Code

Located in `ops/aws/`:
- **`s3_bucket.tf`**:
  - `aws_s3_bucket_public_access_block`: All 4 public access blocks enabled (`block_public_acls`, `block_public_policy`, `ignore_public_acls`, `restrict_public_buckets`).
  - `aws_s3_bucket_server_side_encryption_configuration`: Default AES256 server-side encryption.
  - `aws_s3_bucket_policy`: Rejects all non-TLS requests (`aws:SecureTransport == "false"`).
  - `aws_s3_bucket_cors_configuration`: Restricts origins to `${var.frontend_url}`, allowing only `PUT`, `POST`, `GET`, `HEAD`.
  - `aws_s3_bucket_lifecycle_configuration`:
    - Transition `evidence/` and `thumbs/` to `STANDARD_IA` at 30 days.
    - Expire and permanently delete after 180 days (`EVIDENCE_RETENTION_DAYS`).
    - Abort incomplete multipart uploads after 1 day.
- **`iam_policy.json`**:
  - Least-privilege IAM policy restricting application writes to `evidence/*`, `identity/*`, `thumbs/*`, `questions/*`.

---

## 9. Retention Purge Worker (`src/modules/media/retentionWorker.js`)

- Queries database for violation events older than `EVIDENCE_RETENTION_DAYS` (default 180 days) that still hold active S3 keys.
- Executes S3 `DeleteObjectsCommand` in batches of up to 1,000 keys.
- Nullifies `evidenceKey` and `thumbKey` in Postgres, updating `evidenceStatus = 'EXPIRED'`.
- Emits structured audit logs with the purge count, timestamp cutoff, and duration.

---

## 10. Biometric Bulkhead & Verification Worker

Located in `src/modules/media/biometricService.js`:
- **Circuit Breaker Bulkhead (`opossum`)**:
  - Isolates external AI inference (Python/CompreFace microservice) from the core monolith.
  - Timeout: 3,000 ms.
  - Error threshold percentage: 50%.
  - Reset timeout: 10,000 ms.
  - Concurrency limit: 4 concurrent inference executions.
- **Asynchronous Re-Verification Queue (`pn.verify`)**:
  - Periodic candidate re-verifications (`aiReverifyInterval`) are enqueued as outbox events.
  - `VerificationWorker` processes events with prefetch 2, fetching faces via short-lived presigned GET URLs or direct S3 streams—never through publicly exposed or persisted URLs.

---

## 11. Test Coverage & Verification

All automated test suites execute cleanly and pass without regressions:

| Test Suite | File | Tests Passed | Status |
| :--- | :--- | :---: | :---: |
| **P5 Storage & Evidence Pipeline** | `tests/p5-storage-evidence.test.js` | 13 / 13 | **PASS** |
| **P5 Client Compression & EXIF** | `tests/p5-client-compression.test.js` | 5 / 5 | **PASS** |
| **P4 Concurrency Write Paths** | `tests/p4-concurrency-write-paths.test.js` | 10 / 10 | **PASS** |
| **P4 Property-Based Grading** | `tests/p4-property-grading.test.js` | 1 / 1 | **PASS** |
| **P3 Schema & Data Constraints** | `tests/p3-schema-constraints.test.js` | 20 / 20 | **PASS** |
| **P2 Question & Exam Validation** | `tests/mcq-validation.test.js` | 20 / 20 | **PASS** |
| **Total Test Suite** | — | **69 / 69** | **PASS (100%)** |

### Verified Test Cases in P5:
1. Presign policy enforces $300\text{ KB}$ ceiling on evidence.
2. Presign policy rejects unsupported MIME types (`application/x-sh`).
3. Presign policy enforces BOLA isolation (candidate cannot upload for another student's attempt).
4. Direct upload policy generation produces valid S3 presigned credentials within candidate budget.
5. Identity upload policy authorizes up to $2\text{ MB}$ WebP/JPEG profile pictures.
6. Direct upload completion commits violation row and enqueues outbox event atomically.
7. Evidence worker validates magic bytes, resizes with Sharp, uploads $320\text{ px}$ thumbnail, updates DB status.
8. Evidence worker is strictly idempotent on duplicate event replay.
9. Corrupted image uploads mark `evidence_status = 'FAILED'` while preserving the underlying violation row.
10. Database scanning gate proves zero URLs or `X-Amz-Signature` strings are persisted in any table.
11. 5-minute rounded presigning produces identical signed URLs for repeated requests within window.
12. Batch presigning returns coherent URLs across multiple assets.
13. Retention purge worker deletes expired objects and updates database records.

---

## 12. Interview Defense: Architectural Takeaway

> *"Move bytes off the app tier: signed direct uploads, keys not URLs, async validation. The DB never waits for S3."*

1. **Why not proxy images through Node.js Express?**
   Streaming hundreds of 300 KB proctoring screenshots through an Express server consumes Node's V8 heap, binds event-loop threads during buffer parsing, and starves latency-sensitive autosave and submission endpoints. Direct presigned S3 POST offloads network bandwidth and memory entirely to AWS infrastructure.
2. **Why store Keys instead of URLs?**
   Presigned URLs expire. Hardcoding full URLs in the database means either links permanently break after 15 minutes, or buckets must be made publicly accessible (violating FERPA/GDPR/academic privacy). Storing relative object keys and signing on read gives absolute security, zero data migration if domain names change, and dynamic permission evaluation.
3. **Why 5-minute rounded signing dates?**
   Standard presigned URLs generate a unique HMAC signature every millisecond because `X-Amz-Date` changes. By quantizing the signing timestamp to 5-minute boundaries, 100 students or proctors loading the same asset within that window receive the exact same query parameters, enabling edge CDN and browser caching without extra round-trips.
4. **Why transactional outbox for evidence?**
   If S3 or the image decoding worker experiences temporary latency or downtime, the intake endpoint (`POST /uploads/complete`) still succeeds with durable consistency. The proctoring violation record is committed immediately; evidence processing retries with backoff in the background. The database never waits for S3.
