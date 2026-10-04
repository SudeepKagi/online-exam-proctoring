import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

export const loginDuration = new Trend('login_ms')
export const startDuration = new Trend('start_ms')
export const answerAckDuration = new Trend('answer_ack_ms')
export const submitDuration = new Trend('submit_ms')
export const errorRate = new Rate('custom_error_rate')

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '1m', target: 250 },
    { duration: '2m', target: 500 },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    'login_ms': ['p(95)<400'],
    'start_ms': ['p(95)<800'],
    'answer_ack_ms': ['p(95)<150', 'p(99)<400'],
    'submit_ms': ['p(95)<500'],
    'http_req_failed': ['rate<0.01']
  }
}

const BASE_URL = __ENV.API_URL || 'http://localhost:5000'
const EXAM_ID = __ENV.EXAM_ID || 'a0000000-0000-4000-8000-000000000001'

export default function () {
  const vuId = (__VU % 500) + 1
  const email = `loadtest-student-${vuId}@proctornet.test`
  const password = 'Student123!'

  // 1. Login
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' }
  })
  loginDuration.add(loginRes.timings.duration)

  if (loginRes.status !== 200) {
    errorRate.add(1)
    return
  }

  const token = loginRes.json('token')
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }

  // 2. Start / Resume
  const startRes = http.post(`${BASE_URL}/api/v1/exams/${EXAM_ID}/attempt`, null, {
    headers: authHeaders
  })
  startDuration.add(startRes.timings.duration)

  if (startRes.status !== 200) {
    errorRate.add(1)
    return
  }

  const attemptId = startRes.json('id')
  const questions = startRes.json('questions') || []

  // 3. Answer saving loop (batch dirty flush)
  const answersBatch = []
  for (let i = 0; i < Math.min(5, questions.length); i++) {
    const q = questions[i]
    if (q.options && q.options.length > 0) {
      answersBatch.push({
        attemptQuestionId: q.attemptQuestionId || q.id,
        optionId: q.options[0].id,
        revision: 1
      })
    }
  }

  if (answersBatch.length > 0) {
    sleep(1)
    const batchRes = http.put(
      `${BASE_URL}/api/v1/attempts/${attemptId}/answers`,
      JSON.stringify({ answers: answersBatch }),
      { headers: authHeaders }
    )
    answerAckDuration.add(batchRes.timings.duration)
    check(batchRes, { 'answers saved': (r) => r.status === 200 })
  }

  sleep(2)
}
