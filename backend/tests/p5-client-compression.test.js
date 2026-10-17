const { describe, it } = require('node:test')
const assert = require('node:assert')
const sharp = require('sharp')

// Replicate pure dimension logic from frontend/src/lib/imageCompress.js for automated Node verification
function calculateDimensions(srcWidth, srcHeight, maxWidth = 1280, maxHeight = 720) {
  let width = srcWidth
  let height = srcHeight

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  return { width, height }
}

describe('P5 Client-Side Compression & EXIF Stripping Verification', () => {
  it('correctly downscales 1920x1080 to 1280x720 preserving 16:9 aspect ratio', () => {
    const { width, height } = calculateDimensions(1920, 1080, 1280, 720)
    assert.equal(width, 1280)
    assert.equal(height, 720)
    assert.equal((1920 / 1080).toFixed(4), (width / height).toFixed(4))
  })

  it('correctly downscales 4K (3840x2160) to 1280x720', () => {
    const { width, height } = calculateDimensions(3840, 2160, 1280, 720)
    assert.equal(width, 1280)
    assert.equal(height, 720)
  })

  it('correctly bounds 2048x2048 profile photo to 1024x1024 (1:1 aspect ratio)', () => {
    const { width, height } = calculateDimensions(2048, 2048, 1024, 1024)
    assert.equal(width, 1024)
    assert.equal(height, 1024)
  })

  it('does not enlarge images that are already smaller than maximum bounds', () => {
    const { width, height } = calculateDimensions(640, 480, 1280, 720)
    assert.equal(width, 640)
    assert.equal(height, 480)
  })

  it('strips all EXIF metadata and meets target size budget (<= 120 KB)', async () => {
    // 1. Create high-resolution image with mock EXIF metadata
    const rawBuffer = await sharp({
      create: {
        width: 1920,
        height: 1080,
        channels: 3,
        background: { r: 120, g: 150, b: 180 }
      }
    })
      .withMetadata({
        exif: {
          IFD0: {
            Artist: 'ProctorNet Candidate',
            Make: 'Candidate Device Camera',
            Model: 'HD Webcam'
          }
        }
      })
      .jpeg()
      .toBuffer()

    const rawMeta = await sharp(rawBuffer).metadata()
    assert.ok(rawMeta.exif, 'Raw test image should contain EXIF metadata')

    // 2. Perform client-equivalent compression pipeline (downscale + re-rasterize to WebP)
    const { width, height } = calculateDimensions(rawMeta.width, rawMeta.height, 1280, 720)

    const compressedBuffer = await sharp(rawBuffer)
      .resize({ width, height })
      .webp({ quality: 60 })
      .toBuffer()

    // 3. Assertions
    const compressedMeta = await sharp(compressedBuffer).metadata()

    // Assert dimensions
    assert.equal(compressedMeta.width, 1280)
    assert.equal(compressedMeta.height, 720)

    // Assert EXIF metadata is completely stripped
    assert.equal(compressedMeta.exif, undefined, 'Compressed image must not contain any EXIF metadata')

    // Assert format is WebP
    assert.equal(compressedMeta.format, 'webp')

    // Assert size is within the 120 KB target budget
    assert.ok(
      compressedBuffer.length <= 120 * 1024,
      `Output size (${compressedBuffer.length} bytes) must be <= 120 KB`
    )
  })
})
