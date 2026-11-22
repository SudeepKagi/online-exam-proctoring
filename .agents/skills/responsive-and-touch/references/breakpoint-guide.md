# Responsive Breakpoints & Container Queries Reference

This guide provides concrete CSS and Tailwind patterns for implementing mobile-first responsive interfaces.

## Tailwind Breakpoint Mapping

```javascript
// tailwind.config.js breakpoints
module.exports = {
  theme: {
    screens: {
      sm: '640px',   // Mobile landscape / compact tablet
      md: '768px',   // Tablet portrait / adaptive table cutoff
      lg: '1024px',  // Desktop workspace
      xl: '1280px',  // Wide desktop
      '2xl': '1536px'// Ultra-wide
    }
  }
}
```

## Responsive Table-to-Card Pattern

```jsx
export function ResponsiveDataTable({ columns, data }) {
  return (
    <div>
      {/* Desktop / Tablet Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#c3c3cc]">
              {columns.map((col) => (
                <th key={col.key} className="py-3 px-4 text-xs font-[500] text-[#554e7b] uppercase">
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-b border-[#c3c3cc]/40">
                {columns.map((col) => (
                  <td key={col.key} className="py-3 px-4 text-xs font-[420] text-[#28253b]">
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Stack (< 768px) */}
      <div className="md:hidden space-y-3">
        {data.map((row) => (
          <div key={row.id} className="bg-[#edecfb] rounded-[16px] p-4 space-y-2">
            {columns.map((col) => (
              <div key={col.key} className="flex justify-between items-center text-xs">
                <span className="font-[500] text-[#554e7b] uppercase">{col.title}</span>
                <span className="font-[420] text-[#28253b]">{row[col.key]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```
