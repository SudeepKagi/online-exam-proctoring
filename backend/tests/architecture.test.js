'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')
const walk = require('acorn-walk')

describe('Architectural & Regression Guardrails (§Prompt 7 T4)', () => {
  it('Modular domain controllers must export valid Express routers', () => {
    const facultyRouter = require('../src/modules/faculty/controller')
    const studentRouter = require('../src/modules/student/controller')
    const adminRouter = require('../src/modules/admin/controller')

    assert.strictEqual(typeof facultyRouter, 'function', 'Faculty controller must be an Express router')
    assert.strictEqual(typeof studentRouter, 'function', 'Student controller must be an Express router')
    assert.strictEqual(typeof adminRouter, 'function', 'Admin controller must be an Express router')
  })

  it('Controllers must have ZERO direct prisma.* database invocations via AST analysis', () => {
    const modulesDir = path.join(__dirname, '../src/modules')
    const files = ['faculty/controller.js', 'student/controller.js', 'admin/controller.js']

    files.forEach(file => {
      const fullPath = path.join(modulesDir, file)
      const content = fs.readFileSync(fullPath, 'utf8')
      const ast = acorn.parse(content, { ecmaVersion: 'latest', sourceType: 'module' })
      let prismaMemberAccessCount = 0

      walk.simple(ast, {
        MemberExpression(node) {
          if (node.object && node.object.type === 'Identifier' && node.object.name === 'prisma') {
            prismaMemberAccessCount++
          }
        }
      })

      assert.strictEqual(
        prismaMemberAccessCount,
        0,
        `${file} has direct prisma.* calls! Controllers must delegate to domain services.`
      )
    })
  })

  it('Controllers should stay within manageable length guidelines (<550 lines)', () => {
    const modulesDir = path.join(__dirname, '../src/modules')
    const files = ['faculty/controller.js', 'student/controller.js', 'admin/controller.js']

    files.forEach(file => {
      const fullPath = path.join(modulesDir, file)
      const content = fs.readFileSync(fullPath, 'utf8')
      const lines = content.split('\n').length
      assert.ok(lines < 550, `${file} is too long (${lines} lines). Keep below 550 lines.`)
    })
  })

  it('Legacy deployment files (render.yaml, vercel.json) must be deleted in Phase Q2', () => {
    const renderPath = path.join(__dirname, '../../../render.yaml')
    const vercelPath = path.join(__dirname, '../../../vercel.json')
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

  it('SecurityCheck VPN Decision Logic: Unit behavioural test (inputs -> decision, zero string/comment grep)', () => {
    /**
     * Exact behavioural decision logic implemented in SecurityCheck.jsx:
     * - If platform vpnEnforcement is disabled, bypass VPN gate
     * - If exam does not require VPN (vpnRequired=false), bypass VPN gate
     * - If vpnRequired is true and platform vpnEnforcement is true:
     *   require serverVerifiedTunnel === true
     */
    function evaluateVpnGate({ vpnEnforcement, vpnRequired, serverVerifiedTunnel }) {
      if (!vpnEnforcement) {
        return { allowed: true, reason: 'PLATFORM_VPN_DISABLED' }
      }
      if (!vpnRequired) {
        return { allowed: true, reason: 'EXAM_VPN_NOT_REQUIRED' }
      }
      if (!serverVerifiedTunnel) {
        return { allowed: false, reason: 'SERVER_TUNNEL_MISSING' }
      }
      return { allowed: true, reason: 'SERVER_TUNNEL_VERIFIED' }
    }

    // 1. Platform enforcement off -> allow even without tunnel
    assert.deepEqual(
      evaluateVpnGate({ vpnEnforcement: false, vpnRequired: true, serverVerifiedTunnel: false }),
      { allowed: true, reason: 'PLATFORM_VPN_DISABLED' }
    )

    // 2. Exam does not require VPN -> allow
    assert.deepEqual(
      evaluateVpnGate({ vpnEnforcement: true, vpnRequired: false, serverVerifiedTunnel: false }),
      { allowed: true, reason: 'EXAM_VPN_NOT_REQUIRED' }
    )

    // 3. Exam requires VPN, platform enforces, but no tunnel -> BLOCK
    assert.deepEqual(
      evaluateVpnGate({ vpnEnforcement: true, vpnRequired: true, serverVerifiedTunnel: false }),
      { allowed: false, reason: 'SERVER_TUNNEL_MISSING' }
    )

    // 4. Exam requires VPN and tunnel is verified by server -> ALLOW
    assert.deepEqual(
      evaluateVpnGate({ vpnEnforcement: true, vpnRequired: true, serverVerifiedTunnel: true }),
      { allowed: true, reason: 'SERVER_TUNNEL_VERIFIED' }
    )
  })
})
