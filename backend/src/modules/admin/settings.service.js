'use strict'

const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')

const SEB_CONFIG_KEY = 'seb_config'
let lastVerifiedWriteTime = 0
let inMemoryCachedSebConfig = null
let inMemoryCachedSebConfigExpiry = 0

class SettingsService {
  async getSetting(key) {
    if (!key) return null
    try {
      const row = await prisma.systemSetting.findUnique({
        where: { key: String(key) }
      })
      return row ? row.value : null
    } catch (err) {
      logger.error({ err, key }, 'Failed to fetch system setting')
      return null
    }
  }

  async setSetting(key, value) {
    if (!key) throw new Error('Setting key is required')
    return prisma.systemSetting.upsert({
      where: { key: String(key) },
      update: {
        value,
        updatedAt: new Date()
      },
      create: {
        key: String(key),
        value
      }
    })
  }

  async deleteSetting(key) {
    if (!key) return
    return prisma.systemSetting.deleteMany({
      where: { key: String(key) }
    })
  }

  async getSebConfig() {
    const now = Date.now()
    if (inMemoryCachedSebConfig && inMemoryCachedSebConfigExpiry > now) {
      return inMemoryCachedSebConfig
    }

    const val = await this.getSetting(SEB_CONFIG_KEY)
    if (val && typeof val === 'object') {
      inMemoryCachedSebConfig = val
      inMemoryCachedSebConfigExpiry = now + 10000 // 10s memory cache
      return val
    }
    inMemoryCachedSebConfig = null
    return null
  }

  async saveSebConfig({ fileKey, configKey, uploadedAt = new Date().toISOString(), lastVerifiedAt = null }) {
    const existing = await this.getSebConfig()
    const payload = {
      fileKey: fileKey || existing?.fileKey || null,
      configKey: configKey ? String(configKey).trim().toLowerCase() : (existing?.configKey || null),
      uploadedAt: uploadedAt || existing?.uploadedAt || new Date().toISOString(),
      lastVerifiedAt: lastVerifiedAt !== undefined ? lastVerifiedAt : (existing?.lastVerifiedAt || null)
    }

    const saved = await this.setSetting(SEB_CONFIG_KEY, payload)
    inMemoryCachedSebConfig = payload
    inMemoryCachedSebConfigExpiry = Date.now() + 10000

    // Invalidate SEB caches
    try {
      const { clearAllSebCaches } = require('../../middleware/seb')
      clearAllSebCaches()
    } catch (_) {}

    return saved.value
  }

  async deleteSebConfig() {
    await this.deleteSetting(SEB_CONFIG_KEY)
    inMemoryCachedSebConfig = null
    inMemoryCachedSebConfigExpiry = 0

    // Invalidate SEB caches
    try {
      const { clearAllSebCaches } = require('../../middleware/seb')
      clearAllSebCaches()
    } catch (_) {}
  }

  async updateSebLastVerified(timestamp = new Date().toISOString()) {
    const now = Date.now()
    if (inMemoryCachedSebConfig) {
      inMemoryCachedSebConfig.lastVerifiedAt = timestamp
    }

    // Throttle database write to once per 60 seconds
    if (now - lastVerifiedWriteTime < 60000) {
      return
    }

    try {
      const current = await this.getSebConfig()
      if (current) {
        current.lastVerifiedAt = timestamp
        await this.setSetting(SEB_CONFIG_KEY, current)
        lastVerifiedWriteTime = now
        inMemoryCachedSebConfig = current
        inMemoryCachedSebConfigExpiry = now + 10000
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to record SEB lastVerifiedAt in database')
    }
  }

  clearMemoryCache() {
    inMemoryCachedSebConfig = null
    inMemoryCachedSebConfigExpiry = 0
    lastVerifiedWriteTime = 0
  }
}

const settingsService = new SettingsService()
module.exports = { settingsService, SettingsService, SEB_CONFIG_KEY }

