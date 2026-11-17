import * as React from "react"
import { cva } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 text-sm font-[420] whitespace-nowrap cursor-pointer transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#5266eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-[#5266eb] text-white hover:bg-[#4354d0] active:bg-[#3745b5] shadow-xs rounded-[32px] border-0",
        default:
          "bg-[#5266eb] text-white hover:bg-[#4354d0] active:bg-[#3745b5] shadow-xs rounded-[32px] border-0",
        secondary:
          "bg-[rgba(82,102,235,0.10)] text-[#28253b] hover:bg-[rgba(82,102,235,0.18)] active:bg-[rgba(82,102,235,0.22)] rounded-[40px] border-0",
        outline:
          "bg-[rgba(85,78,123,0.10)] border border-[rgba(85,78,123,0.22)] text-[#28253b] hover:bg-[rgba(85,78,123,0.16)] rounded-[40px]",
        ghost:
          "bg-transparent text-[#28253b] hover:bg-[rgba(82,102,235,0.08)] hover:text-[#5266eb] active:bg-[rgba(82,102,235,0.12)] rounded-[40px] border-0",
        destructive:
          "bg-[rgba(82,102,235,0.08)] text-[#28253b] hover:bg-[rgba(82,102,235,0.16)] active:scale-[0.98] rounded-[40px] border-0",
        tint:
          "bg-[rgba(82,102,235,0.10)] text-[#28253b] hover:bg-[rgba(82,102,235,0.18)] rounded-[40px] border-0",
        glass:
          "bg-[rgba(175,178,206,0.2)] text-[#28253b] hover:bg-[rgba(175,178,206,0.3)] rounded-[40px] border-0",
        link:
          "text-[#5266eb] underline-offset-4 hover:underline p-0 h-auto font-[420] border-0 rounded-none bg-transparent",
      },
      size: {
        default: "h-10 px-5 py-2 has-[>svg]:px-4 text-sm",
        xs: "h-6 gap-1 rounded-full px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-full px-3.5 text-xs has-[>svg]:px-2.5",
        lg: "h-11 rounded-full px-6 text-sm font-[420] has-[>svg]:px-5",
        icon: "size-10 rounded-full",
        "icon-xs": "size-6 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-full",
        "icon-lg": "size-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

/**
 * Filter out ad-hoc background and text colors to enforce strict enterprise design system tokens.
 */
function sanitizeButtonClasses(classes) {
  if (!classes || typeof classes !== 'string') return classes
  return classes
    .replace(/\bbg-(?:red|blue|green|emerald|indigo|slate|gray|yellow|purple|zinc|neutral|stone)-\d+\b/g, '')
    .replace(/\bbg-\[#[0-9a-fA-F]+\]/g, '')
    .replace(/\btext-(?:red|green|blue|gray|zinc|neutral|stone)-\d+\b/g, '')
    .replace(/\btext-\[#[0-9a-fA-F]+\]/g, '')
}

function Button({
  className,
  variant = "primary",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "button"
  const cleanClass = sanitizeButtonClasses(className)

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className: cleanClass }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
