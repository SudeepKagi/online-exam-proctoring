---
name: enterprise-accessibility
description: Enforces WCAG 2.2 AA accessibility standards across the platform, including keyboard navigation flow, visible focus indicators (:focus-visible), focus trapping in modals, ARIA live announcements, form labels and accessible names, color independence, and automated axe-core audits. Trigger when building or auditing interactive UI components, forms, dialogs, timers, or accessible flows.
---

# Enterprise Accessibility Standard (WCAG 2.2 AA)

This skill codifies the accessibility standards for ProctorNet, ensuring full compliance with WCAG 2.2 Level AA across student, instructor, and administrative interfaces.

**Official Sources & Standards:**
- W3C Web Content Accessibility Guidelines (WCAG) 2.2 Level AA Standard
- W3C WAI-ARIA Authoring Practices Guide (APG)
- Deque Systems axe-core Accessibility Engine
- Date of Authorship: 2026-11-22

---

## 1. Keyboard Navigation & Focus Rings

1. **Logical Tab Sequence:**
   - Every interactive control must be reachable via `Tab` / `Shift+Tab` in an order matching visual reading flow.
   - Radio groups and question selectors must support keyboard arrow navigation (`ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`).
2. **Visible Focus Rings (`:focus-visible`):**
   - All interactive controls must show a clear, high-contrast focus indicator:
     `outline: 2px solid #5266eb; outline-offset: 2px;`
   - NEVER use `outline: none` or `outline: 0` without providing an explicit `:focus-visible` replacement.

---

## 2. Modal Focus Trapping & Restoration

- **Focus Trapping:** When a modal or dialog opens, keyboard focus must move immediately into the dialog's first actionable element and cycle strictly within the dialog.
- **Escape Dismissal:** Pressing `Escape` must close non-blocking dialogs.
- **Focus Restoration:** Upon closing, focus must return immediately to the triggering button.

---

## 3. ARIA Live Announcements

Use `aria-live` regions to announce asynchronous changes to screen readers:
- **`aria-live="polite"`:** For routine updates:
  - Timer milestone warnings ("15 minutes remaining", "5 minutes remaining", "1 minute remaining").
  - Autosave status ("Answer saved").
- **`aria-live="assertive"`:** For urgent, blocking notices:
  - Network disconnection alerts.
  - Final exam submission countdowns.

---

## 4. Form Labels, Accessible Names & Color Independence

- **Form Labels:** Every `<input>`, `<select>`, and `<textarea>` must have an explicit `<label htmlFor="...">` or `aria-label`.
- **Icon-Only Buttons:** Buttons containing only icons must have a meaningful `aria-label` (e.g. `aria-label="Flag question for review"`).
- **Color Independence:** Never convey status (success, error, warning) purely by color. Always pair color with text labels, badges, or descriptive icons.

---

## 5. Implementation Checklist

- [ ] Interactive elements fully navigable via keyboard (`Tab`, `Space`, `Enter`).
- [ ] Focus rings use `2px solid #5266eb` with `2px` offset on `:focus-visible`.
- [ ] Modals trap focus and return focus to trigger on close.
- [ ] Timer milestones announced via `aria-live="polite"`.
- [ ] All inputs and icon buttons have accessible names.
- [ ] Color is never the sole indicator of status or validity.
- [ ] Headings follow logical `h1` $\rightarrow$ `h2` $\rightarrow$ `h3` hierarchy without skipping levels.

---

## 6. Common Failures

- **Invisible focus:** Suppressing `outline: none` without replacement, making keyboard navigation impossible.
- **Unlabelled buttons:** Icon buttons rendered without `aria-label` or inner text.
- **Modal focus leakage:** Allowing keyboard focus to navigate behind an active dialog.
- **Silent timer expiry:** Allowing time to expire without an accessible screen-reader announcement.

---

## 7. Verification Commands

```bash
# Verify component syntax and JSX a11y rules
npm run lint

# Run automated axe accessibility checks in Playwright
npx playwright test e2e/a11y.spec.ts
```
