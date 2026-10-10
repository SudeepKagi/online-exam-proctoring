import { spawn, ChildProcess } from 'child_process'
import path from 'path'

export interface CompanionProcess {
  process: ChildProcess
  kill: () => void
  getLogs: () => string
}

const AGENT_DIR = path.resolve(__dirname, '../../proctornet/device-agent')

/**
 * Starts the ProctorNet Exam Device Companion agent from source as a child process
 */
export function startCompanionAgent(pairingCode: string, serverUrl = 'http://localhost:5000'): CompanionProcess {
  let logs = ''

  const proc = spawn('node', ['src/main.js', '--server', serverUrl, '--code', pairingCode], {
    cwd: AGENT_DIR,
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  proc.stdout?.on('data', data => {
    const text = data.toString()
    logs += text
    if (process.env.DEBUG_COMPANION) {
      process.stdout.write(`[COMPANION] ${text}`)
    }
  })

  proc.stderr?.on('data', data => {
    const text = data.toString()
    logs += text
    if (process.env.DEBUG_COMPANION) {
      process.stderr.write(`[COMPANION_ERR] ${text}`)
    }
  })

  return {
    process: proc,
    kill: () => {
      if (!proc.killed) {
        proc.kill('SIGTERM')
      }
    },
    getLogs: () => logs
  }
}
