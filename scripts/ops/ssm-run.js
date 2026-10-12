#!/usr/bin/env node
const { execFileSync } = require('child_process');

const commands = process.argv.slice(2);
if (commands.length === 0) {
  console.error('Usage: node scripts/ops/ssm-run.js "<command 1>" ["<command 2>"]');
  process.exit(1);
}

const instanceId = process.env.AWS_EC2_INSTANCE_ID || 'i-0d242d962823f0a89';
const region = process.env.AWS_REGION || 'ap-south-1';

const payload = JSON.stringify({ commands });

console.log(`[SSM] Sending commands to ${instanceId}...`);
try {
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
  const sendRes = execFileSync('aws', [
    'ssm', 'send-command',
    '--instance-ids', instanceId,
    '--document-name', 'AWS-RunShellScript',
    '--parameters', payload,
    '--region', region,
    '--output', 'json'
  ], { encoding: 'utf8', env });

  const parsed = JSON.parse(sendRes);
  const commandId = parsed.Command.CommandId;
  console.log(`[SSM] Dispatched CommandId: ${commandId}`);

  let attempts = 0;
  while (attempts < 30) {
    attempts++;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);

    const statusRes = execFileSync('aws', [
      'ssm', 'get-command-invocation',
      '--command-id', commandId,
      '--instance-id', instanceId,
      '--region', region,
      '--output', 'json'
    ], { encoding: 'utf8', env });

    const statusObj = JSON.parse(statusRes);
    const status = statusObj.Status;
    console.log(`[SSM] Status (${attempts}/30): ${status}`);

    if (status === 'Success' || status === 'Failed' || status === 'Cancelled' || status === 'TimedOut') {
      console.log('\n--- STDOUT ---');
      console.log(statusObj.StandardOutputContent || '(empty)');
      if (statusObj.StandardErrorContent) {
        console.error('\n--- STDERR ---');
        console.error(statusObj.StandardErrorContent);
      }
      process.exit(status === 'Success' ? 0 : 1);
    }
  }
  console.error('[SSM] Timed out waiting for execution');
  process.exit(1);
} catch (err) {
  console.error('[SSM] Error:', err.message);
  if (err.stdout) console.log(err.stdout);
  if (err.stderr) console.error(err.stderr);
  process.exit(1);
}
