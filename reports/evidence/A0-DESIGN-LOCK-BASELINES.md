# Design Lock Baseline — Student Pre-Exam & Device Security Interfaces

> **Protocol Reference (§0.7, Prompt 2 §4):** Preserves visual aesthetics, dark/light theme tokens, layout density, and services-only wording during agent enhancements.

---

## 1. Scope of Interfaces Subject to Design Lock

1. **`BYODDeviceCheck.jsx`** (`/student/device-check` and `/student/device-check/:examId`)
2. **`SecurityCheck.jsx`** (`/student/exams/:examId/security`)
3. **`ExamInterface.jsx`** (`/student/exams/:examId/exam`)

---

## 2. Design Tokens & Styling Principles

### Typography & Spacing
- **Font Stack**: Satoshi / Inter sans-serif for UI copy, standard monospace for system telemetry, ports, and codes (`font-mono`).
- **Headings**: `text-sm font-bold text-[#0f172a]` (Light) / `text-xs font-bold text-foreground uppercase tracking-wider font-mono` (Dark/Slate).
- **Subtitles**: `text-[11px] text-[#64748b]` / `text-xs text-muted-foreground`.
- **Card Padding**: High-density 20px padding (`p-5` / `p-4.5`).

### Color Palette & Visual Accents
- **Card Backgrounds**:
  - Light mode: `bg-white border border-[#e2e8f0] rounded-2xl shadow-xs`
  - Dark mode: `bg-card border border-border rounded-2xl`
- **Icon Enclosures**:
  - Container: `w-8 h-8 rounded-xl flex items-center justify-center`
  - Active Blue: `bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe]` / `bg-primary/10 text-primary`
  - Success Green: `bg-[#ecfdf5] text-[#10b981] border border-[#a7f3d0]` / `bg-emerald-500/10 text-emerald-500`
  - Warning Red: `bg-[#fef2f2] text-[#ef4444] border border-[#fecaca]` / `bg-rose-500/10 text-rose-500`

### Status Badges
- **Connected**: `px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ecfdf5] text-[#10b981] border border-[#a7f3d0]`
- **Offline / Degraded**: `px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fef2f2] text-[#ef4444] border border-[#fecaca]`
- **Browser Guard**: `px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe]`

---

## 3. DOM Structural Hierarchies

### A. Device Diagnostics (`BYODDeviceCheck.jsx`)
```html
<Card class="bg-white border border-[#e2e8f0] rounded-2xl p-5">
  <Header class="flex items-center justify-between mb-3">
    <IconBadge class="w-8 h-8 rounded-xl bg-[#eff6ff] text-[#2563eb]" />
    <TitleWrapper>
      <Title class="text-sm font-bold text-[#0f172a]">Process & Security Environment</Title>
      <Subtitle class="text-[11px] text-[#64748b]">Banned remote software & virtual drivers check</Subtitle>
    </TitleWrapper>
    <StatusBadge class="rounded-full text-[10px] font-bold">AGENT CONNECTED | BROWSER GUARD</StatusBadge>
  </Header>
  <Content class="space-y-2.5 my-3.5">
    <!-- Findings list or clean integrity banner -->
    <!-- System specs grid (2 columns) -->
  </Content>
  <ActionFooter>
    <Button class="w-full text-xs font-semibold h-9">Run Security Scan</Button>
  </ActionFooter>
</Card>
```

### B. Pre-Exam Staged Security Gate (`SecurityCheck.jsx`)
```html
<StageContainer class="rounded-2xl border p-4.5">
  <StageHeader class="flex items-start justify-between">
    <StageIndicator class="w-9 h-9 rounded-xl">Cpu Icon</StageIndicator>
    <StageTitle class="text-xs font-bold uppercase font-mono">
      1. ProctorNet Exam Device Companion
      <Badge class="text-[10px]">CONNECTED | OFFLINE</Badge>
    </StageTitle>
  </StageHeader>
  <!-- Stage conditional feedback: Not running notice / Blocked apps / Clean integrity -->
</StageContainer>
```

---

## 4. Copy Rules & Invariant Constraints (§0.7)

1. **Product Naming Lock**: Must strictly refer to the binary as **"Exam Device Companion"**.
2. **Services-Only Wording**:
   - Zero vendor or protocol names in student-facing UI (no mentions of "Node.js", "WireGuard", "Electron", "SEA", "WebSockets").
   - Actionable instructions only: *"Please close `<program name>` and keep this page open — your exam will continue automatically."*
3. **Zero Layout Regressions**: When replacing legacy panels with the new `DeviceCompanionPanel` component in Phase A5, all padding, border-radius (`rounded-2xl`), badge geometry, and flex alignments must match this baseline.
