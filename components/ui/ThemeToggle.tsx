'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
      <button
        onClick={() => setTheme('light')}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors
          ${theme === 'light'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
          }`}
        aria-label="Light theme"
      >
        <Sun size={14} />
        Light
      </button>

      <button
        onClick={() => setTheme('system')}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors
          ${theme === 'system'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
          }`}
        aria-label="System theme"
      >
        <Monitor size={14} />
        System
      </button>

      <button
        onClick={() => setTheme('dark')}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors
          ${theme === 'dark'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
          }`}
        aria-label="Dark theme"
      >
        <Moon size={14} />
        Dark
      </button>
    </div>
  )
}