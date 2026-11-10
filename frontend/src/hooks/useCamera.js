import { useEffect, useRef, useCallback, useSyncExternalStore } from 'react'
import cameraStore from '@/lib/cameraStore'

export function useCamera() {
  const storeState = useSyncExternalStore(
    cameraStore.subscribe.bind(cameraStore),
    () => cameraStore.getState(),
    () => cameraStore.getState()
  )

  const videoRef = useRef(null)

  const applyStreamToVideo = useCallback((el, stream) => {
    if (!el || !stream) return
    if (el.srcObject !== stream) {
      el.srcObject = stream
    }
    el.autoplay = true
    el.playsInline = true
    el.muted = true
    const playPromise = el.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Autoplay may be interrupted or waiting for gesture
      })
    }
  }, [])

  // Callback ref: invoked immediately upon DOM insertion (e.g. after consent toggle)
  const attachVideoRef = useCallback((el) => {
    videoRef.current = el
    if (el) {
      const activeStream = cameraStore.getStream()
      if (activeStream) {
        applyStreamToVideo(el, activeStream)
      }
    }
  }, [applyStreamToVideo])

  // Sync stream to video element on store updates
  useEffect(() => {
    if (videoRef.current && storeState.stream) {
      applyStreamToVideo(videoRef.current, storeState.stream)
    }
  }, [storeState.stream, storeState.status, applyStreamToVideo])

  // Continuous real-frame verification
  useEffect(() => {
    if (storeState.status !== 'live') return

    let active = true
    let frameCheckInterval = null

    const verifyFrame = () => {
      const el = videoRef.current
      if (!el || !active) return
      if (cameraStore.checkFrameSample(el)) {
        if (!cameraStore.getState().hasFrames) {
          cameraStore.setHasFrames(true)
        }
      }
    }

    frameCheckInterval = setInterval(verifyFrame, 200)
    verifyFrame()

    return () => {
      active = false
      if (frameCheckInterval) clearInterval(frameCheckInterval)
    }
  }, [storeState.status])

  const requestCamera = useCallback((opts) => {
    return cameraStore.requestCamera(opts)
  }, [])

  const selectDevice = useCallback((deviceId) => {
    return cameraStore.selectDevice(deviceId)
  }, [])

  const retryCamera = useCallback(() => {
    return cameraStore.requestCamera({ forceNew: true })
  }, [])

  const releaseCamera = useCallback((reason) => {
    cameraStore.releaseCamera(reason)
  }, [])

  return {
    ...storeState,
    videoRef,
    attachVideoRef,
    requestCamera,
    selectDevice,
    retryCamera,
    releaseCamera,
    checkFrameSample: () => cameraStore.checkFrameSample(videoRef.current)
  }
}

export default useCamera

