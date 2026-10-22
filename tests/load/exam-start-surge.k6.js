import http from 'k6/http'
import { check } from 'k6'
import { Trend, Rate } from 'k6/metrics'

const surgeDuration = new Trend('exam_start_surge_duration_ms')
const errorRate = new Rate('http_req_failed')

export const options = {
  scenarios: {
    exam_start_surge: {
      executor: 'per-vu-iterations',
      vus: 200,
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate==0'],
    exam_start_surge_duration_ms: ['p(95)<500'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:5000'

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({
      email: 'student1@proctornet.com',
      password: 'Password@12345',
      role: 'student',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  )

  let token = ''
  try {
    const data = loginRes.json()
    token = data.accessToken || data.token || ''
  } catch (_e) {}

  return { token }
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    ...(data.token ? { Authorization: `Bearer ${data.token}` } : {}),
  }

  // 200 students hit the active exams list endpoint simultaneously
  const res = http.get(`${BASE_URL}/api/v1/exams`, { headers })

  surgeDuration.add(res.timings.duration)
  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
  })

  errorRate.add(!ok)
}
