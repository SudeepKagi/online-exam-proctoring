# exam-platform-terminology

An Agent Skill (open `SKILL.md` format) that makes AI coding agents use one consistent, industry-standard, plain-English vocabulary across an online exam and proctoring platform: buttons, menus, statuses, roles, errors, routes, and feature names.

## What is inside

| Path | Purpose |
|---|---|
| `SKILL.md` | Rules and workflow the agent follows (loaded when the skill triggers) |
| `references/glossary.md` | Canonical terms, banned synonyms, decision points, pending-terms table |
| `references/ui-copy-patterns.md` | Button sets per screen, dialogs, errors, empty states, warnings |
| `references/deny-list.txt` | Machine-readable banned terms for the check script |
| `scripts/check-terms.mjs` | Zero-dependency Node scan; exits 1 when banned wording is found |

## Install

Copy the whole folder into your project's skills directory, then restart the agent session.

| Agent | Project location |
|---|---|
| OpenAI Codex | `.agents/skills/exam-platform-terminology/` |
| Google Antigravity | `.agent/skills/exam-platform-terminology/` (some setups use `.agents/skills/`; if one does not load, try the other or symlink) |
| Claude Code | `.claude/skills/exam-platform-terminology/` |
| Cursor | `.cursor/skills/exam-platform-terminology/` |

## Make it deterministic: add this to `AGENTS.md`

Skills load when the agent decides they are relevant, and agents sometimes skip them. A short rule in `AGENTS.md` (read every session by Codex and Antigravity) closes that gap:

```md
## UI terminology (mandatory)
- Before adding or changing ANY user-visible text, page, role, status, route, or feature name, read
  `.agents/skills/exam-platform-terminology/SKILL.md` and `references/glossary.md`.
- Use canonical terms exactly. Never invent names; add unknown terms to "Pending terms" in the glossary.
- All UI strings live in the single strings file; no hard-coded labels in components.
- Before finishing, run `npm run check:terms` and fix every hit.
```

## Add the check to CI

In `package.json`:

```json
{
  "scripts": {
    "check:terms": "node .agents/skills/exam-platform-terminology/scripts/check-terms.mjs src"
  }
}
```

Run it in the same CI job as lint and tests so banned wording fails the build.

## Run a one-time cleanup

Paste this to your agent once to fix the existing project:

> Use the exam-platform-terminology skill. Audit every user-visible string, page title, nav item, role label, status, toast, error, and email in the frontend. Move all strings into the single strings file, replace every non-canonical term with the glossary term, list any concept the glossary lacks under "Pending terms" instead of inventing a name, update tests to use the shared strings, then run `npm run check:terms` until it passes. Do not rename database columns, enums, or API routes.

## Maintaining it

- Change a term: edit the glossary row, then run a project-wide rename.
- Add a banned word: add a line to `deny-list.txt` and to glossary section 11.
- Switch a decision point (for example Teacher to Faculty): change section 12, then rename everywhere in one pass.
- Genuine exception in code: add `// terms-ok: reason` on the same line.
