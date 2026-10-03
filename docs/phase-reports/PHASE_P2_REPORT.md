# Phase P2 Report — MCQ-Only Scope Restriction & Attack Surface Elimination
## Executive Summary

Phase P2 successfully executed the complete deprecation and removal of all non-MCQ question types across the ProctorNet stack. The system now exclusively supports **single-correct-option Multiple Choice Questions (MCQ)**. All long-form written responses, coding problems, language execution runtimes, test case evaluation engines, and in-browser code editor dependencies have been systematically purged from the database schema, backend services, frontend user interfaces, documentation, seed data, and tests.

> **Architectural Decision (ADR 002):** *"Narrowing scope is a scalability decision: grading became one set-based SQL and the attack surface (code execution) disappeared."*

---

## 1. Domain Validation Rules & Database Constraints

All questions must strictly satisfy the following rules, enforced by application-layer validators and database engine constraints:

1. **Option Cardinality**: Exactly 2 to 6 options per question.
2. **Deterministic Correctness**: Exactly one option must have `isCorrect = true`.
3. **Database Engine Partial Unique Index**:
   A PostgreSQL partial unique index guarantees that no more than one option can be marked correct per question, preventing race conditions and bypassing application-layer bugs:
   ```sql
   CREATE UNIQUE INDEX idx_question_single_correct ON "QuestionOption" ("questionId") WHERE "isCorrect" = true;
   ```
4. **Marks & Negative Marking**:
   - `marks > 0` (positive numeric).
   - `0 <= negative_marks <= marks` (negative marking cannot exceed positive award).
5. **Text Length Constraints**:
   - Question statement: non-empty string, length `<= 5000` characters.
   - Option text: non-empty string, length `<= 500` characters.
6. **Hard Publish Rejection (Eliminating B-04 Silent Fallback)**:
   - Publishing an exam is rejected with HTTP `400 Bad Request` if the exam has 0 questions or if any question violates the MCQ domain rules.
   - B-04's legacy behavior of silently defaulting unconfigured answers to Option A has been permanently eliminated.

---

## 2. Schema Refactoring & Data Model Realignment

### Deprecated Fields & Models
As formally specified in [ADR 002](file:///c:/Final%20year%20project/online-exam-proctoring/docs/adr/002-mcq-only.md), all legacy non-MCQ columns have been dropped from the Prisma schema:
- **`Question`**: Dropped all legacy fields for coding templates, test suites, word limits, and unstructured options.
- **`Answer`**: Dropped all fields storing freeform code or text buffers, manual grading flags, and evaluator identifiers.
- **`ExamResult`**: Dropped manual evaluation fields.

### Added Relation & Models
- Introduced **`QuestionOption`** model with `onDelete: Cascade` foreign key to `Question`:
  ```prisma
  model QuestionOption {
    id         String   @id @default(uuid())
    questionId String
    question   Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
    text       String
    isCorrect  Boolean  @default(false)
    order      Int      @default(0)

    @@index([questionId])
  }
  ```

---

## 3. Backend Implementation & Services

1. **Validator (`src/validators/question.validator.js`)**:
   - `validateMcqQuestion(data)`: Validates cardinality, single correct option, marks, negative marks, and text bounds.
   - `normalizeExcelQuestionRow(row, rowIndex)`: Ingests bulk spreadsheet rows (`Question, OptionA...OptionF, CorrectOption, Marks, NegativeMarks, Difficulty, Tags`).
2. **Question Service (`src/services/questionService.js`)**:
   - Manages questions and options transactionally (`tx.question.create`, `tx.questionOption.createMany`).
   - Supports bulk Excel file uploads (`importQuestionsFromExcel(buffer, examId)`).
   - Constrains AI generation prompts and fallbacks strictly to MCQ structures.
3. **Exam Service (`src/services/examService.js`)**:
   - `publishExamById`: Enforces zero-question and invalid-question hard rejections.
   - `duplicateExamById`: Deep-clones `Question` entities and their associated `QuestionOption` child rows.
4. **Student Service (`src/services/studentService.js`)**:
   - **Student DTO Projection**: `startOrResumeExam` selects only `{ id, text, order }` from `options`, guaranteeing `isCorrect` is never serialized to candidates.
   - **Autosave**: Persists `selectedOption` cleanly without code/written buffers.
   - **Submission & Grading**: Deterministic scoring against `QuestionOption.isCorrect`.
5. **Collusion Service (`src/services/collusionService.js`)**:
   - Compares MCQ answer choice vectors and submission timestamps.

---

## 4. Frontend Optimization & Bundle Size Measurement

### Purged Dependencies & Components
- Uninstalled third-party client code editor packages (removed 6 transitive packages from `proctornet/frontend/package.json`).
- Deleted non-MCQ question rendering components.
- Cleaned up question panels, forms, and results across all role consoles (`QuestionPanel.jsx`, `ExamInterface.jsx`, `CreateExam.jsx`, `ExamDetail.jsx`, `QuestionPool.jsx`, `StudentDossier.jsx`, `Results.jsx`, `LandingPage.jsx`).
- Cleaned font stacks in `index.css` and SVG performance flamegraphs.

### Bundle Size Impact

| Bundle Asset | Pre-Cleanup (P2 Baseline) | Post-Cleanup (P2 Final) | Delta |
| :--- | :--- | :--- | :--- |
| **Production JS** | `2,449.64 kB` | `2,428.18 kB` | **-21.46 kB (-0.88%)** |
| **Gzipped JS** | `634.60 kB` | `627.53 kB` | **-7.07 kB (-1.11%)** |
| **Production CSS** | `153.27 kB` | `153.12 kB` | **-0.15 kB** |
| **Gzipped CSS** | `23.95 kB` | `23.96 kB` | **+0.01 kB** |
| **Dependencies** | Code editor present | Completely uninstalled | **-6 packages** |

---

## 5. CI Grep Gate Verification

The grep gate strictly validates that zero forbidden keywords exist outside allowable migration, changelog, and ADR directories.

**Result:** Exited with code `1` (0 matches found across the entire repository). **Grep gate is 100% GREEN.**
**

---

## 6. Verification & Automated Test Suite

A dedicated test suite was implemented in `proctornet/backend/tests/mcq-validation.test.js`:

| Test Suite / Category | Tests | Status |
| :--- | :---: | :---: |
| **Question Validation Matrix** (0/1/7 options, 0/2 correct, negative > marks, negative < 0, empty text, empty option, long text, long option) | 12 | **PASS** |
| **Bulk Excel Import Normalizer** (happy path, empty question, invalid correct option, negative > marks) | 4 | **PASS** |
| **Publish Rejection Guard** (0 questions rejected, invalid question rejected, B-04 killed) | 2 | **PASS** |
| **Student DTO Security Leak Prevention** (`isCorrect` never serialized to candidates) | 1 | **PASS** |
| **Database Partial Unique Index Enforcement** (`idx_question_single_correct` throws P2002 on second correct option) | 1 | **PASS** |
| **Full Backend Regression Suite** | **97 / 97** | **ALL PASS (100%)** |

All 97 tests across 24 suites pass without errors or skips.
