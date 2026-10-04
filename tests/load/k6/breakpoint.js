import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

export const answerAckDuration = new Trend('answer_ack_ms')
export const errorRate = new Rate('custom_error_rate')

export const options = {
  stages: [
    { duration: '30s', target: 250 },
    { duration: '1m', target: 500 },    // Tier A
    { duration: '1m', target: 1000 },   // Tier B
    { duration: '1m', target: 1500 },
    { duration: '1m', target: 2000 },   // Tier C (Stretch)
    { duration: '1m', target: 2500 },   // Breakpoint Search
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    'answer_ack_ms': ['p(95)<400'],
    'http_req_failed': ['rate<0.05']
  }
}

const BASE_URL = __ENV.API_URL || 'http://localhost:5000'
const EXAM_ID = __ENV.EXAM_ID || 'a0000000-0000-4000-8000-000000000001'

export default function () {
  const vuId = (__VU % 500) + 1
  const email = `loadtest-student-${vuId}@proctornet.test`

  // 1. Auth
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({ email, password: 'Student123!' }), {
    headers: { 'Content-Type': 'application/json' }
  })
  if (loginRes.status !== 200) {
    errorRate.add(1)
    return
  }
  const token = loginRes.json('token')
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }

  // 2. Start
  const startRes = http.post(`${BASE_URL}/api/v1/exams/${EXAM_ID}/attempt`, null, { headers: authHeaders })
  if (startRes.status !== 200) {
    errorRate.add(1)
    return
  }
  const attemptId = startRes.json('id')
  const questions = startRes.json('questions') || []

  // 3. Fast save
  if (questions.length > 0) {
    const q = questions[0]
    if (q.options && q.options.length > 0) {
      const res = http.put(
        `${BASE_URL}/api/v1/attempts/${attemptId}/answers`,
        JSON.stringify({
          answers: [{ attemptQuestionId: q.id, optionId: q.options[0].id, revision: 1 }]
        }),
        { headers: authHeaders }
      )
      answerAckDuration.add(res.timings.duration)
      check(res, { 'batch save 200': (r) => r.status === 200 })
    }
  }

  sleep(1)
}
