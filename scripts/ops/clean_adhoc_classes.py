import os

repo_root = r'c:\Final year project\online-exam-proctoring'
frontend_dir = os.path.join(repo_root, 'frontend', 'src')

def replace_in_file(rel_path, replacements):
    full_path = os.path.join(frontend_dir, rel_path)
    if not os.path.exists(full_path):
        print(f"File not found: {full_path}")
        return False
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()

    orig = content
    for old, new in replacements:
        if old not in content:
            print(f"Target not found in {rel_path}:\n{old[:80]}...")
            return False
        content = content.replace(old, new)

    with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {rel_path}")
    return True

# 1. DashboardShell.jsx
replace_in_file('components/common/DashboardShell.jsx', [
    (
        'className="text-[#554e7b] hover:text-[#28253b] hover:bg-[#edecfb]/60 gap-1.5 h-8 rounded-full cursor-pointer transition-colors"',
        'className="gap-1.5 h-8 rounded-full cursor-pointer transition-colors"'
    )
])

# 2. ExamArenaHeader.jsx
replace_in_file('components/exam/ExamArenaHeader.jsx', [
    (
        'className="bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-[32px] px-4 h-8 cursor-pointer"',
        'className="px-4 h-8 cursor-pointer"'
    )
])

# 3. ProctoringInterruptedOverlay.jsx
replace_in_file('components/exam/ProctoringInterruptedOverlay.jsx', [
    (
        'className="bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-[32px] px-6 h-10 shadow-xs cursor-pointer"',
        'className="px-6 h-10 cursor-pointer"'
    )
])

# 4. SubmitExamDialog.jsx
replace_in_file('components/exam/SubmitExamDialog.jsx', [
    (
        'className="bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] px-6 cursor-pointer"',
        'className="h-10 px-6 cursor-pointer"'
    ),
    (
        'className={onTakeOver\n              ? "bg-[#edecfb] hover:bg-[#e2e0f9] text-[#28253b] text-xs font-[420] h-10 rounded-[40px] px-6 cursor-pointer"\n              : "bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] px-6 cursor-pointer"\n            }',
        'variant={onTakeOver ? "secondary" : "primary"}\n            className="h-10 px-6 cursor-pointer"'
    )
])

# 5. ExamAiModal.jsx
replace_in_file('components/faculty/ExamAiModal.jsx', [
    (
        'className="w-full h-10 bg-[#5266eb] hover:bg-[#4353c7] text-white font-[420] text-xs rounded-[32px] shadow-xs flex items-center justify-center gap-2 cursor-pointer"',
        'className="w-full h-10 flex items-center justify-center gap-2 cursor-pointer"'
    ),
    (
        'className="bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-[32px] px-4 h-9 shadow-xs flex items-center gap-1.5 cursor-pointer"',
        'className="px-4 h-9 flex items-center gap-1.5 cursor-pointer"'
    )
])

# 6. ExamCredentialsModal.jsx
replace_in_file('components/faculty/ExamCredentialsModal.jsx', [
    (
        'className="text-xs font-[420] rounded-[40px] px-3.5 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-0"',
        'variant="secondary"\n            className="text-xs px-3.5"'
    ),
    (
        'className="text-xs font-[420] rounded-[32px] px-4 h-9 bg-[#5266eb] hover:bg-[#4353c7] text-white shadow-xs cursor-pointer gap-1.5"',
        'className="px-4 h-9 cursor-pointer gap-1.5"'
    )
])

# 7. ExamSettingsModal.jsx
replace_in_file('components/faculty/ExamSettingsModal.jsx', [
    (
        'className="text-xs text-[#554e7b] hover:text-[#28253b] hover:bg-[#edecfb] gap-1 rounded-[40px] px-3 cursor-pointer border-0"',
        'className="gap-1 px-3 cursor-pointer"'
    ),
    (
        'className="bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-9 px-4 rounded-[32px] shadow-xs ml-auto flex items-center gap-1.5 cursor-pointer"',
        'className="h-9 px-4 ml-auto flex items-center gap-1.5 cursor-pointer"'
    )
])

# 8. ExamViolationsTab.jsx
replace_in_file('components/faculty/ExamViolationsTab.jsx', [
    (
        'className="h-8 px-4 rounded-[32px] bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] border-0"',
        'className="h-8 px-4"'
    )
])

