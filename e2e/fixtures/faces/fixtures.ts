/**
 * Face Fixtures for Deterministic Testing (Prompt 8 §U4.2)
 * Fixtures represent genuine candidate, impostor, no-face, and two-faces.
 */

// 1x1 transparent PNG data URL as base fixture
export const TINY_FACE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

export interface FaceFixture {
  id: string
  label: string
  faceCount: number
  similarityToGenuine: number
  heightRatio: number
  brightness: number
  sharpness: number
  poseYawDeg: number
  expectedDecision: 'PASS' | 'FAIL' | 'REVIEW' | 'QUALITY_REJECT'
  expectedMessage?: string
}

export const FACE_FIXTURES: Record<string, FaceFixture> = {
  genuine: {
    id: 'fixture-genuine-01',
    label: 'Genuine Candidate Face',
    faceCount: 1,
    similarityToGenuine: 98.5,
    heightRatio: 0.55,
    brightness: 82,
    sharpness: 90,
    poseYawDeg: 2,
    expectedDecision: 'PASS'
  },
  impostor: {
    id: 'fixture-impostor-01',
    label: 'Impostor Face (Different Identity)',
    faceCount: 1,
    similarityToGenuine: 42.1,
    heightRatio: 0.50,
    brightness: 78,
    sharpness: 85,
    poseYawDeg: 5,
    expectedDecision: 'FAIL',
    expectedMessage: 'Identity verification failed: low similarity'
  },
  noFace: {
    id: 'fixture-noface-01',
    label: 'No Face in Frame',
    faceCount: 0,
    similarityToGenuine: 0.0,
    heightRatio: 0.0,
    brightness: 60,
    sharpness: 70,
    poseYawDeg: 0,
    expectedDecision: 'QUALITY_REJECT',
    expectedMessage: 'No face detected in camera view'
  },
  twoFaces: {
    id: 'fixture-twofaces-01',
    label: 'Multiple Faces in Frame',
    faceCount: 2,
    similarityToGenuine: 0.0,
    heightRatio: 0.40,
    brightness: 75,
    sharpness: 80,
    poseYawDeg: 0,
    expectedDecision: 'QUALITY_REJECT',
    expectedMessage: 'Multiple individuals detected in frame'
  }
}
