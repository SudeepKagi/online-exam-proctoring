#!/usr/bin/env node
/**
 * scripts/ci/check-no-stubs.js
 * 
 * CI Guardrail: AST + Regex Stub Scanner (§R0 Requirement 2)
 * 
 * Asserts zero stubs, zero fake-passes, and zero unobserved writes across the codebase:
 * 1. Numeric literals >= 0.5 assigned to score|similarity|matchScore|confidence
 * 2. Forbidden stub strings:
 *    verified-key | student-face-key | student-id-key |
 *    Evidence acknowledged | Violation logged | Watermark acknowledged
 * 3. Functions named *Mock* | generateMock* outside __tests__ / test suites
 * 4. success: true responses in handlers that perform no await on a repository/service call
 * 5. Empty catch(() => {}) or catch(e) {} around database/storage write operations
 */

const fs = require('fs')
const path = require('path')
const acorn = require('acorn')
const walk = require('acorn-walk')
const acornJsx = require('acorn-jsx')

const REPO_ROOT = path.resolve(__dirname, '../..')
const parser = acorn.Parser.extend(acornJsx())

// Extend acorn-walk base visitor to handle JSX nodes
const jsxWalkBase = {
  ...walk.base,
  JSXElement(node, st, c) {
    if (node.openingElement) c(node.openingElement, st)
    if (node.children) node.children.forEach(child => c(child, st))
  },
  JSXFragment(node, st, c) {
    if (node.children) node.children.forEach(child => c(child, st))
  },
  JSXExpressionContainer(node, st, c) {
    if (node.expression) c(node.expression, st)
  },
  JSXAttribute(node, st, c) {
    if (node.value) c(node.value, st)
  },
  JSXSpreadAttribute(node, st, c) {
    if (node.argument) c(node.argument, st)
  },
  JSXOpeningElement(node, st, c) {
    if (node.attributes) node.attributes.forEach(attr => c(attr, st))
  },
  JSXClosingElement() {},
  JSXText() {},
  JSXIdentifier() {},
  JSXMemberExpression() {},
  JSXNamespacedName() {},
  JSXEmptyExpression() {}
}

// Directories to scan
const SCAN_ROOTS = [
  path.join(REPO_ROOT, 'proctornet/backend/src'),
  path.join(REPO_ROOT, 'proctornet/frontend/src'),
  path.join(REPO_ROOT, 'shared')
]

// Excluded patterns
const EXCLUDE_PATHS = [
  /[\\/]node_modules[\\/]/,
  /[\\/]\.git[\\/]/,
  /[\\/]dist[\\/]/,
  /[\\/]build[\\/]/,
  /[\\/]coverage[\\/]/
]

// 1. Forbidden strings
const FORBIDDEN_STRINGS = [
  'verified-key',
  'student-face-key',
  'student-id-key',
  'Evidence acknowledged',
  'Violation logged',
  'Watermark acknowledged'
]

// 2. Score regex fallback
const HARDCODED_SCORE_REGEX = /\b(score|similarity|matchScore|confidence)\s*[:=]\s*(0\.[5-9]\d*|1(?:\.0+)?)\b/i

// 3. Mock function name pattern
const MOCK_NAME_REGEX = /(Mock|generateMock)/i

// 5. Database/Storage/Repository Write patterns (fail-closed observable side-effects)
const WRITE_CALL_PATTERN = /(?:prisma\b|repository\b|\$executeRaw|\$queryRaw|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM\s+\w+)/i

let totalFilesScanned = 0
let violations = []

function isTestFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/')
  return (
    normalized.includes('/__tests__/') ||
    normalized.includes('/tests/') ||
    normalized.endsWith('.test.js') ||
    normalized.endsWith('.test.ts') ||
    normalized.endsWith('.spec.js') ||
    normalized.endsWith('.spec.ts')
  )
}

