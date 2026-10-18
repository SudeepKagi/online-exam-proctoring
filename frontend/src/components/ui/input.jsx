import * as React from "react"

import { cn } from "@/lib/utils"

function Input({
  className,
  type,
  ...props
}) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-[#c3c3cc]/60 bg-white px-3.5 py-2 text-sm text-[#28253b] font-[420] shadow-xs transition-all duration-150 outline-none placeholder:text-[#70707d] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-[#5266eb] focus-visible:ring-2 focus-visible:ring-[#5266eb]/20",
        "aria-invalid:border-red-500 aria-invalid:ring-2 aria-invalid:ring-red-500/20",
        className
      )}
      {...props} />
  );
}

export { Input }
