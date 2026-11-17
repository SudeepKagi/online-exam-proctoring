'use strict'
const { execSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const instanceId = 'i-0d242d962823f0a89'
const awsRegion = 'ap-south-1'

const p = path.join(os.tmpdir(), `ssm-log-recent-${Date.now()}.json`)
fs.writeFileSync(p, JSON.stringify({
  commands: [
    'echo "=== SERVICE LOGS SINCE 02:30 ==="',
    'journalctl -u proctornet.service --since "2026-11-17 02:30:00" --no-pager',
    'echo "=== CADDY LOGS SINCE 02:30 ==="',
    'journalctl -u caddy --since "2026-11-17 02:30:00" --no-pager | tail -n 80'
  ]
}))

try {
  const out = execSync(`aws ssm send-command --instance-ids ${instanceId} --region ${awsRegion} --document-name AWS-RunShellScript --parameters file://${p} --output json`, { encoding: 'utf8' })
  try { fs.unlinkSync(p) } catch (_) {}
  const commandId = JSON.parse(out).Command?.CommandId
  console.log('Command ID:', commandId)

  for (let attempt = 0; attempt < 10; attempt++) {
    execSync('powershell -Command "Start-Sleep -Seconds 2"')
    const statusCmd = `aws ssm get-command-invocation --command-id "${commandId}" --instance-id "${instanceId}" --region "${awsRegion}" --output json`
    const statusOut = JSON.parse(execSync(statusCmd, { encoding: 'utf8', timeout: 10000 }))
    if (['Success', 'Failed', 'TimedOut', 'Cancelled'].includes(statusOut.Status)) {
      console.log('--- Output ---')
      console.log(statusOut.StandardOutputContent || '')
      break
    }
  }
} catch (err) {
  console.error('Error:', err.message)
}
