/**
 * cookies.js
 * Centralized authentication cookie management for ProctorNet.
 * Enforces secure HttpOnly attributes, environment-aware security settings,
 * and reliable cookie extraction for REST APIs and Socket.IO handshakes.
 */

const AUTH_COOKIE_NAME = 'proctornet_auth'
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

/**
 * Compute secure cookie configuration based on deployment environment.
 * @param {number} [maxAgeMs] - Custom max-age in milliseconds
 * @returns {object} Express cookie options
 */
function getAuthCookieOptions(maxAgeMs) {
  const isProd = process.env.NODE_ENV === 'production'
  const sameSite = process.env.COOKIE_SAMESITE || (isProd ? 'lax' : 'lax')

  const options = {
    httpOnly: true,
    secure: isProd,
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
 * @param {import('express').Response} res
 * @param {string} token - Signed JWT
 * @param {number} [maxAgeMs] - Optional lifetime in ms
 */
function setAuthCookie(res, token, maxAgeMs) {
  if (!res || typeof res.cookie !== 'function') return
  const options = getAuthCookieOptions(maxAgeMs)
  res.cookie(AUTH_COOKIE_NAME, token, options)
}

/**
 * Clear the authentication cookie on the response.
 * @param {import('express').Response} res
 */
function clearAuthCookie(res) {
  if (!res || typeof res.clearCookie !== 'function') return
  const isProd = process.env.NODE_ENV === 'production'
  const sameSite = process.env.COOKIE_SAMESITE || (isProd ? 'lax' : 'lax')

  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
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
  if (!req) return null

  // 1. Read from parsed req.cookies (cookie-parser)
  if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
    return req.cookies[AUTH_COOKIE_NAME]
  }

  // 2. Read from raw headers.cookie
  const rawCookieHeader = req.headers?.cookie
  if (rawCookieHeader) {
    const token = parseCookieHeader(rawCookieHeader, AUTH_COOKIE_NAME)
    if (token) return token
  }

  // 3. Deliberate fallback for non-browser automation / test suites: Authorization: Bearer <token>
  const authHeader = req.headers?.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1].trim()
  }

  return null
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
    const token = parseCookieHeader(handshakeCookie, AUTH_COOKIE_NAME)
    if (token) return token
  }

  // 2. Read from underlying HTTP request cookie (if present)
  const reqCookie = socket.request?.headers?.cookie
  if (reqCookie) {
    const token = parseCookieHeader(reqCookie, AUTH_COOKIE_NAME)
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
  DEFAULT_MAX_AGE_MS,
  getAuthCookieOptions,
  setAuthCookie,
  clearAuthCookie,
  extractTokenFromReq,
  extractTokenFromSocket,
  parseCookieHeader
}
