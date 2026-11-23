#!/usr/bin/env bash
set -e
cd /opt/proctornet/current/backend
NODE_ENV=production node -r dotenv/config -e '
const { prisma } = require("./src/infra/postgres/client");
async function main() {
  const attempts = await prisma.examAttempt.findMany({
    where: { examId: "8147f0dd-2323-47fe-bd53-b50a608db88d" },
    include: { student: { select: { id: true, email: true, fullName: true, role: true } } }
  });
  console.log("=== ATTEMPTS FOR EXAM 8147f0dd ===");
  console.log(JSON.stringify(attempts, null, 2));

  const assignments = await prisma.examAssignment.findMany({
    where: { examId: "8147f0dd-2323-47fe-bd53-b50a608db88d" },
    include: { student: { select: { id: true, email: true, fullName: true } } }
  });
  console.log("=== ASSIGNMENTS FOR EXAM 8147f0dd ===");
  console.log(JSON.stringify(assignments, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
' dotenv_config_path=/opt/proctornet/shared/.env
