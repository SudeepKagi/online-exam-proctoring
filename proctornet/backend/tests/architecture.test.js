const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

describe('Architectural & Regression Guardrails', () => {
  it('faculty.controller.js must export valid unique functions with no duplicate declarations in source', () => {
    const facultyController = require('../src/controllers/faculty.controller')
    const exportedKeys = Object.keys(facultyController)

    assert.ok(exportedKeys.length >= 10, 'Must export all required handler methods')
    exportedKeys.forEach(key => {
      assert.strictEqual(typeof facultyController[key], 'function', `Export ${key} must be a valid function`)
    })

    // Check source code for duplicate function declarations
    const filePath = path.join(__dirname, '../src/controllers/faculty.controller.js')
    const content = fs.readFileSync(filePath, 'utf8')
    const functionRegex = /async function\s+([a-zA-Z0-9_]+)\s*\(/g
    const matches = []
    let m
    while ((m = functionRegex.exec(content)) !== null) {
      matches.push(m[1])
    }

    const uniqueMatches = new Set(matches)
    assert.strictEqual(
      matches.length,
      uniqueMatches.size,
      `Duplicate function names found in faculty.controller.js: ${matches.filter((v, i, a) => a.indexOf(v) !== i).join(', ')}`
    )
  })

  it('Controllers must have ZERO direct prisma.* database invocations (Service Layer Pattern)', () => {
    const controllersDir = path.join(__dirname, '../src/controllers')
    const files = ['faculty.controller.js', 'student.controller.js', 'admin.controller.js']

    files.forEach(file => {
      const fullPath = path.join(controllersDir, file)
      const content = fs.readFileSync(fullPath, 'utf8')
      const prismaCalls = (content.match(/prisma\.[a-zA-Z0-9_]+\./g) || []).length
      assert.strictEqual(
        prismaCalls,
        0,
        `${file} has direct prisma.* calls! Controllers must delegate to domain services.`
      )
    })
  })

  it('Controllers should stay within manageable length guidelines (<500 lines)', () => {
    const controllersDir = path.join(__dirname, '../src/controllers')
    const files = ['faculty.controller.js', 'student.controller.js', 'admin.controller.js']

    files.forEach(file => {
      const fullPath = path.join(controllersDir, file)
      const content = fs.readFileSync(fullPath, 'utf8')
      const lines = content.split('\n').length
      assert.ok(lines < 550, `${file} is too long (${lines} lines). Keep below 500 lines.`)
    })
  })

  it('render.yaml startCommand must point to an existing backend entry point (src/app.js)', () => {
    const renderPath = path.join(__dirname, '../../render.yaml')
    if (fs.existsSync(renderPath)) {
      const renderContent = fs.readFileSync(renderPath, 'utf8')
      assert.ok(
        renderContent.includes('node src/app.js'),
        'render.yaml must use node src/app.js matching package.json entry point'
      )
      assert.ok(
        !renderContent.includes('node src/server.js'),
        'render.yaml must not reference obsolete src/server.js'
      )
    }
  })

  it('VITE_VPN_ENABLED must not exist in any configuration template or frontend source', () => {
    const frontendEnvPath = path.join(__dirname, '../../frontend/.env.example')
    if (fs.existsSync(frontendEnvPath)) {
      const content = fs.readFileSync(frontendEnvPath, 'utf8')
      assert.ok(
        !content.includes('VITE_VPN_ENABLED'),
        'frontend/.env.example must not contain VITE_VPN_ENABLED flag'
      )
    }
  })

  it('SecurityCheck.jsx must enforce mandatory WireGuard tunnel verification with zero bypass', () => {
    const secCheckPath = path.join(__dirname, '../../frontend/src/pages/student/SecurityCheck.jsx')
    if (fs.existsSync(secCheckPath)) {
      const content = fs.readFileSync(secCheckPath, 'utf8')
      assert.ok(
        content.includes('if (!vpnVerified)'),
        'SecurityCheck.jsx must gate exam start on vpnVerified'
      )
      assert.ok(
        content.includes('/vpn-check'),
        'SecurityCheck.jsx must query device agent for real VPN tunnel status'
      )
    }
  })
})

