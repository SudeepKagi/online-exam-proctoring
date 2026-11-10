import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'
import crypto from 'k6/crypto'

const startDuration = new Trend('seb_exam_start_duration_ms')
const answersDuration = new Trend('seb_exam_answers_duration_ms')
const submitDuration = new Trend('seb_exam_submit_duration_ms')

const startErrors = new Rate('seb_exam_start_errors')
const answersErrors = new Rate('seb_exam_answers_errors')
const submitErrors = new Rate('seb_exam_submit_errors')

const testDataRaw = open('./load-test-data.json')
const testData = JSON.parse(testDataRaw)

export const options = {
  scenarios: {
    seb_lifecycle: {
      executor: 'per-vu-iterations',
      vus: testData.studentsCount || 20,
      iterations: 1,
      maxDuration: `${(testData.maxDurationSec || 600)}s`,
    },
  },
  thresholds: {
    seb_exam_start_errors: ['rate<0.01'],
    seb_exam_answers_errors: ['rate<0.01'],
    seb_exam_submit_errors: ['rate<0.01'],
    seb_exam_start_duration_ms: ['p(95)<1500'],
    seb_exam_answers_duration_ms: ['p(95)<400'],
    seb_exam_submit_duration_ms: ['p(95)<1500'],
  },
}

export function setup() {
  return testData
}

export default function (data) {
  const vuIndex = __VU - 1
  const student = data.students[vuIndex % data.students.length]
  const configKey = data.configKey
  const baseUrl = data.baseUrl
  const publicOrigin = data.publicOrigin || baseUrl
  const rampWindow = data.rampWindowSec || 5
  const autosaveInterval = data.autosaveIntervalSec || 10
  const autosaveDuration = data.autosaveDurationSec || 30
  const submitWindow = data.submitWindowSec || 5

  function makeSebHeaders(path, token) {
    const canonicalUrl = `${publicOrigin}${path}`
    const hash = crypto.sha256(canonicalUrl + configKey, 'hex')
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-SafeExamBrowser-ConfigKeyHash': hash,
    }
  }

  // 1. Staggered Start Window (simulating starts over ramp window)
  const startDelay = Math.random() * rampWindow
  sleep(startDelay)

  const startPath = `/api/v1/attempts/exams/${data.examId}/start`
  const startRes = http.post(`${baseUrl}${startPath}`, JSON.stringify({}), {
    headers: makeSebHeaders(startPath, student.token),
  })

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

  // 2. Periodic Autosave Loop (every 10s for autosaveDuration)
  const autosaveCycles = Math.max(1, Math.floor(autosaveDuration / autosaveInterval))
  for (let cycle = 0; cycle < autosaveCycles; cycle++) {
    sleep(autosaveInterval)

    const answersPath = `/api/v1/attempts/${attemptId}/answers`
    const answersPayload = JSON.stringify({
      answers: data.questions.map((q, idx) => ({
        questionId: q.id,
        selectedOptionIndex: (idx + cycle) % 4,
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
  }

  // 3. Staggered Submit Window
  const submitDelay = Math.random() * submitWindow
  sleep(submitDelay)

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
