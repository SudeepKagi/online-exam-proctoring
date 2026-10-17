'use strict'

function setupGracefulShutdown({ server, internalServer, io, rosterCoalescer, proctoringService, prisma, redisClient, config, logger }) {
  let isShuttingDown = false

  async function gracefulShutdown(signal) {
    logger.info({ signal }, 'Graceful shutdown initiated (C-10): draining requests and closing connections')

    const serverClosePromise = new Promise((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed: intake stopped')
        resolve()
      })
    })

    try {
      rosterCoalescer.stop()
    } catch (err) {
      logger.warn({ error: err.message }, 'Error stopping roster coalescer')
    }

    try {
      await proctoringService.flush()
      logger.info('Proctoring logs batcher drained successfully')
    } catch (err) {
      logger.warn({ error: err.message }, 'Error draining proctoring logs batcher')
    }

    if (io) {
      try {
        io.emit('server:restarting', { message: 'Server is restarting for maintenance', reconnectAfter: 3000 })
        await new Promise((resolve) => io.close(() => resolve()))
        logger.info('Socket.io server closed')
      } catch (err) {
        logger.warn({ error: err.message }, 'Error closing socket server')
      }
    }

    const internalClosePromise = new Promise((resolve) => {
      if (internalServer && internalServer.listening) {
        internalServer.close((err) => {
          if (err) logger.warn({ error: err.message }, 'Error closing internal HTTP server')
          else logger.info('Internal metrics HTTP server closed cleanly')
          resolve()
        })
      } else {
        resolve()
      }
    })

    await Promise.all([serverClosePromise, internalClosePromise])

    try {
      const shutdownTasks = [prisma.$disconnect()]
      if (config.cacheDriver !== 'memory') shutdownTasks.push(redisClient.quit())
      await Promise.allSettled(shutdownTasks)
      logger.info('All connection pools closed cleanly')
    } catch (err) {
      logger.warn({ error: err.message }, 'Error closing connection pools')
    }

    process.exit(0)
  }

  function handleSignal(signal) {
    if (isShuttingDown) {
      logger.warn({ signal }, 'Second termination signal received; forcing immediate exit (C-10)')
      process.exit(1)
    }
    isShuttingDown = true

    setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded, forcing exit')
      process.exit(1)
    }, 10000).unref()

    gracefulShutdown(signal)
  }

  process.on('SIGTERM', () => handleSignal('SIGTERM'))
  process.on('SIGINT', () => handleSignal('SIGINT'))
}

module.exports = { setupGracefulShutdown }
