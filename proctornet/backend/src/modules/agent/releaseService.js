const { prisma } = require('../../infra/postgres/client')
const { getPresignedReadUrl } = require('../../infra/s3/s3.client')
const { NotFoundError, BadRequestError } = require('../../shared/errors')
const { logger } = require('../../shared/logging')

const PRIVACY_NOTICE_VERSION = '2026.1'
const DEFAULT_MIN_VERSION = '1.0.0'

class ReleaseService {
  /**
   * Return client manifest with latest version and hashes per OS
   */
  async getManifest() {
    const releases = await prisma.agentRelease.findMany({
      where: { revokedAt: null },
      orderBy: { createdAt: 'desc' }
    })

    // Group latest by OS
    const latestByOs = {}
    for (const rel of releases) {
      if (!latestByOs[rel.os]) {
        latestByOs[rel.os] = {
          version: rel.version,
          arch: rel.arch,
          sha256: rel.sha256,
          sizeBytes: rel.sizeBytes,
          signed: rel.signed,
          minSupported: rel.minSupported,
          downloadUrl: `/api/v1/agent/download?os=${rel.os}`
        }
      }
    }

    return {
      manifestVersion: 1,
      minSupportedVersion: DEFAULT_MIN_VERSION,
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      platforms: latestByOs,
      serverTime: new Date().toISOString()
    }
  }

  /**
   * Resolve download URL for specific OS platform
   */
  async getDownloadRedirect(os) {
    const validOs = ['win', 'mac-arm64', 'mac-x64', 'linux']
    if (!validOs.includes(os)) {
      throw new BadRequestError(`Invalid platform OS '${os}'. Allowed: ${validOs.join(', ')}`)
    }

    const release = await prisma.agentRelease.findFirst({
      where: {
        os,
        revokedAt: null
      },
      orderBy: { createdAt: 'desc' }
    })

    if (!release) {
      // In dev/pilot, provide a friendly placeholder or local build URL
      return {
        url: `/downloads/proctornet-companion-${os}.zip`,
        release: null
      }
    }

    if (release.s3Key) {
      const presignedUrl = await getPresignedReadUrl(release.s3Key, 900) // 15m expiry
      if (presignedUrl) {
        return { url: presignedUrl, release }
      }
    }

    return {
      url: `/downloads/proctornet-companion-${os}.zip`,
      release
    }
  }

  /**
   * Register a new binary release (CI / Admin)
   */
  async registerRelease(data) {
    const { version, os, arch, sha256, sizeBytes, s3Key, signed, minSupported } = data

    const existing = await prisma.agentRelease.findUnique({
      where: {
        version_os_arch: { version, os, arch }
      }
    })

    if (existing) {
      return prisma.agentRelease.update({
        where: { id: existing.id },
        data: {
          sha256,
          sizeBytes,
          s3Key,
          signed: Boolean(signed),
          minSupported: Boolean(minSupported),
          revokedAt: null
        }
      })
    }

    return prisma.agentRelease.create({
      data: {
        version,
        os,
        arch,
        sha256,
        sizeBytes,
        s3Key,
        signed: Boolean(signed),
        minSupported: Boolean(minSupported)
      }
    })
  }

  /**
   * Revoke a compromised or faulty release
   */
  async revokeRelease(releaseId) {
    const release = await prisma.agentRelease.findUnique({
      where: { id: releaseId }
    })

    if (!release) {
      throw new NotFoundError(`Release '${releaseId}' not found`)
    }

    return prisma.agentRelease.update({
      where: { id: releaseId },
      data: { revokedAt: new Date() }
    })
  }
}

const releaseService = new ReleaseService()

module.exports = {
  releaseService,
  PRIVACY_NOTICE_VERSION
}
