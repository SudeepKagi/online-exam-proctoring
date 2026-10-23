import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const SheetContext = React.createContext({ open: false, onOpenChange: () => {} })

function Sheet({ open, onOpenChange, children }) {
  return (
    <SheetContext.Provider value={{ open: Boolean(open), onOpenChange: onOpenChange || (() => {}) }}>
      {children}
    </SheetContext.Provider>
  )
}

function SheetTrigger({ asChild, children, onClick, ...props }) {
  const { onOpenChange } = React.useContext(SheetContext)
  const handleClick = (e) => {
    if (onClick) onClick(e)
    onOpenChange(true)
  }
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e) => {
        if (children.props.onClick) children.props.onClick(e)
        handleClick(e)
      },
      ...props
    })
  }
  return <button onClick={handleClick} {...props}>{children}</button>
}

function SheetClose({ asChild, children, onClick, ...props }) {
  const { onOpenChange } = React.useContext(SheetContext)
  const handleClick = (e) => {
    if (onClick) onClick(e)
    onOpenChange(false)
  }
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e) => {
        if (children.props.onClick) children.props.onClick(e)
        handleClick(e)
      },
      ...props
    })
  }
  return <button onClick={handleClick} {...props}>{children}</button>
}

function SheetContent({ className, children, side = 'right', showCloseButton = true, ...props }) {
  const { open, onOpenChange } = React.useContext(SheetContext)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in-0"
        onClick={() => onOpenChange(false)}
      />
      {/* Drawer Panel */}
      <div
        className={cn(
          "relative z-50 flex h-full w-full max-w-md flex-col bg-white p-6 shadow-2xl transition ease-in-out animate-in slide-in-from-right duration-300",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 rounded-xs p-1 text-slate-400 hover:text-slate-600 focus:outline-hidden"
          >
            <X className="w-4 h-4" />
            <span className="sr-only">Close</span>
          </button>
        )}
      </div>
    </div>
  )
}

function SheetHeader({ className, ...props }) {
  return <div className={cn("flex flex-col gap-1.5 p-1 pb-4 border-b border-slate-100", className)} {...props} />
}

function SheetFooter({ className, ...props }) {
  return <div className={cn("mt-auto flex flex-col gap-2 p-1 pt-4 border-t border-slate-100", className)} {...props} />
}

function SheetTitle({ className, ...props }) {
  return <h2 className={cn("text-base font-[480] text-slate-900", className)} {...props} />
}

function SheetDescription({ className, ...props }) {
  return <p className={cn("text-xs text-slate-500", className)} {...props} />
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription
}
