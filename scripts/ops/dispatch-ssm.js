#!/usr/bin/env node
/**
 * scripts/ops/dispatch-ssm.js
 * Runs a remote bash script on an EC2 instance via AWS SSM.
 * Safely handles script payload via base64, waits for completion,
 * saves output to logs-deploy/, and appends an entry to docs/ops/DEPLOY_LOG.md.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);

let instanceId = 'i-0d242d962823f0a89'; // Live production server
let scriptPath = '';
let logName = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--instance' && args[i + 1]) {
    instanceId = args[++i];
  } else if (args[i] === '--script' && args[i + 1]) {
    scriptPath = args[++i];
  } else if (args[i] === '--log' && args[i + 1]) {
    logName = args[++i];
  }
}

if (!scriptPath) {
  console.error('Usage: node scripts/ops/dispatch-ssm.js --script <path-to-sh> [--instance <id>] [--log <logname>]');
  process.exit(1);
}

const resolvedScript = path.isAbsolute(scriptPath) ? scriptPath : path.resolve(repoRoot, scriptPath);
if (!fs.existsSync(resolvedScript)) {
  console.error(`Script not found: ${resolvedScript}`);
  process.exit(1);
}

const scriptContent = fs.readFileSync(resolvedScript, 'utf8');
const base64Script = Buffer.from(scriptContent, 'utf8').toString('base64');
const baseName = logName || path.basename(scriptPath, path.extname(scriptPath));
const logFile = path.resolve(repoRoot, 'logs-deploy', `${baseName}.log`);

console.log(`[SSM Dispatch] Target Instance: ${instanceId}`);
console.log(`[SSM Dispatch] Script: ${path.relative(repoRoot, resolvedScript)}`);

// Construct parameter payload safely via JSON
const parameterPayload = JSON.stringify({
  commands: [
    `echo "${base64Script}" | base64 -d > /tmp/remote-task.sh`,
    `chmod +x /tmp/remote-task.sh`,
    `bash /tmp/remote-task.sh`,
    `rm -f /tmp/remote-task.sh`
  ]
});

// Write parameters to a temporary file to avoid shell escaping issues on Windows
const tempParamFile = path.resolve(repoRoot, 'logs-deploy', 'ssm-params.json');
fs.writeFileSync(tempParamFile, parameterPayload, 'utf8');

try {
  const sendCmd = `aws ssm send-command --instance-ids "${instanceId}" --document-name "AWS-RunShellScript" --parameters "file://${tempParamFile.replace(/\\/g, '/')}" --region ap-south-1 --output json`;
  const sendRes = JSON.parse(execSync(sendCmd, { encoding: 'utf8' }));
  const commandId = sendRes.Command.CommandId;
  console.log(`[SSM Dispatch] Command dispatched: ${commandId}. Polling for completion...`);

  let status = 'Pending';
  let invocation = null;
  const maxPolls = 60; // 5 minutes max
  for (let poll = 0; poll < maxPolls; poll++) {
    // wait 5s
    execSync('powershell -Command "Start-Sleep -Seconds 4"');
    try {
      const getCmd = `aws ssm get-command-invocation --command-id "${commandId}" --instance-id "${instanceId}" --region ap-south-1 --output json`;
      invocation = JSON.parse(execSync(getCmd, { encoding: 'utf8' }));
      status = invocation.Status;
    } catch (e) {
      // may take a second to become visible
    }

    if (['Success', 'Failed', 'Cancelled', 'TimedOut'].includes(status)) {
      break;
    }
    process.stdout.write('.');
  }
  console.log(`\n[SSM Dispatch] Final Status: ${status}`);

  const stdOut = invocation?.StandardOutputContent || '';
  const stdErr = invocation?.StandardErrorContent || '';
  const fullLog = `=== STDOUT ===\n${stdOut}\n=== STDERR ===\n${stdErr}\n=== STATUS: ${status} (Code: ${invocation?.ResponseCode}) ===\n`;

  fs.writeFileSync(logFile, fullLog, 'utf8');
  console.log(`[SSM Dispatch] Output saved to: ${path.relative(repoRoot, logFile)}`);

  // Log to docs/ops/DEPLOY_LOG.md
  const deployLogPath = path.resolve(repoRoot, 'docs/ops/DEPLOY_LOG.md');
  const timestamp = new Date().toISOString();
  const logEntry = `\n### [${timestamp}] Command on ${instanceId}\n- **Script**: \`${path.relative(repoRoot, resolvedScript)}\`\n- **Command ID**: \`${commandId}\`\n- **Status**: \`${status}\` (Exit Code: ${invocation?.ResponseCode})\n- **Log File**: \`logs-deploy/${path.basename(logFile)}\`\n`;
  fs.appendFileSync(deployLogPath, logEntry, 'utf8');

  if (status !== 'Success') {
    console.error(`[!] Remote command failed with status ${status}`);
    process.exit(1);
  }
} finally {
  if (fs.existsSync(tempParamFile)) {
    fs.unlinkSync(tempParamFile);
  }
}
