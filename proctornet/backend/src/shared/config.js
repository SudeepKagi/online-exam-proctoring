require('dotenv').config()

// ── R4: Memory discipline — guard against multi-instance memory-only cache ────
const _appInstances = parseInt(process.env.APP_INSTANCES || '1', 10)
const _cacheDriver = (process.env.CACHE_DRIVER || 'redis').toLowerCase().trim()
const _queueDriver = (process.env.QUEUE_DRIVER || 'rabbitmq').toLowerCase().trim()

if (_cacheDriver === 'memory' && _appInstances > 1) {
  // Fatal boot-time guard: in-memory cache cannot be shared across processes
  console.error(
    `[FATAL] CACHE_DRIVER=memory is incompatible with APP_INSTANCES=${_appInstances}. ` +
      'Use CACHE_DRIVER=redis for multi-instance deployments. Exiting.'
  )
  process.exit(1)
}

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

  // Authentication & Security (Phase S2)
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: '15m',
  jwtRefreshExpiresIn: '12h',
  cookieName: 'pn_at',
  bcryptRounds: parseInt(
    process.env.BCRYPT_ROUNDS || ((process.env.APP_PROFILE || 'lite') === 'lite' ? '10' : '12'),
    10
  ),
  hashConcurrencyLimit: parseInt(
    process.env.HASH_CONCURRENCY_LIMIT ||
      ((process.env.APP_PROFILE || 'lite') === 'lite' ? '2' : '10'),
    10
  ),

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

  // S3 / Object Storage (Unified S3_BUCKET env)
  s3Bucket:
    process.env.S3_BUCKET ||
    process.env.AWS_S3_BUCKET ||
    (process.env.NODE_ENV === 'test' ? 'proctornet-test-bucket' : undefined),
  s3Region: process.env.AWS_REGION || 'ap-south-1',

  // ── R4: Driver Selection ──────────────────────────────────────────────────

  // Media Driver (R3: snapshot [lite/default] | livekit-selfhost | livekit-cloud)
  get mediaDriver() {
    if (process.env.MEDIA_DRIVER) {
      const d = process.env.MEDIA_DRIVER.toLowerCase().trim()
      if (d === 'snapshot' || d === 'livekit-selfhost' || d === 'livekit-cloud') return d
    }
    const profile = (process.env.APP_PROFILE || 'lite').toLowerCase().trim()
    if (profile === 'lite') return 'snapshot'
    return process.env.LIVEKIT_URL ? 'livekit-selfhost' : 'snapshot'
  },

  // Queue Driver: 'rabbitmq' (default) | 'postgres' (lite — in-process outbox dispatch, no broker dependency)
  queueDriver: _queueDriver === 'postgres' ? 'postgres' : 'rabbitmq',

  // Cache Driver: 'redis' (default) | 'memory' (single-instance lite only — startup guard above)
  cacheDriver: _cacheDriver === 'memory' ? 'memory' : 'redis',

  // Face Driver: 'rekognition' | 'onnx' | 'off'
  faceDriver: (process.env.FACE_DRIVER || 'off').toLowerCase().trim(),

  // LLM Provider: 'none' | 'openai' | 'google' | 'anthropic' | 'groq'
  // When 'none': AI question generation button is hidden in UI, never mocked.
  get llmProvider() {
    if (process.env.LLM_PROVIDER) {
      const p = process.env.LLM_PROVIDER.toLowerCase().trim()
      if (p === 'gemini') return 'google'
      return p
    }
    if (process.env.GROQ_API_KEY) return 'groq'
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return 'google'
    if (process.env.OPENAI_API_KEY) return 'openai'
    if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
    return 'none'
  },
  get llmApiKey() {
    if (process.env.LLM_API_KEY) return process.env.LLM_API_KEY
    const prov = this.llmProvider
    if (prov === 'google' || prov === 'gemini') {
      return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
    }
    if (prov === 'groq') return process.env.GROQ_API_KEY || ''
    if (prov === 'openai') return process.env.OPENAI_API_KEY || ''
    if (prov === 'anthropic') return process.env.ANTHROPIC_API_KEY || ''
    return (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      ''
    )
  },
  get llmModel() {
    if (process.env.LLM_MODEL) return process.env.LLM_MODEL
    const prov = this.llmProvider
    if (prov === 'groq') return 'llama-3.3-70b-versatile'
    if (prov === 'google' || prov === 'gemini') return 'gemini-1.5-flash'
    if (prov === 'openai') return 'gpt-4o-mini'
    if (prov === 'anthropic') return 'claude-3-haiku-20240307'
    return ''
  },

  // Per-faculty AI rate limits
  llmDailyCostCapUsd: parseFloat(process.env.LLM_DAILY_COST_CAP_USD || '5.0'),
  llmRateLimitPerFacultyPerDay: parseInt(
    process.env.LLM_RATE_LIMIT_PER_FACULTY_PER_DAY || '20',
    10
  ),

  // App scaling
  appInstances: _appInstances,

  // ── R4: Memory Discipline ────────────────────────────────────────────────
  prismaConnectionLimit: parseInt(process.env.PRISMA_CONNECTION_LIMIT || '5', 10),
}

module.exports = config
