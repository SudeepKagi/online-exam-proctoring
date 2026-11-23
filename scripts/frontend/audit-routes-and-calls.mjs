import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '../../')
const FRONTEND_DIR = path.resolve(ROOT_DIR, 'frontend/src')
const AUDIT_OUTPUT = path.resolve(ROOT_DIR, 'docs/frontend/AUDIT.md')

function getAllFiles(dir, exts = ['.jsx', '.js', '.tsx', '.ts']) {
  let files = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        files = files.concat(getAllFiles(fullPath, exts))
      }
    } else if (entry.isFile() && exts.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath)
    }
  }
  return files
}

function parseRoutesFromApp() {
  const appFile = path.resolve(FRONTEND_DIR, 'App.jsx')
  const content = fs.readFileSync(appFile, 'utf8')
  const routeRegex = /<Route\s+path=["']([^"']+)["']\s+element=\{([^}]+)\}/g
  const routes = []
  let match

  while ((match = routeRegex.exec(content)) !== null) {
    const routePath = match[1]
    const elementRaw = match[2]

    let role = 'PUBLIC'
    if (elementRaw.includes("allowedRoles={['ADMIN']}")) role = 'ADMIN'
    else if (elementRaw.includes("allowedRoles={['FACULTY', 'ADMIN']}")) role = 'FACULTY'
    else if (elementRaw.includes("allowedRoles={['INVIGILATOR', 'FACULTY', 'ADMIN']}")) role = 'INVIGILATOR'
    else if (elementRaw.includes("allowedRoles={['STUDENT']}")) role = 'STUDENT'
    else if (elementRaw.includes("allowedRoles={['STUDENT', 'FACULTY', 'ADMIN']}")) role = 'STUDENT/FACULTY/ADMIN'
    else if (elementRaw.includes('OnboardingGuard')) role = 'AUTH_ONBOARDING'
    else if (routePath.startsWith('/admin')) role = 'ADMIN'
    else if (routePath.startsWith('/faculty')) role = 'FACULTY'
    else if (routePath.startsWith('/student')) role = 'STUDENT'
    else if (routePath.startsWith('/invigilator')) role = 'INVIGILATOR'

    // Extract component name
    const compMatch = elementRaw.match(/<([A-Z][A-Za-z0-9]+)/)
    const componentName = compMatch ? compMatch[1] : 'Unknown'

    routes.push({
      path: routePath,
      role,
      component: componentName,
      raw: elementRaw.trim()
    })
  }

  return routes
}

