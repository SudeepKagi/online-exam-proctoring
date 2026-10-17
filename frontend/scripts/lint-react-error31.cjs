const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default

const SRC_DIR = path.resolve(__dirname, '../src')

let violations = []

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      scanDir(fullPath)
    } else if (/\.(jsx|js)$/.test(entry.name) && !entry.name.endsWith('.test.js') && !entry.name.endsWith('.spec.js')) {
      checkFile(fullPath)
    }
  }
}

function checkFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8')
  let ast
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx']
    })
  } catch (e) {
    return
  }

  traverse(ast, {
    JSXElement(nodePath) {
      // Check JSX children expressions
      for (const child of nodePath.node.children) {
        if (child.type === 'JSXExpressionContainer') {
          const expr = child.expression
          
          // Case 1: Direct identifier like {err} or {error}
          if (expr.type === 'Identifier' && /^(err|error)$/i.test(expr.name)) {
            violations.push({
              file: path.relative(SRC_DIR, filePath),
              line: expr.loc?.start.line,
              code: `{${expr.name}}`,
              reason: `Direct rendering of '${expr.name}' object as a React child causes React Error #31.`
            })
          }

          // Case 2: MemberExpression like {err.response} or {error.response}
          if (expr.type === 'MemberExpression') {
            const propName = expr.property?.name
            const obj = expr.object
            const objName = obj?.name

            if (/^(err|error)$/i.test(objName) && propName === 'response') {
              violations.push({
                file: path.relative(SRC_DIR, filePath),
                line: expr.loc?.start.line,
                code: `{${objName}.${propName}}`,
                reason: `Direct rendering of '${objName}.${propName}' object as a React child causes React Error #31.`
              })
            }

            // Case 3: MemberExpression like {err.message} or {error.message}
            if (/^(err|error)$/i.test(objName) && propName === 'message') {
              violations.push({
                file: path.relative(SRC_DIR, filePath),
                line: expr.loc?.start.line,
                code: `{${objName}.${propName}}`,
                reason: `Rendering raw '${objName}.message' directly in JSX is forbidden (must use errorMessage(err) catalogue helper).`
              })
            }
          }

          // Case 4: Binary/Logical expression like {error && <div>{error}</div>} or {error && <span>{error.message}</span>}
          if (expr.type === 'LogicalExpression') {
            if (expr.right.type === 'Identifier' && /^(err|error)$/i.test(expr.right.name)) {
              violations.push({
                file: path.relative(SRC_DIR, filePath),
                line: expr.right.loc?.start.line,
                code: `{... && ${expr.right.name}}`,
                reason: `Direct rendering of '${expr.right.name}' as a React child causes React Error #31.`
              })
            }
            if (expr.right.type === 'MemberExpression') {
              const propName = expr.right.property?.name
              const objName = expr.right.object?.name
              if (/^(err|error)$/i.test(objName) && propName === 'message') {
                violations.push({
                  file: path.relative(SRC_DIR, filePath),
                  line: expr.right.loc?.start.line,
                  code: `{... && ${objName}.${propName}}`,
                  reason: `Rendering raw '${objName}.message' directly in JSX is forbidden (must use errorMessage(err) catalogue helper).`
                })
              }
            }
          }
        }
      }
    }
  })
}

scanDir(SRC_DIR)

if (violations.length > 0) {
  console.error(`\x1b[31m[AST GATE FAILED] Found ${violations.length} forbidden React Error #31 patterns:\x1b[0m\n`)
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line} -> ${v.code}: ${v.reason}`)
  }
  process.exit(1)
} else {
  console.log(`\x1b[32m[AST GATE PASSED] All JSX expressions free of direct error objects and uncatalogued err.message (React Error #31 safe).\x1b[0m`)
  process.exit(0)
}
