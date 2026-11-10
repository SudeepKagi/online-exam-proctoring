'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

describe('AWS Staging Provisioning Scripts Audit', () => {
  const repoRoot = path.resolve(__dirname, '../..')
  const opsDir = path.join(repoRoot, 'scripts/ops')

  test('required AWS staging automation files exist', () => {
    const requiredFiles = [
      'aws-provision-staging.ps1',
      'aws-provision-staging.sh',
      'bootstrap-remote-staging.js',
      'staging-user-data.sh',
      's3-cors-staging.json',
      'ec2-trust-policy.json',
      's3-staging-policy.json',
      'staging-block-device.json'
    ]

    for (const f of requiredFiles) {
      const fullPath = path.join(opsDir, f)
      assert.equal(fs.existsSync(fullPath), true, `Expected file to exist: ${f}`)
    }
  })

  test('IAM and S3 JSON policy definitions are valid JSON', () => {
    const s3Cors = JSON.parse(fs.readFileSync(path.join(opsDir, 's3-cors-staging.json'), 'utf8'))
    const ec2Trust = JSON.parse(fs.readFileSync(path.join(opsDir, 'ec2-trust-policy.json'), 'utf8'))
    const s3Policy = JSON.parse(fs.readFileSync(path.join(opsDir, 's3-staging-policy.json'), 'utf8'))
    const blockDevice = JSON.parse(fs.readFileSync(path.join(opsDir, 'staging-block-device.json'), 'utf8'))

    assert.equal(s3Cors.CORSRules[0].AllowedOrigins.includes('https://staging.proctornet.duckdns.org'), true)
    assert.equal(ec2Trust.Statement[0].Principal.Service, 'ec2.amazonaws.com')
    assert.equal(s3Policy.Statement[0].Resource.includes('arn:aws:s3:::proctornet-staging-evidence/*'), true)
    assert.equal(blockDevice[0].Ebs.VolumeSize >= 20, true)
  })

  test('Cloud-Init user data script installs Docker and enables SSM cleanly', () => {
    const userData = fs.readFileSync(path.join(opsDir, 'staging-user-data.sh'), 'utf8')
    assert.equal(userData.includes('docker-ce'), true)
    assert.equal(userData.includes('docker-compose-plugin'), true)
    assert.equal(userData.includes('/opt/proctornet-staging'), true)
    assert.equal(userData.includes('apt-get install -y amazon-ssm-agent'), false)
  })
})