function auditFile(filePath) {
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/')
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')

  const callSites = []

  // Detect async call triggers
  const asyncPatterns = [
    { type: 'API_CLIENT', regex: /\b(?:api|apiClient)\.(get|post|put|delete|patch)\s*\(/g },
    { type: 'FETCH', regex: /\bfetch\s*\(/g },
    { type: 'SOCKET_ON', regex: /\bsocket\.on\s*\(/g },
    { type: 'SOCKET_EMIT', regex: /\bsocket\.emit\s*\(/g },
    { type: 'TIMER_INTERVAL', regex: /\bsetInterval\s*\(/g },
    { type: 'TIMER_TIMEOUT', regex: /\bsetTimeout\s*\(/g },
    { type: 'MEDIA_DEVICE', regex: /\bnavigator\.mediaDevices\.getUserMedia\s*\(/g }
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const { type, regex } of asyncPatterns) {
      regex.lastIndex = 0
      let m
      while ((m = regex.exec(line)) !== null) {
        callSites.push({
          line: i + 1,
          type,
          snippet: line.trim()
        })
      }
    }
  }

  if (callSites.length === 0) return null

  // File-level resilience checks
  const hasLoadingState =
    /loading|isLoading|isPending|Skeleton|RouteSkeleton|spinner/i.test(content)
  const hasErrorUiWithRetry =
    /(?:error|isError|err)\s*(?:&&|\?)|(?:retry|handleRetry|Reload|Try Again)/i.test(content)
  const hasErrorMapping =
    /mapClientError|translateError|errorMap|ERROR_MESSAGES|getErrorMessage/i.test(content)
  const hasUnmountSafetyOrAbort =
    /AbortController|isMounted|cancelled|return\s*\(\)\s*=>\s*\{[^}]*(?:clearTimeout|clearInterval|cleanup|abort|disconnect)/i.test(
      content
    )
  const hasDoubleSubmitGuard =
    /disabled=\{[^}]*(?:loading|isSubmitting|submitting|saving|disabled)[^}]*\}/i.test(content)
  const hasSessionExpiryHandling =
    /401|TOKEN_EXPIRED|unauthorized|logout|navigate\(['"]\/login/i.test(content)

  // Compute compliance score (0-6)
  const score =
    (hasLoadingState ? 1 : 0) +
    (hasErrorUiWithRetry ? 1 : 0) +
    (hasErrorMapping ? 1 : 0) +
    (hasUnmountSafetyOrAbort ? 1 : 0) +
    (hasDoubleSubmitGuard ? 1 : 0) +
    (hasSessionExpiryHandling ? 1 : 0)

  return {
    file: relPath,
    callSites,
    hasLoadingState,
    hasErrorUiWithRetry,
    hasErrorMapping,
    hasUnmountSafetyOrAbort,
    hasDoubleSubmitGuard,
    hasSessionExpiryHandling,
    score
  }
}

function runAudit() {
  console.log('Scanning routes in frontend/src/App.jsx...')
  const routes = parseRoutesFromApp()

  console.log('Scanning async call sites in frontend/src...')
  const files = getAllFiles(FRONTEND_DIR)
  const auditedFiles = []

  for (const f of files) {
    const result = auditFile(f)
    if (result) auditedFiles.push(result)
  }

  // Sort by score ascending (worst first)
  auditedFiles.sort((a, b) => a.score - b.score)

  let totalCallSites = 0
  let passedLoading = 0
  let passedErrorUi = 0
  let passedErrorMapping = 0
  let passedAbort = 0
  let passedDoubleSubmit = 0
  let passedSessionExpiry = 0

  for (const af of auditedFiles) {
    totalCallSites += af.callSites.length
    if (af.hasLoadingState) passedLoading++
    if (af.hasErrorUiWithRetry) passedErrorUi++
    if (af.hasErrorMapping) passedErrorMapping++
    if (af.hasUnmountSafetyOrAbort) passedAbort++
    if (af.hasDoubleSubmitGuard) passedDoubleSubmit++
    if (af.hasSessionExpiryHandling) passedSessionExpiry++
  }

  // Generate markdown report
  const report = `# Frontend Route & Async Resilience Audit (§Phase 4)

**Generated:** ${new Date().toISOString()}  
**Target:** \`frontend/src/\`  
**Standard:** \`.agents/skills/client-error-resilience/SKILL.md\` & Rule 02

---

## 1. Executive Summary & Health Metrics

| Metric | Total Count | Compliant | Deficient | Coverage |
| :--- | :--- | :--- | :--- | :--- |
| **Total Routes Declared** | **${routes.length}** | — | — | 100% Mapped |
| **Components with Async Calls** | **${auditedFiles.length}** | — | — | — |
| **Total Async Call Sites** | **${totalCallSites}** | — | — | — |
| **Loading State (Skeleton/Spinner)** | ${auditedFiles.length} | ${passedLoading} | ${auditedFiles.length - passedLoading} | ${Math.round((passedLoading / auditedFiles.length) * 100)}% |
| **Error UI with Retry Action** | ${auditedFiles.length} | ${passedErrorUi} | ${auditedFiles.length - passedErrorUi} | ${Math.round((passedErrorUi / auditedFiles.length) * 100)}% |
| **Error Code Mapping (No Raw Stacks)** | ${auditedFiles.length} | ${passedErrorMapping} | ${auditedFiles.length - passedErrorMapping} | ${Math.round((passedErrorMapping / auditedFiles.length) * 100)}% |
| **Unmount Safety & AbortController** | ${auditedFiles.length} | ${passedAbort} | ${auditedFiles.length - passedAbort} | ${Math.round((passedAbort / auditedFiles.length) * 100)}% |
| **Double-Submit Button Locking** | ${auditedFiles.length} | ${passedDoubleSubmit} | ${auditedFiles.length - passedDoubleSubmit} | ${Math.round((passedDoubleSubmit / auditedFiles.length) * 100)}% |
| **Session Expiry (401 Interception)** | ${auditedFiles.length} | ${passedSessionExpiry} | ${auditedFiles.length - passedSessionExpiry} | ${Math.round((passedSessionExpiry / auditedFiles.length) * 100)}% |

---

## 2. Route Manifest by Institutional Role

| Path | Primary Role | Target Component | Guard & Policy |
| :--- | :--- | :--- | :--- |
${routes.map((r) => `| \`${r.path}\` | \`${r.role}\` | \`${r.component}\` | \`${r.raw.replace(/\|/g, '\\|')}\` |`).join('\n')}

---

## 3. Worst-First Component Backlog (Sorted by Defect Severity)

A score of **0/6** represents maximum vulnerability (no loading state, no retry, no error mapping, unmount leak risk, no submit lock). A score of **6/6** indicates full enterprise fault resilience.

| Priority | Component File | Score | Async Calls | Loading | Error+Retry | Error Map | Abort/Unmount | Submit Lock | 401 Handle |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${auditedFiles
  .map(
    (af, idx) =>
      `| **P${idx + 1}** | \`${af.file}\` | **${af.score}/6** | ${af.callSites.length} | ${af.hasLoadingState ? '✅' : '❌'} | ${af.hasErrorUiWithRetry ? '✅' : '❌'} | ${af.hasErrorMapping ? '✅' : '❌'} | ${af.hasUnmountSafetyOrAbort ? '✅' : '❌'} | ${af.hasDoubleSubmitGuard ? '✅' : '❌'} | ${af.hasSessionExpiryHandling ? '✅' : '❌'} |`
  )
  .join('\n')}

---

## 4. Remediation Plan by Route Group

### Route Group 1: Student Exam Lifecycle (Priority 1)
- **Files:** \`StudentExamStartPage.jsx\`, \`ExamArenaPage.jsx\`, \`PreExamCheckPage.jsx\`, \`StudentDashboardPage.jsx\`, \`StudentResultsPage.jsx\`, \`SebHandoffPage.jsx\`.
- **Target Invariants:**
  1. Standardize \`AsyncStateView\` for \`loading\`, \`empty\`, \`error\`, \`offline\`, \`forbidden\`, \`session_expired\`.
  2. Map all student backend errors via shared \`mapClientError()\` helper with plain language and retry action.
  3. Enforce immediate button submit locking (\`disabled={isSubmitting}\`) on start exam, answer pick, and submit.
  4. Ensure all \`useEffect\` fetch and timer calls utilize \`AbortController\` signals and timer clearings.

### Route Group 2: Faculty & Exam Authoring (Priority 2)
- **Files:** \`FacultyExamsPage.jsx\`, \`ExamManagePage.jsx\`, \`ExamWizardModal.jsx\`, \`ExamQuestionEditor.jsx\`, \`ExamSubmissionsTab.jsx\`.
- **Target Invariants:**
  1. Field-level Zod validation errors on exam creation and question publishing.
  2. Double-submit guard on "Create Exam" and "Generate AI Questions".
  3. Clean recovery and retry states for question fetching and submission reviews.

### Route Group 3: Admin & Security Controls (Priority 3)
- **Files:** \`AdminDashboardPage.jsx\`, \`AdminUsersPage.jsx\`, \`AdminExamsPage.jsx\`, \`AdminSebConfigPage.jsx\`.
- **Target Invariants:**
  1. User role update confirmation and error handling.
  2. SEB config upload error mapping and diagnostics retry.

### Route Group 4: Auth & Session Gates (Priority 4)
- **Files:** \`LoginPage.jsx\`, \`ForgotPasswordPage.jsx\`, \`OnboardingPage.jsx\`, \`PendingApprovalPage.jsx\`.
- **Target Invariants:**
  1. Rate-limit 429 backoff handling.
  2. Password input validation with accessible error labels.
`

  fs.mkdirSync(path.dirname(AUDIT_OUTPUT), { recursive: true })
  fs.writeFileSync(AUDIT_OUTPUT, report, 'utf8')
  console.log(`Audit report generated at: ${AUDIT_OUTPUT}`)
}

runAudit()
