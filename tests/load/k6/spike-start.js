import http from 'k6/http'
import { check } from 'k6'
import { Trend, Rate } from 'k6/metrics'

export const startDuration = new Trend('start_ms')
export const errorRate = new Rate('start_error_rate')

export const options = {
  scenarios: {
    start_spike: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 600,
      stages: [
        { duration: '5s', target: 20 },
        { duration: '10s', target: 200 }, // Sudden Gaussian spike peak (200 req/sec)
        { duration: '10s', target: 50 },
        { duration: '5s', target: 10 }
      ]
    }
  },
  thresholds: {
    'start_ms': ['p(95)<800', 'p(99)<1500'],
    'http_req_failed': ['rate<0.01']
  }
}

const BASE_URL = __ENV.API_URL || 'http://localhost:5000'
const EXAM_ID = __ENV.EXAM_ID || 'a0000000-0000-4000-8000-000000000001'

export function setup() {
  // Pre-authenticate a pool of test tokens to isolate start endpoint latency
  const tokens = []
  const count = 50
  for (let i = 1; i <= count; i++) {
    const email = `loadtest-student-${i}@proctornet.test`
    const res = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({ email, password: 'Student123!' }), {
      headers: { 'Content-Type': 'application/json' }
    })
    if (res.status === 200) {
      tokens.push(res.json('token'))
    }
  }
  return { tokens }
}

export default function (data) {
  const token = data.tokens[__VU % data.tokens.length]
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }

  const startRes = http.post(`${BASE_URL}/api/v1/exams/${EXAM_ID}/attempt`, null, {
    headers: authHeaders
  })

  startDuration.add(startRes.timings.duration)
  const ok = check(startRes, {
    'start status 200': (r) => r.status === 200,
    'has attempt id': (r) => r.json('id') !== undefined
  })

  if (!ok) {
    errorRate.add(1)
  }
}
