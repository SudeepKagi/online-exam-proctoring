'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const examId = '6dd7506c-803a-49f5-b9eb-19e53876933e';
const script = `cd /opt/proctornet/current/backend && NODE_ENV=production node -r dotenv/config -e '
const { prisma } = require("./src/infra/postgres/client");
async function run() {
  console.log("=== EXAM INFO ===");
  const exam = await prisma.exam.findUnique({
    where: { id: "${examId}" },
    include: { questions: { select: { id: true } } }
  });
  console.log("Exam found:", exam ? {
    id: exam.id,
    title: exam.title,
    status: exam.status,
    startTime: exam.startTime,
    endTime: exam.endTime,
    sebRequired: exam.sebRequired,
    questionCount: exam.questions?.length
  } : null);

  console.log("=== ATTEMPTS FOR THIS EXAM ===");
  const attempts = await prisma.attempt.findMany({
    where: { examId: "${examId}" },
    select: { id: true, studentId: true, status: true, startedAt: true, violationCount: true }
  });
  console.log("Attempts:", JSON.stringify(attempts, null, 2));

  console.log("=== SYSTEM SETTINGS ===");
  const settings = await prisma.systemSetting.findMany();
  console.log("Settings keys:", settings.map(s => ({ key: s.key, length: s.value ? s.value.length : 0 })));
}
run().catch(console.error).finally(() => prisma.$disconnect());
' dotenv_config_path=/opt/proctornet/shared/.env
echo "=== RECENT JOURNAL FOR EXAM ==="
journalctl -u proctornet --since "30 minutes ago" --no-pager | grep -E "${examId}|attempts|start|verify" | tail -n 25
`;

const tmpParam = path.join(os.tmpdir(), `ssm-exam-${Date.now()}.json`);
fs.writeFileSync(tmpParam, JSON.stringify({ commands: [script] }));
const ssmCmd = `aws ssm send-command --instance-ids "i-0d242d962823f0a89" --region "ap-south-1" --document-name "AWS-RunShellScript" --parameters "file://${tmpParam.replace(/\\/g, '/')}" --output json`;
const res = JSON.parse(execSync(ssmCmd, { encoding: 'utf8' }));
const commandId = res.Command.CommandId;
fs.unlinkSync(tmpParam);

for (let i = 0; i < 20; i++) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  try {
    const poll = JSON.parse(execSync(`aws ssm get-command-invocation --command-id "${commandId}" --instance-id "i-0d242d962823f0a89" --region "ap-south-1" --output json`, { encoding: 'utf8' }));
    if (poll.Status === 'Success' || poll.Status === 'Failed') {
      const out = poll.StandardOutputContent || poll.StandardErrorContent;
      fs.writeFileSync(path.join(__dirname, '../../test-results/live-exam-check.txt'), out);
      console.log('Saved to test-results/live-exam-check.txt');
      break;
    }
  } catch (e) {}
}
