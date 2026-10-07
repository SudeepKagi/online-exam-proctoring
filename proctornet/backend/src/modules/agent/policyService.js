const { prisma } = require('../../infra/postgres/client')
const { signPolicyBundle, verifyPolicySignature, getPolicyKeyPair } = require('../../utils/encryption')

const SEED_RULES = [
  // 1. Remote Access Software (Action: SUSPEND)
  {
    id: 'r-remote-anydesk',
    version: 1,
    category: 'REMOTE_ACCESS',
    name: 'AnyDesk Remote Desktop',
    matchers: { type: 'exeName', value: 'anydesk' },
    severity: 'CRITICAL',
    action: 'SUSPEND',
    enabled: true
  },
  {
    id: 'r-remote-teamviewer',
    version: 1,
    category: 'REMOTE_ACCESS',
    name: 'TeamViewer Remote Control',
    matchers: { type: 'exeName', value: 'teamviewer' },
    severity: 'CRITICAL',
    action: 'SUSPEND',
    enabled: true
  },
  {
    id: 'r-remote-ultraviewer',
    version: 1,
    category: 'REMOTE_ACCESS',
    name: 'UltraViewer Remote Desktop',
    matchers: { type: 'exeName', value: 'ultraviewer' },
    severity: 'CRITICAL',
    action: 'SUSPEND',
    enabled: true
  },
  {
    id: 'r-remote-rustdesk',
    version: 1,
    category: 'REMOTE_ACCESS',
    name: 'RustDesk Remote Control',
    matchers: { type: 'exeName', value: 'rustdesk' },
    severity: 'CRITICAL',
    action: 'SUSPEND',
    enabled: true
  },
  {
    id: 'r-remote-parsec',
    version: 1,
    category: 'REMOTE_ACCESS',
    name: 'Parsec Low-Latency Remote',
    matchers: { type: 'exeName', value: 'parsec' },
    severity: 'CRITICAL',
    action: 'SUSPEND',
    enabled: true
  },
  {
    id: 'r-remote-splashtop',
    version: 1,
    category: 'REMOTE_ACCESS',
    name: 'Splashtop Remote Desktop',
    matchers: { type: 'exeName', value: 'splashtop' },
    severity: 'CRITICAL',
    action: 'SUSPEND',
    enabled: true
  },
  {
    id: 'r-remote-vnc-server',
    version: 1,
    category: 'REMOTE_ACCESS',
    name: 'VNC Server Daemon',
    matchers: { type: 'exeName', value: 'winvnc' },
    severity: 'CRITICAL',
    action: 'SUSPEND',
    enabled: true
  },
  {
    id: 'r-remote-chrome-host',
    version: 1,
    category: 'REMOTE_ACCESS',
    name: 'Chrome Remote Desktop Host',
    matchers: { type: 'exeName', value: 'remoting_host' },
    severity: 'CRITICAL',
    action: 'SUSPEND',
    enabled: true
  },

  // 2. Remote Session Indicators
  {
    id: 'r-session-rdpclip',
    version: 1,
    category: 'REMOTE_SESSION',
    name: 'Inbound Remote Desktop Session (rdpclip)',
    matchers: { type: 'exeName', value: 'rdpclip' },
    severity: 'CRITICAL',
    action: 'SUSPEND',
    enabled: true
  },
  {
    id: 'r-session-mstsc',
    version: 1,
    category: 'REMOTE_SESSION',
    name: 'Outbound Remote Desktop Client (mstsc)',
    matchers: { type: 'exeName', value: 'mstsc' },
    severity: 'HIGH',
    action: 'FLAG',
    enabled: true
  },

  // 3. Screen Recording & Stream Hijacking (Action: FLAG)
  {
    id: 'r-capture-obs64',
    version: 1,
    category: 'SCREEN_CAPTURE',
    name: 'OBS Studio (64-bit)',
    matchers: { type: 'exeName', value: 'obs64' },
    severity: 'HIGH',
    action: 'FLAG',
    enabled: true
  },
  {
    id: 'r-capture-obs32',
    version: 1,
    category: 'SCREEN_CAPTURE',
    name: 'OBS Studio (32-bit)',
    matchers: { type: 'exeName', value: 'obs32' },
    severity: 'HIGH',
    action: 'FLAG',
    enabled: true
  },
  {
    id: 'r-capture-streamlabs',
    version: 1,
    category: 'SCREEN_CAPTURE',
    name: 'Streamlabs Desktop',
    matchers: { type: 'exeName', value: 'streamlabs' },
    severity: 'HIGH',
    action: 'FLAG',
    enabled: true
  },
  {
    id: 'r-capture-camtasia',
    version: 1,
    category: 'SCREEN_CAPTURE',
    name: 'Camtasia Studio Recorder',
    matchers: { type: 'exeName', value: 'camtasia' },
    severity: 'HIGH',
    action: 'FLAG',
    enabled: true
  },
  {
    id: 'r-capture-bandicam',
    version: 1,
    category: 'SCREEN_CAPTURE',
    name: 'Bandicam Screen Recorder',
    matchers: { type: 'exeName', value: 'bandicam' },
    severity: 'HIGH',
    action: 'FLAG',
    enabled: true
  },

  // 4. Virtual Camera Drivers (Action: BLOCK_START)
  {
    id: 'r-vcam-obs',
    version: 1,
    category: 'VIRTUAL_CAMERA',
    name: 'OBS Virtual Camera Driver',
    matchers: { type: 'deviceName', value: 'obs virtual camera' },
    severity: 'CRITICAL',
    action: 'BLOCK_START',
    enabled: true
  },
  {
    id: 'r-vcam-manycam',
    version: 1,
    category: 'VIRTUAL_CAMERA',
    name: 'ManyCam Virtual Video Source',
    matchers: { type: 'deviceName', value: 'manycam' },
    severity: 'CRITICAL',
    action: 'BLOCK_START',
    enabled: true
  },
  {
    id: 'r-vcam-v4l2loopback',
    version: 1,
    category: 'VIRTUAL_CAMERA',
    name: 'Linux v4l2loopback Virtual Camera',
    matchers: { type: 'deviceName', value: 'v4l2loopback' },
    severity: 'CRITICAL',
    action: 'BLOCK_START',
    enabled: true
  },

  // 5. AI Desktop Assistants (Action: FLAG)
  {
    id: 'r-ai-ollama',
    version: 1,
    category: 'AI_ASSISTANT',
    name: 'Ollama Local LLM Daemon',
    matchers: { type: 'exeName', value: 'ollama' },
    severity: 'HIGH',
    action: 'FLAG',
    enabled: true
  },
  {
    id: 'r-ai-lmstudio',
    version: 1,
    category: 'AI_ASSISTANT',
    name: 'LM Studio Desktop Client',
    matchers: { type: 'exeName', value: 'lmstudio' },
    severity: 'HIGH',
    action: 'FLAG',
    enabled: true
  },
  {
    id: 'r-ai-chatgpt',
    version: 1,
    category: 'AI_ASSISTANT',
    name: 'ChatGPT Desktop Client',
    matchers: { type: 'exeName', value: 'chatgpt' },
    severity: 'HIGH',
    action: 'FLAG',
    enabled: true
  },
  {
    id: 'r-ai-claude',
    version: 1,
    category: 'AI_ASSISTANT',
    name: 'Claude Desktop Application',
    matchers: { type: 'exeName', value: 'claude' },
    severity: 'HIGH',
    action: 'FLAG',
    enabled: true
  },
  {
    id: 'r-ai-cursor',
    version: 1,
    category: 'AI_ASSISTANT',
    name: 'Cursor AI Editor Binary',
    matchers: { type: 'exeName', value: 'cursor' },
    severity: 'HIGH',
    action: 'FLAG',
    enabled: true
  },

  // 6. Virtual Machine Indicators (Action: FLAG)
  {
    id: 'r-vm-virtualbox',
    version: 1,
    category: 'VIRTUAL_MACHINE',
    name: 'VirtualBox Emulated Hardware',
    matchers: { type: 'hardwareString', value: 'VirtualBox' },
    severity: 'HIGH',
    action: 'FLAG',
    enabled: true
  },
  {
    id: 'r-vm-vmware',
    version: 1,
    category: 'VIRTUAL_MACHINE',
    name: 'VMware Virtual Platform',
    matchers: { type: 'hardwareString', value: 'VMware' },
    severity: 'HIGH',
    action: 'FLAG',
    enabled: true
  },
  {
    id: 'r-vm-qemu',
    version: 1,
    category: 'VIRTUAL_MACHINE',
    name: 'QEMU/KVM Virtual Machine',
    matchers: { type: 'hardwareString', value: 'QEMU' },
    severity: 'HIGH',
    action: 'FLAG',
    enabled: true
  },

  // 7. Multi-Display Indicators (Action: WARN)
  {
    id: 'r-display-multiple',
    version: 1,
    category: 'DISPLAY',
    name: 'Multiple Displays Connected',
    matchers: { type: 'displayCount', max: 1 },
    severity: 'MEDIUM',
    action: 'WARN',
    enabled: true
  }
]

