import http from 'k6/http'
import { check } from 'k6'
import { Trend, Rate } from 'k6/metrics'

export const submitDuration = new Trend('submit_ms')
export const errorRate = new Rate('submit_error_rate')

export const options = {
  setupTimeout: '3m',
  scenarios: {
    submit_burst: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 400,
      stages: [
        { duration: '5s', target: 20 },
        { duration: '15s', target: 150 }, // Concentrated submission surge
        { duration: '10s', target: 20 },
        { duration: '5s', target: 5 }
      ]
    }
  },
  thresholds: {
    'submit_ms': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.01']
  }
}

const BASE_URL = __ENV.API_URL || 'http://localhost:5000'
const EXAM_ID = __ENV.EXAM_ID || 'a0000000-0000-4000-8000-000000000001'

export function setup() {
  const sessions = []
  const count = 25

  for (let i = 1; i <= count; i++) {
    const email = `loadtest-student-${i}@proctornet.test`
    const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({ email, password: 'Student123!' }), {
      headers: { 'Content-Type': 'application/json' }
    })
    if (loginRes.status === 200) {
      const token = loginRes.json('token')
      const startRes = http.post(`${BASE_URL}/api/v1/exams/${EXAM_ID}/attempt`, null, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      })
      if (startRes.status === 200) {
        sessions.push({
          token,
          attemptId: startRes.json('id')
        })
      }
    }
  }

  return { sessions }
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export default function (data) {
  if (!data.sessions || data.sessions.length === 0) return
  const session = data.sessions[__VU % data.sessions.length]

  const idempotencyKey = uuidv4()
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.token}`,
    'Idempotency-Key': idempotencyKey
  }

  const submitRes = http.post(
    `${BASE_URL}/api/v1/attempts/${session.attemptId}/submission`,
    JSON.stringify({ answers: [] }),
    { headers: authHeaders }
  )

  submitDuration.add(submitRes.timings.duration)
  const ok = check(submitRes, {
    'submit status 200 or 409': (r) => r.status === 200 || r.status === 409
  })

  if (!ok) {
    errorRate.add(1)
  }
}
