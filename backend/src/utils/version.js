'use strict'

const fs = require('fs')
const path = require('path')

let cachedVersion = null

function getVersion() {
  if (cachedVersion) {
    return cachedVersion
  }

  let pkgVersion = '1.0.6'
  try {
    const pkg = require('../../package.json')
    if (pkg && pkg.version) pkgVersion = pkg.version
  } catch {
    // ignore
  }

  let versionInfo = {
    version: process.env.APP_VERSION || pkgVersion,
    gitSha: process.env.GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'development',
    builtAt: process.env.BUILD_TIMESTAMP || new Date().toISOString(),
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'development'
  }

  // Look for VERSION file in common runtime locations
  const candidatePaths = [
    path.resolve(__dirname, '../../../VERSION'),
    path.resolve(__dirname, '../../VERSION'),
    path.resolve(process.cwd(), 'VERSION'),
    '/opt/proctornet/current/VERSION'
  ]

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8').trim()
        try {
          const parsed = JSON.parse(raw)
          versionInfo = {
            ...versionInfo,
            ...parsed,
            nodeVersion: process.version,
            env: process.env.NODE_ENV || 'development'
          }
        } catch {
          // If plain string, treat as gitSha or version
          versionInfo.gitSha = raw
        }
        break
      }
    } catch {
      // Continue search
    }
  }

  cachedVersion = versionInfo
  return versionInfo
}

module.exports = {
  getVersion
}
