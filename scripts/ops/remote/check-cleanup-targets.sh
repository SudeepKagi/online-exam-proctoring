#!/usr/bin/env bash
set -euo pipefail

echo "================================================================="
echo " PROCTORNET CLEANUP TARGETS AUDIT"
echo " Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "================================================================="

echo "--- 1. RELEASES IN /opt/proctornet/releases ---"
CURRENT_RELEASE=$(readlink -f /opt/proctornet/current)
echo "Current release: $CURRENT_RELEASE"
ls -ldt /opt/proctornet/releases/release-*

echo ""
echo "--- 2. SERVER /tmp LEFTOVERS ---"
ls -la /tmp/remote-task* /tmp/Caddyfile* /tmp/ssm* /tmp/release-* 2>/dev/null || echo "No proctornet /tmp leftovers found"

echo ""
echo "--- 3. LIVE TEST DATA (ACCOUNTS, EXAMS, ATTEMPTS) ---"
cd /opt/proctornet/current/backend
node --env-file=/opt/proctornet/shared/.env -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function auditData() {
  console.log('=== USERS ===');
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });
  console.log(JSON.stringify(users, null, 2));

  console.log('=== EXAMS ===');
  const exams = await prisma.exam.findMany({
    select: {
      id: true,
      title: true,
      courseCode: true,
      status: true,
      startTime: true,
      endTime: true,
      _count: { select: { questions: true, assignments: true, attempts: true } }
    },
    orderBy: { createdAt: 'asc' }
  });
  console.log(JSON.stringify(exams, null, 2));

  console.log('=== ATTEMPTS ===');
  const attempts = await prisma.examAttempt.findMany({
    select: { id: true, examId: true, studentId: true, status: true, score: true },
  });
  console.log(JSON.stringify(attempts, null, 2));

  console.log('=== PROCTORING LOGS ===');
  const logCount = await prisma.proctoringLog.count();
  console.log('Proctoring log count:', logCount);

  console.log('=== READINESS REPORTS ===');
  const readinessCount = await prisma.studentReadinessReport.count();
  console.log('Readiness report count:', readinessCount);

  await prisma.\$disconnect();
}
auditData().catch(err => { console.error(err); process.exit(1); });
"

echo ""
echo "--- 4. S3 TEST OBJECTS IN STORAGE BUCKET ---"
aws s3 ls s3://proctornet-storage-prod-858109978489/ --recursive | head -n 30 || true
echo "Total S3 object count:"
aws s3 ls s3://proctornet-storage-prod-858109978489/ --recursive | wc -l || true

echo "================================================================="
