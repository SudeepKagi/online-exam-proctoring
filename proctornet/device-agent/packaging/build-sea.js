/**
 * ProctorNet Exam Device Companion
 * Node Single Executable Application (SEA) Builder
 * Architecture: ADR A-001, Prompt 4 A3
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')
const esbuild = require('esbuild')

async function buildSea(options = {}) {
  const rootDir = path.resolve(__dirname, '..')
  const distDir = path.join(rootDir, 'dist')
  const entryPoint = path.join(rootDir, 'src', 'main.js')

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true })
  }

  const bundlePath = path.join(distDir, 'bundle.js')
  const seaConfigPath = path.join(distDir, 'sea-config.json')
  const seaBlobPath = path.join(distDir, 'sea-prep.blob')

  const isWin = process.platform === 'win32'
  const binaryName = isWin ? 'proctornet-companion.exe' : 'proctornet-companion'
  const targetBinaryPath = path.join(distDir, binaryName)

  console.log(`[SEA Build] 1. Bundling JavaScript sources via esbuild...`)
  await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: bundlePath,
    format: 'cjs',
    minify: false,
    external: []
  })

  console.log(`[SEA Build] 2. Generating sea-config.json...`)
  const seaConfig = {
    main: bundlePath,
    output: seaBlobPath,
    disableExperimentalSEAWarning: true
  }
  fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2))

  console.log(`[SEA Build] 3. Generating Node SEA blob...`)
  execFileSync(process.execPath, ['--experimental-sea-config', seaConfigPath], {
    stdio: 'inherit'
  })

  console.log(`[SEA Build] 4. Copying host Node runtime binary...`)
  fs.copyFileSync(process.execPath, targetBinaryPath)

  console.log(`[SEA Build] 5. Injecting SEA blob via postject...`)
  // Sentinel fuse per Node.js SEA documentation
  const sentinelFuse = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
  const postjectCliJs = path.join(rootDir, 'node_modules', 'postject', 'dist', 'cli.js')

  execFileSync(process.execPath, [
    postjectCliJs,
    targetBinaryPath,
    'NODE_SEA_BLOB',
    seaBlobPath,
    '--sentinel-fuse',
    sentinelFuse
  ], { stdio: 'inherit' })

  // Compute checksum
  const binaryBuffer = fs.readFileSync(targetBinaryPath)
  const sha256 = crypto.createHash('sha256').update(binaryBuffer).digest('hex')
  const sizeBytes = binaryBuffer.length

  console.log(`[SEA Build] 6. Binary successfully built: ${targetBinaryPath}`)
  console.log(`             Size: ${(sizeBytes / (1024 * 1024)).toFixed(2)} MB (${sizeBytes} bytes)`)
  console.log(`             SHA-256: ${sha256}`)

  const manifestRecord = {
    version: '1.0.0',
    os: isWin ? 'win' : (process.platform === 'darwin' ? 'mac' : 'linux'),
    arch: process.arch,
    sha256,
    sizeBytes,
    signed: false,
    binaryPath: targetBinaryPath
  }

  fs.writeFileSync(path.join(distDir, 'release-manifest.json'), JSON.stringify(manifestRecord, null, 2))

  // Smoke test
  console.log(`[SEA Build] 7. Running smoke test (--version)...`)
  const versionOutput = execFileSync(targetBinaryPath, ['--version'], { encoding: 'utf8' })
  console.log(`             Output: ${versionOutput.trim()}`)

  return manifestRecord
}

if (require.main === module) {
  buildSea().catch((err) => {
    console.error(`[SEA Build Error] ${err.message}`)
    process.exit(1)
  })
}

module.exports = { buildSea }
