'use strict'

const fs = require('fs')
const path = require('path')

let mismatches = 0
let checkedFiles = 0

function checkFile(filePath) {
  checkedFiles++
  const content = fs.readFileSync(filePath, 'utf8')
  const importRegex = /(?:import\s+.*?\s+from\s+['"](.*?)['"]|require\(['"](.*?)['"]\))/g
  let match
  while ((match = importRegex.exec(content)) !== null) {
    const rel = match[1] || match[2]
    if (!rel.startsWith('.')) continue // skip external modules

    const dir = path.dirname(filePath)
    const parts = rel.split('/')
    let cur = dir
    for (const part of parts) {
      if (part === '.') continue
      if (part === '..') {
        cur = path.dirname(cur)
        continue
      }
      if (!fs.existsSync(cur)) break
      const actualEntries = fs.readdirSync(cur)
      const exactMatch = actualEntries.find(e =>
        e === part ||
        e === part + '.js' ||
        e === part + '.jsx' ||
        e === part + '.ts' ||
        e === part + '.tsx' ||
        e === part + '.json'
      )
      if (!exactMatch) {
        const caseInsensitiveMatch = actualEntries.find(e =>
          e.toLowerCase() === part.toLowerCase() ||
          e.toLowerCase() === (part + '.js').toLowerCase() ||
          e.toLowerCase() === (part + '.jsx').toLowerCase()
        )
        if (caseInsensitiveMatch) {
          console.error(`❌ Case mismatch in ${filePath}: requested "${part}" but disk has "${caseInsensitiveMatch}"`)
          mismatches++
        }
        break
      }
      cur = path.join(cur, part)
    }
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f)
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist' && f !== 'build') {
        walk(full)
      }
    } else if (/\.(js|jsx|ts|tsx)$/.test(f)) {
      checkFile(full)
    }
  }
}

walk(path.resolve(__dirname, '../../backend/src'))
walk(path.resolve(__dirname, '../../frontend/src'))
walk(path.resolve(__dirname, '../../e2e'))

console.log(`Checked ${checkedFiles} files. Found ${mismatches} import casing mismatches.`)
if (mismatches > 0) {
  process.exit(1)
}
