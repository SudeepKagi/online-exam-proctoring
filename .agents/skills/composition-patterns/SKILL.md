---
name: composition-patterns
description: Vercel Composition Patterns for modular component architectures, compound components, and file size governance.
---

# Vercel Composition Patterns

This skill establishes patterns to maintain maintainable, modular components and adhere strictly to the 250-line rule.

## 1. Compound Component Primitives
Avoid boolean prop sprawl (e.g., `<Input isPassword={true} isEmail={false} withIcon={true} showStrength={true} />`).
Instead, compose specialized compound primitives:
- `<PasswordInput />`: Self-contained with lock icon, eye toggle, and strength indicator.
- `<FormField />`: Self-contained wrapper for Label, Input, description, and error message.
- `<PhotoUploadCard />`: Encapsulated camera capture or file drop zone with zoom and preview.
- `<StatCard />`: Standardized KPI tile with title, metric, icon, and trend badge.

## 2. File Size Governance (Strict <= 250 Lines)
- Every `.js` and `.jsx` file MUST remain strictly `<= 250 lines`.
- When a page component grows near 200 lines, extract:
  - Modals and Dialogs into `@/components/<domain>/<Action>Modal.jsx`
  - Complex Tab panels into `@/components/<domain>/<Domain>Tab.jsx`
  - Tables into `@/components/<domain>/<Domain>Table.jsx`
- This ensures clean single-responsibility components and effortless unit testability.
