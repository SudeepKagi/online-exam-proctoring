---
name: web-design-guidelines
description: Vercel Web Interface Guidelines for forms, inputs, focus states, labels, and async button feedback.
---

# Vercel Web Interface Guidelines

This skill enforces interaction standards, accessibility affordances, and form behaviors across all ProctorNet views.

## 1. Input & Form Affordances
- **Explicit Labels:** Every input, textarea, and select element must have an associated `<Label htmlFor="inputId">` element. Never rely solely on placeholder text for labeling.
- **Leading Contextual Icons:** Place relevant Lucide icons inside inputs (e.g., `Mail`, `Lock`, `User`, `Search`, `Building`) to give instant cognitive anchors.
- **Realistic Placeholders:** Use domain-specific placeholders (e.g., `alex@university.edu`, `1RV21CS042`, `CS301 — Distributed Systems`), never generic `"Enter text"`.
- **Autocomplete Attributes:** Inputs must provide correct HTML autocomplete tags (`email`, `current-password`, `new-password`, `tel`, `name`, `username`).
- **Focus Rings:** Ensure high-visibility focus states: `focus-visible:ring-2 focus-visible:ring-blue-600/25 focus-visible:border-blue-600 outline-none`.

## 2. Password Field Standards
- Every password field MUST be paired with an accessible show/hide password toggle button (`aria-label="Toggle password visibility"`).
- Keyboard accessible: toggling visibility does not lose input focus.

## 3. Asynchronous Button States
- When a form submission or async mutation begins:
  - Display an animated spinner (`<Loader2 className="w-4 h-4 animate-spin" />`).
  - Set `disabled={isSubmitting}` to prevent duplicate mutations.
  - Retain button width or size to avoid layout jitter during the loading transition.
