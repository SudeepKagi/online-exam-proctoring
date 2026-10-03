const EVIDENCE_EVENT_TYPES = Object.freeze([
  'MULTIPLE_FACES',
  'NO_FACE',
  'FACE_MISMATCH',
  'SUSPICIOUS_OBJECT',
  'DEVTOOLS_OPENED',
  'TAB_SWITCH',
  'FULLSCREEN_EXIT'
])

const PER_ATTEMPT_EVIDENCE_CAP = 30
const EVIDENCE_COOLDOWN_MS = 10000 // 10s cooldown per event type
const MAX_EVIDENCE_SIZE_BYTES = 300 * 1024 // 300 KB limit
const MAX_IDENTITY_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB limit
const EVIDENCE_RETENTION_DAYS = 180
const SNAPSHOT_FALLBACK_INTERVAL_MS = 120000 // 120s keyframe fallback

function isEvidenceRequired(eventType) {
  return EVIDENCE_EVENT_TYPES.includes(eventType)
}

/**
 * Check if the attempt is still within the evidence screenshot budget
 */
async function checkEvidenceBudget(attemptId, prisma) {
  const currentCount = await prisma.violationEvent.count({
    where: {
      attemptId,
      evidenceKey: { not: null }
    }
  })

  return {
    allowed: currentCount < PER_ATTEMPT_EVIDENCE_CAP,
    currentCount,
    cap: PER_ATTEMPT_EVIDENCE_CAP,
    remaining: Math.max(0, PER_ATTEMPT_EVIDENCE_CAP - currentCount)
  }
}

module.exports = {
  EVIDENCE_EVENT_TYPES,
  PER_ATTEMPT_EVIDENCE_CAP,
  EVIDENCE_COOLDOWN_MS,
  MAX_EVIDENCE_SIZE_BYTES,
  MAX_IDENTITY_SIZE_BYTES,
  EVIDENCE_RETENTION_DAYS,
  SNAPSHOT_FALLBACK_INTERVAL_MS,
  isEvidenceRequired,
  checkEvidenceBudget
}
