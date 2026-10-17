import React, { useEffect, useRef } from 'react'

export default function WatermarkCanvas({ text }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      draw()
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      
      ctx.font = '24px Inter, sans-serif'
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)'
      ctx.textAlign = 'center'
      
      const angle = -Math.PI / 4
      ctx.rotate(angle)

      const spacingX = 300
      const spacingY = 200

      // Draw repeating pattern
      // We need a large area because of rotation
      for (let x = -canvas.width; x < canvas.width * 2; x += spacingX) {
        for (let y = -canvas.height; y < canvas.height * 2; y += spacingY) {
          ctx.fillText(text, x, y)
        }
      }
      
      ctx.restore()
    }

    window.addEventListener('resize', resize)
    resize()

    return () => window.removeEventListener('resize', resize)
  }, [text])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  )
}
