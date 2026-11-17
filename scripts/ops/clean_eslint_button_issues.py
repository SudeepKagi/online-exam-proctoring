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

# 1. AdminApprovalsTab.jsx
replace_in_file('components/admin/AdminApprovalsTab.jsx', [
    (
        'className="h-8 px-4 text-xs bg-[#5266eb] hover:bg-[#4354d0] text-white font-[420] rounded-[32px] shadow-xs flex items-center gap-1.5 ml-auto cursor-pointer"',
        'className="h-8 px-4 text-xs flex items-center gap-1.5 ml-auto cursor-pointer"'
    )
])

# 2. UserTable.jsx
replace_in_file('components/admin/UserTable.jsx', [
    (
        'variant="outline"\n                          size="sm"\n                          onClick={() => onVerify?.(u)}\n                          className="h-7 px-3 text-xs font-[420] rounded-full text-[#28253b] hover:bg-[rgba(82,102,235,0.15)] border-0 bg-[rgba(82,102,235,0.08)] gap-1 cursor-pointer transition"',
        'variant="secondary"\n                          size="sm"\n                          onClick={() => onVerify?.(u)}\n                          className="h-7 px-3 text-xs gap-1 cursor-pointer transition"'
    ),
    (
        'className="h-7 px-2.5 text-xs font-[420] rounded-full cursor-pointer text-[#554e7b] hover:text-[#28253b] hover:bg-[#edecfb] border-0"',
        'className="h-7 px-2.5 text-xs rounded-full cursor-pointer"'
    )
])

# 3. QuestionCard.jsx
replace_in_file('components/exam/QuestionCard.jsx', [
    (
        'className="bg-[#5266eb] hover:bg-[#4353c7] text-white gap-1 text-xs font-[420] rounded-[32px] px-4 h-8 cursor-pointer disabled:opacity-40"',
        'className="gap-1 text-xs px-4 h-8 cursor-pointer disabled:opacity-40"'
    )
])

# 4. ExamViolationsTab.jsx
replace_in_file('components/faculty/ExamViolationsTab.jsx', [
    (
        'className="group relative w-16 h-10 p-0 rounded overflow-hidden bg-[#fbfbff] hover:opacity-90 transition"',
        'className="group relative w-16 h-10 p-0 rounded overflow-hidden hover:opacity-90 transition"'
    )
])

# 5. ExamWizardStepAIReview.jsx
replace_in_file('components/faculty/ExamWizardStepAIReview.jsx', [
    (
        'className="h-8 px-3.5 rounded-full bg-[#fbfbff] text-[#28253b] border-[#e9eaf2] hover:bg-[#edecfb]"',
        'className="h-8 px-3.5 rounded-full"'
    ),
    (
        'className="h-6 text-[11px] px-3 rounded-full bg-white text-[#5266eb] border-[#e9eaf2] hover:bg-[#fbfbff]"',
        'className="h-6 text-[11px] px-3 rounded-full"'
    )
])

# 6. ExamWizardStepUpload.jsx
replace_in_file('components/faculty/ExamWizardStepUpload.jsx', [
    (
        'className="h-9 px-4 rounded-full text-xs text-[#554e7b] border-[#e9eaf2] hover:bg-[#edecfb]"',
        'className="h-9 px-4 rounded-full text-xs"'
    )
])

# 7. IncidentReviewModal.jsx
replace_in_file('components/faculty/IncidentReviewModal.jsx', [
    (
        'className="text-[11px] font-[420] text-[#5266eb] hover:bg-[#edecfb] rounded-[20px] h-7 px-2"',
        'className="text-[11px] h-7 px-2"'
    )
])

# 8. CandidateAuditSheet.jsx
replace_in_file('components/invigilator/CandidateAuditSheet.jsx', [
    (
        'className="h-8 text-xs font-[420] rounded-[32px] bg-[#5266eb] hover:bg-[#4353c7] text-white border-0"',
        'className="h-8 text-xs font-[420]"'
    ),
    (
        'className="h-8 text-xs font-[420] rounded-[32px] bg-[rgba(82,102,235,0.08)] text-[#28253b] border-0"',
        'variant="secondary"\n                      className="h-8 text-xs font-[420]"'
    ),
    (
        'variant="outline"\n              className={`w-full text-xs h-9 rounded-[32px] font-[420] border-0 ${\n                isFinalized\n                  ? \'bg-[#f4f4f7] text-[#70707d] cursor-not-allowed\'\n                  : candidate.attemptStatus === \'SUSPENDED\'\n                  ? \'bg-[#5266eb] text-white hover:bg-[#4353c7]\'\n                  : \'bg-[rgba(82,102,235,0.08)] text-[#28253b] hover:bg-[rgba(82,102,235,0.14)]\'\n              }`}',
        'variant={candidate.attemptStatus === \'SUSPENDED\' ? \'primary\' : \'secondary\'}\n              className="w-full text-xs h-9 font-[420]"'
    ),
    (
        'className="w-full text-xs h-9 rounded-[32px] bg-[#28253b] hover:bg-[#1f1d2e] text-white border-0 font-[420] shadow-xs cursor-pointer"',
        'variant="destructive"\n                className="w-full text-xs h-9 font-[420] cursor-pointer"'
    )
])