# 9. ExamWizardStepAIReview.jsx
replace_in_file('components/faculty/ExamWizardStepAIReview.jsx', [
    (
        'className="h-7 px-3 text-[11px] rounded-full bg-white text-[#5266eb] border-[#e9eaf2] hover:bg-[#fbfbff]"',
        'className="h-7 px-3 text-[11px] rounded-full"'
    ),
    (
        'className="h-7 text-xs rounded-full bg-[#5266eb] text-white hover:bg-[#4353c7]"',
        'className="h-7 text-xs rounded-full"'
    )
])

# 10. ExamWizardStepUpload.jsx
replace_in_file('components/faculty/ExamWizardStepUpload.jsx', [
    (
        'className="h-7 text-xs rounded-full px-3 bg-white text-[#5266eb] border-[#e9eaf2] hover:bg-[#edecfb]"',
        'className="h-7 text-xs rounded-full px-3"'
    ),
    (
        'className="h-9 px-6 rounded-full text-xs font-[420] bg-[#5266eb] text-white hover:bg-[#4353c7]"',
        'className="h-9 px-6 rounded-full text-xs"'
    ),
    (
        'variant="outline"\n                  size="sm"\n                  onClick={handleCancelJob}\n                  className="h-8 px-4 rounded-full text-xs text-red-600 border-red-200 hover:bg-red-50"',
        'variant="destructive"\n                  size="sm"\n                  onClick={handleCancelJob}\n                  className="h-8 px-4 rounded-full text-xs"'
    ),
    (
        'className="h-7 px-3 text-xs rounded-full bg-white text-[#5266eb] border-[#e9eaf2] hover:bg-[#edecfb]"',
        'className="h-7 px-3 text-xs rounded-full"'
    ),
    (
        'className="text-xs text-[#554e7b] hover:text-[#28253b] hover:bg-[#edecfb]/60 rounded-full h-8 px-4"',
        'className="text-xs rounded-full h-8 px-4"'
    )
])

# 11. IncidentReviewModal.jsx
replace_in_file('components/faculty/IncidentReviewModal.jsx', [
    (
        'className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-9 rounded-[32px] cursor-pointer"',
        'className="w-full h-9 cursor-pointer"'
    )
])

# 12. FacultyDetailsStep.jsx
replace_in_file('components/onboarding/FacultyDetailsStep.jsx', [
    (
        'className="h-10 px-5 bg-[#5266eb] hover:bg-[#4353c7] text-white font-[420] text-xs rounded-[32px] shadow-xs flex items-center gap-2 cursor-pointer"',
        'className="h-10 px-5 flex items-center gap-2 cursor-pointer"'
    )
])

# 13. IdCardUploadStep.jsx
replace_in_file('components/onboarding/IdCardUploadStep.jsx', [
    (
        'variant="outline"\n          disabled={uploading || submitting}\n          className="h-10 px-4 text-xs font-[420] rounded-[40px] bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-0 flex items-center gap-1.5 cursor-pointer"',
        'variant="secondary"\n          disabled={uploading || submitting}\n          className="h-10 px-4 flex items-center gap-1.5 cursor-pointer"'
    ),
    (
        'className="h-10 px-5 bg-[#5266eb] hover:bg-[#4353c7] text-white font-[420] text-xs rounded-[32px] shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"',
        'className="h-10 px-5 flex items-center gap-2 cursor-pointer disabled:opacity-50"'
    )
])

# 14. StudentAcademicStep.jsx
replace_in_file('components/onboarding/StudentAcademicStep.jsx', [
    (
        'className="h-10 px-5 bg-[#5266eb] hover:bg-[#4353c7] text-white font-[420] text-xs rounded-[32px] shadow-xs flex items-center gap-2 cursor-pointer"',
        'className="h-10 px-5 flex items-center gap-2 cursor-pointer"'
    )
])

# 15. WebcamCaptureStep.jsx
replace_in_file('components/onboarding/WebcamCaptureStep.jsx', [
    (
        'variant="outline"\n          disabled={uploading}\n          className="h-10 px-4 text-xs font-[420] rounded-[40px] bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-0 flex items-center gap-1.5 cursor-pointer"',
        'variant="secondary"\n          disabled={uploading}\n          className="h-10 px-4 flex items-center gap-1.5 cursor-pointer"'
    ),
    (
        'className="h-10 px-5 bg-[#5266eb] hover:bg-[#4353c7] text-white font-[420] text-xs rounded-[32px] shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"',
        'className="h-10 px-5 flex items-center gap-2 cursor-pointer disabled:opacity-50"'
    )
])

