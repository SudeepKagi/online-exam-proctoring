import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const DialogContext = React.createContext({ open: false, onOpenChange: () => {} })

const Dialog = ({ open, onOpenChange, children }) => {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

const DialogTrigger = React.forwardRef(({ asChild, children, onClick, ...props }, ref) => {
  const { onOpenChange } = React.useContext(DialogContext)
  const handleClick = (e) => {
    if (onClick) onClick(e)
    if (onOpenChange) onOpenChange(true)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ref,
      onClick: (e) => {
        if (children.props.onClick) children.props.onClick(e)
        handleClick(e)
      },
      ...props,
    })
  }

  return (
    <button ref={ref} onClick={handleClick} {...props}>
      {children}
    </button>
  )
})
DialogTrigger.displayName = 'DialogTrigger'

const DialogClose = React.forwardRef(({ asChild, children, onClick, ...props }, ref) => {
  const { onOpenChange } = React.useContext(DialogContext)
  const handleClick = (e) => {
    if (onClick) onClick(e)
    if (onOpenChange) onOpenChange(false)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ref,
      onClick: (e) => {
        if (children.props.onClick) children.props.onClick(e)
        handleClick(e)
      },
      ...props,
    })
  }

  return (
    <button ref={ref} onClick={handleClick} {...props}>
      {children}
    </button>
  )
})
DialogClose.displayName = 'DialogClose'

const DialogContent = React.forwardRef(({ className, children, onClose, ...props }, ref) => {
  const { open, onOpenChange } = React.useContext(DialogContext)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-[#171721]/60 backdrop-blur-xs transition-opacity animate-in fade-in-0"
        onClick={() => onOpenChange && onOpenChange(false)}
      />
      <div
        ref={ref}
        className={cn(
          'relative z-50 w-full max-w-lg rounded-[12px] border border-[#e9eaf2] bg-white p-6 shadow-[0_8px_30px_rgba(40,37,59,0.08)] animate-in zoom-in-95 font-sans',
          className
        )}
        {...props}
      >
        {children}
        <button
          type="button"
          onClick={() => {
            if (onClose) onClose()
            if (onOpenChange) onOpenChange(false)
          }}
          className="absolute right-4 top-4 rounded-full p-1 text-[#554e7b] hover:text-[#28253b] hover:bg-[#edecfb]/60 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </div>
  )
})
DialogContent.displayName = 'DialogContent'

const DialogHeader = ({ className, ...props }) => (
  <div
    className={cn('flex flex-col space-y-1.5 text-center sm:text-left mb-4', className)}
    {...props}
  />
)

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn('text-lg font-[480] leading-none tracking-tight text-[#28253b]', className)}
    {...props}
  />
))
DialogTitle.displayName = 'DialogTitle'

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm font-[360] text-[#554e7b]', className)}
    {...props}
  />
))
DialogDescription.displayName = 'DialogDescription'

const DialogFooter = ({ className, ...props }) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6', className)}
    {...props}
  />
)

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter }
