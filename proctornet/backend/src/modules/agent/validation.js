const { z } = require('zod')

// Strict privacy contract: any occurrence of these keys rejects the payload immediately
const FORBIDDEN_PRIVACY_KEYS = [
  'processes',
  'processlist',
  'process_list',
  'cmdline',
  'cmd_line',
  'args',
  'arguments',
  'path',
  'paths',
  'windowtitle',
  'window_title',
  'screenshot',
  'keystrokes',
  'clipboard',
  'url',
  'urls',
  'browserhistory',
  'history',
  'username',
  'user_name'
]

function assertPrivacyCompliance(data) {
  if (!data || typeof data !== 'object') return
  const stack = [data]
  while (stack.length > 0) {
    const current = stack.pop()
    if (typeof current !== 'object' || current === null) continue
    for (const key of Object.keys(current)) {
      const lower = key.toLowerCase()
      if (FORBIDDEN_PRIVACY_KEYS.includes(lower)) {
        throw new Error(`Privacy contract violation: forbidden telemetry key '${key}' received`)
      }
      if (typeof current[key] === 'object' && current[key] !== null) {
        stack.push(current[key])
      }
    }
  }
}

const pairAgentSchema = z.object({
  code: z.string().trim().length(8, 'Pairing code must be exactly 8 characters'),
  agentVersion: z.string().trim().min(1, 'Agent version is required').max(32),
  os: z.enum(['win', 'mac', 'linux']),
  arch: z.string().trim().min(2).max(16),
  buildHash: z.string().trim().min(8).max(128),
  deviceId: z.string().trim().max(128).optional()
}).strict()

const findingItemSchema = z.object({
  ruleId: z.string().trim().min(1).max(64),
  evidence: z.string().trim().max(128).optional()
}).strict()

const reportSchema = z.object({
  seq: z.number().int().positive(),
  findings: z.array(findingItemSchema).default([]),
  display: z.object({
    count: z.number().int().min(0).max(32).default(1)
  }).strict().default({ count: 1 }),
  session: z.object({
    remote: z.boolean().default(false)
  }).strict().default({ remote: false }),
  vm: z.object({
    indicators: z.array(z.string().trim().max(64)).default([])
  }).strict().default({ indicators: [] }),
  cameras: z.object({
    virtual: z.array(z.string().trim().max(64)).default([])
  }).strict().default({ virtual: [] }),
  collection: z.object({
    ok: z.boolean().default(true),
    errors: z.array(z.string().trim().max(128)).default([])
  }).strict().default({ ok: true, errors: [] }),
  integrity: z.object({
    buildHash: z.string().trim().max(128).optional()
  }).strict().optional()
}).strict()

const grantWaiverSchema = z.object({
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500)
}).strict()

const releaseSchema = z.object({
  version: z.string().trim().min(1).max(32),
  os: z.enum(['win', 'mac-arm64', 'mac-x64', 'linux']),
  arch: z.string().trim().min(2).max(16),
  sha256: z.string().trim().length(64, 'SHA-256 must be 64 hexadecimal characters'),
  sizeBytes: z.number().int().positive(),
  s3Key: z.string().trim().min(1).max(256),
  signed: z.boolean().default(false),
  minSupported: z.boolean().default(false)
}).strict()

const updateRuleSchema = z.object({
  enabled: z.boolean().optional(),
  action: z.enum(['FLAG', 'SUSPEND', 'BLOCK_START', 'WARN']).optional(),
  severity: z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional()
}).strict()

module.exports = {
  FORBIDDEN_PRIVACY_KEYS,
  assertPrivacyCompliance,
  pairAgentSchema,
  reportSchema,
  grantWaiverSchema,
  releaseSchema,
  updateRuleSchema
}
