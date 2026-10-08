const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const adminService = require(path.join(__dirname, '../proctornet/backend/src/modules/admin/service'))
const adminRepository = require(path.join(__dirname, '../proctornet/backend/src/modules/admin/repository'))
const { ValidationError } = require(path.join(__dirname, '../proctornet/backend/src/shared/errors'))

describe('BUG-J02: Feature-Truth Audit & Admin Settings Wire-Up', () => {
  it('supports receiving and saving a flat settings object', async () => {
    const origUpsert = adminRepository.upsertSetting
    try {
      const saved = []
      adminRepository.upsertSetting = async (key, value, userId) => {
        saved.push({ key, value: String(value), userId })
        return {
          id: 'setting-uuid',
          key,
          value: String(value),
          updatedBy: userId,
          updatedAt: new Date()
        }
      }

      const flatPayload = {
        watermarkVisible: 'true',
        preventClipboardCopy: 'true',
        watermarkOpacity: 25
      }

      const res = await adminService.updateSettings(flatPayload, 'admin-user-1')
      assert.equal(res.length, 3, 'Should process all 3 flat setting keys')
      assert.equal(saved.find(s => s.key === 'watermarkVisible')?.value, 'true')
      assert.equal(saved.find(s => s.key === 'preventClipboardCopy')?.value, 'true')
      assert.equal(saved.find(s => s.key === 'watermarkOpacity')?.value, '25')
    } finally {
      adminRepository.upsertSetting = origUpsert
    }
  })

  it('supports single key/value setting update', async () => {
    const origUpsert = adminRepository.upsertSetting
    try {
      adminRepository.upsertSetting = async (key, value, userId) => ({
        id: 'setting-uuid-2',
        key,
        value: String(value),
        updatedBy: userId,
        updatedAt: new Date()
      })

      const res = await adminService.updateSettings({ key: 'maxExamDuration', value: '180' }, 'admin-1')
      assert.equal(res.key, 'maxExamDuration')
      assert.equal(res.value, '180')
    } finally {
      adminRepository.upsertSetting = origUpsert
    }
  })

  it('supports nested settings object payload', async () => {
    const origUpsert = adminRepository.upsertSetting
    try {
      adminRepository.upsertSetting = async (key, value, userId) => ({
        id: 'setting-uuid-3',
        key,
        value: String(value),
        updatedBy: userId,
        updatedAt: new Date()
      })

      const res = await adminService.updateSettings({
        settings: {
          tabSwitchTolerance: '3'
        }
      }, 'admin-1')
      assert.equal(res.length, 1)
      assert.equal(res[0].key, 'tabSwitchTolerance')
      assert.equal(res[0].value, '3')
    } finally {
      adminRepository.upsertSetting = origUpsert
    }
  })

  it('rejects invalid or empty settings body with ValidationError', async () => {
    await assert.rejects(
      async () => {
        await adminService.updateSettings(null, 'admin-1')
      },
      (err) => err instanceof ValidationError
    )

    await assert.rejects(
      async () => {
        await adminService.updateSettings({}, 'admin-1')
      },
      (err) => err instanceof ValidationError
    )
  })

  it('retrieves all platform settings via getSettings', async () => {
    const origGetAll = adminRepository.getAllSettings
    try {
      adminRepository.getAllSettings = async () => [
        { id: '1', key: 'setting1', value: 'val1', updatedBy: null, updatedAt: new Date() },
        { id: '2', key: 'setting2', value: 'val2', updatedBy: null, updatedAt: new Date() }
      ]

      const settings = await adminService.getSettings()
      assert.equal(settings.length, 2)
      assert.equal(settings[0].key, 'setting1')
      assert.equal(settings[1].key, 'setting2')
    } finally {
      adminRepository.getAllSettings = origGetAll
    }
  })

  after(async () => {
    try {
      const { redis } = require('../proctornet/backend/src/infra/redis/client')
      if (redis && redis.disconnect) redis.disconnect()
    } catch {}
    setTimeout(() => process.exit(0), 50).unref()
  })
})
