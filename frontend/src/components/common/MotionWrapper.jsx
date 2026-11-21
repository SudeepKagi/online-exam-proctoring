import React from 'react'
import { motion, AnimatePresence } from 'motion/react'

/**
 * Enterprise Page Transition
 * Calibrated per .agents/skills/framer-motion-mastery/SKILL.md
 * Subtle opacity fade + 6px vertical slide with snappy ease
 */
export function PageTransition({ children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * Stagger Reveal Container for grid cards and dashboard items
 */
export function StaggerContainer({ children, className = '', delay = 0.04 }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: delay,
            delayChildren: 0.02
          }
        }
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * Single item inside a StaggerContainer
 */
export function StaggerItem({ children, className = '' }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] }
        }
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * Interactive card wrapper with subtle hover lift and click feedback
 */
export function InteractiveCard({ children, className = '', onClick }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 450, damping: 28 }}
      onClick={onClick}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export { motion, AnimatePresence }
