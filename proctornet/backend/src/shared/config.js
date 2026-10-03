require('dotenv').config()

const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: parseInt(process.env.PORT || '5000', 10),

  // Database
  databaseUrl: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  redisPrefix: 'pn:v1:',

  // RabbitMQ
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://guest:guest@127.0.0.1:5672',

  // Authentication & Security
  jwtSecret: process.env.JWT_SECRET || 'proctornet-super-secret-key-production-ready',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  cookieName: 'proctornet_token',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  hashConcurrencyLimit: parseInt(process.env.HASH_CONCURRENCY_LIMIT || '10', 10),

  // Exam Lifecycle & Timing
  attemptPrewarmMinutes: parseInt(process.env.ATTEMPT_PREWARM_MINUTES || '30', 10),
  submitGraceSeconds: parseInt(process.env.SUBMIT_GRACE_SECONDS || '10', 10),
  autosaveMaxBatch: parseInt(process.env.AUTOSAVE_MAX_BATCH || '100', 10),
  sweeperIntervalMs: parseInt(process.env.SWEEPER_INTERVAL_MS || '15000', 10),

  // Micro-batching
  violationBatchIntervalMs: parseInt(process.env.VIOLATION_BATCH_INTERVAL_MS || '100', 10),
  violationBatchMaxSize: parseInt(process.env.VIOLATION_BATCH_MAX_SIZE || '200', 10),
  chatBatchIntervalMs: parseInt(process.env.CHAT_BATCH_INTERVAL_MS || '100', 10),
  chatBatchMaxSize: parseInt(process.env.CHAT_BATCH_MAX_SIZE || '100', 10),

  // Load Shedding
  maxInflightRequests: parseInt(process.env.MAX_INFLIGHT_REQUESTS || '1000', 10),
  maxEventLoopDelayMs: parseInt(process.env.MAX_EVENT_LOOP_DELAY_MS || '200', 10),

  // S3 / Object Storage
  s3Bucket: process.env.AWS_S3_BUCKET || 'proctornet-evidence',
  s3Region: process.env.AWS_REGION || 'us-east-1'
}

module.exports = config
