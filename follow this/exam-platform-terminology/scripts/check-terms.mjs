#!/usr/bin/env node
// Scans UI strings for banned terminology. No dependencies.
// Usage: node check-terms.mjs [dir=src] [--deny path/to/deny-list.txt]
// Exit code 1 when anything is found (use in CI).
// Silence a genuine exception by adding "// terms-ok: reason" on the same line.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const denyIdx = args.indexOf('--deny');
const denyPath =
  denyIdx >= 0 ? args.splice(denyIdx, 2)[1] : resolve(here, '../references/deny-list.txt');
const root = args[0] || 'src';

const phrases = [];
const exacts = new Set();
for (const raw of readFileSync(denyPath, 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const m = line.match(/^(phrase|exact):\s*(.+)$/);
  if (!m) continue;
  if (m[1] === 'exact') exacts.add(m[2]);
  else
    phrases.push({
      term: m[2],
      re: new RegExp(`(^|[^A-Za-z0-9])${m[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z0-9])`, 'i'),
    });
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.next']);
const CODE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue', '.html']);
const JSON_HINT = /(locales?|i18n|lang|messages|strings)/i;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (CODE_EXT.has(extname(p)) || (extname(p) === '.json' && JSON_HINT.test(p))) out.push(p);
  }
  return out;
}

// Attribute values and helper calls that never hold user-facing text.
const NON_UI_CONTEXT =
  /(\b(className|class|id|type|name|key|href|src|htmlFor|role|variant|size|color|data-[\w-]+)\s*=\s*\{?\s*|\b(cn|clsx|classNames|twMerge)\(\s*([^)]*,\s*)?)$/;

// Identifier-like strings (classNames, routes, event names) are not user-facing.
const looksLikeIdentifier = (s) => /^[a-z][\w:./#@-]*$/.test(s) && !/\s/.test(s);

function check(file, lineNo, text, hits) {
  const t = text.trim();
  if (t.length < 2 || looksLikeIdentifier(t)) return;
  if (exacts.has(t)) hits.push({ file, lineNo, text: t, why: `vague label "${t}"` });
  for (const p of phrases) if (p.re.test(t)) hits.push({ file, lineNo, text: t, why: `banned term "${p.term}"` });
}

function scanJson(file, hits) {
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return;
  }
  const visit = (v, path) => {
    if (typeof v === 'string') check(file, path, v, hits);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) visit(x, `${path}.${k}`.replace(/^\./, ''));
  };
  visit(data, '');
}

function scanCode(file, hits) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (/^(import\b|export\b.*\bfrom\b|\/\/|\/\*|\*)/.test(trimmed) || /require\(/.test(line)) return;
    if (/\/\/\s*terms-ok/.test(line)) return;
    for (const m of line.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) {
      const before = line.slice(0, m.index);
      if (NON_UI_CONTEXT.test(before)) continue;
      check(file, i + 1, m[2], hits);
    }
    for (const m of line.matchAll(/>([^<>{}]+)</g)) check(file, i + 1, m[1], hits);
  });
}

const hits = [];
for (const f of walk(root)) (extname(f) === '.json' ? scanJson : scanCode)(f, hits);

if (!hits.length) {
  console.log(`check-terms: OK (${root})`);
  process.exit(0);
}
for (const h of hits) console.log(`${h.file}:${h.lineNo}  ${h.why}  ->  "${h.text}"`);
console.log(`\ncheck-terms: ${hits.length} problem(s). See references/glossary.md (section 11) for approved wording.`);
process.exit(1);
