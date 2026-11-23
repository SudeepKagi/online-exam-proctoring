'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const script = `
echo "=== 1. CADDY REQUESTS WITH STATUS != 200/304 OR CONTAINING seb/api/v1/exchange ==="
journalctl -u caddy --since "45 minutes ago" --no-pager -o cat | jq -c 'select(.request != null) | {ts: .ts, ip: .request.client_ip, m: .request.method, uri: .request.uri, status: .status, ua: .request.headers["User-Agent"]}' | tail -n 40 || true

echo ""
echo "=== 2. PROCTORNET RECENT LOGS (warn/error or seb/token/exchange) ==="
journalctl -u proctornet.service --since "45 minutes ago" --no-pager | grep -iE 'warn|error|seb|launch|token|exchange' | tail -n 40 || true

echo ""
echo "=== 3. PRISMA QUERY FOR SEB SETTINGS & ATTEMPTS ==="
cd /opt/proctornet/current/backend && NODE_ENV=production node -r dotenv/config -e '
const { prisma } = require("./src/infra/postgres/client");
async function run() {
  const settings = await prisma.systemSetting.findMany();
  console.log("SYSTEM SETTINGS:", JSON.stringify(settings, null, 2));

  try {
    const attempts = await prisma.sebVerificationAttempt.findMany({
      orderBy: { createdAt: "desc" },
      take: 5
    });
    console.log("SEB VERIFICATION ATTEMPTS:", JSON.stringify(attempts, null, 2));
  } catch (e) {
    console.log("No SebVerificationAttempt table or query error:", e.message);
  }

  try {
    const tokens = await prisma.sebLaunchToken.findMany({
      orderBy: { createdAt: "desc" },
      take: 5
    });
    console.log("SEB LAUNCH TOKENS:", JSON.stringify(tokens, null, 2));
  } catch (e) {
    console.log("No SebLaunchToken table or query error:", e.message);
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());
' dotenv_config_path=/opt/proctornet/shared/.env
`;

const tmpParam = path.join(os.tmpdir(), `ssm-seb-check-${Date.now()}.json`);
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
      fs.writeFileSync(path.join(__dirname, '../../test-results/seb-activity-audit.txt'), out);
      console.log('Saved to test-results/seb-activity-audit.txt');
      break;
    }
  } catch (e) {}
}
