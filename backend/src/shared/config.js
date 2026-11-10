require('dotenv').config()

// ── R4: Memory discipline — guard against multi-instance memory-only cache ────
const _appInstances = parseInt(process.env.APP_INSTANCES || '1', 10)
const _cacheDriver = (process.env.CACHE_DRIVER || 'redis').toLowerCase().trim()

if (_cacheDriver === 'memory' && _appInstances > 1) {
  // Fatal boot-time guard: in-memory cache cannot be shared across processes
  console.error(
    `[FATAL] CACHE_DRIVER=memory is incompatible with APP_INSTANCES=${_appInstances}. ` +
      'Use CACHE_DRIVER=redis for multi-instance deployments. Exiting.'
  )
  process.exit(1)
}

// ── SEB Mode & Global Configuration (Step 1) ──────────────────────────────────
const _rawSebMode = (process.env.SEB_MODE || 'off').toLowerCase().trim()
if (!['off', 'log', 'enforce'].includes(_rawSebMode)) {
  throw new Error(`[FATAL] Invalid SEB_MODE: "${process.env.SEB_MODE}". Must be one of: off, log, enforce.`)
}

const { normalizePublicOrigin } = require('./validateConfig')

let _rawSebConfigKey = null
if (process.env.SEB_CONFIG_KEY) {
  const trimmedKey = process.env.SEB_CONFIG_KEY.trim().toLowerCase()
  if (trimmedKey && !/^[0-9a-f]{64}$/.test(trimmedKey)) {
    throw new Error('[FATAL] Invalid SEB_CONFIG_KEY. Must be a 64-character hex string if set.')
  }
  _rawSebConfigKey = trimmedKey || null
}

const _normalizedPublicOrigin = normalizePublicOrigin(process.env.PUBLIC_ORIGIN)

const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: parseInt(process.env.PORT || '5000', 10),
  publicOrigin: _normalizedPublicOrigin,

  // Database
  databaseUrl: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,

  // Safe Exam Browser (SEB) Settings
  sebMode: _rawSebMode,
  sebConfigKey: _rawSebConfigKey,
  sebLinkSecret: process.env.SEB_LINK_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev_seb_link_secret_at_least_32_characters_long_for_hmac'),
  sebPreDownloadMinutes: parseInt(process.env.SEB_PRE_DOWNLOAD_MINUTES || '30', 10),

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  redisPrefix: 'pn:v1:',

  // Authentication & Security (Phase S2)
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
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
    process.env.S3_BUCKET_NAME ||
    process.env.AWS_S3_BUCKET ||
    (process.env.NODE_ENV === 'test' ? 'proctornet-test-bucket' : undefined),
  s3Region: process.env.AWS_REGION || 'ap-south-1',

  // ── R4: Driver Selection ──────────────────────────────────────────────────

  // Media Driver (snapshot proctoring)
  get mediaDriver() {
    return 'snapshot'
  },



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
    if (prov === 'google' || prov === 'gemini') return 'gemini-3.5-flash'
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
