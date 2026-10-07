/**
 * ProctorNet Exam Device Companion
 * Plain-Language Terminal UX & Student Privacy Notice
 * Architecture: Prompt 4 A2 §1 & §3.6
 */

const readline = require('readline')
const { AGENT_VERSION } = require('../config')

function clearScreen() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1Bc')
  }
}

function printHeader() {
  console.log('====================================================================')
  console.log(`  ProctorNet Exam Device Companion (v${AGENT_VERSION})`)
  console.log('  Assessment Workstation Integrity Monitor')
  console.log('====================================================================\n')
}

function printPrivacyNotice() {
  console.log('  [STUDENT PRIVACY NOTICE]')
  console.log('  The Exam Device Companion verifies your workstation hardware:')
  console.log('    ✓ Checks for active remote control or screen sharing tools')
  console.log('    ✓ Checks for virtual camera drivers and multi-display setups')
  console.log('    ✓ Checks if running inside an unapproved virtual machine\n')
  console.log('  WHAT THIS COMPANION NEVER COLLECTS OR ACCESSES:')
  console.log('    ✗ NEVER collects your full process list or applications')
  console.log('    ✗ NEVER collects window titles, file paths, or usernames')
  console.log('    ✗ NEVER captures your screen, camera feed, or microphone')
  console.log('    ✗ NEVER records keystrokes, clipboard, or browser history')
  console.log('  All detection rules run locally in RAM. Only rule hits are reported.')
  console.log('--------------------------------------------------------------------\n')
}

/**
 * Prompts user for 8-character pairing code
 */
function promptPairingCode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question('  Enter the 8-character code shown on your exam screen: ', (answer) => {
      rl.close()
      resolve(answer.trim().toUpperCase())
    })
  })
}

/**
 * Displays live companion active status
 */
function printLiveStatus(sessionToken, lastReportTime, findings = []) {
  clearScreen()
  printHeader()

  console.log('  STATUS: COMPANION CONNECTED ✓\n')
  console.log(`  Session Token : ${sessionToken ? sessionToken.substring(0, 12) + '...' : 'Active'}`)
  console.log(`  Last Report   : ${lastReportTime ? new Date(lastReportTime).toLocaleTimeString() : 'Connecting...'}`)
  console.log(`  Active Status : Healthy`)

  if (findings.length > 0) {
    console.log('\n  ⚠️  ATTENTION REQUIRED:')
    for (const f of findings) {
      console.log(`    - Prohibited software detected: ${f.evidence || f.ruleId}`)
      console.log(`      Please close this application immediately to avoid exam suspension.`)
    }
  } else {
    console.log('\n  ✓ All hardware checks clear.')
  }

  console.log('\n--------------------------------------------------------------------')
  console.log('  KEEP THIS WINDOW OPEN UNTIL YOU SUBMIT YOUR EXAM.')
  console.log('  Closing this window will pause your exam attempt.')
  console.log('--------------------------------------------------------------------\n')
}

module.exports = {
  clearScreen,
  printHeader,
  printPrivacyNotice,
  promptPairingCode,
  printLiveStatus
}
