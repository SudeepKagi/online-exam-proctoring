'use strict'

const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListObjectVersionsCommand
} = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { createPresignedPost } = require('@aws-sdk/s3-presigned-post')
const { NodeHttpHandler } = require('@smithy/node-http-handler')
const https = require('https')
const http = require('http')
const crypto = require('crypto')
const { logger } = require('../../shared/logging')

/**
 * Base Abstract S3 Storage Adapter (§Prompt 7 T3 / T4)
 */
class S3Adapter {
  async headObject(key) { throw new Error('Not implemented') }
  async getObjectBuffer(key) { throw new Error('Not implemented') }
  async putObject(key, buffer, contentType = 'image/webp') { throw new Error('Not implemented') }
  async deleteObject(key) { throw new Error('Not implemented') }
  async deleteObjects(keys = []) { throw new Error('Not implemented') }
  async listObjects(prefix = '', continuationToken = null, maxKeys = 1000) { throw new Error('Not implemented') }
  async listObjectVersions(prefix = '', keyMarker = null, versionIdMarker = null, maxKeys = 1000) { throw new Error('Not implemented') }
  async deleteObjectVersions(objects = []) { throw new Error('Not implemented') }
  async getPresignedReadUrl(key, expiresIn = 600, signingDate = null) { throw new Error('Not implemented') }
  async getPresignedPutUrl(key, contentType = 'image/webp', expiresIn = 120) { throw new Error('Not implemented') }
  async createDirectUploadPolicy({ key, contentType, maxSizeBytes, expiresIn = 120 }) { throw new Error('Not implemented') }
  destroy() {}
}

/**
 * AWS SDK v3 Implementation using Default Credential Provider Chain (Instance Role) / MinIO
 */
class AwsS3Adapter extends S3Adapter {
  constructor(options = {}) {
    super()
    this.bucket = options.bucket || process.env.S3_BUCKET || 'proctornet-storage'
    this.region = options.region || process.env.AWS_REGION || 'ap-south-1'
    const isProd = process.env.NODE_ENV === 'production'

    this.httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100 })
    this.httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100 })

    this.requestHandler = new NodeHttpHandler({
      connectionTimeout: 2000,
      socketTimeout: 5000,
      httpsAgent: this.httpsAgent,
      httpAgent: this.httpAgent
    })

    const clientConfig = {
      region: this.region,
      maxAttempts: 3,
      requestHandler: this.requestHandler
    }

    // In non-production, allow explicit static credentials if provided; otherwise AWS default chain handles it
    if (!isProd && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    }

    // MinIO / S3 compatible endpoint
    if (process.env.S3_ENDPOINT || options.endpoint) {
      clientConfig.endpoint = options.endpoint || process.env.S3_ENDPOINT
      // Fix forcePathStyle tautology: strictly boolean comparison
      clientConfig.forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true' || Boolean(options.forcePathStyle)
    }

    this.client = new S3Client(clientConfig)
  }

  async headObject(key) {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key
    })
    return this.client.send(command)
  }

  async getObjectBuffer(key) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    })
    const response = await this.client.send(command)
    const chunks = []
    for await (const chunk of response.Body) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  async putObject(key, buffer, contentType = 'image/webp') {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buf,
      ContentType: contentType,
      ServerSideEncryption: 'AES256'
    })
    return this.client.send(command)
  }

  async deleteObject(key) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    })
    return this.client.send(command)
  }

  async deleteObjects(keys = []) {
    if (!keys || keys.length === 0) return { Deleted: [] }
    const objects = keys.map(k => ({ Key: k }))
    const command = new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: {
        Objects: objects,
        Quiet: true
      }
    })
    return this.client.send(command)
  }

  async listObjects(prefix = '', continuationToken = null, maxKeys = 1000) {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken || undefined,
      MaxKeys: maxKeys
    })
    return this.client.send(command)
  }

  async listObjectVersions(prefix = '', keyMarker = null, versionIdMarker = null, maxKeys = 1000) {
    const command = new ListObjectVersionsCommand({
      Bucket: this.bucket,
      Prefix: prefix,
      KeyMarker: keyMarker || undefined,
      VersionIdMarker: versionIdMarker || undefined,
      MaxKeys: maxKeys
    })
    return this.client.send(command)
  }

  async deleteObjectVersions(objects = []) {
    if (!objects || objects.length === 0) return { Deleted: [] }
    const command = new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: {
        Objects: objects.map(o => ({ Key: o.Key, VersionId: o.VersionId || undefined })),
        Quiet: true
      }
    })
    return this.client.send(command)
  }

  async getPresignedReadUrl(key, expiresIn = 600, signingDate = null) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    })
    return getSignedUrl(this.client, command, {
      expiresIn,
      signingDate: signingDate || undefined
    })
  }

  async getPresignedPutUrl(key, contentType = 'image/webp', expiresIn = 120) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ServerSideEncryption: 'AES256'
    })
    return getSignedUrl(this.client, command, { expiresIn })
  }

  async createDirectUploadPolicy({ key, contentType, maxSizeBytes, expiresIn = 120 }) {
    const conditions = [
      ['starts-with', '$Content-Type', 'image/'],
      ['content-length-range', 1, maxSizeBytes],
      ['eq', '$key', key]
    ]

    const fields = {
      'Content-Type': contentType
    }

    let post = null
    try {
      post = await createPresignedPost(this.client, {
        Bucket: this.bucket,
        Key: key,
        Conditions: conditions,
        Fields: fields,
        Expires: expiresIn
      })
    } catch (err) {
      logger.warn({ error: err.message }, 'createPresignedPost warning, relying on presigned PUT')
    }

    const putUrl = await this.getPresignedPutUrl(key, contentType, expiresIn)

    return {
      key,
      postUrl: post?.url || putUrl,
      fields: post?.fields || {},
      putUrl,
      contentType,
      maxSizeBytes,
      expiresIn
    }
  }

  destroy() {
    try { this.client.destroy() } catch (_) {}
    try { this.requestHandler.destroy() } catch (_) {}
    try { this.httpsAgent.destroy() } catch (_) {}
    try { this.httpAgent.destroy() } catch (_) {}
  }
}

/**
 * In-Memory S3 Storage Adapter for Isolated Unit Tests
 */
class MemoryS3Adapter extends S3Adapter {
  constructor(options = {}) {
    super()
    this.bucket = options.bucket || 'test-bucket'
    this.store = new Map() // key -> { buffer, contentType, lastModified, versionId }
    this.versions = new Map() // key -> array of versions
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
    return `https://${this.bucket}.s3.amazonaws.com/${encodeURIComponent(key)}?presigned=read`
  }

  async getPresignedPutUrl(key, contentType = 'image/webp', expiresIn = 120) {
    return `https://${this.bucket}.s3.amazonaws.com/${encodeURIComponent(key)}?presigned=put`
  }

  async createDirectUploadPolicy({ key, contentType, maxSizeBytes, expiresIn = 120 }) {
    return {
      key,
      postUrl: `https://${this.bucket}.s3.amazonaws.com/${encodeURIComponent(key)}`,
      fields: { key, 'Content-Type': contentType },
      putUrl: `https://${this.bucket}.s3.amazonaws.com/${encodeURIComponent(key)}?presigned=put`,
      contentType,
      maxSizeBytes,
      expiresIn
    }
  }

  clear() {
    this.store.clear()
    this.versions.clear()
  }
}

module.exports = {
  S3Adapter,
  AwsS3Adapter,
  MemoryS3Adapter
}