# 16. photo-upload-card.jsx
replace_in_file('components/ui/photo-upload-card.jsx', [
    (
        'variant="outline" size="sm" onClick={() => setZoomOpen(true)} className="h-9 text-xs gap-1.5 rounded-[40px] px-3.5 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-0 font-[420]"',
        'variant="secondary" size="sm" onClick={() => setZoomOpen(true)} className="h-9 text-xs gap-1.5 px-3.5"'
    ),
    (
        'variant="ghost" size="sm" onClick={handleRetake} disabled={disabled} className="h-9 text-xs text-[#554e7b] hover:text-[#28253b] hover:bg-[#edecfb] gap-1.5 rounded-[40px] px-3.5 border-0 font-[420]"',
        'variant="ghost" size="sm" onClick={handleRetake} disabled={disabled} className="h-9 text-xs gap-1.5 px-3.5"'
    ),
    (
        'className="w-full h-10 bg-[#5266eb] hover:bg-[#4353c7] text-white font-[420] text-xs rounded-[32px] gap-2 cursor-pointer shadow-xs"',
        'className="w-full h-10 gap-2 cursor-pointer"'
    )
])

# 17. AdminDashboardPage.jsx
replace_in_file('pages/admin/AdminDashboardPage.jsx', [
    (
        'className="h-7 text-xs bg-[#5266eb] hover:bg-[#4353c7] text-white rounded-[32px] px-3 font-[420]"',
        'className="h-7 text-xs px-3"'
    )
])

# 18. AdminExamsPage.jsx
replace_in_file('pages/admin/AdminExamsPage.jsx', [
    (
        'className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] cursor-pointer"',
        'className="w-full h-10 cursor-pointer"'
    )
])

# 19. LoginPage.jsx
replace_in_file('pages/auth/LoginPage.jsx', [
    (
        'className="w-full h-10 bg-[#5266eb] hover:bg-[#4354d0] text-white text-xs font-[420] rounded-[32px] shadow-xs cursor-pointer transition"',
        'className="w-full h-10 cursor-pointer transition"'
    )
])

# 20. NotFoundPage.jsx
replace_in_file('pages/common/NotFoundPage.jsx', [
    (
        'className="w-full sm:w-auto h-10 px-6 bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] rounded-[32px] shadow-xs cursor-pointer"',
        'className="w-full sm:w-auto h-10 px-6 cursor-pointer"'
    )
])

# 21. SettingsPage.jsx
replace_in_file('pages/common/SettingsPage.jsx', [
    (
        'className="bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 px-6 rounded-[32px] shadow-xs flex items-center gap-2 cursor-pointer"',
        'className="h-10 px-6 flex items-center gap-2 cursor-pointer"'
    )
])

# 22. ExamManagePage.jsx
replace_in_file('pages/faculty/ExamManagePage.jsx', [
    (
        'className="bg-[#5266eb] hover:bg-[#4353c7] text-white gap-1.5 text-xs font-[420] rounded-[32px] h-9 px-4 shadow-xs cursor-pointer"',
        'className="gap-1.5 h-9 px-4 cursor-pointer"'
    )
])

# 23. SebRequiredPage.jsx
replace_in_file('pages/student/SebRequiredPage.jsx', [
    (
        'className="w-full bg-[#5266eb] hover:bg-[#4353c7] text-white text-xs font-[420] h-10 rounded-[32px] gap-2 shadow-xs cursor-pointer"',
        'className="w-full h-10 gap-2 cursor-pointer"'
    ),
    (
        'variant="outline"\n              className={`w-full text-xs font-[420] h-10 rounded-[40px] gap-2 border-0 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] cursor-pointer ${\n                !configUrl ? \'bg-[#5266eb] hover:bg-[#4353c7] text-white\' : \'\'\n              }`}',
        'variant={configUrl ? "secondary" : "primary"}\n              className="w-full h-10 gap-2 cursor-pointer"'
    ),
    (
        'className="w-full text-xs font-[420] h-9 rounded-[40px] gap-1.5 text-[#554e7b] hover:text-[#28253b] hover:bg-[#edecfb] cursor-pointer border-0"',
        'className="w-full h-9 gap-1.5 cursor-pointer"'
    )
])

print("Finished ad-hoc class cleanup.")
