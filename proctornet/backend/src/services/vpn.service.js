const { execSync, exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)
const cron = require('node-cron')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const VPN_SERVER_IP = process.env.VPN_SERVER_IP
const VPN_SERVER_PORT = process.env.VPN_SERVER_PORT || '51820'
const VPN_SERVER_PUBLIC_KEY = process.env.VPN_SERVER_PUBLIC_KEY
const VPN_SUBNET = '10.0.0'
const VPN_INTERFACE = 'wg0'

// IP allocation pool
// 10.0.0.2 to 10.0.0.254 (253 students max)
let ipCounter = 2

class VPNService {

  // ──────────────────────────────────────
  // Generate WireGuard key pair for student
  // ──────────────────────────────────────
  async generateKeyPair() {
    try {
      const { stdout: privateKey } = await execAsync('wg genkey')
      const { stdout: publicKey } = await execAsync(`echo "${privateKey.trim()}" | wg pubkey`)
      
      return {
        privateKey: privateKey.trim(),
        publicKey: publicKey.trim()
      }
    } catch(err) {
      console.error('Key generation failed:', err)
      throw new Error('Failed to generate VPN keys')
    }
  }

  // ──────────────────────────────────────
  // Allocate unique IP from pool
  // ──────────────────────────────────────
  async allocateIP() {
    // Check DB for used IPs
    const usedIPs = await prisma.studentExam.findMany({
      where: {
        vpnPeerIp: { not: null },
        status: 'ACTIVE'
      },
      select: { vpnPeerIp: true }
    })
    
    const usedSet = new Set(usedIPs.map(s => s.vpnPeerIp))
    
    // Find available IP
    for(let i = 2; i <= 254; i++) {
      const ip = `${VPN_SUBNET}.${i}`
      if(!usedSet.has(ip)) return ip
    }
    
    throw new Error('No IPs available in pool')
  }

  // ──────────────────────────────────────
  // Add peer to WireGuard server
  // ──────────────────────────────────────
  async addPeer(publicKey, peerIp) {
    try {
      const command = `wg set ${VPN_INTERFACE} peer ${publicKey} allowed-ips ${peerIp}/32`
      
      await execAsync(command)
      
      // Save config permanently
      await execAsync(`wg-quick save ${VPN_INTERFACE}`)
      
      console.log(`Peer added: ${peerIp} → ${publicKey}`)
      return true
    } catch(err) {
      console.error('Add peer failed:', err)
      throw new Error('Failed to add VPN peer')
    }
  }

  // ──────────────────────────────────────
  // Remove peer from WireGuard
  // ──────────────────────────────────────
  async removePeer(publicKey) {
    try {
      const command = `wg set ${VPN_INTERFACE} peer ${publicKey} remove`
      
      await execAsync(command)
      await execAsync(`wg-quick save ${VPN_INTERFACE}`)
      
      console.log(`Peer removed: ${publicKey}`)
      return true
    } catch(err) {
      console.error('Remove peer failed:', err)
      return false
    }
  }

  // ──────────────────────────────────────
  // Generate complete VPN config for student
  // ──────────────────────────────────────
  async generateStudentConfig(studentId, examId, examEndTime) {
    try {
      // Generate key pair
      const { privateKey, publicKey } = await this.generateKeyPair()
      
      // Allocate IP
      const peerIp = await this.allocateIP()
      
      // Add to WireGuard server
      await this.addPeer(publicKey, peerIp)
      
      // Calculate expiry (exam end + 10 min buffer)
      const expiry = new Date(new Date(examEndTime).getTime() + 10 * 60 * 1000)
      
      // Build config file content
      const config = this.buildConfigFile(privateKey, peerIp)
      
      // Store in DB
      await prisma.studentExam.update({
        where: { studentId_examId: { studentId, examId } },
        data: {
          vpnKey: publicKey,
          vpnPrivateKey: privateKey,
          vpnPeerIp: peerIp,
          vpnKeyExpiry: expiry
        }
      })
      
      return {
        config,       // Full WireGuard config text
        publicKey,
        privateKey,
        peerIp,
        expiry,
        serverIp: VPN_SERVER_IP,
        serverPort: VPN_SERVER_PORT
      }
    } catch(err) {
      console.error('Config generation failed:', err)
      throw err
    }
  }

