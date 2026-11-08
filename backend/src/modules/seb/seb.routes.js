'use strict'

const express = require('express')
const rateLimit = require('express-rate-limit')
const { authenticateToken } = require('../auth/auth.routes')
const sebController = require('./seb.controller')

const router = express.Router()

const isTest = process.env.NODE_ENV === 'test'
const isLoadTest = (process.env.LOADTEST_ALLOW === '1' || process.env.DISABLE_RATE_LIMIT === '1')

const pingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (isTest || isLoadTest) ? 10000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many ping requests. Please slow down.' }
})

const launchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (isTest || isLoadTest) ? 10000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many launch link requests.' }
})

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (isTest || isLoadTest) ? 10000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many configuration download requests.' }
})

// Proof by use: unauthenticated, works in any SEB_MODE
router.get('/ping', pingLimiter, sebController.ping)

// One-click launch link: authenticated
router.post('/launch-link', launchLimiter, authenticateToken, sebController.createLaunchLink)

// Config file download: token check only (no cookies)
router.get('/config/:token', downloadLimiter, sebController.downloadSebConfig)

module.exports = router

