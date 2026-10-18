# STRICT ENGINEERING & UI/UX CONSTITUTION

## 1. HARD CONSTRAINTS (ZERO TOLERANCE)
1. **NO UNREQUESTED FILES:** Never create phase reports, QA ledgers, performance audits, or extra `.env` / `docker-compose` files.
2. **FILE SIZE LIMIT:** No `.ts` or `.tsx` file may exceed **250 lines**. Split larger files by domain responsibility.
3. **FUNCTION SIZE LIMIT:** No function may exceed **40 lines** or 3 levels of indentation.
4. **NO DEAD CODE OR BAND-AIDS:** Delete unused code immediately. Never comment out blocks "for later." Never use `setTimeout` to mask race conditions.
5. **NO NEW PACKAGES:** Do not run `npm install` without explicit user approval.

## 2. LOCKED SYSTEM SCOPE
1. **100% Browser-Based Proctoring (NO Desktop Companion Agent):**
   - There is NO downloadable desktop agent, NO SEA binary, and NO short-code device pairing.
   - **Pre-Exam Check:** One-time Face Verification using **AWS Rekognition** (`CompareFaces` against student's `reference_photo_s3_key`) + Entire Screen Share permission check + Fullscreen entry.
   - **During Live Exam:** Webcam is TURNED OFF after Pre-Exam Check. Only **Screen Sharing** (periodic/violation S3 snapshots) and **Browser Lockdown Events** (`visibilitychange`, `fullscreenchange`, `window.blur`, `screenTrack.onended`) are active.
2. **Future WireGuard VPN Hook:**
   - Do not build VPN clients. Keep a single clean middleware hook (`require_vpn` boolean on exams, default `false`) that validates client subnet IP when enabled.
3. **MCQ-Only Engine:**
   - 4-option Multiple Choice Questions only. Deterministic server-side SQL grading.
4. **4 Institutional Roles Only:**
   - `ADMIN`, `FACULTY`, `INVIGILATOR`, `STUDENT`.

## 3. NAMING & FOLDER STANDARDS
1. **React Components:** `PascalCase.tsx` (e.g., `DashboardShell.tsx`, `PreExamCheckPage.tsx`).
2. **Frontend Hooks/Utils:** `camelCase.ts` (e.g., `useScreenShare.ts`, `useExamLockdown.ts`, `apiClient.ts`).
3. **Backend Modules (`src/modules/<domain>/`):** Strictly 4 files per domain:
   - `<domain>.routes.ts`
   - `<domain>.controller.ts`
   - `<domain>.service.ts`
   - `<domain>.sql.ts`

## 4. STRICT UI/UX & TERMINOLOGY RULES
1. **Layouts:** Only `<DashboardShell>` (Admin/Faculty/Invigilator) and `<ExamArenaShell>` (Student Pre-Check & Active Exam).
2. **Shared UI Primitives Only:** Use `@/components/ui/{Button, Input, Select, Modal, DataTable, Badge, Card}`. No raw HTML `<button>`, `<input>`, or `<table>` with ad-hoc Tailwind classes in feature views.
3. **Color Tokens:**
   - Canvas: `bg-slate-50` | Surface: `bg-white` | Sidebar: `bg-slate-900` | Border: `border-slate-200`
   - Primary: `bg-blue-600 hover:bg-blue-700 text-white`
   - Semantic: `emerald-600` (Answered/Active/Verified), `amber-500` (Bookmarked/Warning), `rose-600` (Violation/Suspended/Danger)
   - Numbers/Timers/IDs: `font-mono tabular-nums`
4. **Industry Terminology (Mandatory):**
   - Use "Exam Attempt" (never "Student Exam" or "Mutation")
   - Use "System & Identity Check" (never "Onboarding Canary" or "Companion Pairing")
   - Use "Live Proctoring Console" (never "Live Grid" or "Matrix")
   - Use "Bookmark Question" (never "Flagged State")
   - Use "Suspend Attempt" (never "Kill Session" or "Force Terminate")

## 5. UI/UX SKILLS & DESIGN SYSTEM MANDATE
Before modifying or creating ANY UI file in `frontend/src/`:
1. **Mandatory Token Reading:** You MUST read and follow `.agents/design-system/MASTER.md` as the single source of truth for typography, color tokens, role badges, status indicators, and spatial rhythm.
2. **Mandatory Skills Application:** You MUST adhere to all 8 Snyk UI/UX engineering skills located in `.agents/skills/`:
   - `frontend-design` (Distinctive Google Fonts: Plus Jakarta Sans, DM Sans, JetBrains Mono; layered slate)
   - `web-design-guidelines` (Accessible labels, contextual icons, focus rings, autocomplete, button loading states)
   - `react-best-practices` (Zero CLS, Promise.all parallel fetching, useMemo / useCallback)
   - `composition-patterns` (Compound UI primitives, strict <= 250 lines per file)
   - `ui-ux-pro-max` (MASTER.md token enforcement)
   - `bencium-ux-designer` (Live password strength meters, instant image previews, empty states)
   - `accesslint` (WCAG 2.1 AA, >= 4.5:1 text contrast, >= 3:1 border contrast, aria labels)
   - `vercel-react-native-skills` (40px–44px minimum interactive targets, responsive tables)

