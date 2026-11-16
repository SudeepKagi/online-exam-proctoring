'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const script = `cd /opt/proctornet/current/backend && NODE_ENV=production node -r dotenv/config -e '
const { prisma } = require("./src/infra/postgres/client");
async function run() {
  const count = await prisma.proctoringLog.count();
  console.log("PROCTORING_LOGS_COUNT: " + count);
  const logs = await prisma.proctoringLog.findMany({
    select: { id: true, attemptId: true, eventType: true, severity: true, evidenceKey: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  console.log("Recent logs sample:", JSON.stringify(logs, null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());
' dotenv_config_path=/opt/proctornet/shared/.env`;

const tmpParam = path.join(os.tmpdir(), `ssm-plog-${Date.now()}.json`);
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
      fs.writeFileSync(path.join(__dirname, '../../test-results/phase0-plog-evidence.txt'), out);
      console.log('Saved to test-results/phase0-plog-evidence.txt');
      break;
    }
  } catch (e) {}
}
