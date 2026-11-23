# Frontend Route & Async Resilience Audit (§Phase 4)

**Generated:** 2026-11-22T08:44:44.411Z  
**Target:** `frontend/src/`  
**Standard:** `.agents/skills/client-error-resilience/SKILL.md` & Rule 02

---

## 1. Executive Summary & Health Metrics

| Metric | Total Count | Compliant | Deficient | Coverage |
| :--- | :--- | :--- | :--- | :--- |
| **Total Routes Declared** | **45** | — | — | 100% Mapped |
| **Components with Async Calls** | **50** | — | — | — |
| **Total Async Call Sites** | **184** | — | — | — |
| **Loading State (Skeleton/Spinner)** | 50 | 28 | 22 | 56% |
| **Error UI with Retry Action** | 50 | 28 | 22 | 56% |
| **Error Code Mapping (No Raw Stacks)** | 50 | 0 | 50 | 0% |
| **Unmount Safety & AbortController** | 50 | 11 | 39 | 22% |
| **Double-Submit Button Locking** | 50 | 21 | 29 | 42% |
| **Session Expiry (401 Interception)** | 50 | 8 | 42 | 16% |

---

## 2. Route Manifest by Institutional Role

| Path | Primary Role | Target Component | Guard & Policy |
| :--- | :--- | :--- | :--- |
| `/` | `PUBLIC` | `LandingPage` | `<LandingPage />` |
| `/login` | `PUBLIC` | `LoginPage` | `<LoginPage />` |
| `/admin/login` | `ADMIN` | `LoginPage` | `<LoginPage />` |
| `/faculty/login` | `FACULTY` | `LoginPage` | `<LoginPage />` |
| `/invigilator/login` | `INVIGILATOR` | `LoginPage` | `<LoginPage />` |
| `/invigilator-login` | `INVIGILATOR` | `LoginPage` | `<LoginPage />` |
| `/student/login` | `STUDENT` | `LoginPage` | `<LoginPage />` |
| `/forgot-password` | `PUBLIC` | `ForgotPasswordPage` | `<ForgotPasswordPage />` |
| `/seb/enter` | `PUBLIC` | `SebHandoffPage` | `<SebHandoffPage />` |
| `/seb/diagnostics` | `PUBLIC` | `SebDiagnosticsPage` | `<SebDiagnosticsPage />` |
| `/onboarding` | `AUTH_ONBOARDING` | `OnboardingGuard` | `<OnboardingGuard><OnboardingPage /></OnboardingGuard>` |
| `/pending-approval` | `AUTH_ONBOARDING` | `OnboardingGuard` | `<OnboardingGuard><PendingApprovalPage /></OnboardingGuard>` |
| `/settings` | `PUBLIC` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['STUDENT', 'FACULTY', 'ADMIN']` |
| `/student/settings` | `STUDENT` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['STUDENT']` |
| `/faculty/settings` | `FACULTY` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']` |
| `/admin` | `ADMIN` | `Navigate` | `<Navigate to="/admin/dashboard" replace />` |
| `/faculty` | `FACULTY` | `Navigate` | `<Navigate to="/faculty/exams" replace />` |
| `/invigilator` | `INVIGILATOR` | `Navigate` | `<Navigate to="/invigilator/console" replace />` |
| `/student` | `STUDENT` | `Navigate` | `<Navigate to="/student/dashboard" replace />` |
| `/student/enrollment` | `STUDENT` | `Navigate` | `<Navigate to="/student/dashboard" replace />` |
| `/admin/dashboard` | `ADMIN` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['ADMIN']` |
| `/admin/users` | `ADMIN` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['ADMIN']` |
| `/admin/exams` | `ADMIN` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['ADMIN']` |
| `/admin/seb` | `ADMIN` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['ADMIN']` |
| `/admin/settings/seb` | `ADMIN` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['ADMIN']` |
| `/faculty/dashboard` | `FACULTY` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']` |
| `/faculty/exams` | `FACULTY` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']` |
| `/faculty/exams/:id` | `FACULTY` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']` |
| `/invigilator/dashboard` | `INVIGILATOR` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['INVIGILATOR', 'FACULTY', 'ADMIN']` |
| `/invigilator/console` | `INVIGILATOR` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['INVIGILATOR', 'FACULTY', 'ADMIN']` |
| `/student/dashboard` | `STUDENT` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['STUDENT']` |
| `/student/secure-browser` | `STUDENT` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['STUDENT', 'FACULTY', 'ADMIN']` |
| `/student/exams` | `STUDENT` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['STUDENT']` |
| `/student/exams/:id/start` | `STUDENT` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['STUDENT']` |
| `/student/exams/:id/seb-required` | `STUDENT` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['STUDENT']` |
| `/student/exams/:id/pre-check` | `STUDENT` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['STUDENT']` |
| `/student/exams/:id/lobby` | `STUDENT` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['STUDENT']` |
| `/student/exams/:id/security` | `STUDENT` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['STUDENT']` |
| `/student/exams/:id/arena` | `STUDENT` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['STUDENT']` |
| `/student/exams/:id/exam` | `STUDENT` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['STUDENT']` |
| `/student/exams/:id/results` | `STUDENT` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['STUDENT', 'FACULTY', 'ADMIN']` |
| `/student/results/:attemptId` | `STUDENT` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['STUDENT', 'FACULTY', 'ADMIN']` |
| `/student/results` | `STUDENT` | `ProtectedRoute` | `<ProtectedRoute allowedRoles={['STUDENT']` |
| `/privacy` | `PUBLIC` | `PrivacyPage` | `<PrivacyPage />` |
| `*` | `PUBLIC` | `NotFoundPage` | `<NotFoundPage />` |

