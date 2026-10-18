'use strict'

const crypto = require('crypto')

/**
 * In-Memory S3 Storage Adapter for Isolated Unit Tests
 */
class MemoryS3Adapter {
  constructor(options = {}) {
    this.bucket = options.bucket || 'test-bucket'
    this.maxKeys = options.maxKeys || 100
    this.store = new Map() // key -> { buffer, contentType, lastModified, versionId }
    this.versions = new Map() // key -> array of versions
    this.client = {
      send: async () => ({}),
      destroy: () => { }
    }
  }

  async headObject(key) {
    const item = this.store.get(key)
    if (!item) {
      const err = new Error('NotFound')
      err.name = 'NotFound'
      err.$metadata = { httpStatusCode: 404 }
      throw err
    }
    return {
      ContentLength: item.buffer.length,
      ContentType: item.contentType,
      LastModified: item.lastModified
    }
  }

  async getObjectBuffer(key) {
    const item = this.store.get(key)
    if (!item) {
      const err = new Error('NoSuchKey')
      err.name = 'NoSuchKey'
      err.$metadata = { httpStatusCode: 404 }
      throw err
    }
    return item.buffer
  }

  async putObject(key, buffer, contentType = 'image/webp') {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
    const versionId = crypto.randomUUID()
    const entry = {
      buffer: buf,
      contentType,
      lastModified: new Date(),
      versionId
    }

    if (!this.store.has(key) && this.store.size >= this.maxKeys) {
      const oldestKey = this.store.keys().next().value
      this.store.delete(oldestKey)
      this.versions.delete(oldestKey)
    }

    this.store.set(key, entry)

    if (!this.versions.has(key)) {
      this.versions.set(key, [])
    }
    this.versions.get(key).push(entry)

    return { ETag: '"test-etag"', VersionId: versionId }
  }

  async deleteObject(key) {
    this.store.delete(key)
    return {}
  }

  async deleteObjects(keys = []) {
    const deleted = []
    for (const k of keys) {
      this.store.delete(k)
      deleted.push({ Key: k })
    }
    return { Deleted: deleted }
  }

  async listObjects(prefix = '', continuationToken = null, maxKeys = 1000) {
    const contents = []
    for (const [key, item] of this.store.entries()) {
      if (key.startsWith(prefix)) {
        contents.push({
          Key: key,
          Size: item.buffer.length,
          LastModified: item.lastModified
        })
      }
    }
    return {
      Contents: contents.slice(0, maxKeys),
      IsTruncated: contents.length > maxKeys
    }
  }

  async listObjectVersions(prefix = '', keyMarker = null, versionIdMarker = null, maxKeys = 1000) {
    const versions = []
    const deleteMarkers = []
    for (const [key, vers] of this.versions.entries()) {
      if (key.startsWith(prefix)) {
        for (const v of vers) {
          versions.push({
            Key: key,
            VersionId: v.versionId,
            IsLatest: true,
            LastModified: v.lastModified,
            Size: v.buffer.length
          })
        }
      }
    }
    return {
      Versions: versions.slice(0, maxKeys),
      DeleteMarkers: deleteMarkers,
      IsTruncated: versions.length > maxKeys
    }
  }

  async deleteObjectVersions(objects = []) {
    const deleted = []
    for (const obj of objects) {
      this.store.delete(obj.Key)
      if (this.versions.has(obj.Key)) {
        const remaining = this.versions.get(obj.Key).filter(v => v.versionId !== obj.VersionId)
        if (remaining.length === 0) {
          this.versions.delete(obj.Key)
        } else {
          this.versions.set(obj.Key, remaining)
        }
      }
      deleted.push({ Key: obj.Key, VersionId: obj.VersionId })
    }
    return { Deleted: deleted }
  }

  async getPresignedReadUrl(key, expiresIn = 600, signingDate = null) {
    const dateStr = signingDate ? signingDate.toISOString() : new Date().toISOString()
    return `https://${this.bucket}.s3.amazonaws.com/${encodeURIComponent(key)}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=${dateStr}&X-Amz-Expires=${expiresIn}&X-Amz-Signature=mock-sig`
  }

  async getPresignedPutUrl(key, _contentType = 'image/webp', expiresIn = 120) {
    return `https://${this.bucket}.s3.amazonaws.com/${encodeURIComponent(key)}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${expiresIn}&X-Amz-Signature=mock-sig`
  }

  async createDirectUploadPolicy({ key, contentType, maxSizeBytes, expiresIn = 120 }) {
    const putUrl = await this.getPresignedPutUrl(key, contentType, expiresIn)
    return {
      key,
      postUrl: `https://${this.bucket}.s3.amazonaws.com/`,
      fields: {
        key,
        'Content-Type': contentType,
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Date': new Date().toISOString(),
        'X-Amz-Expires': String(expiresIn)
      },
      putUrl,
      contentType,
      maxSizeBytes,
      expiresIn
    }
  }

  destroy() {}

  clear() {
    this.store.clear()
    this.versions.clear()
  }
}

module.exports = { MemoryS3Adapter }
