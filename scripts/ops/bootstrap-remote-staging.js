#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const INSTANCE_ID = process.env.INSTANCE_ID || 'i-0d7b44f76235917fe'
const REGION = process.env.AWS_REGION || 'ap-south-1'
const DOMAIN = process.env.DOMAIN || 'staging.proctornet.duckdns.org'
const S3_BUCKET = process.env.S3_BUCKET || 'proctornet-staging-evidence'

const repoRoot = path.resolve(__dirname, '../..')
const composeFile = path.join(repoRoot, 'docker-compose.prod.yml')
const initEnvFile = path.join(repoRoot, 'scripts/ops/init-env.js')
const preflightFile = path.join(repoRoot, 'scripts/ops/preflight-env.js')

console.log(`[1] Reading host files from: ${repoRoot}`)
const b64Compose = fs.readFileSync(composeFile).toString('base64')
const b64Init = fs.readFileSync(initEnvFile).toString('base64')
const b64Preflight = fs.readFileSync(preflightFile).toString('base64')

const commands = [
  'mkdir -p /opt/proctornet-staging',
  'cd /opt/proctornet-staging',
  `echo "${b64Compose}" | base64 -d > docker-compose.prod.yml`,
  `echo "${b64Init}" | base64 -d > init-env.js`,
  `echo "${b64Preflight}" | base64 -d > preflight-env.js`,
  'chmod +x init-env.js preflight-env.js',
  `node init-env.js --staging --domain ${DOMAIN} --s3-bucket ${S3_BUCKET} --env /opt/proctornet-staging/.env --force`,
  'chmod 600 /opt/proctornet-staging/.env',
  'node preflight-env.js /opt/proctornet-staging/.env',
  'ls -la /opt/proctornet-staging'
]

const payloadPath = path.join(repoRoot, 'scripts/ops/ssm-staging-init-payload.json')
fs.writeFileSync(payloadPath, JSON.stringify({ commands }, null, 2), 'utf8')

console.log(`[2] Dispatching SSM initialization to ${INSTANCE_ID} in ${REGION}...`)
const sendCmd = `aws ssm send-command --instance-ids "${INSTANCE_ID}" --document-name "AWS-RunShellScript" --parameters "file://${payloadPath.replace(/\\/g, '/')}" --region ${REGION} --query "Command.CommandId" --output text`
const cmdId = execSync(sendCmd, { encoding: 'utf8' }).trim()
console.log(`[3] Command dispatched: ${cmdId}`)

console.log('[4] Polling for execution status...')
let status = 'Pending'
let result
for (let i = 0; i < 30; i++) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000)
  try {
    const raw = execSync(`aws ssm get-command-invocation --command-id "${cmdId}" --instance-id "${INSTANCE_ID}" --region ${REGION} --output json`, { encoding: 'utf8' })
    result = JSON.parse(raw)
    status = result.Status
    process.stdout.write(`. (${status})`)
    if (status === 'Success' || status === 'Failed' || status === 'Cancelled' || status === 'TimedOut') {
      break
    }
  } catch (err) {
    // Retry on pending invocation
  }
}

console.log('\n[5] Command Output:')
console.log(result ? result.StandardOutputContent : 'No output')
if (result && result.StandardErrorContent) {
  console.error('[!] Standard Error:\n', result.StandardErrorContent)
}

if (status !== 'Success') {
  console.error(`[x] Bootstrap failed with status: ${status}`)
  process.exit(1)
} else {
  console.log('[✓] Staging host environment successfully bootstrapped!')
}
