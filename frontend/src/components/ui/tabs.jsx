"use client"

import * as React from "react"
import { cva } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn("group/tabs flex gap-2 data-[orientation=horizontal]:flex-col", className)}
      {...props} />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-[40px] p-1 text-[#554e7b] border border-[#e9eaf2] bg-[#fbfbff] group-data-[orientation=horizontal]/tabs:h-10 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none data-[variant=line]:border-0 data-[variant=line]:bg-transparent",
  {
    variants: {
      variant: {
        default: "",
        line: "gap-2 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props} />
  );
}

function TabsTrigger({
  className,
  ...props
}) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-2px)] flex-1 items-center justify-center gap-1.5 rounded-[40px] px-3.5 py-1.5 text-xs font-[420] whitespace-nowrap text-[#554e7b] transition-all duration-150 group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-[#28253b] focus-visible:ring-2 focus-visible:ring-[#5266eb] disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-white data-[state=active]:text-[#28253b] data-[state=active]:font-[500] data-[state=active]:shadow-xs",
        "group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:text-[#5266eb]",
        className
      )}
      {...props} />
  );
}

function TabsContent({
  className,
  ...props
}) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props} />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
