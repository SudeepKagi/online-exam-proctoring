/**
 * infra/vpn/index.js
 * VPN Provider Factory (P8 Task 1 / ADR-010)
 */

const { NoopProvider } = require('./NoopProvider')
const { FakeProvider } = require('./FakeProvider')
const { WireGuardAgentProvider } = require('./WireGuardAgentProvider')
const { WireGuardSshProvider } = require('./WireGuardSshProvider')

let cachedProvider = null

function getVpnProvider(overrideProvider = null) {
  if (overrideProvider) {
    return overrideProvider
  }

  if (cachedProvider) {
    return cachedProvider
  }

  const vpnEnabled = process.env.VPN_ENABLED === 'true'
  if (!vpnEnabled) {
    cachedProvider = new NoopProvider()
    return cachedProvider
  }

  const providerType = (process.env.VPN_PROVIDER || 'agent').toLowerCase()
  switch (providerType) {
    case 'fake':
      cachedProvider = new FakeProvider()
      break
    case 'ssh':
      cachedProvider = new WireGuardSshProvider()
      break
    case 'agent':
      cachedProvider = new WireGuardAgentProvider()
      break
    case 'noop':
    default:
      cachedProvider = new NoopProvider()
      break
  }

  return cachedProvider
}

function setVpnProvider(provider) {
  cachedProvider = provider
}

module.exports = {
  getVpnProvider,
  setVpnProvider,
  NoopProvider,
  FakeProvider,
  WireGuardAgentProvider,
  WireGuardSshProvider
}
