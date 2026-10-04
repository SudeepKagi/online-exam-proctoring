import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

// Custom Section 10.2 Trends & Metrics
export const loginDuration = new Trend('login_ms')
export const startDuration = new Trend('start_ms')
export const answerAckDuration = new Trend('answer_ack_ms')
export const submitDuration = new Trend('submit_ms')
export const errorRate = new Rate('custom_error_rate')

export const options = {
  vus: 10,
  duration: '30s',
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

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export default function () {
  const vuId = (__VU % 500) + 1
  const email = `loadtest-student-${vuId}@proctornet.test`
  const password = 'Student123!'

  // 1. Login
  const loginPayload = JSON.stringify({ email, password })
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' }
  })

  loginDuration.add(loginRes.timings.duration)
  const loginOk = check(loginRes, {
    'login status 200': (r) => r.status === 200,
    'has access token': (r) => r.json('token') !== undefined
  })
  if (!loginOk) {
    errorRate.add(1)
    sleep(1)
    return
  }

  const token = loginRes.json('token')
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }

  // 2. Start / Resume Attempt
  const startRes = http.post(`${BASE_URL}/api/v1/exams/${EXAM_ID}/attempt`, null, {
    headers: authHeaders
  })
  startDuration.add(startRes.timings.duration)

  const startOk = check(startRes, {
    'start status 200': (r) => r.status === 200,
    'attempt id returned': (r) => r.json('id') !== undefined
  })
  if (!startOk) {
    errorRate.add(1)
    sleep(1)
    return
  }

  const attemptId = startRes.json('id')
  const questions = startRes.json('questions') || []

  // 3. Answer 3 Questions (Autosave batch and individual)
  if (questions.length > 0) {
    const q1 = questions[0]
    const opt1 = q1.options && q1.options[0] ? q1.options[0].id : null

    if (opt1) {
      // Individual PUT
      const q1Id = q1.attemptQuestionId || q1.id
      const putRes = http.put(
        `${BASE_URL}/api/v1/attempts/${attemptId}/answers/${q1Id}`,
        JSON.stringify({ optionId: opt1, revision: 1 }),
        { headers: authHeaders }
      )
      answerAckDuration.add(putRes.timings.duration)
      check(putRes, { 'individual save 200': (r) => r.status === 200 })
    }

    if (questions.length >= 2) {
      const q2 = questions[1]
      const opt2 = q2.options && q2.options[0] ? q2.options[0].id : null
      const q2Id = q2.attemptQuestionId || q2.id

      // Batch PUT
      const batchRes = http.put(
        `${BASE_URL}/api/v1/attempts/${attemptId}/answers`,
        JSON.stringify({
          answers: [
            { attemptQuestionId: q2Id, optionId: opt2, revision: 1 }
          ]
        }),
        { headers: authHeaders }
      )
      answerAckDuration.add(batchRes.timings.duration)
      check(batchRes, { 'batch save 200': (r) => r.status === 200 })
    }
  }

  sleep(1)

  // 4. Submit
  const submitRes = http.post(
    `${BASE_URL}/api/v1/attempts/${attemptId}/submission`,
    JSON.stringify({ answers: [] }),
    {
      headers: Object.assign({}, authHeaders, {
        'Idempotency-Key': uuidv4()
      })
    }
  )
  submitDuration.add(submitRes.timings.duration)
  check(submitRes, { 'submit status 200': (r) => r.status === 200 })

  sleep(2)
}
