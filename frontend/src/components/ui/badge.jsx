import * as React from "react"
import { cva } from "class-variance-authority";
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-0.5 text-xs font-[420] whitespace-nowrap transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&>svg]:pointer-events-none [&>svg]:size-3 font-sans",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#5266eb] text-white shadow-xs [a&]:hover:bg-[#4353c7]",
        secondary:
          "bg-[rgba(82,102,235,0.08)] text-[#28253b] border-transparent [a&]:hover:bg-[rgba(82,102,235,0.15)]",
        outline:
          "border-[#c3c3cc]/60 text-[#554e7b] bg-white [a&]:hover:bg-[#fbfbff]",
        purple:
          "bg-[#edecfb] text-[#554e7b] border-[#d8d6f8] [a&]:hover:bg-[#e4e2f9]",
        green:
          "bg-[#ecfdf5] text-[#166534] border-[#bbf7d0] [a&]:hover:bg-emerald-100",
        success:
          "bg-[#ecfdf5] text-[#166534] border-[#bbf7d0] [a&]:hover:bg-emerald-100",
        warning:
          "bg-[#fffbeb] text-[#b45309] border-[#fde68a] [a&]:hover:bg-amber-100",
        destructive:
          "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca] [a&]:hover:bg-red-100",
        ghost: "border-transparent [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "border-transparent text-[#5266eb] underline-offset-4 [a&]:hover:underline",
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