function scanFile(filePath) {
  const relativePath = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/')
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  totalFilesScanned++

  const inTest = isTestFile(filePath)

  // ── 1. Forbidden Strings Check ─────────────────────────────
  FORBIDDEN_STRINGS.forEach((str) => {
    if (content.includes(str)) {
      lines.forEach((line, idx) => {
        if (line.includes(str)) {
          // Ignore comment lines
          const trimmed = line.trim()
          if (!trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')) {
            violations.push({
              file: relativePath,
              line: idx + 1,
              rule: 'FORBIDDEN_STRING',
              message: `Forbidden stub string found: "${str}"`
            })
          }
        }
      })
    }
  })

  // ── 2. AST + Regex Checks ──────────────────────────────────
  let ast = null
  try {
    ast = parser.parse(content, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true
    })
  } catch (_e) {
    // If AST parsing fails (e.g. TypeScript syntax), fallback strictly to regex scanner
  }

  if (ast) {
    walk.simple(ast, {
      // Rule 1: Numeric literals >= 0.5 assigned to score|similarity|matchScore|confidence
      Property(node) {
        let keyName = null
        if (node.key.type === 'Identifier') keyName = node.key.name
        else if (node.key.type === 'Literal') keyName = String(node.key.value)

        if (keyName && /^(score|similarity|matchScore|confidence)$/i.test(keyName)) {
          if (node.value.type === 'Literal' && typeof node.value.value === 'number' && node.value.value >= 0.5) {
            violations.push({
              file: relativePath,
              line: node.loc.start.line,
              rule: 'HARDCODED_SCORE',
              message: `Hardcoded score/confidence >= 0.5 assigned to property "${keyName}": ${node.value.value}`
            })
          }
        }
      },

      AssignmentExpression(node) {
        let leftName = null
        if (node.left.type === 'Identifier') leftName = node.left.name
        else if (node.left.type === 'MemberExpression' && node.left.property.type === 'Identifier') {
          leftName = node.left.property.name
        }

        if (leftName && /^(score|similarity|matchScore|confidence)$/i.test(leftName)) {
          if (node.right.type === 'Literal' && typeof node.right.value === 'number' && node.right.value >= 0.5) {
            violations.push({
              file: relativePath,
              line: node.loc.start.line,
              rule: 'HARDCODED_SCORE',
              message: `Hardcoded score/confidence >= 0.5 assigned to variable "${leftName}": ${node.right.value}`
            })
          }
        }
      },

      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && /^(score|similarity|matchScore|confidence)$/i.test(node.id.name)) {
          if (node.init && node.init.type === 'Literal' && typeof node.init.value === 'number' && node.init.value >= 0.5) {
            violations.push({
              file: relativePath,
              line: node.loc.start.line,
              rule: 'HARDCODED_SCORE',
              message: `Hardcoded score/confidence >= 0.5 assigned in declaration of "${node.id.name}": ${node.init.value}`
            })
          }
        }
      },

      // Rule 3: Mock functions outside tests
      FunctionDeclaration(node) {
        if (!inTest && node.id && MOCK_NAME_REGEX.test(node.id.name)) {
          violations.push({
            file: relativePath,
            line: node.loc.start.line,
            rule: 'MOCK_FUNCTION_OUTSIDE_TESTS',
            message: `Mock function declaration found outside tests: "${node.id.name}"`
          })
        }
      },

      MethodDefinition(node) {
        if (!inTest && node.key && node.key.type === 'Identifier' && MOCK_NAME_REGEX.test(node.key.name)) {
          violations.push({
            file: relativePath,
            line: node.loc.start.line,
            rule: 'MOCK_FUNCTION_OUTSIDE_TESTS',
            message: `Mock method found outside tests: "${node.key.name}"`
          })
        }
      },

      // Rule 4: success: true responses in handlers with no await (controllers)
      FunctionExpression(node) {
        checkHandlerAwaits(node, relativePath, content)
      },
      ArrowFunctionExpression(node) {
        checkHandlerAwaits(node, relativePath, content)
      },

      // Rule 5: Empty catch around writes
      CatchClause(node) {
        if (!node.body || node.body.body.length === 0) {
          // Check if parent try block contains write operations
          const clauseText = content.slice(node.loc.start.index || 0, node.loc.end.index || 0)
          // Find enclosing or previous try
          const startLine = Math.max(1, node.loc.start.line - 15)
          const slice = lines.slice(startLine - 1, node.loc.start.line).join('\n')
          if (WRITE_CALL_PATTERN.test(slice)) {
            violations.push({
              file: relativePath,
              line: node.loc.start.line,
              rule: 'EMPTY_CATCH_AROUND_WRITE',
              message: 'Empty catch block found around database or storage write operation'
            })
          }
        }
      }
    }, jsxWalkBase)
  } else {
    // Regex fallback for non-parsed files
    lines.forEach((line, idx) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return

      if (HARDCODED_SCORE_REGEX.test(line)) {
        violations.push({
          file: relativePath,
          line: idx + 1,
          rule: 'HARDCODED_SCORE',
          message: `Regex detected hardcoded score/confidence >= 0.5: "${trimmed}"`
        })
      }

      if (!inTest && MOCK_NAME_REGEX.test(line) && /(function\s+\w*Mock|const\s+\w*Mock\s*=)/.test(line)) {
        violations.push({
          file: relativePath,
          line: idx + 1,
          rule: 'MOCK_FUNCTION_OUTSIDE_TESTS',
          message: `Regex detected mock function outside tests: "${trimmed}"`
        })
      }
    })
  }

  // Promise .catch(() => {}) regex check for writes
  const catchPromiseRegex = /\.catch\s*\(\s*(?:\(\s*\)|\w+)?\s*=>\s*\{\s*\}\s*\)/g
  let match
  while ((match = catchPromiseRegex.exec(content)) !== null) {
    const matchIndex = match.index
    // Check preceding 200 characters for write calls
    const preceding = content.slice(Math.max(0, matchIndex - 250), matchIndex)
    if (WRITE_CALL_PATTERN.test(preceding)) {
      const lineNum = content.slice(0, matchIndex).split('\n').length
      violations.push({
        file: relativePath,
        line: lineNum,
        rule: 'EMPTY_CATCH_AROUND_WRITE',
        message: 'Empty promise .catch(() => {}) found around write operation'
      })
    }
  }
}

