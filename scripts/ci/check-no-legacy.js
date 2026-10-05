#!/usr/bin/env node
/**
 * check-no-legacy.js
 * CI Guardrail: Asserts that legacy architecture layers and obsolete schema tokens
 * have been completely eliminated from the codebase (Phase Q2 requirement).
 */

const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '../..')
const SRC_DIR = path.join(REPO_ROOT, 'proctornet/backend/src')

const FORBIDDEN_DIRS = [
  path.join(SRC_DIR, 'controllers'),
  path.join(SRC_DIR, 'routes'),
  path.join(SRC_DIR, 'services'),
  path.join(SRC_DIR, 'sockets'),
  path.join(SRC_DIR, 'validators')
]

const FORBIDDEN_FILES = [
  path.join(REPO_ROOT, 'render.yaml'),
  path.join(REPO_ROOT, 'vercel.json'),
  path.join(REPO_ROOT, 'proctornet/render.yaml'),
  path.join(REPO_ROOT, 'proctornet/vercel.json'),
  path.join(REPO_ROOT, 'proctornet/docker-compose.yml')
]

const FORBIDDEN_TOKENS = [
  'global.prisma',
  'studentExam',
  'assignedQuestionIds',
  'facePhotoUrl',
  'imageUrl'
]

let violations = 0

console.log('🔍 [CI] Checking for forbidden legacy directories...')
for (const dir of FORBIDDEN_DIRS) {
  if (fs.existsSync(dir)) {
    console.error(`❌ Legacy directory must not exist: ${path.relative(REPO_ROOT, dir)}`)
    violations++
  }
}

console.log('🔍 [CI] Checking for forbidden legacy deployment files...')
for (const file of FORBIDDEN_FILES) {
  if (fs.existsSync(file)) {
    console.error(`❌ Legacy file must not exist: ${path.relative(REPO_ROOT, file)}`)
    violations++
  }
}

console.log('🔍 [CI] Scanning src/ for forbidden schema & global tokens...')

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      scanDirectory(fullPath)
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      const content = fs.readFileSync(fullPath, 'utf8')
      const lines = content.split('\n')
      lines.forEach((line, idx) => {
        for (const token of FORBIDDEN_TOKENS) {
          if (line.includes(token)) {
            console.error(`❌ Forbidden token '${token}' found in ${path.relative(REPO_ROOT, fullPath)}:${idx + 1}`)
            console.error(`   ${line.trim()}`)
            violations++
          }
        }
      })
    }
  }
}

scanDirectory(SRC_DIR)

if (violations > 0) {
  console.error(`\n❌ Check failed: ${violations} legacy violation(s) detected.`)
  process.exit(1)
} else {
  console.log('\n✅ Check passed: Zero legacy directories, files, or tokens detected in src/.')
  process.exit(0)
}
