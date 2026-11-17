#!/usr/bin/env bash
set -euo pipefail

echo "================================================================="
echo " PROCTORNET LIVE TEST DATA DELETION"
echo " Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "================================================================="

cd /opt/proctornet/current/backend
node --env-file=/opt/proctornet/shared/.env -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanData() {
  const targetExamId = '52439667-22e9-4ff0-a6c2-b843f2a7c855';
  const targetEmail = 'invvh475@proctornet.local';

  console.log('=== BEFORE CLEANUP ===');
  const examBefore = await prisma.exam.findUnique({
    where: { id: targetExamId },
    include: { _count: { select: { questions: true, assignments: true, attempts: true } } }
  });
  console.log('Target exam before:', JSON.stringify(examBefore, null, 2));

  const userBefore = await prisma.user.findUnique({
    where: { email: targetEmail },
    select: { id: true, email: true, role: true }
  });
  console.log('Target user before:', JSON.stringify(userBefore, null, 2));

  console.log('\n=== EXECUTING CLEANUP ===');
  if (examBefore) {
    // Delete assignments for this exam
    const delAssignments = await prisma.examAssignment.deleteMany({ where: { examId: targetExamId } });
    console.log('Deleted assignments count:', delAssignments.count);

    // Delete questions for this exam
    const delQuestions = await prisma.question.deleteMany({ where: { examId: targetExamId } });
    console.log('Deleted questions count:', delQuestions.count);

    // Delete exam
    const delExam = await prisma.exam.delete({ where: { id: targetExamId } });
    console.log('Deleted exam:', delExam.id, delExam.title);
  } else {
    console.log('Target exam not found or already deleted.');
  }

  if (userBefore) {
    const delUser = await prisma.user.delete({ where: { email: targetEmail } });
    console.log('Deleted user:', delUser.id, delUser.email);
  } else {
    console.log('Target user not found or already deleted.');
  }

  console.log('\n=== AFTER CLEANUP AUDIT ===');
  const usersAfter = await prisma.user.findMany({
    select: { id: true, email: true, role: true }
  });
  console.log('Remaining users count:', usersAfter.length);
  console.log(JSON.stringify(usersAfter, null, 2));

  const examsAfter = await prisma.exam.findMany({
    select: { id: true, title: true, status: true }
  });
  console.log('Remaining exams count:', examsAfter.length);
  console.log(JSON.stringify(examsAfter, null, 2));

  await prisma.\$disconnect();
}

cleanData().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
"

echo "================================================================="
