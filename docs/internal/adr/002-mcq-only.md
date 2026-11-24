# ADR 002: Restriction to MCQ-Only Assessment Model

## Status
Accepted

## Date
2026-10-03

## Context
The legacy codebase supported mixed question types (`MCQ`, `CODE`, `SUBJECTIVE`), requiring language execution runtimes, test case evaluation, complex code editor dependencies (`@monaco-editor/react`), and heuristic token-based similarity analysis. In high-concurrency environments, subjective grading and containerized code execution introduce CPU bottlenecks, unbounded request durations, and security risks.

The project authority has established that all examinations conducted via ProctorNet will exclusively utilize Single-Choice Multiple Choice Questions (MCQ).

## Decision
1. **Remove all non-MCQ question types**:
   - Strip `CODE` and `SUBJECTIVE` evaluation pathways from services, controllers, and schemas.
   - Remove Monaco editor and text-area subjective widgets from frontend bundles.
   - Questions have exactly one correct option out of 2–6 options.
2. **Deterministic Relational Representation**:
   - Options are modeled relationally or as strongly typed schemas with exactly one correct option marked (`is_correct: boolean`), guaranteed at question creation/update time.
   - In-database grading can be computed in a single set-based SQL statement without pulling questions or answer keys into application memory.

## Consequences
### Positive
- Massive reduction in code complexity and attack surface.
- Completely eliminates heavy client dependencies (`@monaco-editor/react`, saving bundle size and main-thread CPU).
- Grading is instantaneous and deterministic, reducible to a single bulk SQL statement:
  ```sql
  UPDATE attempt_answers a
  SET score = CASE WHEN qo.is_correct THEN q.marks ELSE -COALESCE(q.negative_marks, 0) END,
      is_evaluated = true
  FROM attempt_questions aq
  JOIN question_options qo ON qo.id = a.selected_option_id
  JOIN questions q ON q.id = aq.question_id
  WHERE a.attempt_id = $1 AND aq.id = a.attempt_question_id;
  ```
- Predictable database write and evaluation times.

### Negative
- Exams cannot assess freeform writing or algorithmic coding tasks without third-party integrations.

## Notion Step-13 Alignment
Supersedes Notion 13.5's v1 list (`MCQ`, `TRUE_FALSE`, `NUMERIC`) by explicitly restricting to Single-Correct MCQ as directed by project stakeholders.
