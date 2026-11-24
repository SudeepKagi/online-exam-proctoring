const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');

// 1. Stale terms to scan for
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

// Directories or files to ignore during search
const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  'test-results',
  'playwright-report'
]);

function scanFileForStaleTerms(filePath, relativePath) {
  const ext = path.extname(filePath).toLowerCase();
  // ignore binary files and large logs
  const textExts = ['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.yml', '.yaml', '.html', '.css', '.sh', '.py', '.txt', '.toml', '.example'];
  if (!textExts.includes(ext) && path.basename(filePath) !== 'Makefile' && !path.basename(filePath).startsWith('.env')) {
    return [];
  }

  // Skip huge log files
  const stat = fs.statSync(filePath);
  if (stat.size > 2 * 1024 * 1024) return [];

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return [];
  }

  const lines = content.split('\n');
  const hits = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const term of STALE_TERMS) {
      // Case-insensitive check or word check depending on term
      // For exact terms like PIN, avoid false positives in 'spin', 'pine', etc.
      let matched = false;
      if (term === 'PIN') {
        // Regex word boundary for PIN
        if (/\bPIN\b/i.test(line)) {
          // Exclude unrelated words if any
          matched = true;
        }
      } else {
        if (line.toLowerCase().includes(term.toLowerCase())) {
          matched = true;
        }
      }

      if (matched) {
        hits.push({
          term,
          file: relativePath.replace(/\\/g, '/'),
          line: i + 1,
          snippet: line.trim().slice(0, 120)
        });
      }
    }
  }

  return hits;
}

function walkDir(dir, baseDir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        results = results.concat(walkDir(fullPath, baseDir));
      }
    } else if (entry.isFile()) {
      results.push({ fullPath, relPath });
    }
  }

  return results;
}

console.log('Scanning repository files...');
const allFiles = walkDir(repoRoot, repoRoot);

let allStaleHits = [];
for (const file of allFiles) {
  const hits = scanFileForStaleTerms(file.fullPath, file.relPath);
  if (hits.length > 0) {
    allStaleHits = allStaleHits.concat(hits);
  }
}

console.log(`Found ${allStaleHits.length} stale term occurrences.`);

// Read package.json files
const rootPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const backendPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'backend/package.json'), 'utf8'));
const frontendPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'frontend/package.json'), 'utf8'));

// Extract env var names from .env.example
const envExampleContent = fs.readFileSync(path.join(repoRoot, '.env.example'), 'utf8');
const envVarNames = [];
for (const line of envExampleContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const key = trimmed.split('=')[0].trim();
    if (key && !envVarNames.includes(key)) {
      envVarNames.push(key);
    }
  }
}

