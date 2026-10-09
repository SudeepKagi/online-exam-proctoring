#!/usr/bin/env node
'use strict'

/**
 * scripts/ci/check-no-source-grep-tests.js
 *
 * CI Gate: Prohibit Comment/String Grep Assertion Tests (§Prompt 7 T4)
 *
 * Scans test files to ensure tests do NOT read runtime source files (.js/.jsx)
 * and use String.includes / indexOf / regex to assert runtime behavior.
 * Tests must be behavioural (invoking functions and asserting inputs -> outputs).
 */

const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '../..')

// Allowed patterns for documentation link checkers, CI workflow checks, or config template files
const ALLOWED_TEST_PATHS = [
  'ci_workflow_integrity.test.js',
  'check-doc-links.js',
  'check-no-stubs.js',
  'check-no-legacy.js',
  'scan-banned-terms.js',
  'check-ledger.js',
  'gate-sanity-banned-terms.test.js'
]

function walkDir(dir) {
  let files = []
  if (!fs.existsSync(dir)) return files

  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue
    const fullPath = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      files.push(...walkDir(fullPath))
    } else if (ent.isFile() && (ent.name.endsWith('.test.js') || ent.name.endsWith('.spec.js'))) {
      files.push(fullPath)
    }
  }
  return files
}

function main() {
  const testFiles = [
    ...walkDir(path.join(REPO_ROOT, 'tests')),
    ...walkDir(path.join(REPO_ROOT, 'proctornet/backend/tests'))
  ]

  const violations = []

  for (const testFile of testFiles) {
    const relPath = path.relative(REPO_ROOT, testFile).replace(/\\/g, '/')
    if (ALLOWED_TEST_PATHS.some(allowed => relPath.includes(allowed))) {
      continue
    }

    const content = fs.readFileSync(testFile, 'utf8')
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Detect patterns where tests read source JS/JSX and grep for logic statements like 'if (' or function bodies
      const readsSourceFile = /readFileSync\s*\([^)]*\.(?:js|jsx)['"`]\s*,\s*['"`]utf8['"`]\)/i.test(line) ||
                              /readFileSync\s*\([^)]*(?:modules|pages|components|lib)\/[^)]*\)/i.test(line)
      
      if (readsSourceFile) {
        // Look ahead in subsequent lines for includes() assertion on source code
        const nextChunk = lines.slice(i, i + 15).join('\n')
        if (/\.includes\s*\(\s*['"`](?:if\s*\(|function|const|let|var|\/vpn-check)/i.test(nextChunk)) {
          violations.push({
            file: relPath,
            line: i + 1,
            snippet: line.trim()
          })
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error('\n[CI LINT ERROR] Detected comment-satisfiable or source-grep tests:')
    for (const v of violations) {
      console.error(`  at ${v.file}:${v.line} -> "${v.snippet}"`)
    }
    console.error('\nTests must execute code behaviourally rather than inspecting source code text via String.includes.\n')
    process.exit(1)
  }

  console.log(`[✓] No source-grep assertion tests detected across ${testFiles.length} test files.`)
}

if (require.main === module) {
  main()
}

module.exports = { main }
