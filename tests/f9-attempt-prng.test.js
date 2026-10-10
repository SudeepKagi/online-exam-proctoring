const { describe, it } = require('node:test')
const assert = require('node:assert')
const path = require('path')

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'
process.env.QUEUE_DRIVER = 'postgres'
process.env.START_WORKERS = 'false'

const BACKEND_ROOT = path.resolve(__dirname, '../proctornet/backend')
const {
  createSeededRng,
  shuffleArray,
  buildAttemptQuestions
} = require(path.join(BACKEND_ROOT, 'src/modules/attempts/repository'))

describe('F9 — Deterministic Mulberry32 PRNG & Unified buildAttemptQuestions', () => {
  it('F9.1: createSeededRng never collapses to zero on empty seed', () => {
    const rng = createSeededRng('')
    const v1 = rng()
    const v2 = rng()
    const v3 = rng()
    assert.strictEqual(v1 === 0 && v2 === 0 && v3 === 0, false)
    assert.ok(v1 > 0 && v1 < 1)
    assert.ok(v2 > 0 && v2 < 1)
    assert.ok(v3 > 0 && v3 < 1)
  })

  it('F9.2: createSeededRng passes distribution sanity over 2,000 samples', () => {
    const rng = createSeededRng('distribution-sanity-seed-12345')
    let sum = 0
    const N = 2000
    for (let i = 0; i < N; i++) {
      const v = rng()
      assert.ok(v >= 0 && v < 1, `Value ${v} must be in [0, 1)`)
      sum += v
    }
    const mean = sum / N
    assert.ok(mean >= 0.46 && mean <= 0.54, `Mean ${mean} must be close to 0.5`)
  })

  it('F9.3: deterministic replay — identical seed produces identical order', () => {
    const questions = [
      { id: 'q1', order: 1, options: [{ id: 'o1', order: 1 }, { id: 'o2', order: 2 }, { id: 'o3', order: 3 }, { id: 'o4', order: 4 }] },
      { id: 'q2', order: 2, options: [{ id: 'o5', order: 1 }, { id: 'o6', order: 2 }, { id: 'o7', order: 3 }, { id: 'o8', order: 4 }] },
      { id: 'q3', order: 3, options: [{ id: 'o9', order: 1 }, { id: 'o10', order: 2 }, { id: 'o11', order: 3 }, { id: 'o12', order: 4 }] },
      { id: 'q4', order: 4, options: [{ id: 'o13', order: 1 }, { id: 'o14', order: 2 }, { id: 'o15', order: 3 }, { id: 'o16', order: 4 }] },
      { id: 'q5', order: 5, options: [{ id: 'o17', order: 1 }, { id: 'o18', order: 2 }, { id: 'o19', order: 3 }, { id: 'o20', order: 4 }] },
    ]

    const exam = {
      randomiseQuestions: true,
      randomiseOptions: true,
      questionsPerStudent: 0
    }

    const seed = 'consistent-attempt-seed-abc'
    const run1 = buildAttemptQuestions(exam, questions, seed)
    const run2 = buildAttemptQuestions(exam, questions, seed)

    assert.strictEqual(run1.length, 5)
    assert.strictEqual(run2.length, 5)

    for (let i = 0; i < 5; i++) {
      assert.strictEqual(run1[i].questionId, run2[i].questionId)
      assert.strictEqual(run1[i].displayOrder, run2[i].displayOrder)
      assert.deepStrictEqual(run1[i].optionOrder, run2[i].optionOrder)
    }
  })

  it('F9.4: honors randomiseQuestions: false and randomiseOptions: false', () => {
    const questions = [
      { id: 'q1', order: 1, options: [{ id: 'o1', order: 1 }, { id: 'o2', order: 2 }] },
      { id: 'q2', order: 2, options: [{ id: 'o3', order: 1 }, { id: 'o4', order: 2 }] },
      { id: 'q3', order: 3, options: [{ id: 'o5', order: 1 }, { id: 'o6', order: 2 }] }
    ]

    const exam = {
      randomiseQuestions: false,
      randomiseOptions: false,
      questionsPerStudent: 0
    }

    const res = buildAttemptQuestions(exam, questions, 'arbitrary-seed')

    assert.strictEqual(res[0].questionId, 'q1')
    assert.strictEqual(res[1].questionId, 'q2')
    assert.strictEqual(res[2].questionId, 'q3')

    assert.deepStrictEqual(res[0].optionOrder, [0, 1])
    assert.deepStrictEqual(res[1].optionOrder, [0, 1])
    assert.deepStrictEqual(res[2].optionOrder, [0, 1])
  })

  it('F9.5: honors questionsPerStudent subsetting', () => {
    const questions = [
      { id: 'q1', order: 1, options: [{ id: 'o1', order: 1 }] },
      { id: 'q2', order: 2, options: [{ id: 'o2', order: 1 }] },
      { id: 'q3', order: 3, options: [{ id: 'o3', order: 1 }] },
      { id: 'q4', order: 4, options: [{ id: 'o4', order: 1 }] }
    ]

    const exam = {
      randomiseQuestions: false,
      randomiseOptions: false,
      questionsPerStudent: 2
    }

    const res = buildAttemptQuestions(exam, questions, 'subset-seed')
    assert.strictEqual(res.length, 2)
    assert.strictEqual(res[0].displayOrder, 1)
    assert.strictEqual(res[1].displayOrder, 2)
  })
})
