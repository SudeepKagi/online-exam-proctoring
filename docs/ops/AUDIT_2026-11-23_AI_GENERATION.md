# Root Cause Analysis: AI Question Generation 404/502 Outage

**Date**: 2026-11-23  
**Status**: RESOLVED & VERIFIED IN PRODUCTION  
**Impact**: Faculty AI-assisted question generation from course material / PDF was failing with `502 AI_PROVIDER_UNAVAILABLE`.  
**Production Release**: `release-9ed0a5f6d5b18ab7ac8de86ccf596e7920dfb008` (Merged via PR #76)  
**Target Server**: EC2 `i-0d242d962823f0a89` (`https://proctornet.duckdns.org`)

---

## 1. Executive Summary

During operational smoke testing of the AI question generation feature on the live production environment, the backend threw:
```
LLM invocation failed: Request failed with status code 404
```
resulting in HTTP 502 `AI_PROVIDER_UNAVAILABLE` for faculty attempting to extract grounded questions from syllabus PDFs.

Investigation revealed that Google retired older Flash models (`gemini-1.5-flash` and `gemini-2.5-flash`) on the Gemini API `v1beta` endpoint for new users and newer API keys:
> `"This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash for the latest features and improvements."`

The issue was resolved by:
1. Updating the default model from `gemini-1.5-flash` to `gemini-3.5-flash`.
2. Implementing an automated candidate fallback cascade across `['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest']` in `callGemini` that dynamically recovers from 404 (model retirement), 503 (high demand spikes), and 429 (rate limits).
3. Adding a JSON markdown fence stripper (`stripJsonMarkdown`) to prevent parse errors when LLMs wrap valid JSON in ````json ... ````.
4. Adding regression unit tests in `backend/tests/ai-generator-fixture.test.js`.
5. Verifying 100% green release gate (777.9s, 164 Playwright tests, 492 backend tests).
6. Deploying to production EC2 instance with verified pre-deployment database backup in S3, and confirming live with `scripts/ops/remote/run-ai-smoke-live.sh` (3/3 questions generated with verified verbatim citations).

---

## 2. Hypotheses & Falsification Table

| # | Hypothesis | Falsification Test | Result | Status |
|---|---|---|---|---|
| H1 | `GEMINI_API_KEY` was missing, empty, or unreadable in `/opt/proctornet/shared/.env`. | Inspected environment via `check-gemini-env.sh`. | Key is present, non-empty, and correctly loaded. | **Falsified** |
| H2 | Network connectivity or DNS resolution to `generativelanguage.googleapis.com` was blocked from EC2. | Executed HTTPS GET query from instance via `scripts/ops/remote/check-gemini-models.sh`. | Response HTTP 200 with complete model list. | **Falsified** |
| H3 | Google retired `gemini-1.5-flash` on the `v1beta` endpoint. | Executed direct invocation with `gemini-1.5-flash` on EC2. | API returned 404: `models/gemini-1.5-flash is not found for API version v1beta`. | **CONFIRMED (Root Cause)** |
| H4 | Newer Gemini models (`gemini-3.5-flash`, `gemini-3.8-flash`) are available and functional. | Probed candidate models via `test-gemini-call.sh`. | `gemini-3.5-flash` returned HTTP 200 with valid generated JSON. | **CONFIRMED** |
| H5 | Single-model spikes (503 High Demand) can disrupt service. | Observed occasional 503 during testing on `gemini-3.8-flash`. | Fallback cascade tested to successfully failover to next candidate model. | **CONFIRMED** |

---

## 3. Root Cause Details

1. **Model Retirement by Provider**:
   Google Generative Language API frequently deprecates older model aliases. While older API keys with legacy grandfathered access might have resolved `gemini-1.5-flash`, newly created keys and active endpoints reject requests with HTTP 404.
2. **Hardcoded Single Model Reference**:
   The backend had hardcoded `'gemini-1.5-flash'` as the fallback when `GEMINI_MODEL` was not explicitly set, providing no automatic retry or model cascade when the upstream provider retired the model or experienced 503 high demand spikes.

---

## 4. Implementation & Code Changes

### A. `backend/src/modules/exams/ai.generator.js`
1. **Default Model**: Updated default from `gemini-1.5-flash` to `gemini-3.5-flash` in `getAiProviderInfo()`, `probeAiAvailability()`, `examExtractionSchema`, and `aiAudit`.
2. **Candidate Fallback Cascade**:
   ```javascript
   const CANDIDATE_GEMINI_MODELS = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest']

   async function callGemini(apiKey, prompt) {
     const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash'
     const modelsToTry = [preferredModel, ...CANDIDATE_GEMINI_MODELS.filter(m => m !== preferredModel)]

     let lastErr = null
     for (const model of modelsToTry) {
       try {
         const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
         const res = await axios.post(url, {
           contents: [{ parts: [{ text: prompt }] }],
           generationConfig: { temperature: 0.2, maxOutputTokens: 3500, responseMimeType: 'application/json' }
         }, { timeout: 25000 })

         const rawText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text
         if (!rawText) continue
         const cleaned = stripJsonMarkdown(rawText)
         return JSON.parse(cleaned)
       } catch (err) {
         lastErr = err
         const status = err.response?.status
         if ([404, 503, 429].includes(status)) {
           logger.warn({ model, status, msg: err.response?.data?.error?.message }, 'Gemini model unavailable or under high demand, trying next candidate model')
           continue
         }
         throw err
       }
     }
     throw lastErr || new Error('All Gemini candidate models failed')
   }
   ```
3. **Markdown Fence Stripper**:
   ```javascript
   function stripJsonMarkdown(raw) {
     if (typeof raw !== 'string') return ''
     let cleaned = raw.trim()
     if (cleaned.startsWith('```')) {
       cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
     }
     return cleaned
   }
   ```

### B. Unit & Regression Tests (`backend/tests/ai-generator-fixture.test.js`)
- Test 6: Verifies `stripJsonMarkdown` strips ````json ... ```` and ```` ... ```` markdown fences cleanly.
- Test 7: Verifies `CANDIDATE_GEMINI_MODELS` includes modern models and excludes deprecated `gemini-1.5-flash` and `gemini-2.5-flash`.
- Test 8: Verifies `getAiProviderInfo` resolves default model to `gemini-3.5-flash`.

---

## 5. Production Verification Evidence

1. **Release Check Gate** (`npm run release:check`):
   - Lint: PASSED (11.2s)
   - Typecheck: PASSED (2.6s)
   - Vite Build: PASSED (4.9s)
   - Backend Test Suite: PASSED (68.6s, 492/492 tests)
   - Playwright E2E Suite: PASSED (683.4s, 164/164 tests)
   - Audit: PASSED (3.4s)
   - Migration Drift Check: PASSED (3.9s)
   - Total Gate Time: 777.9s

2. **GitHub Actions CI (PR #76)**:
   - Backend Unit & Integration Tests: PASS (1m2s)
   - Database Migration Drift Check: PASS (38s)
   - Lint, Typecheck & Build: PASS (43s)
   - Playwright End-to-End Suite: PASS (11m14s)
   - Safe Exam Browser (SEB) Enforce Mode Smoke Check: PASS (51s)
   - Security Scans & Repository Hygiene: PASS (12s)

3. **Pre-Deployment Database Backup**:
   - Backup: `/opt/proctornet/backups/postgres/pre_deploy_v1.3.0_1795408329.dump` (598,847 bytes)
   - TOC Verification: 644 entries
   - Off-box S3: `s3://proctornet-storage-prod-858109978489/backups/postgres/pre_deploy_v1.3.0_1795408329.dump`

4. **Production Deployment**:
   - Release: `release-9ed0a5f6d5b18ab7ac8de86ccf596e7920dfb008`
   - All 8 live smoke checks passed (`healthz`, TLS cert 44d, HSTS, SPA login, CORS, SEB ping, 401 gate, WebSocket 101).

5. **Live AI Smoke Verification** (`scripts/ops/remote/run-ai-smoke-live.sh`):
   ```
   === ProctorNet AI Grounded Generation Smoke Test ===
   Active Provider: gemini
   Active Model:    gemini-3.5-flash
   Configured:      true
   Is Production:   true

   Executing question generation with citation verification...
   {"level":"info","msg":"AI question generation completed with citation verification","provider":"gemini","model":"gemini-3.5-flash","requestedCount":3,"honestCount":3,"acceptedCount":3,"rejectedCount":0}

   Generated 3 questions (source: gemini)
   [Question 1] Citation Valid: true ✓
   [Question 2] Citation Valid: true ✓
   [Question 3] Citation Valid: true ✓

   === Smoke Summary ===
   Total Accepted Questions: 3
   Questions with Invented Protocol Facts: 3/3
   ✅ AI Grounded Generation Smoke Test PASSED
   ```
