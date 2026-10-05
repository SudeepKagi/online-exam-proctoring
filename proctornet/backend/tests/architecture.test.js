const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

describe('Architectural & Regression Guardrails', () => {
  it('Modular domain controllers must export valid Express routers', () => {
    const facultyRouter = require('../src/modules/faculty/controller')
    const studentRouter = require('../src/modules/student/controller')
    const adminRouter = require('../src/modules/admin/controller')

    assert.strictEqual(typeof facultyRouter, 'function', 'Faculty controller must be an Express router')
    assert.strictEqual(typeof studentRouter, 'function', 'Student controller must be an Express router')
    assert.strictEqual(typeof adminRouter, 'function', 'Admin controller must be an Express router')
  })

  it('Controllers must have ZERO direct prisma.* database invocations (Service Layer Pattern)', () => {
    const modulesDir = path.join(__dirname, '../src/modules')
    const files = ['faculty/controller.js', 'student/controller.js', 'admin/controller.js']

    files.forEach(file => {
      const fullPath = path.join(modulesDir, file)
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
    const modulesDir = path.join(__dirname, '../src/modules')
    const files = ['faculty/controller.js', 'student/controller.js', 'admin/controller.js']

    files.forEach(file => {
      const fullPath = path.join(modulesDir, file)
      const content = fs.readFileSync(fullPath, 'utf8')
      const lines = content.split('\n').length
      assert.ok(lines < 550, `${file} is too long (${lines} lines). Keep below 500 lines.`)
    })
  })

  it('Legacy deployment files (render.yaml, vercel.json) must be deleted in Phase Q2', () => {
    const renderPath = path.join(__dirname, '../../render.yaml')
    const vercelPath = path.join(__dirname, '../../vercel.json')
    assert.strictEqual(fs.existsSync(renderPath), false, 'render.yaml must be deleted')
    assert.strictEqual(fs.existsSync(vercelPath), false, 'vercel.json must be deleted')
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

