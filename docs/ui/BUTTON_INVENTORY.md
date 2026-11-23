# Button and Interactive Action Inventory

Generated: 2026-11-17
Total interactive button elements audited: **231**
Raw `<button>` elements to migrate: **1**
Elements with defects: **1**

## 1. Summary of Identified Defects

### Multiple Primary Buttons on Single Route Views
- **Route `/admin/seb`** has 2 primary buttons:
  - Line 745 in `pages\admin\AdminSebConfigPage.jsx`: `<Button`
  - Line 1048 in `pages\admin\AdminSebConfigPage.jsx`: `<Button`
- **Route `/admin/users`** has 2 primary buttons:
  - Line 115 in `pages\admin\AdminUsersPage.jsx`: `<Button variant="primary" size="sm">`
  - Line 146 in `pages\admin\AdminUsersPage.jsx`: `<Button type="submit" variant="primary" className="w-full mt-2">`
- **Route `/forgot-password`** has 3 primary buttons:
  - Line 130 in `pages\auth\ForgotPasswordPage.jsx`: `<Button`
  - Line 157 in `pages\auth\ForgotPasswordPage.jsx`: `<Button`
  - Line 219 in `pages\auth\ForgotPasswordPage.jsx`: `<Button`
- **Route `/student/exams/:id/arena`** has 4 primary buttons:
  - Line 333 in `pages\student\ExamArenaPage.jsx`: `<Button`
  - Line 342 in `pages\student\ExamArenaPage.jsx`: `<Button`
  - Line 541 in `pages\student\ExamArenaPage.jsx`: `<Button`
  - Line 612 in `pages\student\ExamArenaPage.jsx`: `<Button`
- **Route `/student/exams/:id/precheck`** has 4 primary buttons:
  - Line 419 in `pages\student\PreExamCheckPage.jsx`: `<Button`
  - Line 446 in `pages\student\PreExamCheckPage.jsx`: `<Button`
  - Line 532 in `pages\student\PreExamCheckPage.jsx`: `<Button`
  - Line 617 in `pages\student\PreExamCheckPage.jsx`: `<Button`
- **Route `/seb/required`** has 2 primary buttons:
  - Line 90 in `pages\student\SebRequiredPage.jsx`: `<Button`
  - Line 100 in `pages\student\SebRequiredPage.jsx`: `<Button`
- **Route `/student/exams/:id/start`** has 7 primary buttons:
  - Line 415 in `pages\student\StudentExamStartPage.jsx`: `<Button`
  - Line 463 in `pages\student\StudentExamStartPage.jsx`: `<Button`
  - Line 477 in `pages\student\StudentExamStartPage.jsx`: `<Button`
  - Line 502 in `pages\student\StudentExamStartPage.jsx`: `<Button`
  - Line 846 in `pages\student\StudentExamStartPage.jsx`: `<Button`
  - Line 864 in `pages\student\StudentExamStartPage.jsx`: `<Button`
  - Line 891 in `pages\student\StudentExamStartPage.jsx`: `<Button`

### Ad-hoc Color Overrides & Raw `<button>` Usages
- `components\ui\switch.jsx:6` (button, variant="raw/unstyled"): Raw <button> used instead of design system <Button>
  ```jsx
  <button
  ```

## 2. Complete Inventory by File

