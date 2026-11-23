import os
import re
import glob

def analyze_buttons():
    repo_root = r'c:\Final year project\online-exam-proctoring'
    frontend_dir = os.path.join(repo_root, 'frontend', 'src')
    files = sorted(glob.glob(os.path.join(frontend_dir, '**', '*.jsx'), recursive=True))

    route_map = {
        'LandingPage.jsx': '/',
        'AdminDashboardPage.jsx': '/admin/dashboard',
        'AdminExamsPage.jsx': '/admin/exams',
        'AdminSebConfigPage.jsx': '/admin/seb',
        'AdminUsersPage.jsx': '/admin/users',
        'ForgotPasswordPage.jsx': '/forgot-password',
        'LoginPage.jsx': '/login',
        'OnboardingPage.jsx': '/onboarding',
        'PendingApprovalPage.jsx': '/pending-approval',
        'NotFoundPage.jsx': '/404',
        'PrivacyPage.jsx': '/privacy',
        'SettingsPage.jsx': '/settings',
        'ExamManagePage.jsx': '/faculty/exams/:id',
        'FacultyExamsPage.jsx': '/faculty/exams',
        'LiveConsolePage.jsx': '/invigilator/live/:id',
        'ExamArenaPage.jsx': '/student/exams/:id/arena',
        'PreExamCheckPage.jsx': '/student/exams/:id/precheck',
        'SebHandoffPage.jsx': '/seb/handoff',
        'SebRequiredPage.jsx': '/seb/required',
        'StudentDashboardPage.jsx': '/student/dashboard',
        'StudentExamStartPage.jsx': '/student/exams/:id/start',
        'StudentSebCheckPage.jsx': '/student/secure-browser',
    }

    inventory = []
    defects = []

    for f in files:
        rel = os.path.relpath(f, frontend_dir)
        filename = os.path.basename(f)
        route = route_map.get(filename, f'Component ({rel})')
        with open(f, 'r', encoding='utf-8') as fp:
            content = fp.read()

        lines = content.split('\n')
        i = 0
        while i < len(lines):
            line = lines[i]
            btn_match = re.search(r'<(Button|button)\b', line)
            link_btn_match = re.search(r'<(Link|a)\b[^>]*buttonVariants', line)

            if btn_match or link_btn_match:
                start_line = i + 1
                tag = 'Link(buttonVariants)' if link_btn_match else btn_match.group(1)

                full_tag = line
                j = i
                while '>' not in full_tag and j < len(lines) - 1:
                    j += 1
                    full_tag += ' ' + lines[j]

                # extract variant
                var_m = re.search(r'variant=["\']([^"\']+)["\']', full_tag)
                variant = var_m.group(1) if var_m else ('default' if tag == 'Button' else 'raw/unstyled')

                # extract className
                cls_m = re.search(r'className=["\']([^"\']+)["\']', full_tag)
                classes = cls_m.group(1) if cls_m else ''

                # check for defects
                item_defects = []
                if tag == 'button':
                    item_defects.append('Raw <button> used instead of design system <Button>')
                
                # Check for color overrides on Button
                if tag == 'Button':
                    if re.search(r'\bbg-(red|blue|green|emerald|indigo|slate|gray|yellow|purple)-\d+', classes):
                        item_defects.append(f'Ad-hoc Tailwind color class override: {classes}')
                    if re.search(r'\bbg-\[#[0-9a-fA-F]+\]', classes):
                        item_defects.append(f'Ad-hoc inline hex background: {classes}')
                    if re.search(r'\btext-(white|black|red|green|blue|gray)-\d+', classes):
                        item_defects.append(f'Ad-hoc text color override: {classes}')

                # Check for white text on light backgrounds
                if 'text-white' in classes and ('bg-white' in classes or 'bg-[#ffffff]' in classes or 'bg-[#edecfb]' in classes):
                    item_defects.append('Critical: White text on light background')

                # Check for disabled styling confusion
                if 'opacity-50' in classes and 'disabled' not in full_tag:
                    item_defects.append('Warning: Enabled button styled with opacity-50')

                item = {
                    'file': rel,
                    'line': start_line,
                    'route': route,
                    'tag': tag,
                    'variant': variant,
                    'classes': classes,
                    'defects': item_defects,
                    'snippet': line.strip()[:100]
                }
                inventory.append(item)
                if item_defects:
                    defects.append(item)
                i = j
            i += 1

    # Check for duplicate primaries per route/page
    primaries_by_route = {}
    for item in inventory:
        if item['variant'] in ('default', 'primary') and item['tag'] == 'Button':
            # Ignore dialogs/modals for simple page primary count or group them
            r = item['route']
            primaries_by_route.setdefault(r, []).append(item)

    duplicate_primaries = {r: items for r, items in primaries_by_route.items() if len(items) > 1 and not r.startswith('Component')}

    # Write docs/ui/BUTTON_INVENTORY.md
    out_path = os.path.join(repo_root, 'docs', 'ui', 'BUTTON_INVENTORY.md')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as fp:
        fp.write('# Button and Interactive Action Inventory\n\n')
        fp.write(f'Generated: 2026-11-17\n')
        fp.write(f'Total interactive button elements audited: **{len(inventory)}**\n')
        fp.write(f'Raw `<button>` elements to migrate: **{sum(1 for i in inventory if i["tag"] == "button")}**\n')
        fp.write(f'Elements with defects: **{len(defects)}**\n\n')

        fp.write('## 1. Summary of Identified Defects\n\n')
        if duplicate_primaries:
            fp.write('### Multiple Primary Buttons on Single Route Views\n')
            for r, items in duplicate_primaries.items():
                fp.write(f'- **Route `{r}`** has {len(items)} primary buttons:\n')
                for it in items:
                    fp.write(f'  - Line {it["line"]} in `{it["file"]}`: `{it["snippet"]}`\n')
            fp.write('\n')

        fp.write('### Ad-hoc Color Overrides & Raw `<button>` Usages\n')
        for d in defects:
            fp.write(f'- `{d["file"]}:{d["line"]}` ({d["tag"]}, variant="{d["variant"]}"): {", ".join(d["defects"])}\n')
            fp.write(f'  ```jsx\n  {d["snippet"]}\n  ```\n')

        fp.write('\n## 2. Complete Inventory by File\n\n')
        fp.write('| Route / Context | File:Line | Element | Variant | Classes / Styling |\n')
        fp.write('| :--- | :--- | :--- | :--- | :--- |\n')
        for item in inventory:
            cls = f'`{item["classes"][:40]}...`' if len(item['classes']) > 40 else (f'`{item["classes"]}`' if item['classes'] else '—')
            fp.write(f'| {item["route"]} | `{item["file"]}:{item["line"]}` | `{item["tag"]}` | `{item["variant"]}` | {cls} |\n')

    print(f'Inventory written to {out_path}')
    print(f'Total elements: {len(inventory)}')
    print(f'Raw buttons: {sum(1 for i in inventory if i["tag"] == "button")}')
    print(f'Defect count: {len(defects)}')
    print(f'Routes with multiple primaries: {list(duplicate_primaries.keys())}')

if __name__ == '__main__':
    analyze_buttons()
