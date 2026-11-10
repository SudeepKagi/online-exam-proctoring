#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../..');
const headSha = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
const releaseTag = `release-${headSha}`;
const tarFile = `${releaseTag}.tar.gz`;
const bucket = 'proctornet-storage-prod-858109978489';

const versionData = {
  version: releaseTag,
  gitSha: headSha,
  builtAt: new Date().toISOString()
};

fs.writeFileSync(path.join(repoRoot, 'VERSION'), JSON.stringify(versionData, null, 2), 'utf8');
console.log(`[Package] Creating ${tarFile}...`);

const tarCmd = `tar -czf ${tarFile} backend frontend/dist scripts docker-compose.yml package.json VERSION`;
execSync(tarCmd, { cwd: repoRoot, stdio: 'inherit' });
console.log(`[Package] Tarball created: ${tarFile}`);

console.log(`[Package] Uploading to s3://${bucket}/releases/${tarFile}...`);
execSync(`aws s3 cp ${tarFile} s3://${bucket}/releases/${tarFile}`, { cwd: repoRoot, stdio: 'inherit' });

fs.unlinkSync(path.join(repoRoot, tarFile));
fs.unlinkSync(path.join(repoRoot, 'VERSION'));
console.log(`[Package] Upload complete and local artifacts cleaned.`);