---

## 3. Worst-First Component Backlog (Sorted by Defect Severity)

A score of **0/6** represents maximum vulnerability (no loading state, no retry, no error mapping, unmount leak risk, no submit lock). A score of **6/6** indicates full enterprise fault resilience.

| Priority | Component File | Score | Async Calls | Loading | Error+Retry | Error Map | Abort/Unmount | Submit Lock | 401 Handle |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **P1** | `frontend/src/components/faculty/ExamCredentialsModal.jsx` | **0/6** | 1 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **P2** | `frontend/src/components/faculty/ExamWizardStepAIReview.jsx` | **0/6** | 1 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **P3** | `frontend/src/hooks/useArenaSocketAndTab.js` | **0/6** | 2 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **P4** | `frontend/src/hooks/useExamTimer.js` | **0/6** | 1 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **P5** | `frontend/src/lib/sebClient.js` | **0/6** | 1 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **P6** | `frontend/src/lib/uploadHelper.js` | **0/6** | 4 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **P7** | `frontend/src/pages/faculty/ExamManagePage.jsx` | **0/6** | 5 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **P8** | `frontend/src/components/common/ErrorBoundary.jsx` | **1/6** | 1 | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **P9** | `frontend/src/components/faculty/ExamWizardStepPublish.jsx` | **1/6** | 1 | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **P10** | `frontend/src/components/faculty/ExamWizardStepReview.jsx` | **1/6** | 3 | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **P11** | `frontend/src/components/ui/photo-upload-card.jsx` | **1/6** | 1 | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **P12** | `frontend/src/hooks/useScreenProctoring.jsx` | **1/6** | 7 | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **P13** | `frontend/src/lib/cameraStore.js` | **1/6** | 1 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **P14** | `frontend/src/pages/admin/AdminDashboardPage.jsx` | **1/6** | 4 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **P15** | `frontend/src/pages/common/SettingsPage.jsx` | **1/6** | 1 | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **P16** | `frontend/src/pages/faculty/FacultyExamsPage.jsx` | **1/6** | 2 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **P17** | `frontend/src/pages/invigilator/LiveConsolePage.jsx` | **1/6** | 15 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **P18** | `frontend/src/pages/student/SebRequiredPage.jsx` | **1/6** | 2 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **P19** | `frontend/src/pages/student/StudentDashboardPage.jsx` | **1/6** | 5 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **P20** | `frontend/src/pages/student/StudentResultsPage.jsx` | **1/6** | 1 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **P21** | `frontend/src/components/faculty/ExamQuestionsTab.jsx` | **2/6** | 3 | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **P22** | `frontend/src/components/faculty/ExamSettingsModal.jsx` | **2/6** | 2 | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **P23** | `frontend/src/components/faculty/ExamWizardModal.jsx` | **2/6** | 4 | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **P24** | `frontend/src/components/faculty/ExamWizardStepSecurity.jsx` | **2/6** | 2 | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **P25** | `frontend/src/components/faculty/ExamWizardStepUpload.jsx` | **2/6** | 6 | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **P26** | `frontend/src/components/faculty/IncidentReviewModal.jsx` | **2/6** | 2 | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **P27** | `frontend/src/context/AuthContext.jsx` | **2/6** | 4 | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **P28** | `frontend/src/hooks/useAnswerAutosave.js` | **2/6** | 4 | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **P29** | `frontend/src/hooks/useCamera.js` | **2/6** | 1 | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **P30** | `frontend/src/lib/apiClient.js` | **2/6** | 6 | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **P31** | `frontend/src/pages/admin/AdminExamsPage.jsx` | **2/6** | 3 | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **P32** | `frontend/src/pages/admin/AdminUsersPage.jsx` | **2/6** | 5 | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **P33** | `frontend/src/pages/auth/OnboardingPage.jsx` | **2/6** | 1 | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **P34** | `frontend/src/pages/public/SebDiagnosticsPage.jsx` | **2/6** | 2 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **P35** | `frontend/src/components/admin/AdminApprovalsTab.jsx` | **3/6** | 1 | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **P36** | `frontend/src/components/admin/ReviewUserDialog.jsx` | **3/6** | 3 | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **P37** | `frontend/src/components/admin/UserVerificationModal.jsx` | **3/6** | 4 | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **P38** | `frontend/src/components/faculty/ExamAiModal.jsx` | **3/6** | 2 | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **P39** | `frontend/src/components/faculty/ExamInvigilatorsTab.jsx` | **3/6** | 4 | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **P40** | `frontend/src/components/faculty/ExamReadinessTab.jsx` | **3/6** | 1 | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **P41** | `frontend/src/components/faculty/ExamViolationsTab.jsx` | **3/6** | 1 | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **P42** | `frontend/src/components/faculty/ExamWizardStepAudience.jsx` | **3/6** | 1 | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **P43** | `frontend/src/pages/auth/LoginPage.jsx` | **3/6** | 1 | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **P44** | `frontend/src/pages/student/StudentSebCheckPage.jsx` | **3/6** | 6 | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **P45** | `frontend/src/pages/admin/AdminSebConfigPage.jsx` | **4/6** | 15 | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **P46** | `frontend/src/pages/auth/ForgotPasswordPage.jsx` | **4/6** | 3 | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **P47** | `frontend/src/pages/student/ExamArenaPage.jsx` | **4/6** | 9 | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **P48** | `frontend/src/pages/student/PreExamCheckPage.jsx` | **4/6** | 12 | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **P49** | `frontend/src/pages/student/SebHandoffPage.jsx` | **6/6** | 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **P50** | `frontend/src/pages/student/StudentExamStartPage.jsx` | **5/6** | 15 | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |

---

## 4. Remediation Plan by Route Group

### Route Group 1: Student Exam Lifecycle (Priority 1)
- **Files:** `StudentExamStartPage.jsx`, `ExamArenaPage.jsx`, `PreExamCheckPage.jsx`, `StudentDashboardPage.jsx`, `StudentResultsPage.jsx`, `SebHandoffPage.jsx`.
- **Target Invariants:**
  1. Standardize `AsyncStateView` for `loading`, `empty`, `error`, `offline`, `forbidden`, `session_expired`.
  2. Map all student backend errors via shared `mapClientError()` helper with plain language and retry action.
  3. Enforce immediate button submit locking (`disabled={isSubmitting}`) on start exam, answer pick, and submit.
  4. Ensure all `useEffect` fetch and timer calls utilize `AbortController` signals and timer clearings.

### Route Group 2: Faculty & Exam Authoring (Priority 2)
- **Files:** `FacultyExamsPage.jsx`, `ExamManagePage.jsx`, `ExamWizardModal.jsx`, `ExamQuestionEditor.jsx`, `ExamSubmissionsTab.jsx`.
- **Target Invariants:**
  1. Field-level Zod validation errors on exam creation and question publishing.
  2. Double-submit guard on "Create Exam" and "Generate AI Questions".
  3. Clean recovery and retry states for question fetching and submission reviews.

### Route Group 3: Admin & Security Controls (Priority 3)
- **Files:** `AdminDashboardPage.jsx`, `AdminUsersPage.jsx`, `AdminExamsPage.jsx`, `AdminSebConfigPage.jsx`.
- **Target Invariants:**
  1. User role update confirmation and error handling.
  2. SEB config upload error mapping and diagnostics retry.

### Route Group 4: Auth & Session Gates (Priority 4)
- **Files:** `LoginPage.jsx`, `ForgotPasswordPage.jsx`, `OnboardingPage.jsx`, `PendingApprovalPage.jsx`.
- **Target Invariants:**
  1. Rate-limit 429 backoff handling.
  2. Password input validation with accessible error labels.
