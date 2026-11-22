# WCAG 2.2 AA Audit Matrix for ProctorNet

This matrix maps core user flows to relevant WCAG 2.2 AA success criteria and validation checks.

| WCAG Criteria | Requirement | Implementation in ProctorNet | Validation Tool |
| :--- | :--- | :--- | :--- |
| **1.3.1 Info and Relationships** | Semantic structure | Proper semantic tags (`<header>`, `<main>`, `<nav>`, `<fieldset>`, `<legend>`). | axe-core / Playwright |
| **1.4.3 Contrast (Minimum)** | $\ge 4.5:1$ text contrast | Primary text `#28253b` on canvas `#fbfcfd` provides $> 11:1$ contrast. | Lighthouse / axe-core |
| **2.1.1 Keyboard** | Full keyboard access | Tab sequence covers all controls; arrow keys navigate options. | Manual Tab audit |
| **2.4.3 Focus Order** | Meaningful tab order | DOM order matches visual layout flow across all views. | Playwright trace |
| **2.4.7 Focus Visible** | Clear focus indicator | `outline: 2px solid #5266eb; outline-offset: 2px` on `:focus-visible`. | Visual inspection |
| **2.5.8 Target Size (Minimum)** | $\ge 24 \times 24$px (44px enterprise) | Buttons, options, and icons maintain $\ge 44 \times 44$px clickable bounds. | `responsive-audit.spec.ts` |
| **4.1.3 Status Messages** | Dynamic announcements | `aria-live` containers for timer countdown warnings and autosave status. | NVDA / VoiceOver check |
