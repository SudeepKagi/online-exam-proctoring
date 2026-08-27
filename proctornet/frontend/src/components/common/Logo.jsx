import React from 'react'

export default function Logo({ className = "w-10 h-10", imgClassName = "w-full h-full object-contain" }) {
  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-white shadow-xs ${className}`}>
      <img
        src="/logo.png"
        alt="ProctorNet Logo"
        className={imgClassName}
        loading="eager"
      />
    </div>
  )
}
