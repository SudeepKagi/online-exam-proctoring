import React from 'react'

export default function LoadingSpinner({ fullPage = true }) {
  const spinner = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-lg"></div>
      <p className="text-gray-500 font-medium animate-pulse">Initializing ProctorNet...</p>
    </div>
  )

  if (fullPage) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[9999] flex items-center justify-center">
        {spinner}
      </div>
    )
  }

  return spinner
}
