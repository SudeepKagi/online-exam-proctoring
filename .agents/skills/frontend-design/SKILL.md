---
name: frontend-design
description: Anthropic Frontend Design standard for institutional software, typography, atmosphere, and spatial layout.
---

# Anthropic Frontend Design Standard

This skill establishes the visual craft, aesthetic atmosphere, typography, and layout rules for ProctorNet.

## 1. Typography Directives
- **Zero Generic AI Fonts:** Never default to generic AI fonts (`Inter`, `Roboto`, `Arial`, `Space Grotesk`).
- **Standard Typeface Triad:**
  1. **`Plus Jakarta Sans`**: Used for Display & Headings (`h1`–`h4`), title banners, and prominent modal headings (weights 600–800).
  2. **`DM Sans`**: Used for Refined Interface & Body typography, descriptions, button copy, dialogs, and labels (weights 400–600).
  3. **`JetBrains Mono`**: Used for institutional metrics, exam timers, roll numbers/USNs, exam PINs, and scores.

## 2. Color Atmosphere & Elevation
- **Layered Slate Foundation:**
  - Base canvas: `#F8FAFC` (`bg-slate-50`).
  - Elevated surfaces: `#FFFFFF` (`bg-white`) bordered with `1px solid rgba(226, 232, 240, 0.9)`.
  - Sidebar: `#0F172A` (`bg-slate-900`) for high-contrast command navigation.
- **Accents & Radiance:**
  - Royal Blue `#2563EB` as the primary interactive hue.
  - Subtle radial gradient highlights on landing and authentication headers to evoke depth and institutional gravity without distracting from core tasks.

## 3. Spatial Composition
- **Breathing Room:** Never cram components. Use generous container padding (`p-6` on mobile, `lg:p-8` on desktop).
- **Harmonious Grid Gaps:** Standardize grid and flex layouts with `gap-6` or `gap-4`.
- **Card Content Scannability:** Ensure headers, bodies, and footers inside cards have clear visual demarcation with soft borders (`border-b border-slate-100`).
