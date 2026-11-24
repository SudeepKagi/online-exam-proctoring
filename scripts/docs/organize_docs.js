/**
 * scripts/docs/organize_docs.js
 * Moves internal engineering folders under docs/ into docs/internal/ preserving git history.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const docsDir = path.join(repoRoot, 'docs');
const internalDir = path.join(docsDir, 'internal');

if (!fs.existsSync(internalDir)) {
  fs.mkdirSync(internalDir, { recursive: true });
}

const itemsToMove = [
  'adr',
  'architecture',
  'assets',
  'ci',
  'ops',
  'samples',
  'seb',
  'security',
  'testing',
  'ui',
  'ux',
  'SEB_PreFlight_Analysis.md'
];

for (const item of itemsToMove) {
  const src = path.join(docsDir, item);
  const dest = path.join(internalDir, item);

  if (fs.existsSync(src)) {
    console.log(`Moving ${item} -> internal/${item}`);
    try {
      execSync(`git mv "${src}" "${dest}"`, { cwd: repoRoot, stdio: 'inherit' });
    } catch (e) {
      console.warn(`Fallback moving without git mv: ${item}`);
      fs.renameSync(src, dest);
    }
  }
}

// Write one-line index in docs/internal/README.md
const internalIndex = `# Internal Engineering Records Index

This directory archives historical architectural decisions, deployment logs, operational runbooks, and test audits.
`;

fs.writeFileSync(path.join(internalDir, 'README.md'), internalIndex, 'utf8');
console.log('Successfully organized internal docs.');
