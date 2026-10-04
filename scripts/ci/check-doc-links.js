const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '../..')
const docsDir = path.join(repoRoot, 'docs')

function getMarkdownFiles(dir) {
  let results = []
  const list = fs.readdirSync(dir)
  for (const file of list) {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    if (stat && stat.isDirectory()) {
      results = results.concat(getMarkdownFiles(fullPath))
    } else if (file.endsWith('.md')) {
      results.push(fullPath)
    }
  }
  return results
}

function checkLinks() {
  const mdFiles = getMarkdownFiles(docsDir)
  let brokenLinks = []
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g

  for (const filePath of mdFiles) {
    const content = fs.readFileSync(filePath, 'utf8')
    let match
    while ((match = linkRegex.exec(content)) !== null) {
      const linkTarget = match[2].trim()
      // Skip external URLs, mailto, and anchors
      if (linkTarget.startsWith('http://') || linkTarget.startsWith('https://') || linkTarget.startsWith('mailto:') || linkTarget.startsWith('#')) {
        continue
      }

      // Strip anchor from local file path if present
      const cleanTarget = linkTarget.split('#')[0]
      if (!cleanTarget) continue

      // Resolve target path
      let resolvedTarget
      if (cleanTarget.startsWith('file:///')) {
        // file URI
        let cleaned = decodeURIComponent(cleanTarget.replace('file:///', ''))
        // Windows path handling
        resolvedTarget = path.normalize(cleaned)
      } else if (cleanTarget.startsWith('/')) {
        resolvedTarget = path.join(repoRoot, cleanTarget)
      } else {
        resolvedTarget = path.resolve(path.dirname(filePath), cleanTarget)
      }

      if (!fs.existsSync(resolvedTarget)) {
        brokenLinks.push({
          source: path.relative(repoRoot, filePath),
          linkText: match[1],
          target: cleanTarget,
          resolved: path.relative(repoRoot, resolvedTarget)
        })
      }
    }
  }

  return brokenLinks
}

const broken = checkLinks()
console.log(`Found ${broken.length} broken links in docs/**`)
if (broken.length > 0) {
  for (const b of broken) {
    console.log(`❌ [${b.source}]: "${b.linkText}" -> "${b.target}" (resolved: ${b.resolved})`)
  }
  process.exit(1)
} else {
  console.log('✅ All markdown links in docs/** are valid!')
  process.exit(0)
}
