/**
 * drivers/index.js
 * R4 — Unified Drivers & Adapters Factory
 *
 * Driver configuration:
 *   QUEUE_DRIVER:  'postgres' | 'rabbitmq'
 *   CACHE_DRIVER:  'memory'   | 'redis'
 *   MEDIA_DRIVER:  'snapshot' | 'livekit-selfhost' | 'livekit-cloud'
 *   FACE_DRIVER:   'rekognition' | 'onnx' | 'off' | 'test'
 *   LLM_PROVIDER:  'none'     | 'openai' | 'google' | 'anthropic'
 */

'use strict'

const { getQueueDriver, registerQueueHandler } = require('./queue')
const { getCacheDriver } = require('./cache')
const { getMediaDriver } = require('./media')
const { getFaceDriver } = require('./face')
const { getLlmDriver } = require('./llm')

module.exports = {
  getQueueDriver,
  registerQueueHandler,
  getCacheDriver,
  getMediaDriver,
  getFaceDriver,
  getLlmDriver
}
