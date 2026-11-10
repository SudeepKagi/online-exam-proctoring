#!/bin/bash
set -euo pipefail

CURRENT_DIR=$(readlink -f /opt/proctornet/current)
cd "$CURRENT_DIR/backend"

node --env-file=/opt/proctornet/shared/.env -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== USERS ===');
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      fullName: true,
      institutionId: true,
      createdAt: true,
      _count: {
        select: {
          createdExams: true,
          assignments: true,
          attempts: true,
          reviewedAttempts: true,
          readinessReports: true,
          consents: true
        }
      }
    },
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
      durationMinutes: true,
      createdById: true,
      createdAt: true,
      _count: {
        select: {
          questions: true,
          assignments: true,
          attempts: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });
  console.log(JSON.stringify(exams, null, 2));

  console.log('=== ASSIGNMENTS ===');
  const assignments = await prisma.examAssignment.findMany({
    select: {
      examId: true,
      userId: true,
      assignedRole: true,
      user: {
        select: { email: true, role: true }
      },
      exam: {
        select: { title: true }
      }
    }
  });
  console.log(JSON.stringify(assignments, null, 2));

  console.log('=== ATTEMPTS ===');
  const attempts = await prisma.examAttempt.findMany({
    select: {
      id: true,
      examId: true,
      studentId: true,
      status: true,
      score: true,
      startedAt: true,
      submittedAt: true,
      student: {
        select: { email: true }
      },
      exam: {
        select: { title: true }
      }
    }
  });
  console.log(JSON.stringify(attempts, null, 2));

  await prisma.\$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
"
