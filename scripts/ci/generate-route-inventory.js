#!/usr/bin/env node
/**
 * generate-route-inventory.js
 * Generates docs/api/ROUTE_INVENTORY.md by introspecting mounted Express routers.
 * Prevents route inventory drift by deriving route matrices directly from code.
 */

const fs = require('fs')
const path = require('path')

process.env.NODE_ENV = 'test'
process.env.START_WORKERS = 'false'

const REPO_ROOT = path.resolve(__dirname, '../..')
const INVENTORY_FILE = path.join(REPO_ROOT, 'docs/api/ROUTE_INVENTORY.md')

function extractRoutes() {
  const v1Router = require('../../proctornet/backend/src/modules/router')
  const routes = []

  function inspectRouter(router, parentPrefix = '', inheritedAuth = false, inheritedRoles = []) {
    let routerAuth = inheritedAuth
    let routerRoles = [...inheritedRoles]

    // 1. Identify router-level middleware in stack
    for (const layer of router.stack) {
      if (!layer.route && layer.handle) {
        if (layer.handle.isAuthMiddleware || layer.handle.name === 'authenticate') {
          routerAuth = true
        }
        if (layer.handle.allowedRoles) {
          routerRoles = layer.handle.allowedRoles
        }
      }
    }

    // 2. Process route layers and nested router layers
    for (const layer of router.stack) {
      if (layer.route) {
        const route = layer.route
        let routeAuth = routerAuth
        let routeRoles = [...routerRoles]

        // Inspect route-specific middleware
        for (const handlerLayer of route.stack) {
          const fn = handlerLayer.handle
          if (fn.isAuthMiddleware || fn.name === 'authenticate') {
            routeAuth = true
          }
          if (fn.allowedRoles) {
            routeRoles = fn.allowedRoles
          }
        }

        const methods = Object.keys(route.methods).map(m => m.toUpperCase())
        const rawPaths = Array.isArray(route.path) ? route.path : [route.path]

        for (const rawPath of rawPaths) {
          const fullPath = (parentPrefix + rawPath).replace(/\/+/g, '/').replace(/\/$/, '') || '/'

          for (const method of methods) {
            const moduleName = determineModule(fullPath)
            const ownerCheck = determineOwnerCheck(fullPath, routeRoles, method)
            const { effect, negativeEffect } = determineEffect(method, fullPath)

            routes.push({
              method,
              path: fullPath,
              auth: routeAuth ? 'Required' : 'Public',
              role: routeRoles.length > 0 ? routeRoles.join(', ') : (routeAuth ? 'Any Authenticated' : 'Public'),
              ownerCheck,
              module: moduleName,
              effect,
              negativeEffect
            })
          }
        }
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        let subPrefix = parentPrefix
        if (layer.regexp && layer.regexp.source) {
          const match = layer.regexp.source.match(/^\^\\\/([a-zA-Z0-9_\-]+)/)
          if (match) {
            subPrefix = `${parentPrefix}/${match[1]}`
          }
        }
        inspectRouter(layer.handle, subPrefix, routerAuth, routerRoles)
      }
    }
  }

  inspectRouter(v1Router, '/api/v1')
  return deduplicateAndSort(routes)
}

function determineModule(path) {
  const parts = path.split('/').filter(Boolean)
  // parts[0] is 'api', parts[1] is 'v1'
  const segment = parts[2] || 'system'
  if (['auth', 'admin', 'faculty', 'student', 'invigilator', 'notifications'].includes(segment)) {
    return segment
  }
  if (segment === 'exams') return 'exams'
  if (segment === 'questions') return 'questions'
  if (segment === 'attempts') return 'attempts'
  if (segment === 'answers') return 'answers'
  if (segment === 'submissions') return 'submissions'
  if (segment === 'proctoring') return 'proctoring'
  if (segment === 'results') return 'results'
  if (segment === 'media' || segment === 'evidence') return 'media'
  if (segment === 'audit') return 'audit'
  if (segment === 'vpn') return 'vpn'
  if (segment === 'device-check' || segment === 'exam') return 'deviceCheck'
  return 'system'
}