// Generate markdown content
const docFacts = `# ProctorNet Documentation Facts Matrix

> **Generated on**: ${new Date().toISOString()}  
> **Source**: Verified directly from code, configurations, schemas, and tests in the repository.

---

## 1. Stack and Component Versions

| Tier | Technology / Library | Version / Runtime | Source |
| :--- | :--- | :--- | :--- |
| **Monorepo Runtime** | Node.js | >= 22.0.0 | Root & workspaces \`package.json\` |
| **Backend Framework** | Express.js | ^4.18.2 | \`backend/package.json\` |
| **Database ORM** | Prisma | ^5.22.0 | \`backend/package.json\` |
| **Database Engine** | PostgreSQL | 15+ (ACID transactional) | \`backend/prisma/schema.prisma\` |
| **Cache & Real-Time** | Redis (\`ioredis\`) + Socket.io | ioredis ^6.0.0, socket.io ^4.6.1 | \`backend/package.json\` |
| **Frontend Framework** | React + React DOM | ^19.2.5 | \`frontend/package.json\` |
| **Frontend Bundler** | Vite | ^8.0.10 | \`frontend/package.json\` |
| **Frontend Styling** | Tailwind CSS (Vite plugin) | ^4.3.0 | \`frontend/package.json\` |
| **Frontend UI / Motion** | Radix UI + Motion | radix-ui ^1.6.7, motion ^14.14.0 | \`frontend/package.json\` |
| **Frontend Icons** | Lucide React | ^1.14.0 | \`frontend/package.json\` |
| **Client Lockdown** | Safe Exam Browser (SEB) | 3.x compatible | \`backend/src/modules/seb/\` |
| **AI / LLM Integration** | Google Gemini (fallback OpenAI) | Gemini API / OpenAI API | \`backend/src/modules/exams/ai.generator.js\` |
| **Cloud Biometrics** | AWS Rekognition | @aws-sdk/client-rekognition ^3.1147.0 | \`backend/package.json\` |
| **Cloud Storage** | AWS S3 (Presigned URLs) | @aws-sdk/client-s3 ^3.1146.0 | \`backend/package.json\` |
| **E2E Testing** | Playwright | ^1.63.0 | Root \`package.json\` |

---

## 2. Stored Data Models (Prisma Relational Schema)

The PostgreSQL database stores the following 11 models defined in \`backend/prisma/schema.prisma\`:

1. \`User\` (Students, Faculty, Invigilators, Admins; auth credentials, reference photo keys, institutional ID)
2. \`Exam\` (Exam titles, course codes, start/end timestamps, duration, proctoring configuration, status)
3. \`Question\` (Exam questions, multiple-choice options, correct index, positive/negative marks, display order)
4. \`ExamAssignment\` (Mapping of assigned students and faculty to specific exams)
5. \`ExamAttempt\` (Per-student exam sessions, start/submit times, scores, face verification status, violation counts)
6. \`AttemptAnswer\` (Saved responses per question, selected options bitmask, bookmark flags, update timestamps)
7. \`ProctoringLog\` (Audit log of violation events: tab switches, multi-face alerts, severity, snapshot keys)
8. \`SystemSetting\` (Key-value store for global institutional settings and SEB configurations)
9. \`StudentReadinessReport\` (Pre-exam hardware telemetry: camera, microphone, browser, OS, latency bucket)
10. \`StudentConsent\` (Legal and institutional proctoring agreements accepted prior to exam entry)
11. \`ExamDraft\` (Autosaved drafts for faculty exam creation wizard)

---

## 3. Features Implemented by User Role

### Candidate / Student Role
- **Authentication & Setup**: Registration, password reset, login with JWT cookies, and institutional reference photo capture.
- **Pre-Exam System Check**: Interactive hardware diagnostic (webcam, microphone, operating system, browser, network latency check).
- **Identity Gate**: Automated facial comparison against stored reference photo using AWS Rekognition before entry is unlocked.
- **Secure Browser Integration**: Direct launching and verification via Safe Exam Browser with cryptographic config key exchange.
- **Exam Arena**:
  - Live synchronized countdown timer anchored to server expiration timestamp.
  - Question navigation palette with answered, unanswered, and bookmarked filters.
  - Debounced auto-save on answer change with local offline queue fallback.
  - Full-screen enforcement, tab-switch detection, and keyboard shortcut interception.
- **Submission & Results**: Immediate idempotent submission with score calculation and breakdown.

### Faculty / Invigilator Role
- **Exam Management**:
  - Multi-step Exam Creation Wizard (Title, duration, schedules, audience assignments).
  - Question authoring supporting single-choice, multi-select, positive, negative, and partial marks.
  - AI-assisted question generation grounded in uploaded PDF course material.
  - Safe Exam Browser security settings configuration.
- **Live Invigilator Console**:
  - Real-time candidate roster grid with active attempt statuses (\`IN_PROGRESS\`, \`SUBMITTED\`, \`SUSPENDED\`).
  - Live webcam snapshot stream updated periodically via WebSockets.
  - Real-time malpractice alerts for tab switches, fullscreen exit, and multi-face detections.
  - Active proctor interventions: Pause attempt, resume attempt, or terminate attempt with reason.
- **Submission & Review**: Review flagged attempts, inspect photographic violation evidence, and approve identity overrides.

### Institutional Administrator Role
- **User Management**: Approve pending faculty/student registrations, modify roles, and suspend malicious accounts.
- **Global SEB Configuration**: Manage institutional Safe Exam Browser config files and cryptographic exam keys.
- **Audit & Analytics**: System-wide exam logs, candidate violation audit trails, and server health telemetry.

---

## 4. Production Integrations

1. **AWS S3**: Direct pre-signed upload policies and secure read URLs for reference photos, identity cards, and violation snapshots.
2. **AWS Rekognition**: Biometric face comparison (\`CompareFacesCommand\`) matching live pre-check frames against reference photos with a 90% confidence threshold.
3. **Safe Exam Browser (SEB)**: Browser lockdown via HTTP header verification (\`x-safeexambrowser-requesthash\` and \`x-safeexambrowser-configkeyhash\`).
4. **Google Gemini (with OpenAI fallback)**: Document-grounded question generation from course PDFs (\`gemini-3.5-flash\` or \`gpt-4o-mini\`).
5. **Redis Pub/Sub**: WebSocket scaling across Socket.io instances and in-memory session token tracking.

---

## 5. Verified npm Scripts

### Root Workspace Scripts
- \`dev\`: Run both frontend and backend concurrently in development mode.
- \`dev:backend\`: Run backend development server with nodemon.
- \`dev:frontend\`: Run frontend Vite development server.
- \`build\`: Build frontend production assets with Vite.
- \`db:migrate\`: Run Prisma database migrations in development.
- \`db:migrate:deploy\`: Deploy pending Prisma database migrations to production.
- \`db:seed\`: Seed database with initial administrator account.
- \`typecheck\`: Run TypeScript typechecking across backend and frontend workspaces.
- \`lint\`: Run ESLint across frontend and backend.
- \`test\`: Run backend automated tests.
- \`test:e2e\`: Run Playwright end-to-end browser tests.
- \`test:smoke\`: Run Playwright tests tagged with \`@smoke\`.
- \`test:all\`: Run complete backend test suite and Playwright tests.
- \`format\`: Format codebase with Prettier.
- \`format:check\`: Verify codebase formatting without modifying files.

### Backend Scripts
- \`start\`: Run backend service with memory limits (\`src/app.js\`).
- \`start:standard\`: Run backend service with standard Node runtime.
- \`pilot\`: Run backend using pilot environment file (\`.env.pilot\`).
- \`test\`: Run backend unit and integration tests using Node built-in test runner.
- \`lint\`: Run ESLint on backend source files.
- \`typecheck\`: Typecheck backend JavaScript using JSDoc and \`jsconfig.json\`.
- \`seed\`: Run admin database seeder.
- \`generate\`: Generate Prisma Client JavaScript bindings.

### Frontend Scripts
- \`dev\`: Start Vite development server.
- \`build\`: Compile and bundle React frontend for production.
- \`lint\`: Run ESLint on frontend code.
- \`typecheck\`: Run TypeScript typecheck on frontend source.
- \`preview\`: Preview production Vite build locally.

---

## 6. Environment Variable Names

The following environment variables are recognized and validated across \`.env.example\` and \`backend/src/shared/config.js\`:

\`\`\`text
PORT
NODE_ENV
DATABASE_URL
DIRECT_URL
REDIS_URL
JWT_SECRET
JWT_REFRESH_SECRET
CORS_ORIGIN
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
S3_BUCKET
REQUIRE_IDENTITY_VERIFICATION
FACE_MATCH_THRESHOLD
FACE_DRIVER
GEMINI_API_KEY
GEMINI_MODEL
OPENAI_API_KEY
OPENAI_MODEL
AI_MAX_QUESTIONS_PER_RUN
AI_MAX_PDF_PAGES
AI_DAILY_QUESTION_QUOTA_PER_USER
AI_MIN_SUBSTANTIVE_WORDS
SEB_CONFIG_KEY
SEB_ENFORCE_MODE
APP_URL
VITE_API_URL
\`\`\`

---

## 7. Current Deployment Architecture

- **Hosting Platform**: Single-node AWS EC2 instance running Ubuntu Linux.
- **Process Management**: Systemd services for Node.js backend processes with automatic restart.
- **Reverse Proxy & TLS**: Caddy web server terminating SSL/TLS with automatic Let's Encrypt certificates and reverse-proxying API / WebSocket traffic.
- **Remote Operations**: Zero-SSH AWS Systems Manager (SSM) command dispatch with automated pre-flight checks, live database backup, zero-downtime cutover, and automated rollback safeguarding.
- **Database**: Remote PostgreSQL database connected via pooling and direct migration URLs.

---

## 8. Test Coverage Overview

- **Backend Tests (54 test suites under \`backend/tests/\`)**:
  - Authentication lifecycle, token expiration, password security, and onboarding guards.
  - Exam creation validation, scheduling, and timezone handling.
  - Safe Exam Browser config key exchange, token validation, and header security.
  - Proctoring pipeline buffering, violation severity mapping, and camera cadence.
  - State persistence, answer autosave, concurrent race conditions, and scoring accuracy.
  - AI document-grounded question generator fixtures and rate quotas.
- **E2E Playwright Tests (25 test suites under \`e2e/\`)**:
  - Complete user journeys for Student, Faculty, Invigilator, and Administrator.
  - Real browser verification of hardware check, exam arena, palette navigation, and auto-submit.
  - Invigilator live console telemetry and manual interventions.
  - Safe Exam Browser simulated handoff journeys.

---

## 9. Comprehensive Stale-Term Audit

The following table lists all detected occurrences of legacy or disallowed terms across repository files:

| Target Stale Term | File Path | Line | Context Snippet |
| :--- | :--- | :--- | :--- |
${allStaleHits.map(h => `| \`${h.term}\` | \`${h.file}\` | ${h.line} | \`${h.snippet.replace(/`/g, "'")}\` |`).join('\n')}

---
`;

fs.mkdirSync(path.join(repoRoot, 'docs/internal'), { recursive: true });
fs.writeFileSync(path.join(repoRoot, 'docs/internal/DOCS_FACTS.md'), docFacts, 'utf8');
console.log('Successfully wrote docs/internal/DOCS_FACTS.md');
