# ADR 011: Storing Private S3 Object Keys and Short-Lived Pre-Signed URL Resolution

## Status
Accepted

## Date
2026-10-03

## Context
In the legacy implementation, S3 upload functions generated a 7-day presigned URL and stored that full URL string in database columns (`facePhotoUrl`, `idCardPhotoUrl`, `screenshotUrl`, etc.).

This practice has severe defects (Finding S-02):
1. **Silent Expiry**: After 7 days, pre-signed URLs expire permanently. Candidate profile photos, reference biometrics, and historical evidence become broken 403 Forbidden links.
2. **Bearer Security Leak**: Full signed URLs act as unauthenticated bearer tokens. Anyone who intercepts the URL in logs, database dumps, or network transfers can access candidate biometric photos without authorization.
3. **Storage Bloat**: Storing 300+ character signed URLs increases database table and index footprints significantly compared to clean relative object keys.

## Decision
1. **Store Object Keys Only**:
   - Database columns store only clean relative S3 keys (e.g., `evidence/snapshots/att_123/cam_456.jpg`, `students/face/usn_789.jpg`).
   - Database migrations convert any existing legacy full URLs to clean keys via regex extraction.
2. **Direct Browser Pre-Signed POST for Ingestion**:
   - Eliminate base64 transmission through the API process (Finding S-01).
   - Candidate browsers request a pre-signed S3 POST policy from the API, upload binary data directly to S3, and notify the API upon completion with the resulting key.
3. **On-Demand Pre-Signing on Read**:
   - Pre-signed read URLs are minted dynamically when requested by an authorized user (via REST endpoint `/api/evidence/view?key=...` or short-lived JSON response), with a tight time-to-live (e.g., 15–60 minutes).
   - Biometric reference photos used by CompreFace or Python services are accessed either via private VPC endpoints or authenticated temporary signatures.

## Consequences
### Positive
- Evidence and biometric records never expire in the database.
- Private student photos remain fully private in S3 buckets with public access completely blocked.
- Eliminates memory exhaustion in Node caused by buffering multi-megabyte base64 strings in JSON payloads.

### Negative
- Read requests for media assets require an extra pre-signing step or redirect endpoint.

## Notion Step-13 Alignment
Directly satisfies Notion 13.8 ("Evidence Plane — Browser Direct Pre-signed POST to S3; Store keys, sign on read").
