#!/usr/bin/env node
/**
 * verify-edge-s1.js
 * Automated acceptance suite for Phase S1 — Edge: HTTPS, headers, routing.
 * Tests live endpoints against the canonical production domain.
 */

const https = require('https');
const http = require('http');
const { io } = require('socket.io-client');
const assert = require('assert');

const DOMAIN = process.env.DOMAIN_NAME || 'proctornet.duckdns.org';
const PUBLIC_IP = process.env.PUBLIC_IP || '43.204.45.86';

function request(urlStr, options = {}) {
  const url = new URL(urlStr);
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(urlStr, { method: options.method || 'GET', headers: options.headers || {} }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function run() {
  console.log(`==========================================================`);
  console.log(` Starting S1 Edge Verification Suite: ${DOMAIN}`);
  console.log(` Timestamp: ${new Date().toISOString()}`);
  console.log(`==========================================================\n`);

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(` [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(` [FAIL] ${name}: ${err.message}`);
    }
  }

  // 1. HTTPS Main page & Security Headers
  console.log(`1. Inspecting HTTPS root: https://${DOMAIN}/ ...`);
  const rootRes = await request(`https://${DOMAIN}/`);
  test('Root returns 200 OK', () => assert.strictEqual(rootRes.statusCode, 200));
  test('Strict-Transport-Security has ramp value max-age=300', () => {
    assert.strictEqual(rootRes.headers['strict-transport-security'], 'max-age=300');
  });
  test('Permissions-Policy specifies camera, mic, display-capture = self', () => {
    assert.ok(rootRes.headers['permissions-policy']?.includes('camera=(self)'));
    assert.ok(rootRes.headers['permissions-policy']?.includes('display-capture=(self)'));
  });
  test('Content-Security-Policy is present and restricts script/connect origins', () => {
    const csp = rootRes.headers['content-security-policy'];
    assert.ok(csp, 'CSP must be present');
    assert.ok(csp.includes(`wss://${DOMAIN}`), 'CSP must allow wss on domain');
    assert.ok(!csp.includes("'unsafe-eval'"), 'CSP must not allow unconstrained unsafe-eval');
  });
  test('X-Content-Type-Options is nosniff', () => {
    assert.strictEqual(rootRes.headers['x-content-type-options'], 'nosniff');
  });
  test('X-Frame-Options is DENY', () => {
    assert.strictEqual(rootRes.headers['x-frame-options'], 'DENY');
  });
  test('HTML Cache-Control is no-store', () => {
    assert.ok(rootRes.headers['cache-control']?.includes('no-store'));
  });
  test('X-Request-ID header is propagated', () => {
    assert.ok(rootRes.headers['x-request-id'], 'X-Request-ID must be present');
  });

  // 2. HTTP to HTTPS redirect
  console.log(`\n2. Inspecting HTTP -> HTTPS redirect ...`);
  const httpRes = await request(`http://${DOMAIN}/`);
  test('HTTP redirects to HTTPS with 308 or 301', () => {
    assert.ok([301, 308].includes(httpRes.statusCode));
    assert.strictEqual(httpRes.headers['location'], `https://${DOMAIN}/`);
  });

  // 3. Raw IP redirect
  console.log(`\n3. Inspecting Raw IP redirect: http://${PUBLIC_IP} ...`);
  const ipRes = await request(`http://${PUBLIC_IP}/`);
  test('Raw IP redirects to canonical HTTPS domain', () => {
    assert.ok([301, 308].includes(ipRes.statusCode));
    assert.strictEqual(ipRes.headers['location'], `https://${DOMAIN}/`);
  });

  // 4. Public telemetry blocking (EDGE-01)
  console.log(`\n4. Inspecting Telemetry route blocking ...`);
  const readyzRes = await request(`https://${DOMAIN}/readyz`);
  test('Public /readyz returns 404 Not Found', () => {
    assert.strictEqual(readyzRes.statusCode, 404);
  });

  const metricsRes = await request(`https://${DOMAIN}/metrics`);
  test('Public /metrics returns 404 Not Found', () => {
    assert.strictEqual(metricsRes.statusCode, 404);
  });

  // 5. Backend health proxying
  console.log(`\n5. Inspecting /healthz endpoint ...`);
  const healthRes = await request(`https://${DOMAIN}/healthz`);
  test('Public /healthz proxies to backend returning 200 OK', () => {
    assert.strictEqual(healthRes.statusCode, 200);
    const body = JSON.parse(healthRes.body);
    assert.strictEqual(body.status, 'ok');
  });

  // 6. Real-time WebSocket connection over wss://
  console.log(`\n6. Testing WebSocket over wss://${DOMAIN} ...`);
  let wsConnected = false;
  try {
    const postData = JSON.stringify({ email: 'admin@proctornet.com', password: 'Admin@123' });
    const loginRes = await request(`https://${DOMAIN}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
      body: postData
    });
    const cookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0] : null;
    const body = JSON.parse(loginRes.body);
    const token = body.token;

    test('Login cookie has HttpOnly and Secure attributes', () => {
      assert.ok(cookie?.includes('HttpOnly'), 'Cookie must be HttpOnly');
      assert.ok(cookie?.includes('Secure'), 'Cookie must be Secure');
      assert.ok(cookie?.includes('SameSite=Lax'), 'Cookie must be SameSite=Lax');
    });

    const socket = io(`https://${DOMAIN}`, {
      transports: ['websocket'],
      extraHeaders: { cookie },
      auth: { token },
      timeout: 8000
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        wsConnected = true;
        socket.disconnect();
        resolve();
      });
      socket.on('connect_error', err => reject(err));
      setTimeout(() => reject(new Error('WebSocket timeout')), 8000);
    });
  } catch (err) {
    console.error('WebSocket test exception:', err.message);
  }

  test('WebSocket connects over wss:// with authenticated session', () => {
    assert.strictEqual(wsConnected, true);
  });

  console.log(`\n==========================================================`);
  console.log(` S1 Test Results: ${passed}/${total} passed`);
  console.log(`==========================================================`);

  if (passed !== total) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
