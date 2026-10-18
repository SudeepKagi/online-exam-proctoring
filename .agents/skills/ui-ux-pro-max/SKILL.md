---
name: ui-ux-pro-max
description: UI/UX Pro Max Design System Intelligence referencing .agents/design-system/MASTER.md tokens and semantic styling.
---

# UI/UX Pro Max Design System Intelligence

This skill integrates our design token intelligence with runtime UI development.

## 1. Single Source of Truth: `.agents/design-system/MASTER.md`
Before creating or modifying any visual component, read `.agents/design-system/MASTER.md` for exact tokens:
- **Role Badges:**
  - `ADMIN`: `bg-indigo-50 text-indigo-700 border-indigo-200`
  - `FACULTY`: `bg-blue-50 text-blue-700 border-blue-200`
  - `INVIGILATOR`: `bg-violet-50 text-violet-700 border-violet-200`
  - `STUDENT`: `bg-emerald-50 text-emerald-700 border-emerald-200`
- **Semantic Status Badges:**
  - `ACTIVE`: `bg-emerald-50 text-emerald-700 border-emerald-200`
  - `PENDING_APPROVAL` / `PENDING_SETUP`: `bg-amber-50 text-amber-700 border-amber-200`
  - `REJECTED` / `SUSPENDED`: `bg-rose-50 text-rose-700 border-rose-200`
- **Border Radii:**
  - Containers, Cards, Dialogs: `rounded-xl` (`rounded-2xl` for hero cards)
  - Inputs, Buttons, Dropdowns: `rounded-lg` or `rounded-xl`