let cachedPolicyBundle = null

class PolicyService {
  /**
   * Seed rules in database if empty
   */
  async seedRulesIfEmpty() {
    const count = await prisma.agentRule.count()
    if (count === 0) {
      for (const rule of SEED_RULES) {
        await prisma.agentRule.create({ data: rule })
      }
    }
  }

  /**
   * Retrieve active rules and publish signed policy version
   */
  async getLatestSignedPolicy(forceRefresh = false) {
    if (cachedPolicyBundle && !forceRefresh) {
      return cachedPolicyBundle
    }

    await this.seedRulesIfEmpty()

    // Find latest policy version record
    let latestVersion = await prisma.agentPolicyVersion.findFirst({
      orderBy: { version: 'desc' }
    })

    if (latestVersion && !forceRefresh) {
      const isValid = verifyPolicySignature(latestVersion.bundle, latestVersion.signature, getPolicyKeyPair().publicKey)
      if (!isValid) {
        latestVersion = null
      }
    }

    if (!latestVersion || forceRefresh) {
      const activeRules = await prisma.agentRule.findMany({
        where: { enabled: true }
      })

      const versionNum = (latestVersion?.version || 0) + 1
      const unsignedBundle = {
        version: versionNum,
        issuedAt: new Date().toISOString(),
        rules: activeRules.map(r => ({
          id: r.id,
          category: r.category,
          name: r.name,
          matchers: r.matchers,
          severity: r.severity,
          action: r.action
        })),
        heartbeatMs: 15000,
        minAgentVersion: '1.0.0'
      }

      const signature = signPolicyBundle(unsignedBundle)

      latestVersion = await prisma.agentPolicyVersion.create({
        data: {
          version: versionNum,
          bundle: unsignedBundle,
          signature
        }
      })
    }

    cachedPolicyBundle = {
      ...latestVersion.bundle,
      signature: latestVersion.signature,
      publicKey: getPolicyKeyPair().publicKey
    }

    return cachedPolicyBundle
  }

  /**
   * Invalidate policy cache
   */
  invalidateCache() {
    cachedPolicyBundle = null
  }
}

const policyService = new PolicyService()

module.exports = {
  policyService,
  SEED_RULES
}