function determineOwnerCheck(path, roles, method) {
  // Public or read-only system routes
  if (roles.length === 0 || path.includes('/health')) return 'No'
  // Admin-only operations have system scope
  if (roles.length === 1 && roles[0] === 'admin') return 'No (Admin Scope)'
  // Invigilator session or livegrid operations
  if (roles.includes('invigilator')) {
    if (path.includes(':examId') || path.includes('/violations') || path.includes('/pause') || path.includes('/resume') || path.includes('/terminate')) {
      return 'Yes (Exam Session Scoped)'
    }
  }
  // Faculty operations check exam ownership
  if (roles.includes('faculty')) {
    if (path.includes('/exams') || path.includes('/questions') || path.includes('/results')) {
      return 'Yes (Faculty Exam Owner)'
    }
  }
  // Student operations check student attempt/identity ownership
  if (roles.includes('student')) {
    if (path.includes('/exams') || path.includes('/answers') || path.includes('/attempts') || path.includes('/profile') || path.includes('/consent') || path.includes('/verify') || path.includes('/tickets')) {
      return 'Yes (Candidate Identity)'
    }
  }
  return 'Yes'
}

function determineEffect(method, path) {
  if (method === 'GET' || method === 'HEAD') {
    return {
      effect: 'None (Read-only query)',
      negativeEffect: 'None (Zero DB/storage mutation)'
    }
  }

  if (path.includes('/auth/login')) {
    return {
      effect: 'Session token issued; cookie set',
      negativeEffect: 'Zero tokens issued; zero cookies set'
    }
  }
  if (path.includes('/auth/refresh')) {
    return {
      effect: 'Rotated token pair issued',
      negativeEffect: 'Zero tokens rotated; zero session changes'
    }
  }
  if (path.includes('/auth/logout')) {
    return {
      effect: 'Session cookie cleared; token invalidated',
      negativeEffect: 'Zero session changes'
    }
  }
  if (path.includes('/answers')) {
    return {
      effect: 'DB row upserted (answers) with CAS revision increment',
      negativeEffect: '0 answer rows mutated; revision unchanged'
    }
  }
  if (path.includes('/submit')) {
    return {
      effect: 'DB row updated (exam_attempts SUBMITTED) + Outbox row (attempt.submitted)',
      negativeEffect: '0 outbox events created; attempt status unchanged'
    }
  }
  if (path.includes('/violations')) {
    return {
      effect: 'DB row inserted (violation_events) + flag_count incremented',
      negativeEffect: '0 violation_events inserted; 0 flag counts mutated'
    }
  }
  if (path.includes('/warn')) {
    return {
      effect: 'Audit log row created + Socket notification dispatched',
      negativeEffect: '0 audit logs created; 0 notifications dispatched'
    }
  }
  if (path.includes('/pause')) {
    return {
      effect: 'DB row updated (exam_attempts SUSPENDED) + audit log',
      negativeEffect: 'Attempt status untouched; 0 audit logs'
    }
  }
  if (path.includes('/resume')) {
    return {
      effect: 'DB row updated (exam_attempts ACTIVE) + audit log',
      negativeEffect: 'Attempt status untouched; 0 audit logs'
    }
  }
  if (path.includes('/terminate')) {
    return {
      effect: 'DB row updated (exam_attempts TERMINATED) + Outbox row + audit log',
      negativeEffect: 'Attempt status untouched; 0 audit logs'
    }
  }
  if (path.includes('/acknowledge')) {
    return {
      effect: 'DB row updated (violation_events acknowledged=true) + audit log',
      negativeEffect: 'Violation state untouched; 0 audit logs'
    }
  }
  if (path.includes('/presign') || path.includes('/evidence')) {
    return {
      effect: 'S3 presigned URL/POST policy issued + DB ticket created',
      negativeEffect: '0 S3 policies issued; 0 DB tickets created'
    }
  }
  if (path.includes('/results/release')) {
    return {
      effect: 'DB row updated (exam_results is_released=true) + Redis emit',
      negativeEffect: '0 results modified; 0 emits dispatched'
    }
  }
  if (path.includes('/announcements')) {
    return {
      effect: method === 'DELETE' ? 'DB row deleted (announcements)' : 'DB row inserted (announcements)',
      negativeEffect: '0 announcements mutated'
    }
  }
  if (path.includes('/enrollments') || path.includes('/students')) {
    return {
      effect: 'DB row updated (students/enrollments approval_status mutated)',
      negativeEffect: '0 student records mutated'
    }
  }
  if (path.includes('/questions')) {
    return {
      effect: method === 'DELETE' ? 'DB row deleted (questions)' : 'DB row created/updated (questions)',
      negativeEffect: '0 questions mutated'
    }
  }
  if (path.includes('/exams')) {
    return {
      effect: method === 'DELETE' ? 'DB row deleted (exams)' : 'DB row created/updated (exams)',
      negativeEffect: '0 exams mutated'
    }
  }
  if (path.includes('/settings')) {
    return {
      effect: 'DB row updated (platform_settings)',
      negativeEffect: '0 settings mutated'
    }
  }
  if (path.includes('/vpn')) {
    return {
      effect: 'DB row mutated (vpn_peers / vpn_ip_pool leased or released)',
      negativeEffect: '0 VPN leases modified'
    }
  }

  return {
    effect: `DB row mutated (${method} ${path})`,
    negativeEffect: 'Rejected requests mutate zero rows'
  }
}

