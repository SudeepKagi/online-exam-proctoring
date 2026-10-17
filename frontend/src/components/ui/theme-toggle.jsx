import * as React from 'react'
import { Sun, Moon } from 'lucide-react'
import { Button } from './button'

export function ThemeToggle({ className = '' }) {
  React.useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark')
    root.classList.add('light')
    try {
      localStorage.setItem('theme', 'light')
    } catch (e) {}
  }, [])

  return null
}
