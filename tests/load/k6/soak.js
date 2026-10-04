import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

export const answerAckDuration = new Trend('answer_ack_ms')
export const errorRate = new Rate('custom_error_rate')

export const options = {
  stages: [
    { duration: '30s', target: 200 },
    { duration: '1m', target: 400 }, // 80% of Tier A
    { duration: __ENV.SOAK_DURATION || '5m', target: 400 },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    'answer_ack_ms': ['p(95)<150', 'p(99)<400'],
    'http_req_failed': ['rate<0.005']
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

  // 3. Steady answer saves
  for (let i = 0; i < 3; i++) {
    const q = questions[i]
    if (q && q.options && q.options.length > 0) {
      sleep(2)
      const res = http.put(
        `${BASE_URL}/api/v1/attempts/${attemptId}/answers`,
        JSON.stringify({
          answers: [{ attemptQuestionId: q.attemptQuestionId || q.id, optionId: q.options[0].id, revision: 1 }]
        }),
        { headers: authHeaders }
      )
      answerAckDuration.add(res.timings.duration)
      check(res, { 'batch save 200': (r) => r.status === 200 })
    }
  }

  sleep(5)
}
