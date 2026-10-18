---
name: accesslint
description: AccessLint WCAG 2.1 AA Compliance standards for color contrast, screen reader labels, and keyboard navigability.
---

# AccessLint WCAG 2.1 AA Compliance

This skill enforces accessibility baselines so ProctorNet is fully usable by all candidates and educators.

## 1. Color Contrast Ratios
- **Body & Heading Text:** Minimum `4.5:1` contrast against light backgrounds. Use `text-slate-700`, `text-slate-800`, or `text-slate-900`. Never use low-contrast light grays (`text-slate-400` on white) for readable content.
- **Interactive UI Boundaries:** Minimum `3:1` contrast for borders and focus rings (`border-slate-300`, `border-slate-400`).

## 2. Accessible Icon Buttons & Labels
- Any `<Button>` or `<button>` that renders only an icon MUST provide an explicit `aria-label` (e.g., `aria-label="Toggle password visibility"` or `aria-label="Delete question"`).
- Dialogs, Drawers, and Sheets must have an associated `<DialogTitle>` or `aria-labelledby`.

## 3. Keyboard Navigation
- All interactive controls must be focusable via `Tab` key.
- Focus indicators must remain clearly visible (`focus-visible:ring-2 focus-visible:ring-blue-600/25 focus-visible:border-blue-600`).
- Modals must trap focus and close gracefully on `Escape`.
