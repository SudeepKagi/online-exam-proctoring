import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { cameraStore } from './cameraStore.js'

describe('Unit: cameraStore Lifecycle & MediaStream Owner', () => {
  let originalNavigatorDescriptor
  let originalWindowDescriptor

  beforeEach(() => {
    originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    cameraStore.releaseCamera('manual')
  })

  afterEach(() => {
    cameraStore.releaseCamera('manual')
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor)
    } else {
      delete globalThis.navigator
    }
    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
    } else {
      delete globalThis.window
    }
  })

  function setMockNavigator(mockNav) {
    Object.defineProperty(globalThis, 'navigator', {
      value: mockNav,
      configurable: true,
      writable: true
    })
  }

  test('initial state defaults to idle with no active stream', () => {
    const state = cameraStore.getState()
    assert.equal(state.status, 'idle')
    assert.equal(state.stream, null)
    assert.equal(state.hasFrames, false)
    assert.equal(state.selectedDeviceId, null)
    assert.equal(state.error, null)
  })

  test('requestCamera transitions to live and stores active MediaStream', async () => {
    let stopCalled = false
    const mockTrack = {
      readyState: 'live',
      getSettings: () => ({ deviceId: 'cam-1' }),
      addEventListener: () => {},
      removeEventListener: () => {},
      stop: () => { stopCalled = true }
    }
    const mockStream = {
      active: true,
      getVideoTracks: () => [mockTrack],
      getTracks: () => [mockTrack]
    }

    setMockNavigator({
      mediaDevices: {
        getUserMedia: async () => mockStream,
        enumerateDevices: async () => [{ kind: 'videoinput', deviceId: 'cam-1', label: 'HD Webcam' }]
      }
    })

    const acquiredStream = await cameraStore.requestCamera()
    assert.equal(acquiredStream, mockStream)
    assert.equal(cameraStore.getState().status, 'live')
    assert.equal(cameraStore.getStream(), mockStream)
    assert.equal(stopCalled, false)
  })

  test('requestCamera reuses existing live stream across routes without renegotiation', async () => {
    let getUserMediaCalls = 0
    const mockTrack = {
      readyState: 'live',
      getSettings: () => ({ deviceId: 'default-cam' }),
      addEventListener: () => {},
      removeEventListener: () => {},
      stop: () => {}
    }
    const mockStream = {
      active: true,
      getVideoTracks: () => [mockTrack],
      getTracks: () => [mockTrack]
    }

    setMockNavigator({
      mediaDevices: {
        getUserMedia: async () => {
          getUserMediaCalls++
          return mockStream
        },
        enumerateDevices: async () => []
      }
    })

    await cameraStore.requestCamera()
    assert.equal(getUserMediaCalls, 1)

    // Re-request without forceNew should return the same stream immediately
    const reusedStream = await cameraStore.requestCamera()
    assert.equal(reusedStream, mockStream)
    assert.equal(getUserMediaCalls, 1)
  })

  test('maps NotAllowedError to denied state and NotReadableError to in_use state', async () => {
    setMockNavigator({
      mediaDevices: {
        getUserMedia: async () => {
          const err = new Error('Permission denied')
          err.name = 'NotAllowedError'
          throw err
        }
      }
    })

    await assert.rejects(async () => {
      await cameraStore.requestCamera({ forceNew: true })
    })
    assert.equal(cameraStore.getState().status, 'denied')
    assert.match(cameraStore.getState().error, /permit|blocked/i)

    setMockNavigator({
      mediaDevices: {
        getUserMedia: async () => {
          const err = new Error('Device busy')
          err.name = 'NotReadableError'
          throw err
        }
      }
    })

    await assert.rejects(async () => {
      await cameraStore.requestCamera({ forceNew: true })
    })
    assert.equal(cameraStore.getState().status, 'in_use')
    assert.match(cameraStore.getState().error, /already in use/i)
  })

  test('releaseCamera preserves stream on route transition and stops tracks on submit/logout', async () => {
    let stopped = false
    const mockTrack = {
      readyState: 'live',
      getSettings: () => ({}),
      addEventListener: () => {},
      removeEventListener: () => {},
      stop: () => { stopped = true }
    }
    const mockStream = {
      active: true,
      getVideoTracks: () => [mockTrack],
      getTracks: () => [mockTrack]
    }

    setMockNavigator({
      mediaDevices: {
        getUserMedia: async () => mockStream,
        enumerateDevices: async () => []
      }
    })

    await cameraStore.requestCamera()
    assert.equal(cameraStore.getState().status, 'live')

    // Route transition should NOT stop tracks
    cameraStore.releaseCamera('route_change')
    assert.equal(stopped, false)
    assert.equal(cameraStore.getState().status, 'live')

    // Submit or logout SHOULD stop tracks
    cameraStore.releaseCamera('submit')
    assert.equal(stopped, true)
    assert.equal(cameraStore.getState().status, 'idle')
    assert.equal(cameraStore.getStream(), null)
  })

  test('checkFrameSample rejects unrendered video and accepts valid frame dimensions', () => {
    assert.equal(cameraStore.checkFrameSample(null), false)

    const unrenderedVideo = { videoWidth: 0, videoHeight: 0, readyState: 0 }
    assert.equal(cameraStore.checkFrameSample(unrenderedVideo), false)

    const stalledVideo = { videoWidth: 640, videoHeight: 480, readyState: 1 }
    assert.equal(cameraStore.checkFrameSample(stalledVideo), false)
  })

  test('subscribe notifies listeners on state mutations', async () => {
    const states = []
    const unsubscribe = cameraStore.subscribe((s) => states.push(s.status))

    const mockTrack = {
      readyState: 'live',
      getSettings: () => ({}),
      addEventListener: () => {},
      removeEventListener: () => {},
      stop: () => {}
    }
    setMockNavigator({
      mediaDevices: {
        getUserMedia: async () => ({
          active: true,
          getVideoTracks: () => [mockTrack],
          getTracks: () => [mockTrack]
        }),
        enumerateDevices: async () => []
      }
    })

    await cameraStore.requestCamera()
    cameraStore.setHasFrames(true)
    cameraStore.releaseCamera('logout')

    unsubscribe()
    assert.ok(states.includes('requesting'))
    assert.ok(states.includes('live'))
    assert.ok(states.includes('idle'))
  })
})
