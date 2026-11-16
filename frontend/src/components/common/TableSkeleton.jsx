import React from 'react'

export function TableSkeleton({ rows = 4, cols = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="border-b border-[#c3c3cc]/20 animate-pulse">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx} className="py-4 px-4">
              <div
                className={`h-4 rounded-full bg-[#edecfb] ${
                  cIdx === 0 ? 'w-3/4' : cIdx === cols - 1 ? 'w-16 ml-auto' : 'w-1/2'
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function CardListSkeleton({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-5 bg-white rounded-[16px] shadow-xs animate-pulse space-y-3">
          <div className="h-4 bg-[#edecfb] rounded-full w-2/3" />
          <div className="h-3 bg-[#fbfbff] rounded-full w-1/2" />
          <div className="pt-2 flex justify-between items-center">
            <div className="h-6 w-16 bg-[#edecfb] rounded-full" />
            <div className="h-8 w-24 bg-[#edecfb] rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default TableSkeleton
