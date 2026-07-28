const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting student deletion process...');
  
  // Wrap in a transaction to ensure atomic and safe deletion across tables
  await prisma.$transaction(async (tx) => {
    // 1. Delete all Answers (linked to StudentExams)
    const answersDel = await tx.answer.deleteMany({});
    console.log(`Deleted ${answersDel.count} answers.`);

    // 2. Delete all proctoring EvidenceLogs
    const evidenceLogsDel = await tx.evidenceLog.deleteMany({});
    console.log(`Deleted ${evidenceLogsDel.count} proctoring evidence logs.`);

    // 3. Delete all AI ReverificationLogs
    const reverifyLogsDel = await tx.reverificationLog.deleteMany({});
    console.log(`Deleted ${reverifyLogsDel.count} AI reverification logs.`);

    // 4. Delete all IdentityVerifications
    const idVerDel = await tx.identityVerification.deleteMany({});
    console.log(`Deleted ${idVerDel.count} identity verification records.`);

    // 5. Delete all ExamResults
    const examResultsDel = await tx.examResult.deleteMany({});
    console.log(`Deleted ${examResultsDel.count} exam results.`);

    // 6. Delete all StudentExams
    const studentExamsDel = await tx.studentExam.deleteMany({});
    console.log(`Deleted ${studentExamsDel.count} student exam enrollments.`);

    // 7. Delete ChatMessages associated with exams
    const chatMsgDel = await tx.chatMessage.deleteMany({});
    console.log(`Deleted ${chatMsgDel.count} chat messages.`);

    // 8. Delete CollusionReports
    const collusionDel = await tx.collusionReport.deleteMany({});
    console.log(`Deleted ${collusionDel.count} collusion analysis reports.`);

    // 9. Clean student-level logs from AuditLog table
    const auditLogsDel = await tx.auditLog.deleteMany({
      where: { NOT: { studentId: null } }
    });
    console.log(`Deleted ${auditLogsDel.count} student audit logs.`);

    // 10. Delete all Student accounts
    const studentsDel = await tx.student.deleteMany({});
    console.log(`Deleted ${studentsDel.count} student accounts.`);
  });
  
  console.log('All student records and related metrics have been successfully and permanently removed.');
}

main()
  .catch((err) => {
    console.error('Error during student deletion:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
