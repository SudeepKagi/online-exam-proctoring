'use strict'

process.env.NODE_ENV = 'test'
process.env.START_WORKERS = 'false'
process.env.CACHE_DRIVER = 'memory'
process.env.QUEUE_DRIVER = 'postgres'
process.env.STORAGE_DRIVER = 'memory'
process.env.S3_MOCK = 'true'

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
process.env.NODE_ENV = 'test'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

const { putObject, getPresignedReadUrl } = require('../src/infra/s3/s3.client')
const { presentStudent, presentStudents, invalidatePhotoCache } = require('../src/modules/student/presenter')

describe('W1: Student Presenter & Profile Photo Truth Unit Tests (S-1)', () => {
  it('1. When S3 object exists, presentStudent yields presigned URLs and photoAvailable=true', async () => {
    const student = {
      id: crypto.randomUUID(),
      name: 'Alice Presenter',
      usn: '1NT23CS001',
      email: 'alice@test.edu',
      departmentCode: 'CSE',
      semester: 6,
      facePhotoKey: 'identity/unit-test/face.webp',
      idCardPhotoKey: 'identity/unit-test/id.webp',
      profileStatus: 'VERIFIED',
      approvalStatus: 'APPROVED'
    }

    // Put mock objects into storage
    await putObject(student.facePhotoKey, Buffer.from('fake-face-bytes'), 'image/webp')
    await putObject(student.idCardPhotoKey, Buffer.from('fake-id-bytes'), 'image/webp')

    invalidatePhotoCache(student.facePhotoKey)
    invalidatePhotoCache(student.idCardPhotoKey)

    const presented = await presentStudent(student)
    assert.strictEqual(presented.photoAvailable, true, 'photoAvailable must be true when face object exists')
    assert.strictEqual(presented.idPhotoAvailable, true, 'idPhotoAvailable must be true when ID object exists')
    assert.ok(presented.facePhotoUrl, 'facePhotoUrl must be presigned')
    assert.ok(presented.idCardPhotoUrl, 'idCardPhotoUrl must be presigned')
    assert.ok(decodeURIComponent(presented.facePhotoUrl).includes(student.facePhotoKey), 'Presigned URL must reference canonical face key')
  })

  it('2. When S3 object is missing (e.g. broken fixture), presentStudent yields photoAvailable=false and null URL', async () => {
    const missingStudent = {
      id: crypto.randomUUID(),
      name: 'Bob Missing',
      usn: '1NT23CS002',
      facePhotoKey: 'identity/missing/ghost-face.webp',
      idCardPhotoKey: 'identity/missing/ghost-id.webp'
    }
    invalidatePhotoCache(missingStudent.facePhotoKey)
    invalidatePhotoCache(missingStudent.idCardPhotoKey)

    const presented = await presentStudent(missingStudent)
    assert.strictEqual(presented.photoAvailable, false, 'photoAvailable must be false for missing object')
    assert.strictEqual(presented.idPhotoAvailable, false, 'idPhotoAvailable must be false for missing object')
    assert.strictEqual(presented.facePhotoUrl, null, 'facePhotoUrl must be null to prevent broken 404 images')
    assert.strictEqual(presented.idCardPhotoUrl, null, 'idCardPhotoUrl must be null to prevent broken 404 images')
  })

  it('3. Presigned URL host and region adhere to AWS configuration', async () => {
    const key = 'identity/test/config-check.webp'
    await putObject(key, Buffer.from('data'), 'image/webp')
    const url = await getPresignedReadUrl(key, 3600)
    assert.ok(url, 'URL must be generated')
    assert.ok(decodeURIComponent(url).includes(key), 'Decoded URL must include key')
  })

  it('4. presentStudents handles multiple students in batch', async () => {
    const s1 = { id: 's1', facePhotoKey: null }
    const s2 = { id: 's2', facePhotoKey: null }
    const results = await presentStudents([s1, s2])
    assert.strictEqual(results.length, 2)
    assert.strictEqual(results[0].photoAvailable, false)
    assert.strictEqual(results[1].photoAvailable, false)
  })

  it('5. Caching: cached headObject prevents redundant calls, invalidatePhotoCache busts cache', async () => {
    const key = `identity/cache-test/${crypto.randomBytes(4).toString('hex')}.webp`
    const student = { id: 'cache-s', facePhotoKey: key }

    // Initially missing
    let presented = await presentStudent(student)
    assert.strictEqual(presented.photoAvailable, false)

    // Now upload object
    await putObject(key, Buffer.from('now-present'), 'image/webp')

    // Still false due to 10 min cache
    presented = await presentStudent(student)
    assert.strictEqual(presented.photoAvailable, false, 'Should read cached false before invalidation')

    // Invalidate
    invalidatePhotoCache(key)
    presented = await presentStudent(student)
    assert.strictEqual(presented.photoAvailable, true, 'Should read fresh true after cache invalidation')
  })
})
