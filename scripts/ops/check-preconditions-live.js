'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const instanceId = 'i-0d242d962823f0a89';
const awsRegion = 'ap-south-1';

const remoteScript = `
cd /opt/proctornet/current/backend
NODE_ENV=production node -r dotenv/config -e '
const { prisma } = require("./src/infra/postgres/client");
const fs = require("fs");
const path = require("path");

async function check() {
  const now = new Date();
  
  // 1. In-progress attempts
  const inProgressCount = await prisma.examAttempt.count({
    where: { status: "IN_PROGRESS" }
  });

  // 2. Open or upcoming exam windows within 30 min
  const upcomingWindow = new Date(now.getTime() + 30 * 60 * 1000);
  const openExams = await prisma.exam.findMany({
    where: {
      status: "PUBLISHED",
      startTime: { lte: upcomingWindow },
      endTime: { gte: now }
    },
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true
    }
  });

  // 3. Backup freshness
  let backupAgeMin = null;
  const backupDir = "/opt/proctornet/backups/postgres";
  if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith(".dump"));
    if (files.length > 0) {
      let newest = 0;
      for (const f of files) {
        const stat = fs.statSync(path.join(backupDir, f));
        if (stat.mtimeMs > newest) newest = stat.mtimeMs;
      }
      backupAgeMin = Math.round((Date.now() - newest) / 60000);
    }
  }

  // 4. Disk space
  const statvfs = fs.statfsSync("/");
  const freeMb = Math.round((statvfs.bavail * statvfs.bsize) / (1024 * 1024));

  console.log(JSON.stringify({
    inProgressAttemptsCount: inProgressCount,
    openExamsCount: openExams.length,
    openExamsList: openExams.map(e => ({ id: e.id, title: e.title, startTime: e.startTime, endTime: e.endTime })),
    backupAgeMinutes: backupAgeMin,
    freeDiskMb: freeMb,
    publicOrigin: process.env.PUBLIC_ORIGIN || null
  }, null, 2));
}

check().catch(e => {
  console.error(e.message);
  process.exit(1);
}).finally(() => prisma.$disconnect());
' dotenv_config_path=/opt/proctornet/shared/.env
`;

const paramFile = path.join(os.tmpdir(), `ssm-precheck-${Date.now()}.json`);
fs.writeFileSync(paramFile, JSON.stringify({ commands: [remoteScript] }));

try {
  const sendCmd = `aws ssm send-command --instance-ids "${instanceId}" --region "${awsRegion}" --document-name "AWS-RunShellScript" --parameters "file://${paramFile.replace(/\\/g, '/')}" --output json`;
  const sendRes = JSON.parse(execSync(sendCmd, { encoding: 'utf8' }));
  const commandId = sendRes.Command.CommandId;
  fs.unlinkSync(paramFile);

  console.log(`SSM Command dispatched: ${commandId}. Waiting for completion...`);
  let output = null;
  for (let i = 0; i < 30; i++) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
    const invCmd = `aws ssm get-command-invocation --command-id "${commandId}" --instance-id "${instanceId}" --region "${awsRegion}" --output json`;
    const invRes = JSON.parse(execSync(invCmd, { encoding: 'utf8' }));
    if (['Success', 'Failed', 'Cancelled', 'TimedOut'].includes(invRes.Status)) {
      output = invRes;
      break;
    }
  }

  if (!output) {
    console.error('Timed out waiting for SSM command');
    process.exit(1);
  }

  console.log(`Status: ${output.Status}`);
  console.log('StandardOutputContent:');
  console.log(output.StandardOutputContent);
  if (output.StandardErrorContent) {
    console.error('StandardErrorContent:');
    console.error(output.StandardErrorContent);
  }
} catch (e) {
  console.error('Execution error:', e.message);
  process.exit(1);
}
