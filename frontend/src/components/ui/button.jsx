import * as React from "react"
import { cva } from "class-variance-authority";
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-[420] whitespace-nowrap cursor-pointer transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#5266eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[#5266eb] text-white hover:bg-[#4354d0] active:bg-[#3745b5] shadow-xs rounded-[32px]",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-red-600 active:bg-red-700 active:scale-[0.98] focus-visible:ring-destructive rounded-full",
        outline:
          "border border-[#e9eaf2] bg-white text-[#28253b] hover:bg-[#fbfcfd] hover:text-[#5266eb] active:scale-[0.98] rounded-full",
        secondary:
          "bg-[rgba(82,102,235,0.08)] text-[#28253b] border border-[rgba(82,102,235,0.15)] hover:bg-[rgba(82,102,235,0.15)] active:scale-[0.98] rounded-full",
        ghost:
          "text-[#28253b] hover:bg-[rgba(82,102,235,0.08)] hover:text-[#5266eb] active:scale-[0.98] rounded-full",
        glass:
          "bg-[rgba(175,178,206,0.2)] text-[#ededf3] hover:bg-[rgba(175,178,206,0.3)] border border-[rgba(175,178,206,0.36)] rounded-full",
        tint:
          "bg-[rgba(82,102,235,0.1)] text-[#28253b] hover:bg-[rgba(82,102,235,0.16)] rounded-full",
        link: "text-[#5266eb] underline-offset-4 hover:underline p-0 h-auto font-medium",
      },
      size: {
        default: "h-10 px-5 py-2 has-[>svg]:px-4 text-sm",
        xs: "h-6 gap-1 rounded-full px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-full px-3.5 text-xs has-[>svg]:px-2.5",
        lg: "h-11 rounded-full px-6 text-sm font-medium has-[>svg]:px-5",
        icon: "size-10 rounded-full",
        "icon-xs": "size-6 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-full",
        "icon-lg": "size-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props} />
  );
}

export { Button, buttonVariants }