function checkHandlerAwaits(node, relativePath, content) {
  // Only check controller files
  if (!relativePath.includes('controller.js')) return

  let sendsSuccess = false
  let hasAwait = false

  walk.simple(node.body, {
    AwaitExpression() {
      hasAwait = true
    },
    Property(propNode) {
      if (
        propNode.key &&
        (propNode.key.name === 'success' || propNode.key.value === 'success') &&
        propNode.value &&
        propNode.value.type === 'Literal' &&
        propNode.value.value === true
      ) {
        sendsSuccess = true
      }
    }
  }, jsxWalkBase)

  // If a controller handler returns success: true without ANY await on a service/repo
  if (sendsSuccess && !hasAwait) {
    // Check if it's an express handler taking (req, res)
    const paramNames = (node.params || []).map((p) => p.name)
    if (paramNames.includes('res') || paramNames.includes('next')) {
      violations.push({
        file: relativePath,
        line: node.loc.start.line,
        rule: 'SYNCHRONOUS_SUCCESS_HANDLER',
        message: 'Handler returns success: true without awaiting any service or repository call'
      })
    }
  }
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (EXCLUDE_PATHS.some((p) => p.test(fullPath))) continue

    if (entry.isDirectory()) {
      scanDir(fullPath)
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      scanFile(fullPath)
    }
  }
}

console.log('🔍 [CI] Running AST + Regex Stub Scanner (check-no-stubs.js)...')
SCAN_ROOTS.forEach((root) => scanDir(root))

console.log(`\n📊 Scan completed across ${totalFilesScanned} source files.`)

if (violations.length > 0) {
  console.error(`\n❌ Found ${violations.length} stub/mock violation(s):`)
  violations.forEach((v, i) => {
    console.error(`  ${i + 1}. [${v.rule}] ${v.file}:${v.line} — ${v.message}`)
  })
  process.exit(1)
} else {
  console.log('✅ Stub scanner green: zero hardcoded scores, zero stubs, zero unobserved writes, zero fake handlers.\n')
  process.exit(0)
}
