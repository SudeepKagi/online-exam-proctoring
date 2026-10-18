---
name: bencium-ux-designer
description: Bencium UX & Form Ergonomics for progressive feedback, live password strength meters, and image previews.
---

# Bencium UX & Form Ergonomics

This skill focuses on human-centered interaction details, instant visual feedback, and frictionless form completion.

## 1. Live Password Strength Analysis
- In onboarding, setup, and password change flows:
  - Provide a dynamic 4-segment strength meter (Length, Number, Mixed Case, Special Character).
  - Categorize feedback into: `Weak` (rose), `Fair` (amber), `Good` (blue), `Strong` (emerald).
  - Provide instant guidance rather than surprising users after submission.

## 2. Immediate Media Previews
- When a user selects a file or snaps a webcam snapshot:
  - Instantly generate and display a high-resolution preview with object-fit containment.
  - Provide a 1-click `"Retake Photo"` or `"Replace Document"` button.
  - Never require the user to submit the form before seeing what they uploaded.

## 3. Empty State Hospitality
- Tables and lists must never display blank void panels.
- Display a hospitable empty state with an illustrative icon, bold heading, concise explanation, and a primary action trigger (e.g., `"+ Create First Exam"`).
