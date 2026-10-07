/**
 * ProctorNet Exam Device Companion
 * Main CLI Entrypoint & Session Lifecycle Orchestrator
 * Architecture: Prompt 4 A2 (Node SEA, zero native modules, outbound HTTPS only)
 */

const { DEFAULT_SERVER_URL, AGENT_VERSION, DEFAULT_HEARTBEAT_MS } = require('./config')
const { Transport } = require('./transport')
const { pair } = require('./pairing')
const { collectTelemetry } = require('./collectors')
const { matchTelemetry } = require('./matcher')
const { validateOutboundReport } = require('./privacy/schema')
const {
  printHeader,
  printPrivacyNotice,
  promptPairingCode,
  printLiveStatus
} = require('./ui/console')

function parseArgs(args) {
  const options = {
    server: DEFAULT_SERVER_URL,
    code: null,
    diagnose: false,
    version: false,
    help: false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--version' || arg === '-v') {
      options.version = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--diagnose') {
      options.diagnose = true
    } else if (arg === '--server' && i + 1 < args.length) {
      options.server = args[++i]
    } else if (arg === '--code' && i + 1 < args.length) {
      options.code = args[++i]
    }
  }

  return options
}

/**
 * Diagnostic preview mode: executes local checks and dumps safe outbound payload
 */
async function runDiagnose(serverUrl) {
  printHeader()
  console.log('  [DIAGNOSTIC MODE]')
  console.log(`  Evaluating local workstation checks...\n`)

  const collectorOutput = await collectTelemetry()
  const simulatedReport = matchTelemetry(collectorOutput, [])
  simulatedReport.seq = 1

  validateOutboundReport(simulatedReport)

  console.log('  Safe Outbound Payload Preview (Data Minimization Enforced):')
  console.log('  ----------------------------------------------------------')
  console.log(JSON.stringify(simulatedReport, null, 2))
  console.log('  ----------------------------------------------------------')
  console.log(`  ✓ Privacy Contract Verified: Zero forbidden fields present.`)
  console.log(`  ✓ Workstation collection status: ${collectorOutput.ok ? 'OK' : 'DEGRADED'}`)
  process.exit(0)
}

/**
 * Main application runner
 */
async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.version) {
    console.log(`ProctorNet Exam Device Companion v${AGENT_VERSION}`)
    process.exit(0)
  }

  if (options.help) {
    printHeader()
    console.log('  Usage: proctornet-companion [options]\n')
    console.log('  Options:')
    console.log('    --code <code>      Pairing code from exam readiness page')
    console.log('    --server <url>     Override server API URL')
    console.log('    --diagnose         Run local hardware diagnostics and preview report')
    console.log('    --version, -v      Show companion version')
    console.log('    --help, -h         Show help\n')
    process.exit(0)
  }

  if (options.diagnose) {
    return runDiagnose(options.server)
  }

  printHeader()
  printPrivacyNotice()

  const transport = new Transport(options.server)

  let pairingCode = options.code
  if (!pairingCode) {
    pairingCode = await promptPairingCode()
  }

  console.log(`\n  Contacting exam server at ${options.server}...`)

  let session
  try {
    session = await pair(transport, pairingCode)
  } catch (err) {
    console.error(`\n  ❌ Pairing failed: ${err.message}`)
    process.exit(1)
  }

  console.log('  ✓ Pairing successful! Synchronizing security policy...')

  const rules = session.policy?.rules || []
  let seq = 0
  let isRunning = true
  const heartbeatMs = session.heartbeatMs || DEFAULT_HEARTBEAT_MS

  // Graceful shutdown handling
  const shutdown = () => {
    if (!isRunning) return
    isRunning = false
    console.log('\n\n  Companion shutting down. Good luck with your examination!')
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Initial report immediate
  const runReportCycle = async () => {
    if (!isRunning) return

    try {
      const collectorOutput = await collectTelemetry()
      const reportData = matchTelemetry(collectorOutput, rules)

      seq += 1
      reportData.seq = seq

      // Enforce strict local privacy contract before sending
      validateOutboundReport(reportData)

      const res = await transport.sendReport(
        session.sessionToken,
        session.sessionKey,
        seq,
        reportData
      )

      if (res.status === 200) {
        printLiveStatus(session.sessionToken, Date.now(), reportData.findings)
        if (res.body?.exit) {
          console.log('\n  Server indicated examination complete. Companion exiting.')
          shutdown()
          return
        }
      } else {
        console.warn(`\n  [warning] Server response ${res.status}: ${res.body?.error?.message || 'Check failed'}`)
      }
    } catch (err) {
      console.warn(`\n  [warning] Report transmission issue: ${err.message}`)
    }

    if (isRunning) {
      // Jittered interval: ±2000 ms
      const jitter = (Math.random() - 0.5) * 4000
      const delay = Math.max(5000, heartbeatMs + jitter)
      setTimeout(runReportCycle, delay)
    }
  }

  // Launch report loop
  await runReportCycle()
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n  Fatal error: ${err.message}`)
    process.exit(1)
  })
}

module.exports = {
  parseArgs,
  main
}