# 9. command-palette.jsx
replace_in_file('components/ui/command-palette.jsx', [
    (
        'className="w-full flex items-center justify-between px-3.5 py-2.5 h-auto text-xs font-[480] rounded-xl text-foreground hover:bg-[#eff6ff] hover:text-primary transition-colors"',
        'className="w-full flex items-center justify-between px-3.5 py-2.5 h-auto text-xs font-[420] rounded-xl text-foreground transition-colors"'
    )
])

# 10. confirm-dialog.jsx
replace_in_file('components/ui/confirm-dialog.jsx', [
    (
        'variant="ghost"\n            onClick={() => onOpenChange(false)}\n            disabled={loading}\n            className="text-xs font-[420] rounded-[40px] px-3.5 bg-[rgba(82,102,235,0.08)] hover:bg-[rgba(82,102,235,0.15)] text-[#28253b] border-0"',
        'variant="secondary"\n            onClick={() => onOpenChange(false)}\n            disabled={loading}\n            className="text-xs px-3.5"'
    ),
    (
        'className="text-xs font-[420] rounded-[32px] px-4 h-9 bg-[#5266eb] hover:bg-[#4353c7] text-white shadow-xs cursor-pointer"',
        'className="text-xs px-4 h-9 cursor-pointer"'
    )
])

# 11. AdminSebConfigPage.jsx
replace_in_file('pages/admin/AdminSebConfigPage.jsx', [
    (
        'variant="outline"\n                    onClick={() => copyToClipboard(startUrl, \'startUrl\')}\n                    className="h-7 px-2.5 text-[11px] rounded-full text-[#5266eb] hover:bg-[#edecfb] cursor-pointer shrink-0 border-0"',
        'variant="ghost"\n                    onClick={() => copyToClipboard(startUrl, \'startUrl\')}\n                    className="h-7 px-2.5 text-[11px] rounded-full cursor-pointer shrink-0"'
    ),
    (
        'variant="outline"\n                    onClick={() => copyToClipboard(quitUrl, \'quitUrl\')}\n                    className="h-7 px-2.5 text-[11px] rounded-full text-[#5266eb] hover:bg-[#edecfb] cursor-pointer shrink-0 border-0"',
        'variant="ghost"\n                    onClick={() => copyToClipboard(quitUrl, \'quitUrl\')}\n                    className="h-7 px-2.5 text-[11px] rounded-full cursor-pointer shrink-0"'
    ),
    (
        'variant="outline"\n                    onClick={() => copyToClipboard(testPin, \'testPin\')}\n                    className="h-7 px-2.5 text-[11px] rounded-full text-[#5266eb] hover:bg-[#edecfb] border-0 cursor-pointer shrink-0"',
        'variant="ghost"\n                    onClick={() => copyToClipboard(testPin, \'testPin\')}\n                    className="h-7 px-2.5 text-[11px] rounded-full cursor-pointer shrink-0"'
    )
])

# 12. ExamManagePage.jsx
replace_in_file('pages/faculty/ExamManagePage.jsx', [
    (
        'className="text-xs font-[420] text-[#5266eb] hover:bg-[#edecfb] rounded-[32px] h-8 px-3 cursor-pointer"',
        'className="text-xs h-8 px-3 cursor-pointer"'
    )
])

# 13. FacultyExamsPage.jsx
replace_in_file('pages/faculty/FacultyExamsPage.jsx', [
    (
        'className="bg-[#5266eb] hover:bg-[#4353c7] text-white gap-1.5 text-xs font-[420] rounded-[32px] px-5 h-10 shadow-xs cursor-pointer"',
        'className="gap-1.5 text-xs px-5 h-10 cursor-pointer"'
    )
])

print("Finished fixing ESLint button issues.")
