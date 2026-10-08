/**
 * Phase S3 Live Flow Verification Script (verify-flows-s3.js)
 * Tests live endpoints on https://proctornet.duckdns.org for Phase S3 Flow Fixes using native fetch
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'https://proctornet.duckdns.org';
const EVIDENCE_FILE = path.resolve(__dirname, '../../reports/evidence/verify_flows_s3.txt');

const results = [];

function record(id, description, passed, details = '') {
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${id}: ${description} ${details ? '(' + details + ')' : ''}`);
  results.push({ id, description, passed, details });
}

async function runVerification() {
  console.log(`================================================================`);
  console.log(`ProctorNet Phase S3 (Flow Fixes) Live Verification`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`================================================================\n`);

  // Test 1: Healthcheck
  try {
    const res = await fetch(`${BASE_URL}/healthz`);
    record('S3-01', 'Live backend healthz probe', res.status === 200, `status: ${res.status}`);
  } catch (err) {
    record('S3-01', 'Live backend healthz probe', false, err.message);
  }

  // Test 2: FLW-07 Public Student Registration Guard returns 404
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/student/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usn: '1RV21CS001' })
    });
    record('S3-02', 'FLW-07: Public student registration returns 404 NotFoundError', res.status === 404, `status: ${res.status}`);
  } catch (err) {
    record('S3-02', 'FLW-07: Public student registration returns 404 NotFoundError', false, err.message);
  }

  // Test 3: FLW-07 Public Faculty Registration Guard returns 404
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/faculty/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'faculty@rvce.edu.in' })
    });
    record('S3-03', 'FLW-07: Public faculty registration returns 404 NotFoundError', res.status === 404, `status: ${res.status}`);
  } catch (err) {
    record('S3-03', 'FLW-07: Public faculty registration returns 404 NotFoundError', false, err.message);
  }

  // Test 4: FLW-04 Media BOLA unauthenticated access rejection
  try {
    const res = await fetch(`${BASE_URL}/api/v1/media/view?key=identities/secret/id.jpg`);
    record('S3-04', 'FLW-04: Unauthenticated media view access rejected', res.status === 401 || res.status === 403, `status: ${res.status}`);
  } catch (err) {
    record('S3-04', 'FLW-04: Unauthenticated media view access rejected', false, err.message);
  }

  // Test 5: FLW-05 Batch Proctoring Snapshot Endpoint auth rejection
  try {
    const res = await fetch(`${BASE_URL}/api/v1/proctoring/exams/00000000-0000-0000-0000-000000000000/snapshots/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptIds: ['11111111-1111-1111-1111-111111111111'] })
    });
    record('S3-05', 'FLW-05: Batch snapshot read endpoint exists and enforces auth', res.status === 401 || res.status === 403, `status: ${res.status}`);
  } catch (err) {
    record('S3-05', 'FLW-05: Batch snapshot read endpoint exists and enforces auth', false, err.message);
  }

  // Test 6: Admin Login & Dual Cookie Session verification
  let adminCookies = '';
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        email: process.env.ADMIN_EMAIL || 'admin@proctornet.com',
        password: process.env.ADMIN_PASSWORD || 'Admin@123'
      })
    });
    const setCookieHeaders = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
    const hasAt = setCookieHeaders.some(c => c.includes('pn_at='));
    const hasRt = setCookieHeaders.some(c => c.includes('pn_rt='));
    adminCookies = setCookieHeaders.map(c => c.split(';')[0]).join('; ');
    record('S3-06', 'Admin login authenticates and sets pn_at and pn_rt cookies', res.status === 200 && hasAt && hasRt, `status: ${res.status}`);
  } catch (err) {
    record('S3-06', 'Admin login authenticates and sets pn_at and pn_rt cookies', false, err.message);
  }

  // Test 7: FLW-10 / BUG-J02 Admin Settings flat dictionary update
  if (adminCookies) {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/admin/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': adminCookies
        },
        body: JSON.stringify({
          watermarkVisible: 'true',
          preventClipboardCopy: 'true',
          watermarkOpacity: '18'
        })
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.status === 200 && Array.isArray(data?.updated || data?.settings);
      const count = (data?.updated || data?.settings)?.length;
      record('S3-07', 'FLW-10 / BUG-J02: Admin settings flat dictionary update succeeds', ok, `status: ${res.status}, items: ${count}`);
    } catch (err) {
      record('S3-07', 'FLW-10 / BUG-J02: Admin settings flat dictionary update succeeds', false, err.message);
    }

    // Test 8: Admin Settings retrieval
    try {
      const res = await fetch(`${BASE_URL}/api/v1/admin/settings`, {
        headers: { 'Cookie': adminCookies }
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.status === 200 && Array.isArray(data?.settings);
      record('S3-08', 'Admin settings list retrieval succeeds', ok, `status: ${res.status}, count: ${data?.settings?.length}`);
    } catch (err) {
      record('S3-08', 'Admin settings list retrieval succeeds', false, err.message);
    }
  } else {
    record('S3-07', 'FLW-10 / BUG-J02: Admin settings flat dictionary update succeeds', false, 'Skipped: admin login failed');
    record('S3-08', 'Admin settings list retrieval succeeds', false, 'Skipped: admin login failed');
  }

  // Summary & Artifact output
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const allPassed = passedCount === totalCount;

  console.log(`\n================================================================`);
  console.log(`Phase S3 Verification Summary: ${passedCount}/${totalCount} tests passed`);
  console.log(`Status: ${allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}`);
  console.log(`================================================================\n`);

  fs.mkdirSync(path.dirname(EVIDENCE_FILE), { recursive: true });
  const output = [
    `# ProctorNet Phase S3 (Flow Fixes) Verification Evidence`,
    `Target: ${BASE_URL}`,
    `Timestamp: ${new Date().toISOString()}`,
    `Summary: ${passedCount}/${totalCount} Passed\n`,
    ...results.map(r => `[${r.passed ? 'PASS' : 'FAIL'}] ${r.id}: ${r.description} ${r.details ? '(' + r.details + ')' : ''}`)
  ].join('\n');

  fs.writeFileSync(EVIDENCE_FILE, output, 'utf8');
  console.log(`Evidence written to ${EVIDENCE_FILE}`);

  if (!allPassed) {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
