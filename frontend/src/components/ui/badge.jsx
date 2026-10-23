import * as React from "react"
import { cva } from "class-variance-authority";
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border-0 px-2.5 py-0.5 text-xs font-[420] whitespace-nowrap transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&>svg]:pointer-events-none [&>svg]:size-3 font-sans",
  {
    variants: {
      variant: {
        default: "border-0 bg-[#5266eb] text-white shadow-xs [a&]:hover:bg-[#4353c7]",
        secondary: "bg-[rgba(82,102,235,0.08)] text-[#28253b] border-0 [a&]:hover:bg-[rgba(82,102,235,0.15)]",
        outline: "border-0 text-[#554e7b] bg-[#edecfb] [a&]:hover:bg-[#e4e2f9]",
        purple: "bg-[#edecfb] text-[#554e7b] border-0 [a&]:hover:bg-[#e4e2f9]",
        accent: "bg-[#edecfb] text-[#554e7b] border-0",
        success: "bg-[#edecfb] text-[#554e7b] border-0",
        warning: "bg-[#edecfb] text-[#554e7b] border-0",
        destructive: "bg-[#edecfb] text-[#554e7b] border-0",
        ghost: "border-0 [a&]:hover:bg-[rgba(82,102,235,0.08)] [a&]:hover:text-[#28253b]",
        link: "border-0 text-[#5266eb] underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props} />
  );
}

export { Badge, badgeVariants }
