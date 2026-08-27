import * as React from "react"
import { cva } from "class-variance-authority";
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&>svg]:pointer-events-none [&>svg]:size-3 font-sans",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-white shadow-xs [a&]:hover:bg-blue-600",
        secondary:
          "bg-[#eff6ff] text-[#1c4d8e] border-[#d5e6fb] [a&]:hover:bg-blue-100",
        outline:
          "border-border text-foreground bg-card [a&]:hover:bg-neutral-100",
        purple:
          "bg-[#f5f3ff] text-[#5b21b6] border-[#ddd6fe] [a&]:hover:bg-purple-100",
        green:
          "bg-[#ecfdf5] text-[#166534] border-[#bbf7d0] [a&]:hover:bg-emerald-100",
        success:
          "bg-[#ecfdf5] text-[#166534] border-[#bbf7d0] [a&]:hover:bg-emerald-100",
        warning:
          "bg-[#fffbeb] text-[#b45309] border-[#fde68a] [a&]:hover:bg-amber-100",
        destructive:
          "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca] [a&]:hover:bg-red-100",
        ghost: "border-transparent [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "border-transparent text-primary underline-offset-4 [a&]:hover:underline",
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
