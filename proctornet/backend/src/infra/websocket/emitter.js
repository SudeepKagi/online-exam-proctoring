const { Emitter } = require('@socket.io/redis-emitter')
const Redis = require('ioredis')
const config = require('../../shared/config')
const { logger } = require('../../shared/logging')

/**
 * Socket.IO Redis Emitter for Out-of-Process / Worker Broadcasting (C-06)
 * - Uses @socket.io/redis-emitter
 * - Replaces every global.io reference in workers & async services
 * - Strictly validates room names: ONLY 'attempt:{id}' or 'inv:{examId}' permitted
 */
class SocketEmitterManager {
  constructor() {
    this.emitter = null
    this.redisClient = null
    this._init()
  }

  _init() {
    try {
      this.redisClient = new Redis(config.redisUrl, {
        keyPrefix: config.redisPrefix,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => Math.min(times * 200, 5000)
      })

      this.redisClient.connect().catch((err) => {
        logger.warn({ error: err.message }, 'Socket.IO Redis emitter initial connection deferred, will auto-reconnect')
      })

      this.emitter = new Emitter(this.redisClient)
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to initialize Socket.IO Redis emitter')
    }
  }

  /**
   * Emit an event to a strictly validated room name (C-06)
   * Only 'attempt:{id}' or 'inv:{examId}' allowed.
   */
  emitToRoom(room, event, payload) {
    if (!room || (!room.startsWith('attempt:') && !room.startsWith('inv:'))) {
      logger.error({ room, event }, 'Invalid room name rejected by C-06 policy. Only attempt:{id} and inv:{examId} permitted.')
      return false
    }

    try {
      if (this.emitter) {
        this.emitter.to(room).emit(event, payload)
        return true
      }
    } catch (err) {
      logger.warn({ room, event, error: err.message }, 'Failed to emit via Redis emitter')
    }
    return false
  }

  emitToAttempt(attemptId, event, payload) {
    return this.emitToRoom(`attempt:${attemptId}`, event, payload)
  }

  emitToInvigilators(examId, event, payload) {
    return this.emitToRoom(`inv:${examId}`, event, payload)
  }
}

const socketEmitter = new SocketEmitterManager()

module.exports = {
  socketEmitter,
  SocketEmitterManager
}
