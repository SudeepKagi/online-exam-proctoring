/**
 * scripts/docs/check-docs.js
 * Comprehensive documentation verification tool:
 * 1. Validates relative markdown links resolve to existing files.
 * 2. Validates npm scripts and env vars mentioned in public docs exist.
 * 3. Asserts zero stale terms in public docs.
 * 4. Asserts no secret or infrastructure identifier patterns in public docs.
 * 5. Validates image sizes (<= 300 KB each, total <= 3 MB).
 * 6. Reports sentences exceeding 25 words.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const docsDir = path.join(repoRoot, 'docs');
const imagesDir = path.join(docsDir, 'images');

const STALE_TERMS = [
  'Flask',
  'DeepFace',
  'OpenCV',
  'face_recognition',
  'Cloudinary',
  'WebRTC',
  'screen share',
  'WireGuard',
  'LiveKit',
  'coturn',
  'MinIO',
  'RabbitMQ',
  'Companion',
  'PIN',
  'launch code',
  'violation limit',
  'maxViolations',
  'staging',
  'Kubernetes',
  'proctornet/'
];

// Read all scripts from package.json files
const rootPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const backendPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'backend/package.json'), 'utf8'));
const frontendPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'frontend/package.json'), 'utf8'));

const allValidScripts = new Set([
  ...Object.keys(rootPkg.scripts || {}),
  ...Object.keys(backendPkg.scripts || {}),
  ...Object.keys(frontendPkg.scripts || {})
]);

// Read all env vars from .env.example
const envExampleContent = fs.readFileSync(path.join(repoRoot, '.env.example'), 'utf8');
const allValidEnvVars = new Set();
for (const line of envExampleContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const key = trimmed.split('=')[0].trim();
    if (key) allValidEnvVars.add(key);
  }
}
// Add recognized optional/runtime vars
['APP_URL', 'VITE_API_URL', 'CORS_ORIGIN', 'DIRECT_URL', 'JWT_REFRESH_SECRET', 'FACE_DRIVER', 'OPENAI_MODEL'].forEach(v => allValidEnvVars.add(v));

// Public docs list
const publicDocFiles = [
  path.join(repoRoot, 'README.md'),
  path.join(docsDir, 'README.md'),
  path.join(docsDir, 'GETTING_STARTED.md'),
  path.join(docsDir, 'ARCHITECTURE.md'),
  path.join(docsDir, 'USER_GUIDE.md'),
  path.join(docsDir, 'SECURE_BROWSER.md'),
  path.join(docsDir, 'DEPLOYMENT.md'),
  path.join(docsDir, 'TESTING.md'),
  path.join(docsDir, 'SECURITY_AND_PRIVACY.md')
];

let totalErrors = 0;
let totalWarnings = 0;

console.log('=== ProctorNet Documentation Verification ===\n');

// 1. Check relative links in public docs
console.log('1. Checking relative markdown links...');
let brokenLinks = 0;
for (const file of publicDocFiles) {
  if (!fs.existsSync(file)) {
    console.error(`[ERROR] File missing: ${file}`);
    totalErrors++;
    continue;
  }
  const content = fs.readFileSync(file, 'utf8');
  const fileDir = path.dirname(file);

  // Match [text](link) and <img src="link"
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)|<img[^>]+src="([^">]+)"/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const link = match[2] || match[3];
    if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('#') || link.startsWith('mailto:')) {
      continue; // External or anchor
    }
    const cleanLink = link.split('#')[0]; // strip anchor
    if (!cleanLink) continue;

    const targetPath = path.resolve(fileDir, cleanLink);
    if (!fs.existsSync(targetPath)) {
      console.error(`[ERROR] Broken relative link in ${path.relative(repoRoot, file)}: "${link}" -> not found at ${targetPath}`);
      brokenLinks++;
      totalErrors++;
    }
  }
}
if (brokenLinks === 0) console.log('  All relative links resolved successfully.\n');

// 2. Check npm scripts and env vars mentioned
console.log('2. Checking mentioned npm scripts and environment variables...');
let invalidMentions = 0;
for (const file of publicDocFiles) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');

  // Find npm run <script> or npm <test>
  const npmRegex = /npm\s+(?:run\s+)?([a-zA-Z0-9:-]+)/g;
  let m;
  while ((m = npmRegex.exec(content)) !== null) {
    const script = m[1];
    if (['install', 'ci', 'test'].includes(script)) continue;
    if (!allValidScripts.has(script)) {
      console.error(`[ERROR] Invalid npm script "${script}" mentioned in ${path.relative(repoRoot, file)}`);
      invalidMentions++;
      totalErrors++;
    }
  }

  // Find env var names enclosed in backticks or lists
  const envRegex = /`([A-Z][A-Z0-9_]{3,})`/g;
  let ev;
  while ((ev = envRegex.exec(content)) !== null) {
    const varName = ev[1];
    // Ignore common words/filenames
    if (varName.endsWith('.MD') || ['README', 'HTML', 'JSON'].includes(varName)) continue;
    if (varName.includes('_') && !allValidEnvVars.has(varName)) {
      console.warn(`[WARN] Undocumented or unknown env variable "${varName}" in ${path.relative(repoRoot, file)}`);
      totalWarnings++;
    }
  }
}
if (invalidMentions === 0) console.log('  All mentioned npm scripts are valid.\n');

// 3. Stale terms check in public docs
console.log('3. Checking for stale terms in public documentation...');
let staleHits = 0;
for (const file of publicDocFiles) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, lineNum) => {
    for (const term of STALE_TERMS) {
      let hit = false;
      if (term === 'PIN') {
        if (/\bPIN\b/i.test(line)) hit = true;
      } else {
        if (line.toLowerCase().includes(term.toLowerCase())) hit = true;
      }
      if (hit) {
        console.error(`[ERROR] Stale term "${term}" found in ${path.relative(repoRoot, file)}:${lineNum + 1}: ${line.trim()}`);
        staleHits++;
        totalErrors++;
      }
    }
  });
}
if (staleHits === 0) console.log('  Zero stale terms in public documentation.\n');

// 4. Identifier patterns & secrets in public docs
console.log('4. Checking for infrastructure identifiers or secrets in public docs...');
const SECRET_PATTERNS = [
  { name: 'AWS Account ID (12 digits)', regex: /\b\d{12}\b/ },
  { name: 'AWS EC2 Instance ID', regex: /\bi-[0-9a-f]{8,17}\b/ },
  { name: 'AWS S3 Internal Bucket', regex: /proctornet-storage-prod-[a-zA-Z0-9-]+/ },
  { name: 'Private IPv4', regex: /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|\b172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b|\b192\.168\.\d{1,3}\.\d{1,3}\b/ },
  { name: 'Personal Email', regex: /[a-zA-Z0-9._%+-]+@gmail\.com|[a-zA-Z0-9._%+-]+@yahoo\.com/ }
];

let identifierHits = 0;
for (const file of publicDocFiles) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, lineNum) => {
    for (const p of SECRET_PATTERNS) {
      if (p.regex.test(line)) {
        console.error(`[ERROR] Sensitive pattern "${p.name}" found in ${path.relative(repoRoot, file)}:${lineNum + 1}`);
        identifierHits++;
        totalErrors++;
      }
    }
  });
}
if (identifierHits === 0) console.log('  Zero sensitive identifier patterns in public docs.\n');

// 5. Image sizes check
console.log('5. Checking documentation image sizes...');
let imageErrors = 0;
let totalImageBytes = 0;
if (fs.existsSync(imagesDir)) {
  const images = fs.readdirSync(imagesDir);
  for (const img of images) {
    if (img.endsWith('.png') || img.endsWith('.jpg')) {
      const imgPath = path.join(imagesDir, img);
      const stat = fs.statSync(imgPath);
      totalImageBytes += stat.size;
      const sizeKB = stat.size / 1024;
      if (sizeKB > 300) {
        console.error(`[ERROR] Image "${img}" exceeds 300 KB limit (${sizeKB.toFixed(1)} KB)`);
        imageErrors++;
        totalErrors++;
      }
    }
  }
  const totalMB = totalImageBytes / (1024 * 1024);
  if (totalMB > 3.0) {
    console.error(`[ERROR] Total image bundle exceeds 3.0 MB limit (${totalMB.toFixed(2)} MB)`);
    imageErrors++;
    totalErrors++;
  } else {
    console.log(`  All images within size limits (Total: ${totalMB.toFixed(2)} MB).\n`);
  }
}

// 6. Sentence length check (> 25 words)
console.log('6. Analyzing sentence lengths in public documentation...');
let longSentences = [];
for (const file of publicDocFiles) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');

  // Strip code blocks and mermaid
  const cleanContent = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  const paragraphs = cleanContent.split(/\n\s*\n/);

  for (const para of paragraphs) {
    const rawSentences = para.replace(/\n/g, ' ').split(/(?<=[.!?])\s+/);
    for (const raw of rawSentences) {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('|') || trimmed.startsWith('-') || trimmed.startsWith('*')) continue;
      const words = trimmed.split(/\s+/).filter(w => w.length > 0);
      if (words.length > 25) {
        longSentences.push({
          file: path.relative(repoRoot, file),
          length: words.length,
          text: trimmed
        });
      }
    }
  }
}

console.log(`  Found ${longSentences.length} sentences over 25 words in public docs.`);
if (longSentences.length > 0) {
  longSentences.slice(0, 10).forEach(s => {
    console.log(`  - [${s.file} (${s.length} words)]: "${s.text.slice(0, 80)}..."`);
  });
}
console.log('');

// Summary
console.log('==============================================');
console.log(`VERIFICATION SUMMARY: ${totalErrors === 0 ? 'PASSED' : 'FAILED'}`);
console.log(`Total Errors: ${totalErrors}`);
console.log(`Total Warnings: ${totalWarnings}`);
console.log('==============================================');

if (totalErrors > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