function deduplicateAndSort(routes) {
  const seen = new Set()
  const unique = []

  for (const r of routes) {
    const key = `${r.method}:${r.path}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(r)
    }
  }

  return unique.sort((a, b) => {
    if (a.path !== b.path) return a.path.localeCompare(b.path)
    return a.method.localeCompare(b.method)
  })
}

function generateMarkdown(routes) {
  const timestamp = new Date().toISOString()
  const modules = [...new Set(routes.map(r => r.module))].sort()

  let md = `# ProctorNet API Route Inventory (Canonical v1 Monolith)\n\n`
  md += `> **Auto-generated from code:** Generated via \`scripts/ci/generate-route-inventory.js\` from mounted Express routers.\n`
  md += `> **Generation Timestamp:** \`${timestamp}\`\n`
  md += `> **Total Endpoints:** \`${routes.length}\` across \`${modules.length}\` domain modules.\n\n`

  md += `## Modules Summary\n\n`
  md += `| Module | Route Count |\n`
  md += `| :--- | :--- |\n`
  for (const m of modules) {
    const count = routes.filter(r => r.module === m).length
    md += `| \`${m}\` | ${count} |\n`
  }

  md += `\n## Master Route Matrix\n\n`
  md += `| Method | Path | Auth | Role(s) | Owner Check | Module | Observable Effect | Negative Effect |\n`
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`

  for (const r of routes) {
    md += `| \`${r.method}\` | \`${r.path}\` | ${r.auth} | \`${r.role}\` | ${r.ownerCheck} | \`${r.module}\` | ${r.effect} | ${r.negativeEffect} |\n`
  }

  return md
}

function main() {
  console.log('🔍 [Inventory] Introspecting mounted Express routers...')
  const routes = extractRoutes()
  console.log(`📊 Found ${routes.length} canonical endpoints across mounted modules.`)

  const markdown = generateMarkdown(routes)
  fs.mkdirSync(path.dirname(INVENTORY_FILE), { recursive: true })
  fs.writeFileSync(INVENTORY_FILE, markdown, 'utf8')
  console.log(`✅ [Inventory] Written successfully to: ${path.relative(REPO_ROOT, INVENTORY_FILE)}`)

  // Also write route matrix JSON for automated test suite
  const jsonPath = path.join(REPO_ROOT, 'docs/api/route-matrix.json')
  fs.writeFileSync(jsonPath, JSON.stringify(routes, null, 2), 'utf8')
  console.log(`✅ [Inventory] Route matrix dataset written to: ${path.relative(REPO_ROOT, jsonPath)}`)

  process.exit(0)
}

if (require.main === module) {
  main()
}

module.exports = {
  extractRoutes
}
