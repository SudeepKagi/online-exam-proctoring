/**
 * cookies.js
 * Centralized authentication cookie management for ProctorNet (Phase S2 / Appendix C).
 * Enforces secure HttpOnly attributes, environment-aware security settings,
 * and reliable cookie extraction for REST APIs and Socket.IO handshakes.
 */

const { tokenService } = require('../modules/auth/tokenService')

const AUTH_COOKIE_NAME = 'proctornet_auth'
const ACCESS_COOKIE_NAME = 'pn_at'
const LEGACY_COOKIE_NAME = 'proctornet_auth'
const DEFAULT_MAX_AGE_MS = 15 * 60 * 1000 // 15 minutes default for access token

/**
 * Compute secure cookie configuration based on deployment environment.
 * @param {number} [maxAgeMs] - Custom max-age in milliseconds
 * @returns {object} Express cookie options
 */
function getAuthCookieOptions(maxAgeMs, req = null) {
  const isProd = process.env.NODE_ENV === 'production'
  const sameSite = process.env.COOKIE_SAMESITE || 'lax'

  let secure = false
  if (process.env.COOKIE_SECURE === 'true') {
    secure = true
  } else if (process.env.COOKIE_SECURE === 'false') {
    secure = false
  } else if (isProd && req) {
    secure = Boolean(req.secure || req.headers?.['x-forwarded-proto'] === 'https')
  }

  const options = {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
  }

  if (maxAgeMs !== undefined && maxAgeMs !== null) {
    options.maxAge = Math.max(0, maxAgeMs)
  } else {
    options.maxAge = DEFAULT_MAX_AGE_MS
  }

  return options
}

/**
 * Set the authentication cookie on the response.
 */
function setAuthCookie(res, token, maxAgeMs) {
  if (!res || typeof res.cookie !== 'function') return
  const options = getAuthCookieOptions(maxAgeMs, res.req)
  res.cookie(AUTH_COOKIE_NAME, token, options)
}

/**
 * Clear the authentication cookie on the response.
 */
function clearAuthCookie(res) {
  if (!res || typeof res.clearCookie !== 'function') return
  const req = res.req
  const isProd = process.env.NODE_ENV === 'production'
  const sameSite = process.env.COOKIE_SAMESITE || 'lax'

  let secure = false
  if (process.env.COOKIE_SECURE === 'true') {
    secure = true
  } else if (process.env.COOKIE_SECURE === 'false') {
    secure = false
  } else if (isProd && req) {
    secure = Boolean(req.secure || req.headers?.['x-forwarded-proto'] === 'https')
  }

  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
  })
}

/**
 * Parse cookie string manually if cookie-parser was not used.
 * @param {string} cookieHeader
 * @param {string} key
 * @returns {string|null}
 */
function parseCookieHeader(cookieHeader, key) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null
  const cookies = cookieHeader.split(';')
  for (let c of cookies) {
    const [name, ...rest] = c.trim().split('=')
    if (name === key) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return null
}

/**
 * Extract authentication token from incoming HTTP request.
 * Prioritizes HttpOnly cookie, with deliberate fallback to Authorization Bearer header.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractTokenFromReq(req) {
  return tokenService.extractAccessToken(req)
}

/**
 * Extract authentication token from Socket.IO handshake.
 * Reads the browser's automatically attached cookie during the handshake.
 * @param {import('socket.io').Socket} socket
 * @returns {string|null}
 */
function extractTokenFromSocket(socket) {
  if (!socket) return null

  // 1. Read from socket handshake headers cookie
  const handshakeCookie = socket.handshake?.headers?.cookie
  if (handshakeCookie) {
    const token = parseCookieHeader(handshakeCookie, ACCESS_COOKIE_NAME) || parseCookieHeader(handshakeCookie, AUTH_COOKIE_NAME) || parseCookieHeader(handshakeCookie, LEGACY_COOKIE_NAME)
    if (token) return token
  }

  // 2. Read from underlying HTTP request cookie (if present)
  const reqCookie = socket.request?.headers?.cookie
  if (reqCookie) {
    const token = parseCookieHeader(reqCookie, ACCESS_COOKIE_NAME) || parseCookieHeader(reqCookie, AUTH_COOKIE_NAME) || parseCookieHeader(reqCookie, LEGACY_COOKIE_NAME)
    if (token) return token
  }

  // 3. Fallback to auth payload or Authorization header for non-browser test clients
  if (socket.handshake?.auth?.token) {
    return socket.handshake.auth.token
  }
  const authHeader = socket.handshake?.headers?.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1].trim()
  }

  return null
}

module.exports = {
  AUTH_COOKIE_NAME,
  ACCESS_COOKIE_NAME,
  LEGACY_COOKIE_NAME,
  DEFAULT_MAX_AGE_MS,
  getAuthCookieOptions,
  setAuthCookie,
  clearAuthCookie,
  extractTokenFromReq,
  extractTokenFromSocket,
  parseCookieHeader
}
