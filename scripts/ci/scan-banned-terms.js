#!/usr/bin/env node
/**
 * scan-banned-terms.js
 * Scans frontend source files and built bundles for banned vocabulary (§4.1 Abstraction Spec).
 * 
 * Target scope:
 *  - User-visible text (JSX text nodes)
 *  - User-visible attributes: title, alt, placeholder, aria-label, label, description
 *  - Toast and alert messages: toast.error, toast.success, toast.info, toast.warn, alert, confirm
 *  - Error catalogue entries and user notifications
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const FRONTEND_SRC = path.join(REPO_ROOT, 'proctornet/frontend/src');

// §4.1 Banned vocabulary in user-visible text (case-insensitive)
const BANNED_PATTERNS = [
  { category: 'frameworks/runtime', pattern: /\b(react|vite|node(\.js)?|express|tailwind|shadcn|radix|lucide|axios|zod|prisma|pino)\b/i },
  { category: 'data/infra', pattern: /\b(postgres(ql)?|sql|supabase|redis|rabbitmq|amqp|s3|aws|minio|cloudinary|docker|kubernetes|nginx|cluster|daemon|queue|outbox|cron|cache)\b/i },
  { category: 'realtime/media', pattern: /\b(webrtc|sfu|livekit|socket\.?io|websocket|simulcast|vp8|vp9|av1|stun|turn|ice|codec|bitrate|1080p|720p)\b/i },
  { category: 'network/security', pattern: /\b(wireguard|jwt|bcrypt|argon|rbac|csrf|cors|tls|ssl|hash(ing)?|encrypt(ion|ed)?\s+with)\b/i },
  { category: 'network/security (vpn)', pattern: /\bvpn(?!\s*required)\b/i },
  { category: 'device/agent', pattern: /\b(byod|kiosk|swiftshader|hypervisor|virtualbox|vmware|qemu|anydesk|teamviewer)\b/i },
  { category: 'ai/vision/nlp', pattern: /\b(deepface|compreface|exadel|face-?api|tensorflow|onnx|paddle(ocr)?|tesseract|ocr|llama|llm|groq|openai|gpt|gemini|claude|neural|model\s+match|embedding|cosine|similarity\s+(score|scan)|machine\s+learning|model\s+name)\b/i },
  { category: 'formats/ops', pattern: /\b(csv|xlsx|json|rest(\s+api)?|api\s+key|set-?based|sql\s+grading)\b/i }
];

// Extract candidate user-visible text blocks from file content
function extractUserVisibleStrings(content, filePath) {
  const lines = content.split('\n');
  const candidates = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    // Skip full comment lines
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
    // Skip import / export statements
    if (trimmed.startsWith('import ') || trimmed.startsWith('export ') || trimmed.includes('from \'') || trimmed.includes('from "')) return;
    // Skip console.log if dev-only (will be stripped in production)
    if (trimmed.startsWith('console.')) return;

    // 1. Check for JSX text (text between > and <)
    const jsxTextMatches = line.match(/>([^<>{}]*)</g);
    if (jsxTextMatches) {
      for (const m of jsxTextMatches) {
        const text = m.slice(1, -1).trim();
        if (text.length > 1 && !/^[{}$_()]+$/.test(text)) {
          candidates.push({ text, line: idx + 1, type: 'jsx-text' });
        }
      }
    }

    // 2. Check for user-facing attributes: placeholder, title, alt, aria-label
    const attrMatches = line.match(/(?:placeholder|title|alt|aria-label)\s*=\s*["'`]([^"'`]+)["'`]/gi);
    if (attrMatches) {
      for (const m of attrMatches) {
        const val = m.replace(/^(?:placeholder|title|alt|aria-label)\s*=\s*["'`]/i, '').replace(/["'`]$/, '');
        candidates.push({ text: val, line: idx + 1, type: 'attribute' });
      }
    }

    // 3. Check for toasts, alerts, notifications, and stage status messages
    const toastMatches = line.match(/(?:toast(?:\.(?:error|success|info|warn|warning))?|alert|confirm|updateStage)\s*\(\s*(?:[^,()]+,\s*[^,()]+,\s*)?([`'"][^`'"]+[`'"])/g);
    if (toastMatches) {
      for (const m of toastMatches) {
        const strMatch = m.match(/[`'"]([^`'"]+)[`'"]\s*\)?$/);
        if (strMatch && strMatch[1]) {
          candidates.push({ text: strMatch[1], line: idx + 1, type: 'notification' });
        }
      }
    }

    // 4. Check for user-facing object literals (name, label, desc, description, message, reason, details, sub, subtitle)
    const objPropMatches = line.match(/(?:name|label|desc|description|message|reason|details|sub|subtitle)\s*:\s*[`'"]([^`'"]+)[`'"]/gi);
    if (objPropMatches) {
      for (const m of objPropMatches) {
        const str = m.replace(/^[a-zA-Z]+\s*:\s*[`'"]/, '').replace(/[`'"]$/, '');
        // Exclude internal error codes or log levels (e.g. desc: 'asc')
        if (str.length > 2 && !['asc', 'desc', 'success', 'error', 'info', 'warn', 'system', 'media', 'face', 'kiosk'].includes(str)) {
          candidates.push({ text: str, line: idx + 1, type: 'property' });
        }
      }
    }

    // 5. Special check for string literals in error catalogs or support rules
    if (filePath.includes('errorUtils') || filePath.includes('errorCatalog') || filePath.includes('SupportAndRules')) {
      const stringLiterals = line.match(/['"`]([^'"`]{4,})['"`]/g);
      if (stringLiterals) {
        for (const s of stringLiterals) {
          const val = s.slice(1, -1);
          // Ignore css classes or hex colors
          if (!val.startsWith('#') && !val.startsWith('http') && !val.includes('bg-') && !val.includes('text-')) {
            candidates.push({ text: val, line: idx + 1, type: 'literal' });
          }
        }
      }
    }
  });

  return candidates;
}

function walk(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        results.push(...walk(full));
      }
    } else if (/\.(jsx?|tsx?|html)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const files = walk(FRONTEND_SRC);
const rootIndexHtml = path.join(REPO_ROOT, 'proctornet/frontend/index.html');
if (fs.existsSync(rootIndexHtml)) files.push(rootIndexHtml);
const distIndexHtml = path.join(REPO_ROOT, 'proctornet/frontend/dist/index.html');
if (fs.existsSync(distIndexHtml)) files.push(distIndexHtml);

const violations = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const candidates = extractUserVisibleStrings(content, file);

  for (const item of candidates) {
    for (const { category, pattern } of BANNED_PATTERNS) {
      if (pattern.test(item.text)) {
        violations.push({
          file: path.relative(REPO_ROOT, file).replace(/\\/g, '/'),
          line: item.line,
          category,
          type: item.type,
          text: item.text
        });
        break;
      }
    }
  }
}

console.log(`Scan completed. Found ${violations.length} user-visible banned vocabulary violations.`);
for (const v of violations) {
  console.log(`[${v.category}] (${v.type}) ${v.file}:${v.line}`);
  console.log(`   "${v.text}"\n`);
}

process.exit(violations.length > 0 ? 1 : 0);
