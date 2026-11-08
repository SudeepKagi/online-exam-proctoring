import http from 'k6/http'
import { check } from 'k6'
import { Trend, Rate } from 'k6/metrics'
import crypto from 'k6/crypto'

const startDuration = new Trend('seb_exam_start_duration_ms')
const answersDuration = new Trend('seb_exam_answers_duration_ms')
const submitDuration = new Trend('seb_exam_submit_duration_ms')

const startErrors = new Rate('seb_exam_start_errors')
const answersErrors = new Rate('seb_exam_answers_errors')
const submitErrors = new Rate('seb_exam_submit_errors')

export const options = {
  scenarios: {
    seb_lifecycle: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: {
    seb_exam_start_errors: ['rate<0.01'],
    seb_exam_answers_errors: ['rate<0.01'],
    seb_exam_submit_errors: ['rate<0.01'],
    seb_exam_start_duration_ms: ['p(95)<1000'],
    seb_exam_answers_duration_ms: ['p(95)<500'],
    seb_exam_submit_duration_ms: ['p(95)<1000'],
  },
}

const testDataRaw = open('./load-test-data.json')

export function setup() {
  return JSON.parse(testDataRaw)
}

export default function (data) {
  const vuIndex = __VU - 1
  const student = data.students[vuIndex % data.students.length]
  const configKey = data.configKey
  const baseUrl = data.baseUrl
  const publicOrigin = data.publicOrigin || baseUrl

  function makeSebHeaders(path, token) {
    const canonicalUrl = `${publicOrigin}${path}`
    const hash = crypto.sha256(canonicalUrl + configKey, 'hex')
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-SafeExamBrowser-ConfigKeyHash': hash,
    }
  }

  // 1. Start Exam under SEB_MODE=enforce
  const startPath = `/api/v1/attempts/exams/${data.examId}/start`
  const startRes = http.post(`${baseUrl}${startPath}`, JSON.stringify({}), {
    headers: makeSebHeaders(startPath, student.token),
  })
  if (startRes.status !== 200 && startRes.status !== 201) {
    console.log(`[START FAILED] Status: ${startRes.status}, Body: ${startRes.body}`)
  }
  startDuration.add(startRes.timings.duration)
  const startOk = check(startRes, {
    'start status is 200 or 201': (r) => r.status === 200 || r.status === 201,
  })
  startErrors.add(!startOk)

  let attemptId = null
  try {
    const body = startRes.json()
    attemptId = (body.attempt && body.attempt.id) || body.id || (body.data && body.data.id)
  } catch (_e) {}

  if (!attemptId) return

  // 2. Autosave Answers under SEB_MODE=enforce
  const answersPath = `/api/v1/attempts/${attemptId}/answers`
  const answersPayload = JSON.stringify({
    answers: data.questions.map((q, idx) => ({
      questionId: q.id,
      selectedOptionIndex: idx % 4,
    })),
  })
  const answersRes = http.put(`${baseUrl}${answersPath}`, answersPayload, {
    headers: makeSebHeaders(answersPath, student.token),
  })
  answersDuration.add(answersRes.timings.duration)
  const answersOk = check(answersRes, {
    'answers status is 200': (r) => r.status === 200,
  })
  answersErrors.add(!answersOk)

  // 3. Submit Exam under SEB_MODE=enforce
  const submitPath = `/api/v1/attempts/${attemptId}/submit`
  const submitRes = http.post(`${baseUrl}${submitPath}`, JSON.stringify({}), {
    headers: makeSebHeaders(submitPath, student.token),
  })
  submitDuration.add(submitRes.timings.duration)
  const submitOk = check(submitRes, {
    'submit status is 200': (r) => r.status === 200,
  })
  submitErrors.add(!submitOk)
}
