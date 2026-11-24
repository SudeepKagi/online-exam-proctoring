# ADR 013: Real Identity Verification via AWS Rekognition Driver Architecture

## Status
Accepted

## Date
2026-10-07

## Context
The legacy proctoring system suffered from inaccurate face matching ("AI matching is not accurate") and heavy memory consumption:
1. **Unreliable On-Box Python Face Service**: A legacy Python Flask service loaded large computer vision models (`face_recognition`, OpenCV, dlib) directly into process memory or attempted CompreFace / Cloudinary integration. On constrained EC2 instances (t3/t4g.micro or small), loading Python biometric processes led to Out-Of-Memory (OOM) crashes and CPU starvation.
2. **Buffering Image Bytes on Small EC2**: Images were being passed as multipart or base64 streams through Node/Python processes, saturating network I/O and process buffers.
3. **Binary Auto-Pass & Fixed Threshold Fakes**: Previous implementations either used arbitrary mock scores or naive binary matching with no intermediate human-in-the-loop triage, leading to either false rejections or fraudulent auto-passes.
4. **No Raw Embedding Retention Policy**: Storing raw biometric vector embeddings or face templates presents serious privacy, compliance, and regulatory liabilities (GDPR/FERPA/BIPA).
5. **ID Card OCR Overhead**: Running server-side OCR on student ID cards in real time within the Python service was resource-heavy and error-prone across diverse student ID formats.

## Decision

### 1. Driver-Based `FaceVerifier` Abstraction
We implement a pluggable `FaceVerifier` interface with three drivers:
- **`rekognition` (Default on AWS)**: Calls `@aws-sdk/client-rekognition` using direct S3 references (`S3Object: { Bucket, Name }`). Zero image bytes pass through the EC2 application instance.
  - Quality gating uses `DetectFaces` (`Attributes: ['ALL']`).
  - Face comparison uses `CompareFaces` (`QualityFilter: 'AUTO'`).
  - IAM permissions are strictly restricted to `rekognition:DetectFaces` and `rekognition:CompareFaces`.
- **`onnx` (Optional On-Box)**: Available for standard/enterprise profiles with dedicated GPU/CPU capacity.
- **`off` (Disabled Mode)**: Feature is visibly reported as `DISABLED`. Requests fail-closed to `REVIEW` with code `VERIFIER_OFF`; it **never** auto-passes.

### 2. Strict Enrollment Quality Gates (Server-Side)
Enrollment photos must pass strict automated gates via `detect()`:
- Exactly 1 face detected (`faceCount === 1`).
- Face bounding box height $\ge 20\%$ of frame height.
- Brightness and Sharpness quality scores $\ge 40.0$.
- Head pose within bounds: $|\text{yaw}| \le 20^\circ$, $|\text{pitch}| \le 20^\circ$.
- Eyes open (`eyesOpen === true`).
- Face not occluded (`occluded === false`).

Any gate failure returns clear, actionable guidance to the candidate (e.g., "Lighting too dim", "Please face camera directly").
Enrollment face photo vs. ID-card photo comparison is treated as an **assistive signal for the admin approval queue**, rather than an autonomous binary gate. ID-card OCR is removed from synchronous exam ingress and deferred to optional background worker processing or human review.

### 3. Multi-Tier Pre-Exam Decision Engine & Fail-Closed Semantics
Pre-exam verification executes `detect` + `compare(enrollmentRef, liveRef)` with three deterministic tiers:
- **`PASS`**: Similarity $\ge T_{\text{pass}}$ (default: $95.0\%$).
- **`REVIEW`**: $T_{\text{review}} \le \text{Similarity} < T_{\text{pass}}$ (default: $85.0\% \le s < 95.0\%$). Candidate is queued for human invigilator / proctor clearance.
- **`FAIL`**: Similarity $< T_{\text{review}}$ ($< 85.0\%$).
- **`ERROR` / Outage**: Network timeouts or provider unavailability immediately **fail-closed to `REVIEW`** with reason code `VERIFIER_UNAVAILABLE`. Under no circumstances does an error default to `PASS`.

Any manual override by an invigilator or admin requires explicit identification, audit logging, and justification.

### 4. Lightweight Interactive "Live Check"
To deter photo/screen replay of static images without claiming uncertified presentation-attack detection (PAD), an interactive 3-frame challenge ("live check") is issued:
- The server generates a random directive (e.g., "Turn head left", "Turn head right", "Look up").
- The client captures a 3-frame burst.
- The server evaluates the pose delta between initial and target frames via `DetectFaces`.

### 5. Jittered Periodic Re-Verification with Consecutive Mismatch Filter
Periodic proctoring runs a worker job governed by per-exam API call budgets and jitter:
- A single mismatched frame does not immediately flag a violation (mitigating false alarms from transient lighting or motion blur).
- **Two consecutive mismatches** are required before raising an `IDENTITY_MISMATCH` violation.

### 6. Privacy & Persistence
All verification runs are logged to the `identity_verifications` table:
`[attempt_id, kind, provider, request_id, similarity, decision, thresholds_used, model_version, evidence_keys, created_at]`.
- **Zero Raw Embeddings**: No face vectors or biometric templates are stored.
- Only S3 object keys representing evidence artifacts are retained, subject to lifecycle retention policies.

### 7. Retirement of Legacy Python Face Service
- Delete `python-service/services/face_service.py` and related face routing endpoints.
- Remove `cloudinary` from Python dependencies.
- The Python service is not deployed on the `lite` profile.

## Consequences

### Positive
- **Drastically Reduced EC2 Load**: Zero image transcoding or biometric inference on the EC2 host. CPU and memory footprint remain minimal.
- **High Accuracy & Reliability**: Production-grade AWS Rekognition models eliminate inaccurate on-box heuristics.
- **Tamper & Failure Resistance**: Provider outages fail-closed to manual review; mock auto-passes are eliminated.
- **Privacy Compliance**: Zero biometric template storage satisfies stringent data minimization standards.

### Negative
- Direct dependency on AWS Rekognition and S3 in production (mitigated by `testDriver` in CI/test environments and optional `onnxDriver`).
- AWS API costs per verification call (bounded by call budgets and rate limits).