| Route / Context | File:Line | Element | Variant | Classes / Styling |
| :--- | :--- | :--- | :--- | :--- |
| Component (components\admin\AdminApprovalsTab.jsx) | `components\admin\AdminApprovalsTab.jsx:51` | `Button` | `outline` | `text-xs font-[420] gap-1.5 rounded-full ...` |
| Component (components\admin\AdminApprovalsTab.jsx) | `components\admin\AdminApprovalsTab.jsx:121` | `Button` | `default` | — |
| Component (components\admin\ReviewUserDialog.jsx) | `components\admin\ReviewUserDialog.jsx:168` | `Button` | `outline` | — |
| Component (components\admin\ReviewUserDialog.jsx) | `components\admin\ReviewUserDialog.jsx:180` | `Button` | `secondary` | — |
| Component (components\admin\ReviewUserDialog.jsx) | `components\admin\ReviewUserDialog.jsx:189` | `Button` | `destructive` | — |
| Component (components\admin\ReviewUserDialog.jsx) | `components\admin\ReviewUserDialog.jsx:200` | `Button` | `primary` | — |
| Component (components\admin\UserTable.jsx) | `components\admin\UserTable.jsx:56` | `Button` | `secondary` | — |
| Component (components\admin\UserTable.jsx) | `components\admin\UserTable.jsx:64` | `Button` | `ghost` | — |
| Component (components\admin\UserVerificationModal.jsx) | `components\admin\UserVerificationModal.jsx:124` | `Button` | `ghost` | `h-6 text-[10px] gap-1 text-[#5266eb] rou...` |
| Component (components\admin\UserVerificationModal.jsx) | `components\admin\UserVerificationModal.jsx:141` | `Button` | `ghost` | `h-6 text-[10px] gap-1 text-[#5266eb] rou...` |
| Component (components\admin\UserVerificationModal.jsx) | `components\admin\UserVerificationModal.jsx:168` | `Button` | `primary` | `w-3.5 h-3.5 animate-spin` |
| Component (components\admin\UserVerificationModal.jsx) | `components\admin\UserVerificationModal.jsx:177` | `Button` | `secondary` | `w-3.5 h-3.5` |
| Component (components\admin\UserVerificationModal.jsx) | `components\admin\UserVerificationModal.jsx:180` | `Button` | `ghost` | — |
| Component (components\admin\UserVerificationModal.jsx) | `components\admin\UserVerificationModal.jsx:182` | `Button` | `secondary` | — |
| Component (components\admin\UserVerificationModal.jsx) | `components\admin\UserVerificationModal.jsx:186` | `Button` | `destructive` | — |
| Component (components\admin\UserVerificationModal.jsx) | `components\admin\UserVerificationModal.jsx:190` | `Button` | `primary` | — |
| Component (components\common\DashboardShell.jsx) | `components\common\DashboardShell.jsx:64` | `Button` | `ghost` | `gap-1.5 h-8 rounded-full cursor-pointer ...` |
| Component (components\common\EmptyState.jsx) | `components\common\EmptyState.jsx:27` | `Button` | `primary` | — |
| Component (components\common\ErrorBoundary.jsx) | `components\common\ErrorBoundary.jsx:94` | `Button` | `ghost` | — |
| Component (components\common\ErrorBoundary.jsx) | `components\common\ErrorBoundary.jsx:128` | `Button` | `primary` | — |
| Component (components\common\ErrorBoundary.jsx) | `components\common\ErrorBoundary.jsx:135` | `Button` | `secondary` | — |
| Component (components\common\ErrorState.jsx) | `components\common\ErrorState.jsx:32` | `Button` | `primary` | — |
| Component (components\common\SignedImage.jsx) | `components\common\SignedImage.jsx:68` | `Button` | `link` | `mt-2 text-[11px]` |
| Component (components\exam\ExamArenaHeader.jsx) | `components\exam\ExamArenaHeader.jsx:61` | `Button` | `default` | `px-4 h-8 cursor-pointer` |
| Component (components\exam\ProctoringInterruptedOverlay.jsx) | `components\exam\ProctoringInterruptedOverlay.jsx:27` | `Button` | `default` | `px-6 h-10 cursor-pointer` |
| Component (components\exam\QuestionCard.jsx) | `components\exam\QuestionCard.jsx:48` | `Button` | `ghost` | — |
| Component (components\exam\QuestionCard.jsx) | `components\exam\QuestionCard.jsx:80` | `Button` | `default` | `gap-1 text-xs font-[420] rounded-[40px] ...` |
| Component (components\exam\QuestionCard.jsx) | `components\exam\QuestionCard.jsx:88` | `Button` | `default` | — |
| Component (components\exam\QuestionCard.jsx) | `components\exam\QuestionCard.jsx:97` | `Button` | `ghost` | `text-xs text-[#554e7b] font-[420] rounde...` |
| Component (components\exam\QuestionCard.jsx) | `components\exam\QuestionCard.jsx:106` | `Button` | `default` | — |
| Component (components\exam\QuestionPalette.jsx) | `components\exam\QuestionPalette.jsx:38` | `Button` | `default` | — |
| Component (components\exam\SubmitExamDialog.jsx) | `components\exam\SubmitExamDialog.jsx:23` | `Button` | `secondary` | — |
| Component (components\exam\SubmitExamDialog.jsx) | `components\exam\SubmitExamDialog.jsx:26` | `Button` | `primary` | — |
| Component (components\exam\SubmitExamDialog.jsx) | `components\exam\SubmitExamDialog.jsx:69` | `Button` | `default` | `h-10 px-6 cursor-pointer` |
| Component (components\exam\SubmitExamDialog.jsx) | `components\exam\SubmitExamDialog.jsx:79` | `Button` | `default` | `h-10 px-6 cursor-pointer` |
| Component (components\faculty\ExamAiModal.jsx) | `components\faculty\ExamAiModal.jsx:66` | `Button` | `primary` | — |
| Component (components\faculty\ExamAiModal.jsx) | `components\faculty\ExamAiModal.jsx:138` | `Button` | `default` | `w-full h-10 flex items-center justify-ce...` |
| Component (components\faculty\ExamAiModal.jsx) | `components\faculty\ExamAiModal.jsx:161` | `Button` | `outline` | — |
| Component (components\faculty\ExamAiModal.jsx) | `components\faculty\ExamAiModal.jsx:199` | `Button` | `outline` | — |
| Component (components\faculty\ExamAiModal.jsx) | `components\faculty\ExamAiModal.jsx:207` | `Button` | `default` | `px-4 h-9 flex items-center gap-1.5 curso...` |
| Component (components\faculty\ExamCredentialsModal.jsx) | `components\faculty\ExamCredentialsModal.jsx:62` | `Button` | `ghost` | `text-xs px-3.5` |
| Component (components\faculty\ExamCredentialsModal.jsx) | `components\faculty\ExamCredentialsModal.jsx:71` | `Button` | `default` | `px-4 h-9 cursor-pointer gap-1.5` |
| Component (components\faculty\ExamInvigilatorsTab.jsx) | `components\faculty\ExamInvigilatorsTab.jsx:105` | `Button` | `primary` | — |
| Component (components\faculty\ExamInvigilatorsTab.jsx) | `components\faculty\ExamInvigilatorsTab.jsx:123` | `Button` | `primary` | `w-full mt-2` |
| Component (components\faculty\ExamInvigilatorsTab.jsx) | `components\faculty\ExamInvigilatorsTab.jsx:174` | `Button` | `ghost` | — |
| Component (components\faculty\ExamInvigilatorsTab.jsx) | `components\faculty\ExamInvigilatorsTab.jsx:187` | `Button` | `secondary` | — |
| Component (components\faculty\ExamInvigilatorsTab.jsx) | `components\faculty\ExamInvigilatorsTab.jsx:195` | `Button` | `ghost` | — |
| Component (components\faculty\ExamQuestionsTab.jsx) | `components\faculty\ExamQuestionsTab.jsx:80` | `Button` | `secondary` | — |
| Component (components\faculty\ExamQuestionsTab.jsx) | `components\faculty\ExamQuestionsTab.jsx:86` | `Button` | `primary` | — |
| Component (components\faculty\ExamQuestionsTab.jsx) | `components\faculty\ExamQuestionsTab.jsx:117` | `Button` | `primary` | `w-full mt-2` |
| Component (components\faculty\ExamQuestionsTab.jsx) | `components\faculty\ExamQuestionsTab.jsx:144` | `Button` | `destructive` | — |
| Component (components\faculty\ExamReadinessTab.jsx) | `components\faculty\ExamReadinessTab.jsx:97` | `Button` | `default` | — |
| Component (components\faculty\ExamReadinessTab.jsx) | `components\faculty\ExamReadinessTab.jsx:129` | `Button` | `outline` | `gap-1.5 text-xs font-[420] rounded-[40px...` |
| Component (components\faculty\ExamReadinessTab.jsx) | `components\faculty\ExamReadinessTab.jsx:139` | `Button` | `outline` | `gap-1.5 text-xs font-[420] rounded-[40px...` |
| Component (components\faculty\ExamSettingsModal.jsx) | `components\faculty\ExamSettingsModal.jsx:133` | `Button` | `secondary` | — |
| Component (components\faculty\ExamSettingsModal.jsx) | `components\faculty\ExamSettingsModal.jsx:254` | `Button` | `link` | `text-[11px]` |
| Component (components\faculty\ExamSettingsModal.jsx) | `components\faculty\ExamSettingsModal.jsx:304` | `Button` | `ghost` | `gap-1 px-3 cursor-pointer` |
| Component (components\faculty\ExamSettingsModal.jsx) | `components\faculty\ExamSettingsModal.jsx:316` | `Button` | `default` | `h-9 px-4 ml-auto flex items-center gap-1...` |
| Component (components\faculty\ExamViolationsTab.jsx) | `components\faculty\ExamViolationsTab.jsx:169` | `Button` | `ghost` | `h-8 w-8 p-0 rounded-full hover:bg-[rgba(...` |
| Component (components\faculty\ExamViolationsTab.jsx) | `components\faculty\ExamViolationsTab.jsx:180` | `Button` | `outline` | `h-8 px-3 text-xs font-[420] rounded-[40p...` |
| Component (components\faculty\ExamViolationsTab.jsx) | `components\faculty\ExamViolationsTab.jsx:202` | `Button` | `default` | `h-8 px-4` |
| Component (components\faculty\ExamViolationsTab.jsx) | `components\faculty\ExamViolationsTab.jsx:265` | `Button` | `ghost` | — |
| Component (components\faculty\ExamViolationsTab.jsx) | `components\faculty\ExamViolationsTab.jsx:300` | `Button` | `ghost` | — |
| Component (components\faculty\ExamViolationsTab.jsx) | `components\faculty\ExamViolationsTab.jsx:313` | `Button` | `primary` | — |
| Component (components\faculty\ExamWizardModal.jsx) | `components\faculty\ExamWizardModal.jsx:389` | `Button` | `outline` | `rounded-[40px] px-4 text-xs font-[420]` |
| Component (components\faculty\ExamWizardModal.jsx) | `components\faculty\ExamWizardModal.jsx:401` | `Button` | `default` | `bg-primary text-primary-foreground font-...` |
| Component (components\faculty\ExamWizardStepAIReview.jsx) | `components\faculty\ExamWizardStepAIReview.jsx:255` | `Button` | `outline` | `h-7 px-3 text-[11px] rounded-full` |
| Component (components\faculty\ExamWizardStepAIReview.jsx) | `components\faculty\ExamWizardStepAIReview.jsx:276` | `Button` | `outline` | — |
| Component (components\faculty\ExamWizardStepAIReview.jsx) | `components\faculty\ExamWizardStepAIReview.jsx:287` | `Button` | `outline` | — |
| Component (components\faculty\ExamWizardStepAIReview.jsx) | `components\faculty\ExamWizardStepAIReview.jsx:348` | `Button` | `outline` | — |
| Component (components\faculty\ExamWizardStepAIReview.jsx) | `components\faculty\ExamWizardStepAIReview.jsx:357` | `Button` | `default` | `h-7 text-xs rounded-full` |
| Component (components\faculty\ExamWizardStepAIReview.jsx) | `components\faculty\ExamWizardStepAIReview.jsx:429` | `Button` | `ghost` | — |
| Component (components\faculty\ExamWizardStepAIReview.jsx) | `components\faculty\ExamWizardStepAIReview.jsx:439` | `Button` | `ghost` | — |
| Component (components\faculty\ExamWizardStepAIReview.jsx) | `components\faculty\ExamWizardStepAIReview.jsx:451` | `Button` | `ghost` | — |
| Component (components\faculty\ExamWizardStepAIReview.jsx) | `components\faculty\ExamWizardStepAIReview.jsx:460` | `Button` | `ghost` | — |
| Component (components\faculty\ExamWizardStepAIReview.jsx) | `components\faculty\ExamWizardStepAIReview.jsx:471` | `Button` | `ghost` | — |
| Component (components\faculty\ExamWizardStepAIReview.jsx) | `components\faculty\ExamWizardStepAIReview.jsx:482` | `Button` | `ghost` | — |
| Component (components\faculty\ExamWizardStepAIReview.jsx) | `components\faculty\ExamWizardStepAIReview.jsx:493` | `Button` | `destructive` | — |
| Component (components\faculty\ExamWizardStepAIReview.jsx) | `components\faculty\ExamWizardStepAIReview.jsx:584` | `Button` | `outline` | — |
| Component (components\faculty\ExamWizardStepPublish.jsx) | `components\faculty\ExamWizardStepPublish.jsx:123` | `Button` | `outline` | `text-xs bg-[rgba(82,102,235,0.08)] hover...` |
| Component (components\faculty\ExamWizardStepPublish.jsx) | `components\faculty\ExamWizardStepPublish.jsx:133` | `Button` | `outline` | — |
| Component (components\faculty\ExamWizardStepPublish.jsx) | `components\faculty\ExamWizardStepPublish.jsx:142` | `Button` | `outline` | — |
| Component (components\faculty\ExamWizardStepPublish.jsx) | `components\faculty\ExamWizardStepPublish.jsx:183` | `Button` | `default` | `w-full sm:w-auto px-8 bg-gradient-to-r f...` |
| Component (components\faculty\ExamWizardStepReview.jsx) | `components\faculty\ExamWizardStepReview.jsx:215` | `Button` | `outline` | `h-6 text-[10px] px-2.5 rounded-[40px] bg...` |
| Component (components\faculty\ExamWizardStepReview.jsx) | `components\faculty\ExamWizardStepReview.jsx:225` | `Button` | `outline` | — |
| Component (components\faculty\ExamWizardStepReview.jsx) | `components\faculty\ExamWizardStepReview.jsx:262` | `Button` | `outline` | `h-6 text-[10px] px-2.5 rounded-[40px] bg...` |
| Component (components\faculty\ExamWizardStepReview.jsx) | `components\faculty\ExamWizardStepReview.jsx:272` | `Button` | `outline` | `h-6 text-[10px] px-2.5 rounded-[40px] bg...` |
| Component (components\faculty\ExamWizardStepReview.jsx) | `components\faculty\ExamWizardStepReview.jsx:319` | `Button` | `default` | `bg-primary text-primary-foreground font-...` |
| Component (components\faculty\ExamWizardStepSchedule.jsx) | `components\faculty\ExamWizardStepSchedule.jsx:188` | `Button` | `outline` | — |
| Component (components\faculty\ExamWizardStepSchedule.jsx) | `components\faculty\ExamWizardStepSchedule.jsx:197` | `Button` | `outline` | — |
| Component (components\faculty\ExamWizardStepSchedule.jsx) | `components\faculty\ExamWizardStepSchedule.jsx:206` | `Button` | `outline` | — |
| Component (components\faculty\ExamWizardStepUpload.jsx) | `components\faculty\ExamWizardStepUpload.jsx:267` | `Button` | `outline` | `h-7 text-xs rounded-full px-3` |
| Component (components\faculty\ExamWizardStepUpload.jsx) | `components\faculty\ExamWizardStepUpload.jsx:425` | `Button` | `outline` | — |
| Component (components\faculty\ExamWizardStepUpload.jsx) | `components\faculty\ExamWizardStepUpload.jsx:442` | `Button` | `outline` | — |
| Component (components\faculty\ExamWizardStepUpload.jsx) | `components\faculty\ExamWizardStepUpload.jsx:459` | `Button` | `default` | — |
| Component (components\faculty\ExamWizardStepUpload.jsx) | `components\faculty\ExamWizardStepUpload.jsx:533` | `Button` | `default` | — |
| Component (components\faculty\ExamWizardStepUpload.jsx) | `components\faculty\ExamWizardStepUpload.jsx:578` | `Button` | `outline` | — |
| Component (components\faculty\ExamWizardStepUpload.jsx) | `components\faculty\ExamWizardStepUpload.jsx:588` | `Button` | `default` | `h-9 px-6 rounded-full text-xs` |
| Component (components\faculty\ExamWizardStepUpload.jsx) | `components\faculty\ExamWizardStepUpload.jsx:625` | `Button` | `destructive` | `h-8 px-4 rounded-full text-xs` |
| Component (components\faculty\ExamWizardStepUpload.jsx) | `components\faculty\ExamWizardStepUpload.jsx:647` | `Button` | `outline` | `h-7 px-3 text-xs rounded-full` |
| Component (components\faculty\ExamWizardStepUpload.jsx) | `components\faculty\ExamWizardStepUpload.jsx:671` | `Button` | `ghost` | `text-xs rounded-full h-8 px-4` |
| Component (components\faculty\IncidentReviewModal.jsx) | `components\faculty\IncidentReviewModal.jsx:113` | `Button` | `outline` | `gap-1.5 text-xs font-[420] rounded-[40px...` |
| Component (components\faculty\IncidentReviewModal.jsx) | `components\faculty\IncidentReviewModal.jsx:123` | `Button` | `ghost` | — |
| Component (components\faculty\IncidentReviewModal.jsx) | `components\faculty\IncidentReviewModal.jsx:185` | `Button` | `default` | `w-full h-9 cursor-pointer` |
| Component (components\faculty\IncidentReviewModal.jsx) | `components\faculty\IncidentReviewModal.jsx:219` | `Button` | `default` | — |
| Component (components\faculty\IncidentReviewModal.jsx) | `components\faculty\IncidentReviewModal.jsx:332` | `Button` | `ghost` | — |
| Component (components\faculty\IncidentReviewModal.jsx) | `components\faculty\IncidentReviewModal.jsx:362` | `Button` | `secondary` | — |
| Component (components\invigilator\CandidateAuditSheet.jsx) | `components\invigilator\CandidateAuditSheet.jsx:92` | `Button` | `default` | — |
| Component (components\invigilator\CandidateAuditSheet.jsx) | `components\invigilator\CandidateAuditSheet.jsx:101` | `Button` | `outline` | — |
| Component (components\invigilator\CandidateAuditSheet.jsx) | `components\invigilator\CandidateAuditSheet.jsx:117` | `Button` | `default` | — |
| Component (components\invigilator\CandidateAuditSheet.jsx) | `components\invigilator\CandidateAuditSheet.jsx:131` | `Button` | `default` | — |
| Component (components\invigilator\CandidateAuditSheet.jsx) | `components\invigilator\CandidateAuditSheet.jsx:172` | `Button` | `link` | — |
| Component (components\invigilator\CandidateAuditSheet.jsx) | `components\invigilator\CandidateAuditSheet.jsx:214` | `Button` | `ghost` | — |
| Component (components\invigilator\CandidateAuditSheet.jsx) | `components\invigilator\CandidateAuditSheet.jsx:227` | `Button` | `primary` | — |
| Component (components\invigilator\CandidateCard.jsx) | `components\invigilator\CandidateCard.jsx:114` | `Button` | `outline` | — |
| Component (components\invigilator\CandidateCard.jsx) | `components\invigilator\CandidateCard.jsx:122` | `Button` | `default` | — |
| Component (components\invigilator\ConsoleToolbar.jsx) | `components\invigilator\ConsoleToolbar.jsx:29` | `Button` | `default` | — |
| Component (components\invigilator\SnapshotZoomModal.jsx) | `components\invigilator\SnapshotZoomModal.jsx:40` | `Button` | `outline` | `text-xs gap-1 bg-zinc-800 border-zinc-70...` |
| Component (components\onboarding\FacultyDetailsStep.jsx) | `components\onboarding\FacultyDetailsStep.jsx:149` | `Button` | `default` | `h-10 px-5 flex items-center gap-2 cursor...` |
| Component (components\onboarding\IdCardUploadStep.jsx) | `components\onboarding\IdCardUploadStep.jsx:69` | `Button` | `secondary` | `h-10 px-4 flex items-center gap-1.5 curs...` |
| Component (components\onboarding\IdCardUploadStep.jsx) | `components\onboarding\IdCardUploadStep.jsx:79` | `Button` | `default` | `h-10 px-5 flex items-center gap-2 cursor...` |
| Component (components\onboarding\StudentAcademicStep.jsx) | `components\onboarding\StudentAcademicStep.jsx:146` | `Button` | `default` | `h-10 px-5 flex items-center gap-2 cursor...` |
| Component (components\onboarding\WebcamCaptureStep.jsx) | `components\onboarding\WebcamCaptureStep.jsx:69` | `Button` | `secondary` | `h-10 px-4 flex items-center gap-1.5 curs...` |
| Component (components\onboarding\WebcamCaptureStep.jsx) | `components\onboarding\WebcamCaptureStep.jsx:79` | `Button` | `default` | `h-10 px-5 flex items-center gap-2 cursor...` |
| Component (components\ui\command-palette.jsx) | `components\ui\command-palette.jsx:56` | `Button` | `ghost` | — |
| Component (components\ui\command-palette.jsx) | `components\ui\command-palette.jsx:74` | `Button` | `ghost` | — |
| Component (components\ui\confirm-dialog.jsx) | `components\ui\confirm-dialog.jsx:43` | `Button` | `secondary` | — |
| Component (components\ui\confirm-dialog.jsx) | `components\ui\confirm-dialog.jsx:52` | `Button` | `default` | — |
| Component (components\ui\dialog.jsx) | `components\ui\dialog.jsx:35` | `Button` | `ghost` | — |
| Component (components\ui\dialog.jsx) | `components\ui\dialog.jsx:61` | `Button` | `ghost` | — |
| Component (components\ui\dialog.jsx) | `components\ui\dialog.jsx:87` | `Button` | `ghost` | — |
| Component (components\ui\password-input.jsx) | `components\ui\password-input.jsx:67` | `Button` | `ghost` | — |
| Component (components\ui\photo-upload-card.jsx) | `components\ui\photo-upload-card.jsx:201` | `Button` | `secondary` | `h-9 text-xs gap-1.5 px-3.5` |
| Component (components\ui\photo-upload-card.jsx) | `components\ui\photo-upload-card.jsx:204` | `Button` | `ghost` | `h-9 text-xs gap-1.5 px-3.5` |
| Component (components\ui\photo-upload-card.jsx) | `components\ui\photo-upload-card.jsx:209` | `Button` | `default` | `w-full h-10 gap-2 cursor-pointer` |
| Component (components\ui\sheet.jsx) | `components\ui\sheet.jsx:31` | `Button` | `ghost` | — |
| Component (components\ui\sheet.jsx) | `components\ui\sheet.jsx:49` | `Button` | `ghost` | — |
| Component (components\ui\sheet.jsx) | `components\ui\sheet.jsx:73` | `Button` | `ghost` | — |
| Component (components\ui\switch.jsx) | `components\ui\switch.jsx:6` | `button` | `raw/unstyled` | — |
| / | `pages\LandingPage.jsx:40` | `Button` | `secondary` | — |
| / | `pages\LandingPage.jsx:66` | `Button` | `primary` | — |
| / | `pages\LandingPage.jsx:139` | `Button` | `secondary` | — |
| /admin/dashboard | `pages\admin\AdminDashboardPage.jsx:132` | `Button` | `outline` | `gap-1 text-xs font-[420] rounded-[40px] ...` |
| /admin/dashboard | `pages\admin\AdminDashboardPage.jsx:178` | `Button` | `default` | `h-7 text-xs px-3` |
| /admin/exams | `pages\admin\AdminExamsPage.jsx:123` | `Button` | `outline` | `h-8 text-xs gap-1.5 rounded-[40px] px-3....` |
| /admin/exams | `pages\admin\AdminExamsPage.jsx:173` | `Button` | `default` | `w-full h-10 cursor-pointer` |
| /admin/seb | `pages\admin\AdminSebConfigPage.jsx:433` | `Button` | `link` | `text-[10px] p-0 h-auto` |
| /admin/seb | `pages\admin\AdminSebConfigPage.jsx:469` | `Button` | `secondary` | — |
| /admin/seb | `pages\admin\AdminSebConfigPage.jsx:523` | `Button` | `ghost` | — |
| /admin/seb | `pages\admin\AdminSebConfigPage.jsx:573` | `Button` | `ghost` | — |
| /admin/seb | `pages\admin\AdminSebConfigPage.jsx:596` | `Button` | `secondary` | — |
| /admin/seb | `pages\admin\AdminSebConfigPage.jsx:745` | `Button` | `primary` | — |
| /admin/seb | `pages\admin\AdminSebConfigPage.jsx:760` | `Button` | `destructive` | — |
| /admin/seb | `pages\admin\AdminSebConfigPage.jsx:808` | `Button` | `secondary` | — |
| /admin/seb | `pages\admin\AdminSebConfigPage.jsx:834` | `Button` | `ghost` | — |
| /admin/seb | `pages\admin\AdminSebConfigPage.jsx:984` | `Button` | `secondary` | — |
| /admin/seb | `pages\admin\AdminSebConfigPage.jsx:995` | `Button` | `secondary` | — |
| /admin/seb | `pages\admin\AdminSebConfigPage.jsx:1039` | `Button` | `secondary` | — |
| /admin/seb | `pages\admin\AdminSebConfigPage.jsx:1048` | `Button` | `primary` | — |
| /admin/users | `pages\admin\AdminUsersPage.jsx:109` | `Button` | `outline` | `gap-1.5 text-xs font-[420] rounded-[40px...` |
| /admin/users | `pages\admin\AdminUsersPage.jsx:115` | `Button` | `primary` | — |
| /admin/users | `pages\admin\AdminUsersPage.jsx:146` | `Button` | `primary` | `w-full mt-2` |
| /forgot-password | `pages\auth\ForgotPasswordPage.jsx:130` | `Button` | `default` | — |
| /forgot-password | `pages\auth\ForgotPasswordPage.jsx:157` | `Button` | `primary` | `w-full mt-2` |
| /forgot-password | `pages\auth\ForgotPasswordPage.jsx:211` | `Button` | `secondary` | — |
| /forgot-password | `pages\auth\ForgotPasswordPage.jsx:219` | `Button` | `primary` | `flex-1` |
| /login | `pages\auth\LoginPage.jsx:261` | `Button` | `default` | `w-full h-10 cursor-pointer transition` |
| /onboarding | `pages\auth\OnboardingPage.jsx:105` | `Button` | `secondary` | — |
| /pending-approval | `pages\auth\PendingApprovalPage.jsx:47` | `Button` | `secondary` | — |
| /pending-approval | `pages\auth\PendingApprovalPage.jsx:106` | `Button` | `primary` | `w-full` |
| /404 | `pages\common\NotFoundPage.jsx:34` | `Button` | `ghost` | — |
| /404 | `pages\common\NotFoundPage.jsx:64` | `Button` | `default` | `w-full sm:w-auto h-10 px-6 cursor-pointe...` |
| /404 | `pages\common\NotFoundPage.jsx:72` | `Button` | `outline` | `w-full sm:w-auto h-10 px-5 text-xs font-...` |
| /privacy | `pages\common\PrivacyPage.jsx:119` | `Button` | `secondary` | — |
| /settings | `pages\common\SettingsPage.jsx:170` | `Button` | `default` | `h-10 px-6 flex items-center gap-2 cursor...` |
| /faculty/exams/:id | `pages\faculty\ExamManagePage.jsx:88` | `Button` | `ghost` | `gap-1.5 text-xs font-[420] rounded-[40px...` |
| /faculty/exams/:id | `pages\faculty\ExamManagePage.jsx:104` | `Button` | `default` | `gap-1.5 h-9 px-4 cursor-pointer` |
| /faculty/exams/:id | `pages\faculty\ExamManagePage.jsx:186` | `Button` | `outline` | `gap-1.5 text-xs font-[420] rounded-[40px...` |
| /faculty/exams/:id | `pages\faculty\ExamManagePage.jsx:191` | `Button` | `outline` | `gap-1.5 text-xs font-[420] rounded-[40px...` |
| /faculty/exams/:id | `pages\faculty\ExamManagePage.jsx:257` | `Button` | `ghost` | — |
| /faculty/exams | `pages\faculty\FacultyExamsPage.jsx:115` | `Button` | `default` | — |
| /faculty/exams | `pages\faculty\FacultyExamsPage.jsx:205` | `Button` | `ghost` | — |
| /faculty/exams | `pages\faculty\FacultyExamsPage.jsx:215` | `Button` | `outline` | `h-8 text-xs gap-1 rounded-[40px] px-3 bg...` |
| /faculty/exams | `pages\faculty\FacultyExamsPage.jsx:301` | `Button` | `ghost` | — |
| /faculty/exams | `pages\faculty\FacultyExamsPage.jsx:309` | `Button` | `outline` | `h-8 text-xs gap-1 rounded-[40px] px-3 bg...` |
| /student/exams/:id/arena | `pages\student\ExamArenaPage.jsx:333` | `Button` | `primary` | — |
| /student/exams/:id/arena | `pages\student\ExamArenaPage.jsx:342` | `Button` | `primary` | — |
| /student/exams/:id/arena | `pages\student\ExamArenaPage.jsx:352` | `Button` | `outline` | — |
| /student/exams/:id/arena | `pages\student\ExamArenaPage.jsx:395` | `Button` | `ghost` | — |
| /student/exams/:id/arena | `pages\student\ExamArenaPage.jsx:416` | `Button` | `secondary` | — |
| /student/exams/:id/arena | `pages\student\ExamArenaPage.jsx:439` | `Button` | `ghost` | — |
| /student/exams/:id/arena | `pages\student\ExamArenaPage.jsx:462` | `Button` | `ghost` | — |
| /student/exams/:id/arena | `pages\student\ExamArenaPage.jsx:485` | `Button` | `ghost` | — |
| /student/exams/:id/arena | `pages\student\ExamArenaPage.jsx:541` | `Button` | `primary` | — |
| /student/exams/:id/arena | `pages\student\ExamArenaPage.jsx:612` | `Button` | `primary` | `w-full` |
| /student/exams/:id/precheck | `pages\student\PreExamCheckPage.jsx:419` | `Button` | `primary` | `w-full` |
| /student/exams/:id/precheck | `pages\student\PreExamCheckPage.jsx:446` | `Button` | `default` | — |
| /student/exams/:id/precheck | `pages\student\PreExamCheckPage.jsx:498` | `Button` | `outline` | `rounded-[40px] h-9 text-xs font-[420] bo...` |
| /student/exams/:id/precheck | `pages\student\PreExamCheckPage.jsx:523` | `Button` | `secondary` | `flex-1` |
| /student/exams/:id/precheck | `pages\student\PreExamCheckPage.jsx:532` | `Button` | `primary` | `flex-1` |
| /student/exams/:id/precheck | `pages\student\PreExamCheckPage.jsx:567` | `Button` | `secondary` | `w-full mt-2` |
| /student/exams/:id/precheck | `pages\student\PreExamCheckPage.jsx:617` | `Button` | `primary` | `w-full flex items-center justify-center ...` |
| /seb/handoff | `pages\student\SebHandoffPage.jsx:175` | `Button` | `primary` | `w-full flex items-center justify-center gap-2` |
| /seb/handoff | `pages\student\SebHandoffPage.jsx:195` | `Button` | `ghost` | `text-xs text-[#554e7b]` |
| /seb/required | `pages\student\SebRequiredPage.jsx:90` | `Button` | `default` | `w-full h-10 gap-2 cursor-pointer` |
| /seb/required | `pages\student\SebRequiredPage.jsx:100` | `Button` | `default` | `w-full h-10 gap-2 cursor-pointer` |
| /seb/required | `pages\student\SebRequiredPage.jsx:110` | `Button` | `ghost` | `w-full h-9 gap-1.5 cursor-pointer` |
| /seb/required | `pages\student\SebRequiredPage.jsx:142` | `Button` | `ghost` | `text-xs font-[420] text-[#554e7b] hover:...` |
| /student/dashboard | `pages\student\StudentDashboardPage.jsx:188` | `Button` | `secondary` | `shrink-0` |
| /student/dashboard | `pages\student\StudentDashboardPage.jsx:257` | `Button` | `secondary` | `w-full` |
| /student/dashboard | `pages\student\StudentDashboardPage.jsx:263` | `Button` | `secondary` | `w-full opacity-70` |
| /student/dashboard | `pages\student\StudentDashboardPage.jsx:267` | `Button` | `primary` | `w-full` |
| /student/exams/:id/start | `pages\student\StudentExamStartPage.jsx:415` | `Button` | `default` | — |
| /student/exams/:id/start | `pages\student\StudentExamStartPage.jsx:463` | `Button` | `primary` | — |
| /student/exams/:id/start | `pages\student\StudentExamStartPage.jsx:477` | `Button` | `primary` | — |
| /student/exams/:id/start | `pages\student\StudentExamStartPage.jsx:488` | `Button` | `secondary` | `w-full opacity-80` |
| /student/exams/:id/start | `pages\student\StudentExamStartPage.jsx:502` | `Button` | `primary` | `w-full flex items-center justify-center ...` |
| /student/exams/:id/start | `pages\student\StudentExamStartPage.jsx:637` | `Button` | `secondary` | `inline-flex items-center gap-1.5` |
| /student/exams/:id/start | `pages\student\StudentExamStartPage.jsx:660` | `Button` | `secondary` | — |
| /student/exams/:id/start | `pages\student\StudentExamStartPage.jsx:708` | `Button` | `secondary` | `w-full flex items-center justify-center ...` |
| /student/exams/:id/start | `pages\student\StudentExamStartPage.jsx:804` | `Button` | `secondary` | — |
| /student/exams/:id/start | `pages\student\StudentExamStartPage.jsx:821` | `Button` | `secondary` | — |
| /student/exams/:id/start | `pages\student\StudentExamStartPage.jsx:846` | `Button` | `primary` | — |
| /student/exams/:id/start | `pages\student\StudentExamStartPage.jsx:854` | `Button` | `secondary` | `w-full opacity-80` |
| /student/exams/:id/start | `pages\student\StudentExamStartPage.jsx:864` | `Button` | `primary` | `w-full flex items-center justify-center ...` |
| /student/exams/:id/start | `pages\student\StudentExamStartPage.jsx:891` | `Button` | `primary` | `w-full flex items-center justify-center ...` |
| /student/secure-browser | `pages\student\StudentSebCheckPage.jsx:195` | `Button` | `secondary` | `gap-2` |
| /student/secure-browser | `pages\student\StudentSebCheckPage.jsx:354` | `Button` | `ghost` | — |
| /student/secure-browser | `pages\student\StudentSebCheckPage.jsx:376` | `Button` | `ghost` | — |
| /student/secure-browser | `pages\student\StudentSebCheckPage.jsx:398` | `Button` | `ghost` | — |
| /student/secure-browser | `pages\student\StudentSebCheckPage.jsx:441` | `Button` | `primary` | `gap-2 shrink-0` |
