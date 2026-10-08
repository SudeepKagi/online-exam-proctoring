'use strict'

const { logger } = require('./shared/logging')

/**
 * ProctorNet Graceful Lifecycle Manager (§1 CI-D, C1.4, Appendix D)
 * Coordinates ordered, safe shutdown of all background resources, sockets,
 * schedulers, sweepers, queues, caches, and database connections.
 *
 * CRITICAL INVARIANT: Only tears down already-instantiated singletons.
 * NEVER requires an un-instantiated singleton during teardown, which would
 * accidentally open new connections and hang the process.
 */

const closers = []

function getLoadedModule(relPath) {
  try {
    const resolved = require.resolve(relPath, { paths: [__dirname] })
    if (require.cache && require.cache[resolved]) {
      return require(resolved)
    }
  } catch {}
  return null
}

/**
 * Register a teardown hook to be executed on graceful shutdown.
 * @param {string} name Descriptive resource name
 * @param {Function} fn Async or sync teardown function
 */
function onClose(name, fn) {
  closers.push({ name, fn })
}

/**
 * Execute all registered teardown hooks in LIFO order.
 */
async function closeAll() {
  // 1. Custom-registered closers first (servers, sockets, custom listeners)
  for (const { name, fn } of closers.reverse()) {
    try {
      await fn()
    } catch (err) {
      logger.warn({ closer: name, error: err.message }, 'Teardown hook error')
    }
  }
  closers.length = 0

  // 2. Shut down background sweepers if active
  try {
    const agentMod = getLoadedModule('./modules/agent/agentSweeper')
    if (agentMod?.agentSweeper?.stop) agentMod.agentSweeper.stop()
  } catch {}

  try {
    const sessionMod = getLoadedModule('./modules/agent/agentSessionService')
    if (sessionMod?.agentSessionService?.clearHotSessions) sessionMod.agentSessionService.clearHotSessions()
  } catch {}

  try {
    const expiryMod = getLoadedModule('./modules/attempts/expirySweeper')
    if (expiryMod?.expirySweeper?.stop) expiryMod.expirySweeper.stop()
  } catch {}

  // 3. Disconnect transport and queue connections if active
  try {
    const rmqMod = getLoadedModule('./infra/rabbitmq/client')
    if (rmqMod?.rabbitmq?.close) await rmqMod.rabbitmq.close()
  } catch {}

  try {
    const redisMod = getLoadedModule('./infra/redis/client')
    if (redisMod?.redis?.disconnect) await redisMod.redis.disconnect()
  } catch {}

  try {
    const emitterMod = getLoadedModule('./infra/websocket/emitter')
    if (emitterMod?.socketEmitter?.close) await emitterMod.socketEmitter.close()
  } catch {}

  // 4. Disconnect Prisma database pool if active
  try {
    const pgMod = getLoadedModule('./infra/postgres/client')
    if (pgMod?.prisma?.$disconnect) await pgMod.prisma.$disconnect()
  } catch {}

  // 5. Destroy S3 client and keep-alive HTTP/HTTPS sockets if active
  try {
    const s3Mod = getLoadedModule('./infra/s3/s3.client')
    if (s3Mod?.destroy) s3Mod.destroy()
  } catch {}
}

module.exports = {
  onClose,
  closeAll
}
