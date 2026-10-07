const {
  RekognitionClient,
  DetectFacesCommand,
  CompareFacesCommand
} = require('@aws-sdk/client-rekognition')
const { logger } = require('../../../shared/logging')

class RekognitionDriver {
  constructor(options = {}) {
    this.region = options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1'
    this.defaultBucket = options.bucket || process.env.S3_BUCKET_NAME || 'proctornet-evidence'
    this.timeoutMs = options.timeoutMs || 4000

    const clientConfig = {
      region: this.region
    }

    if (process.env.AWS_ENDPOINT_URL || process.env.LOCALSTACK_HOSTNAME) {
      const endpoint = process.env.AWS_ENDPOINT_URL || `http://${process.env.LOCALSTACK_HOSTNAME || '127.0.0.1'}:4566`
      clientConfig.endpoint = endpoint
    }

    this.client = new RekognitionClient(clientConfig)
    this.providerName = 'rekognition'
    this.modelVersion = 'aws-rekognition-v1'
  }

  /**
   * Resolve imageRef into AWS Rekognition Image parameter
   * Prioritizes S3Object references directly to avoid transiting bytes through the EC2 app tier
   */
  _resolveImageParam(imageRef) {
    if (!imageRef) {
      throw new Error('Missing imageRef for Rekognition analysis')
    }

    if (typeof imageRef === 'string') {
      return {
        S3Object: {
          Bucket: this.defaultBucket,
          Name: imageRef
        }
      }
    }

    if (imageRef.s3Object) {
      return {
        S3Object: {
          Bucket: imageRef.s3Object.bucket || this.defaultBucket,
          Name: imageRef.s3Object.key || imageRef.s3Object.name
        }
      }
    }

    if (imageRef.buffer || Buffer.isBuffer(imageRef)) {
      return {
        Bytes: imageRef.buffer || imageRef
      }
    }

    if (imageRef.key) {
      return {
        S3Object: {
          Bucket: imageRef.bucket || this.defaultBucket,
          Name: imageRef.key
        }
      }
    }

    throw new Error('Unsupported imageRef format for Rekognition driver')
  }

  /**
   * DetectFaces for quality gating, pose, and occlusion
   * @param {string|object} imageRef
   * @returns {Promise<{ faceCount: number, boundingBox: object|null, quality: object, pose: object, eyesOpen: boolean, occluded: boolean }>}
   */
  async detect(imageRef) {
    const Image = this._resolveImageParam(imageRef)

    const command = new DetectFacesCommand({
      Image,
      Attributes: ['ALL']
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await this.client.send(command, {
        abortSignal: controller.signal
      })

      const faces = response.FaceDetails || []
      const faceCount = faces.length

      if (faceCount === 0) {
        return {
          faceCount: 0,
          boundingBox: null,
          quality: { brightness: 0, sharpness: 0 },
          pose: { yaw: 0, pitch: 0, roll: 0 },
          eyesOpen: false,
          occluded: false,
          confidence: 0,
          requestId: response.$metadata?.requestId || null,
          provider: this.providerName
        }
      }

      // Select primary face with largest bounding box area
      const primary = faces.reduce((prev, curr) => {
        const prevArea = (prev.BoundingBox?.Width || 0) * (prev.BoundingBox?.Height || 0)
        const currArea = (curr.BoundingBox?.Width || 0) * (curr.BoundingBox?.Height || 0)
        return currArea > prevArea ? curr : prev
      }, faces[0])

      const boundingBox = {
        top: primary.BoundingBox?.Top ?? 0,
        left: primary.BoundingBox?.Left ?? 0,
        width: primary.BoundingBox?.Width ?? 0,
        height: primary.BoundingBox?.Height ?? 0
      }

      const quality = {
        brightness: primary.Quality?.Brightness ?? 0,
        sharpness: primary.Quality?.Sharpness ?? 0
      }

      const pose = {
        yaw: primary.Pose?.Yaw ?? 0,
        pitch: primary.Pose?.Pitch ?? 0,
        roll: primary.Pose?.Roll ?? 0
      }

      const eyesOpen = Boolean(primary.EyesOpen?.Value)
      const occluded = Boolean(primary.FaceOccluded?.Value || primary.Sunglasses?.Value)

      return {
        faceCount,
        boundingBox,
        quality,
        pose,
        eyesOpen,
        occluded,
        confidence: primary.Confidence ?? 0,
        requestId: response.$metadata?.requestId || null,
        provider: this.providerName
      }
    } catch (err) {
      logger.error({ error: err.message, imageRef }, 'Rekognition detect error')
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * CompareFaces between reference and live probe image
   * @param {string|object} srcRef - Reference enrollment image
   * @param {string|object} tgtRef - Live probe image
   * @returns {Promise<{ similarity: number, faceConfidence: number, requestId: string, provider: string, modelVersion: string }>}
   */
  async compare(srcRef, tgtRef) {
    const SourceImage = this._resolveImageParam(srcRef)
    const TargetImage = this._resolveImageParam(tgtRef)

    const command = new CompareFacesCommand({
      SourceImage,
      TargetImage,
      SimilarityThreshold: 0,
      QualityFilter: 'AUTO'
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await this.client.send(command, {
        abortSignal: controller.signal
      })

      const matches = response.FaceMatches || []

      if (matches.length > 0) {
        const topMatch = matches[0]
        return {
          similarity: topMatch.Similarity ?? 0.0,
          faceConfidence: topMatch.Face?.Confidence ?? 0.0,
          requestId: response.$metadata?.requestId || null,
          provider: this.providerName,
          modelVersion: this.modelVersion
        }
      }

      const unmatchedConfidence = response.UnmatchedFaces?.[0]?.Confidence ?? 0.0
      return {
        similarity: 0.0,
        faceConfidence: unmatchedConfidence,
        requestId: response.$metadata?.requestId || null,
        provider: this.providerName,
        modelVersion: this.modelVersion
      }
    } catch (err) {
      logger.error({ error: err.message, srcRef, tgtRef }, 'Rekognition compare error')
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

module.exports = {
  RekognitionDriver
}
