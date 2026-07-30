import React from 'react'

export function ProctorNetLogo({ className = 'w-6 h-6', ...props }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M28 14L54 14C68.3594 14 80 25.6406 80 40C80 54.3594 68.3594 66 54 66H50V90L28 68V36L48 36L28 14Z"
      />
    </svg>
  )
}
