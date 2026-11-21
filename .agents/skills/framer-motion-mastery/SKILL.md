---
name: framer-motion-mastery
description: Production-grade Framer Motion, spring physics, layout animations, and gesture micro-interactions. Use when implementing, auditing, or polishing web animations, transitions, modals, and interactive UI states.
---

# Framer Motion & Fluid Micro-Interactions Mastery

This skill defines the technical standards, spring mechanics, and layout animation patterns for building enterprise-grade, 60fps web interfaces using Framer Motion and modern CSS transitions.

## 1. Core Principles of Enterprise Motion

1. **Restraint over Spectacle:**
   - Animation must serve comprehension and status feedback, never decoration.
   - Micro-interactions (hover, focus, press) must complete within 100–150ms.
   - Screen transitions and drawer entrances must complete within 240–320ms.

2. **Spring Physics over Linear Timing:**
   - Never use `ease-in-out` or linear timing for physical elements.
   - Use physics-based springs that feel responsive, tactile, and natural.

3. **GPU-Accelerated Transforms Only:**
   - ONLY animate `transform` (`scale`, `x`, `y`) and `opacity`.
   - NEVER animate `width`, `height`, `top`, `left`, `margin`, or `padding` directly (causes layout thrashing and CLS). Use `layout` or `layoutId` for geometry changes.

4. **Accessibility First (Reduced Motion):**
   - Always honor `prefers-reduced-motion: reduce`.
   - Replace physical travel and scale with gentle opacity fades.

---

## 2. Standard Spring Presets (Enterprise Tokens)

```javascript
export const springs = {
  // Snappy for buttons, toggles, icon clicks
  micro: { type: 'spring', stiffness: 500, damping: 30, mass: 0.5 },
  
  // Standard UI for dropdowns, tooltips, cards
  snappy: { type: 'spring', stiffness: 400, damping: 28 },
  
  // Gentle for modals, drawers, slide-overs
  gentle: { type: 'spring', stiffness: 320, damping: 32 },
  
  // Smooth for large layout morphs and cross-page elements
  smooth: { type: 'spring', stiffness: 260, damping: 30 }
}
```

---

## 3. High-Frequency Interaction Patterns

### A. Button Tap & Hover Micro-Interaction
```jsx
import { motion } from 'framer-motion'

export function ActionButton({ children, onClick, disabled }) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.015 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      transition={springs.micro}
      onClick={onClick}
      disabled={disabled}
      className="h-10 px-5 rounded-full bg-[#5266eb] text-white text-xs font-[420] outline-none"
    >
      {children}
    </motion.button>
  )
}
```

### B. List Staggered Children Reveal
```jsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: springs.snappy 
  }
}

export function StaggeredList({ items }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-2.5"
    >
      {items.map(item => (
        <motion.div key={item.id} variants={itemVariants}>
          {item.content}
        </motion.div>
      ))}
    </motion.div>
  )
}
```

### C. Modal / Dialog Presence Animation
```jsx
import { motion, AnimatePresence } from 'framer-motion'

export function Modal({ isOpen, onClose, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#28253b]/20 backdrop-blur-xs"
          />

          {/* Modal Surface */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={springs.gentle}
            className="relative bg-white rounded-[20px] p-6 shadow-[0_4px_24px_rgba(40,37,59,0.06)] z-10 max-w-lg w-full"
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
```

---

## 4. Reduced-Motion Implementation

Always check reduced motion preferences:
```jsx
import { useReducedMotion } from 'framer-motion'

export function AnimatedCard({ children }) {
  const shouldReduceMotion = useReducedMotion()

  const cardVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: shouldReduceMotion ? { duration: 0.12 } : springs.snappy 
    }
  }

  return (
    <motion.div variants={cardVariants} initial="hidden" animate="visible">
      {children}
    </motion.div>
  )
}
```
