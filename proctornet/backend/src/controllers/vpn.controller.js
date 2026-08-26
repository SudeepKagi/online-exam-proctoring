const vpnService = require('../services/vpnService')

/**
 * Issue or retrieve WireGuard VPN config for an exam session
 * POST /api/vpn/issue/:examId
 */
async function issueVpnConfig(req, res) {
  try {
    const { examId } = req.params
    const studentId = req.user.id

    const result = await vpnService.issueVpnConfig({ studentId, examId })
    return res.status(200).json(result)
  } catch (error) {
    console.error('[vpnController.issueVpnConfig]', error)
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to issue VPN configuration.'
    })
  }
}

/**
 * Get current VPN status for an exam session
 * GET /api/vpn/status/:examId
 */
async function getVpnStatus(req, res) {
  try {
    const { examId } = req.params
    const studentId = req.user.id

    const result = await vpnService.getVpnStatus({ studentId, examId })
    return res.status(200).json(result)
  } catch (error) {
    console.error('[vpnController.getVpnStatus]', error)
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to retrieve VPN status.'
    })
  }
}

/**
 * Revoke VPN configuration for an exam session
 * POST /api/vpn/revoke/:examId
 */
async function revokeVpnPeer(req, res) {
  try {
    const { examId } = req.params
    const studentId = req.user.id

    const result = await vpnService.revokeVpnPeer({ studentId, examId })
    return res.status(200).json(result)
  } catch (error) {
    console.error('[vpnController.revokeVpnPeer]', error)
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to revoke VPN configuration.'
    })
  }
}

module.exports = {
  issueVpnConfig,
  getVpnStatus,
  revokeVpnPeer
}
