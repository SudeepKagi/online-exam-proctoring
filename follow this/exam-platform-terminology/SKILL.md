---
name: exam-platform-terminology
description: Enforces industry-standard, plain-English terminology for an online exam and proctoring platform. Use whenever you create, rename, or review ANY user-visible text or feature name - button labels, menu items, page titles, form fields, statuses, role names, alerts, toasts, error and empty states, emails, route names, and module names - even if the request never mentions terminology. Prevents invented, quirky, or technical names (e.g. "Command Center", "Nexus", "Initiate Protocol") and keeps exactly one term per concept across Student, Teacher, Admin, and Developer screens.
---

# Exam platform terminology

The single source of truth for every word a user can see in an online exam and proctoring platform, plus the rules for naming anything the glossary does not cover yet.

## Why this exists

Agents improvise names when no vocabulary is defined, and every session improvises differently. The result: one concept with three names ("Exam", "Assessment", "Contest") and buttons like "Initiate Protocol". This skill removes the improvisation with three layers:

1. **Glossary** - look the term up, use it exactly.
2. **Rules** - a short procedure for terms the glossary lacks.
3. **Check script** - a deterministic scan that fails when banned wording slips through (instructions alone are probabilistic; a script is not).

## Hard rules

1. **Look up before you name.** Open `references/glossary.md` before writing or changing any user-visible string, page, role, status, route, or feature name. If the concept exists, use the canonical term exactly: same spelling, same case, in UI, code, API, docs, and tests.
2. **Never invent.** If the concept is missing, apply the naming test below, then add a row to the "Pending terms" table in the glossary and mention it in your final message. Do not silently ship a new term.
3. **One concept, one term.** Never swap in a synonym from the "Don't use" column, even if it sounds nicer.
4. **Plain labels.** Actions are verb + object in sentence case, 1-3 words ("Start exam", "Add user"). No metaphors, branding flourishes, hype words, military or security theatre, or technology names in user-facing text.
5. **Strings live in one place.** All UI text goes in the project's single strings file (for example `src/locales/en.json` or the existing constants file). Components reference keys; they never hard-code labels. If no such file exists, create one and tell the user. Tests import labels from the same file so a rename cannot silently break them.
6. **UI words and code words match.** Identifiers use the same nouns as the UI, with no whimsy.

   | Nav label | Route | Component | String key |
   |---|---|---|---|
   | Live monitoring | `/live-monitoring` | `LiveMonitoringPage` | `liveMonitoring.title` |

7. **Rename wording, not plumbing.** Changing UI text is always fine. Renaming DB columns, enums, or API routes only for wording reasons is a migration: do it only if the user asks, and otherwise map the internal value to the canonical label in the strings layer.

## Workflow

1. List every user-visible string your change adds or touches (labels, headings, statuses, toasts, errors, empty states, emails).
2. Look each one up in `references/glossary.md`. For buttons, dialogs, errors, and empty states, apply the patterns and canonical button sets in `references/ui-copy-patterns.md`.
3. For gaps, run the naming test, pick the plainest option, and add it to "Pending terms".
4. Run the check from the project root and fix every hit:
   `node <skill-path>/scripts/check-terms.mjs src`
   Add genuine exceptions to the script's allow comment (`// terms-ok`) only with a reason on the same line.
5. Finish with a two-line terminology note: terms reused from the glossary, and any proposed new terms.

## Naming test (for terms the glossary lacks)

Pick the option that passes the most checks:

1. Would a first-year student understand it with no explanation?
2. Does the same word appear in the help docs of Moodle, Canvas, or a proctoring vendor such as ProctorU or Honorlock?
3. Action = verb + object. Place or object = plain noun.
4. Does it collide with a term that already has a meaning here (for example "alert", "session", "review")? If yes, choose another word.
5. Would it read naturally in a toast, an error message, and an email subject?

## Renaming an existing term

1. Search the whole repo for the old wording: components, strings file, tests (including Playwright journeys), docs, seed data, emails.
2. Update the strings file first, then every reference. Prefer test selectors that use the shared strings or `data-testid`.
3. Update the glossary row if the canonical term changed.
4. Re-run the check script.

## Done checklist

- [ ] Every new or changed string came from the glossary or is listed under "Pending terms"
- [ ] No hard-coded labels in components
- [ ] No term from the "Don't use" column or `references/deny-list.txt` in user-facing text
- [ ] Check script passes
- [ ] Final message includes the terminology note
