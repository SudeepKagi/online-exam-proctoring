# Top 10 SQL Statements by Execution Time (Baseline P0)

Captured via `pg_stat_statements` on PostgreSQL 16 during the baseline load test (50 & 100 VUs).

| Rank | Query Pattern | Calls | Total Time (ms) | Mean Time (ms) | Total Rows | Root Cause / Service Path |
|------|---------------|-------|-----------------|----------------|------------|---------------------------|
| 1 | `SELECT "Exam"."id", ... LEFT JOIN (SELECT "Question"."examId", COUNT(*) FROM "Question" GROUP BY "Question"."examId") ... WHERE "Exam"."status" IN (...) ORDER BY "Exam"."createdAt" DESC LIMIT $5` | 279 | 129.55 | 0.46 | 15,624 | `studentService.listMyExams` executes unindexed table scan and question count aggregation on every refresh |
| 2 | `SELECT "Question"."id", "Question"."examId", "Question"."type", "Question"."options", "Question"."correctAnswer", ... FROM "Question" WHERE "Question"."examId" IN ($1)` | 242 | 95.55 | 0.39 | 12,100 | `studentService.startOrResumeExam` loads full question bank with answer keys (`isCorrect: true`) into memory |
| 3 | `SELECT * FROM pgbouncer.get_auth($1)` | 486 | 176.76 | 0.36 | 486 | PgBouncer transaction-pooler authentication handshake round-trips |
| 4 | `SELECT "StudentExam".* FROM "StudentExam" WHERE "studentId" = $1 AND "examId" = $2 LIMIT 1` | 412 | 184.20 | 0.45 | 412 | Repeated unindexed candidate exam session lookups in `autoSaveAnswer` and `saveAnswer` |
| 5 | `SELECT "Student"."id", "Student"."approvalStatus", "Student"."isSuspended", "Student"."password" FROM "Student" WHERE "usn" = $1 LIMIT 1` | 185 | 88.42 | 0.48 | 185 | Student login lookup (`auth.controller.studentLogin`) |
| 6 | `INSERT INTO "AuditLog" ("id", "userId", "userRole", "action", "ipAddress", "createdAt") VALUES ($1, $2, $3, $4, $5, $6)` | 390 | 142.10 | 0.36 | 390 | Synchronous audit logging during student logins, session starts, and exam submissions |
| 7 | `UPDATE "StudentExam" SET "lastActive" = $1, "status" = $2 WHERE "id" = $3` | 260 | 115.80 | 0.45 | 260 | `sessionStateMachine.transitionExamSession` running inside interactive transaction blocks |
| 8 | `INSERT INTO "Answer" ("id", "studentExamId", "questionId", "selectedOption", "updatedAt") VALUES ($1, $2, $3, $4, $5) ON CONFLICT ...` | 310 | 138.45 | 0.45 | 310 | `studentService.autoSaveStudentAnswers` single-record upserts without batched pipeline |
| 9 | `SELECT t.oid, t.typname FROM pg_type ... WHERE typrelid = $4` | 5 | 153.77 | 30.75 | 1,095 | Prisma internal PostgreSQL type mapping queries on connection initialization |
| 10 | `SELECT count(*) FROM "Question" WHERE "examId" = $1` | 120 | 54.12 | 0.45 | 120 | Question count checks during exam start and submission grading validation |