  // ──────────────────────────────────────
  // Build WireGuard config file content
  // ──────────────────────────────────────
  buildConfigFile(privateKey, peerIp) {
    return `[Interface]
PrivateKey = ${privateKey}
Address = ${peerIp}/24
DNS = 10.0.0.1

[Peer]
PublicKey = ${VPN_SERVER_PUBLIC_KEY}
Endpoint = ${VPN_SERVER_IP}:${VPN_SERVER_PORT}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25`
  }

  // ──────────────────────────────────────
  // Verify student is connected to VPN
  // ──────────────────────────────────────
  async isStudentConnected(peerIp) {
    try {
      const { stdout } = await execAsync(`wg show ${VPN_INTERFACE} peers`)
      const { stdout: transfer } = await execAsync(`wg show ${VPN_INTERFACE} transfer`)
      const { stdout: handshakes } = await execAsync(`wg show ${VPN_INTERFACE} latest-handshakes`)
      
      // Parse handshakes output
      const lines = handshakes.split('\n')
      for(const line of lines) {
        const parts = line.trim().split('\t')
        if(parts.length >= 2) {
          const timestamp = parseInt(parts[1])
          const now = Math.floor(Date.now() / 1000)
          // Connected if handshake within 3 minutes
          if(now - timestamp < 180) {
            return true
          }
        }
      }
      return false
    } catch(err) {
      return false
    }
  }

  // ──────────────────────────────────────
  // Revoke expired keys (cron job)
  // ──────────────────────────────────────
  startAutoRevoke() {
    // Run every minute
    cron.schedule('* * * * *', async () => {
      try {
        const expired = await prisma.studentExam.findMany({
          where: {
            vpnKey: { not: null },
            vpnKeyExpiry: { lt: new Date() },
            status: { in: ['SUBMITTED', 'TERMINATED'] }
          }
        })
        
        for(const studentExam of expired) {
          if(studentExam.vpnKey) {
            await this.removePeer(studentExam.vpnKey)
            await prisma.studentExam.update({
              where: { id: studentExam.id },
              data: { vpnKey: null, vpnPeerIp: null }
            })
            console.log(`VPN key revoked for student: ${studentExam.studentId}`)
          }
        }
      } catch(err) {
        console.error('Auto-revoke error:', err)
      }
    })
    
    console.log('VPN auto-revoke cron started')
  }

  // ──────────────────────────────────────
  // Manually revoke a student's VPN access
  // ──────────────────────────────────────
  async revokeStudentAccess(studentId, examId) {
    try {
      const studentExam = await prisma.studentExam.findFirst({
        where: { studentId, examId }
      })
      
      if(studentExam?.vpnKey) {
        await this.removePeer(studentExam.vpnKey)
        await prisma.studentExam.update({
          where: { id: studentExam.id },
          data: { vpnKey: null, vpnPeerIp: null }
        })
      }
      
      return true
    } catch(err) {
      console.error('Manual revoke failed:', err)
      return false
    }
  }

  // ──────────────────────────────────────
  // Get VPN server status
  // ──────────────────────────────────────
  async getServerStatus() {
    try {
      const { stdout } = await execAsync(`wg show ${VPN_INTERFACE}`)
      
      const lines = stdout.split('\n')
      const peerCount = lines.filter(l => l.includes('peer:')).length
      
      return {
        isRunning: true,
        connectedPeers: peerCount,
        interface: VPN_INTERFACE,
        serverIp: VPN_SERVER_IP
      }
    } catch(err) {
      return {
        isRunning: false,
        connectedPeers: 0,
        error: err.message
      }
    }
  }
}

module.exports = new VPNService()
