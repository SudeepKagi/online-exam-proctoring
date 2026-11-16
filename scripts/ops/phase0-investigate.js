'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const instanceId = 'i-0d242d962823f0a89';
const awsRegion = 'ap-south-1';

const remoteScript = `
cd /opt/proctornet/current/backend

echo "=== 1. SYSTEM SETTINGS IN DB ==="
NODE_ENV=production node -r dotenv/config -e '
const { prisma } = require("./src/infra/postgres/client");
async function main() {
  const settings = await prisma.systemSetting.findMany();
  console.log("Settings rows count:", settings.length);
  for (const s of settings) {
    const val = s.value;
    if (typeof val === "object" && val !== null) {
      const sanitized = {};
      for (const [k, v] of Object.entries(val)) {
        sanitized[k] = typeof v === "string" ? { length: v.length, last4: v.slice(-4) } : v;
      }
      console.log("Setting key:", s.key, "sanitized_value:", JSON.stringify(sanitized));
    } else {
      console.log("Setting key:", s.key, "type:", typeof val);
    }
  }
}
main().catch(err => console.error("Error:", err)).finally(() => prisma.$disconnect());
' dotenv_config_path=/opt/proctornet/shared/.env

echo "=== 2. SEB SETTINGS AS RETURNED BY SETTINGS SERVICE ==="
NODE_ENV=production node -r dotenv/config -e '
const { settingsService } = require("./src/modules/admin/settings.service");
async function main() {
  const conf = await settingsService.getSebConfig();
  if (conf) {
    console.log("getSebConfig() returned: configKey length =", conf.configKey?.length, "last4 =", conf.configKey?.slice(-4), "fileKey =", conf.fileKey, "uploadedAt =", conf.uploadedAt, "lastVerifiedAt =", conf.lastVerifiedAt);
  } else {
    console.log("getSebConfig() returned null");
  }
}
main().catch(err => console.error("Error:", err));
' dotenv_config_path=/opt/proctornet/shared/.env

echo "=== 3. VIOLATION / PROCTORING EVENTS & ATTEMPTS COUNTS ==="
NODE_ENV=production node -r dotenv/config -e '
const { prisma } = require("./src/infra/postgres/client");
async function main() {
  const examCount = await prisma.exam.count();
  const attemptCount = await prisma.examAttempt.count();
  console.log("Exams count:", examCount, "Attempts count:", attemptCount);
  
  const attempts = await prisma.examAttempt.findMany({
    select: {
      id: true,
      examId: true,
      status: true,
      violationCount: true,
      proctoringLogs: true
    },
    take: 10
  });
  console.log("Recent attempts count returned:", attempts.length);
  for (const a of attempts) {
    let logsCount = 0;
    if (Array.isArray(a.proctoringLogs)) {
      logsCount = a.proctoringLogs.length;
    } else if (typeof a.proctoringLogs === "string") {
      try { logsCount = JSON.parse(a.proctoringLogs).length; } catch(_) {}
    } else if (typeof a.proctoringLogs === "object" && a.proctoringLogs !== null) {
      logsCount = Object.keys(a.proctoringLogs).length;
    }
    console.log("Attempt:", a.id, "Exam:", a.examId, "Status:", a.status, "violationCount:", a.violationCount, "proctoringLogsCount:", logsCount);
  }
}
main().catch(err => console.error("Error:", err)).finally(() => prisma.$disconnect());
' dotenv_config_path=/opt/proctornet/shared/.env
`;

const tmpParam = path.join(os.tmpdir(), `ssm-phase0-db-${Date.now()}.json`);
fs.writeFileSync(tmpParam, JSON.stringify({
  commands: [remoteScript]
}));

try {
  const ssmCmd = `aws ssm send-command --instance-ids "${instanceId}" --region "${awsRegion}" --document-name "AWS-RunShellScript" --parameters "file://${tmpParam.replace(/\\/g, '/')}" --output json`;
  const res = JSON.parse(execSync(ssmCmd, { encoding: 'utf8' }));
  const commandId = res.Command.CommandId;
  fs.unlinkSync(tmpParam);

  console.log('Dispatched command ID:', commandId);
  for (let i = 0; i < 20; i++) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
    try {
      const poll = JSON.parse(execSync(`aws ssm get-command-invocation --command-id "${commandId}" --instance-id "${instanceId}" --region "${awsRegion}" --output json`, { encoding: 'utf8' }));
      if (poll.Status === 'Success' || poll.Status === 'Failed') {
        const out = poll.StandardOutputContent || poll.StandardErrorContent;
        fs.writeFileSync(path.join(__dirname, '../../test-results/phase0-live-db-evidence.txt'), out);
        console.log('Saved live DB evidence to test-results/phase0-live-db-evidence.txt');
        break;
      }
    } catch (e) {}
  }
} catch (err) {
  console.error('Error:', err.message);
  try { fs.unlinkSync(tmpParam); } catch (_) {}
}
