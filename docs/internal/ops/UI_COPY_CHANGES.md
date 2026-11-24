# UI Copy Changes & Outdated Statements Sweep

## 1. Overview
As part of the **Production Release & UI Refresh** milestone, every user-facing surface, documentation file, and error dialog across ProctorNet was audited to eliminate obsolete references to deprecated architectures:
- **Removed**: Legacy WebRTC screen sharing (`getDisplayMedia`), "entire screen" capture prompts, 3-step pre-checks, desktop companion agents, and WireGuard VPN tunnels.
- **Enforced**: Real capabilities of the platform:
  1. Camera and 1:1 facial verification checks with active feed validation.
  2. Safe Exam Browser (SEB) application kiosk lockdown for secured exams, with explicit Windows desktop requirements and mobile/tablet warnings.
  3. Server-authoritative timer with automated expiration submission.
  4. Network-drop resilient autosave with local caching and offline sync.
  5. One-tab rule with deterministic 3-violation threshold termination.
  6. Privacy and proctoring consent agreements with clear data retention rules (90-day purge).
  7. Centralized copy architecture in `frontend/src/copy/index.js`.

---

## 2. Before / After Copy Audit Table

| File & Location | Before (Outdated Copy) | After (Accurate Live Copy) | Rationale & Policy |
| :--- | :--- | :--- | :--- |
| `frontend/src/pages/LandingPage.jsx`<br>Features Grid (Feature 2) | `"Pre-Exam Identity & Screen Check"`<br>`"Facial comparison verification and mandatory full-screen monitor sharing."` | `"Camera & Identity Verification"`<br>`"1:1 facial comparison verification, continuous camera integrity checks, and privacy consent."` | Screen sharing removed in favor of camera-only proctoring and SEB application lockdown. |
| `frontend/src/pages/LandingPage.jsx`<br>Workflow Steps (Step 01) | `"Provision & Verify Accounts"`<br>`"Administrators provision accounts; candidates submit face reference photos for verification."` | `"Provision & Enroll Identity"`<br>`"Administrators provision accounts; candidates enroll their facial identity baseline."` | Clearer biometric enrollment terminology. |
| `frontend/src/pages/LandingPage.jsx`<br>Workflow Steps (Step 02) | `"Author & Schedule Exams"`<br>`"Faculty configure MCQ tests, set start/end windows, and assign proctors to student cohorts."` | `"Author & Schedule Assessments"`<br>`"Faculty configure assessments via 5-step AI wizard, set start windows, and toggle secure browser lockdown."` | Highlights the 5-step wizard and Safe Exam Browser integration. |
| `frontend/src/pages/LandingPage.jsx`<br>Workflow Steps (Step 03) | `"Identity & Screen Verification"`<br>`"Before the exam unlocks, students pass facial comparison and activate screen sharing."` | `"Identity & Integrity Verification"`<br>`"Before the exam unlocks, students pass facial comparison, camera check, and secure kiosk validation."` | Screen sharing removed; accurately reflects camera check and SEB kiosk verification. |
| `frontend/src/pages/LandingPage.jsx`<br>Workflow Steps (Step 04) | `"Monitored Exam & Instant Grading"`<br>`"Exam runner autosaves answers with network resilience and computes deterministic final scores."` | `"Monitored Arena & Autosave"`<br>`"Exam runner autosaves answers with network drop resilience, server timer, and deterministic final scoring."` | Emphasizes server-authoritative timer and network resilience. |
| `frontend/src/pages/LandingPage.jsx`<br>Footer | Inline static text without privacy links or version metadata. | Reusable `<AppFooter />` displaying commit SHA (`import.meta.env.VITE_GIT_COMMIT`), support email, and `/privacy` link. | Provides traceability, compliance transparency, and support paths. |
| `frontend/src/pages/faculty/FacultyExamsPage.jsx`<br>Card 4 (Proctoring Mode) | `Pure Browser`<br>`"Screen snapshots & monitoring"` | `Camera & SEB`<br>`"Facial verification & kiosk lockdown"` | Screen capture is not used; camera snapshots and SEB kiosk mode are the true security engines. |
| `frontend/src/pages/faculty/FacultyExamsPage.jsx`<br>Wizard Action Button | `"+ 4-Step AI Exam Wizard"` | `"+ Create Assessment (AI Wizard)"` | The wizard flow was expanded to 5 steps (Upload, AI Review, Schedule, Security, Review). |
| `frontend/src/pages/student/PreExamCheckPage.jsx`<br>Camera Feed Container | `bg-[#171721]` (dark theme surface) | `bg-[#28253b]` (Mercury ink tone) | Strictly enforces Rule 05 Light-Only Enterprise UI mandate (no dark mode/surfaces). |
| `frontend/src/lib/systemCheck.js`<br>`evaluateOperatingSystem` | `"This secure exam is configured for Windows. Please use a Windows computer or contact your instructor."` | Added `isMobileOrTablet()` check. If mobile/tablet: `"This assessment requires Safe Exam Browser on a Windows PC or laptop. Mobile phones and tablets cannot run this secured examination."` | Clear, unambiguous guidance preventing students from attempting SEB exams on phones or iPads. |
| `frontend/src/pages/student/SebRequiredPage.jsx`<br>Security Notice | Static notice only for desktop browsers. | Added mobile alert: `"Desktop Computer Required: This assessment requires Safe Exam Browser on a Windows PC or laptop. Mobile phones, tablets, and unsupported operating systems cannot run this secured examination."` | Direct guidance for students landing on the SEB required page from mobile devices. |
| `frontend/src/components/common/ErrorBoundary.jsx`<br>Global Error Screen | Generic `"Something went wrong"` without reference ID. | Displays unique `Error Reference ID` (e.g., `ERR-KXZ8...`), one-click Copy with feedback, Reload Page, and Return Home buttons. Styled with `#fbfcfd` canvas and `#edecfb` card. | Allows students and faculty to cite an exact error ID for technical support without data loss. |
| `frontend/src/pages/common/NotFoundPage.jsx`<br>Custom 404 Route | Fallback route redirected silently to `/` (`<Navigate to="/" replace />`). | Dedicated, styled `NotFoundPage` with Compass icon, clear 404 badge, return home action, and navigation links. | Prevents silent disorientation when accessing invalid or expired assessment links. |
| `frontend/src/pages/common/PrivacyPage.jsx`<br>Public Compliance Route | None (document lived only as internal Markdown). | Full interactive `/privacy` route rendering the FERPA & GDPR Data Map, storage locations, encryption, 90-day retention, and student erasure rights. | Full institutional transparency and privacy compliance. |
| Lists (Student & Faculty & Admin)<br>Loading States | Plain unstyled text (`"Loading exams..."`, `"Loading accounts..."`). | Light shimmer animated skeletons (`<TableSkeleton />`, `<CardListSkeleton />`) preventing layout shift (CLS: 0). | Professional enterprise UX. |
| Lists (Student & Faculty & Admin)<br>Empty States | Plain unstyled text (`"No exams registered"`, `"No accounts in this category"`). | Reusable `<EmptyState />` component with soft lavender icon circles, helpful descriptions, and primary CTA buttons. | Actionable guidance when lists are empty. |

---

## 3. Centralized Copy Architecture (`frontend/src/copy/index.js`)
All static text, instructions, error messages, and rule descriptions are now exported from `frontend/src/copy/index.js`:
- `COPY.brand`: Platform titles, badges, taglines.
- `COPY.landing`: Features, workflow steps, role descriptions, hero text.
- `COPY.student.preCheck`: Verification stages, privacy consent terms, camera blocked instructions.
- `COPY.student.instructions`: 5 core candidate rules (camera, one-tab, server timer, autosave, violation limit).
- `COPY.student.seb`: Kiosk lockdown explanations, mobile warning alerts.
- `COPY.student.arena`: Offline banners, autosave sync confirmations, auto-submission alerts.
- `COPY.errors`: Error boundary messages, reference labels, 404 copy.
