/**
 * ProctorNet Exam Device Companion
 * Configuration & Cryptographic Root of Trust
 */

const DEFAULT_SERVER_URL = process.env.PROCTORNET_SERVER_URL || 'http://127.0.0.1:5000'

// Embedded Ed25519 Public Keys for policy signature verification (Current + Next for rotation)
const POLICY_PUBLIC_KEYS = [
  // Primary (Current)
  `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAQGGWKC1CGfTGXuD773U8JsQIQyeoWiO+DnBffmkFJd0=\n-----END PUBLIC KEY-----\n`,
  // Secondary (Next Rotation Key)
  `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA8yE67J7f0H/H7E0Y2H1sN8Qk4A8r3w6q9Z1x3V6tY9E=\n-----END PUBLIC KEY-----\n`
]

const AGENT_VERSION = '1.0.0'
const DEFAULT_HEARTBEAT_MS = 15000
const REPORT_TIMEOUT_MS = 8000
const MAX_COMMAND_BUFFER = 10 * 1024 * 1024 // 10MB to avoid G-02 buffer overflow

module.exports = {
  DEFAULT_SERVER_URL,
  POLICY_PUBLIC_KEYS,
  AGENT_VERSION,
  DEFAULT_HEARTBEAT_MS,
  REPORT_TIMEOUT_MS,
  MAX_COMMAND_BUFFER
}
