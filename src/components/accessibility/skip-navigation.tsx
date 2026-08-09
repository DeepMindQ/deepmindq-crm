'use client'

import { useEffect, useState, useCallback } from 'react'

interface SkipLink {
  target: string
  label: string
}

const DEFAULT_LINKS: SkipLink[] = [
  { target: 'main-content', label: 'Skip to main content' },
  { target: 'sidebar-navigation', label: 'Skip to navigation' },
]

interface SkipNavigationProps {
  links?: SkipLink[]
}

export function SkipNavigation({ links = DEFAULT_LINKS }: SkipNavigationProps) {
  const [visible, setVisible] = useState(false)

  const handleFocusOut = useCallback(() => {
    setTimeout(() => {
      const active = document.activeElement
      const container = document.querySelector('[data-skip-nav]')
      if (!container || !container.contains(active)) {
        setVisible(false)
      }
    }, 100)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        setVisible(true)
      }
    }
    document.addEventListener('keydown', handler)
    document.addEventListener('focusout', handleFocusOut)
    return () => {
      document.removeEventListener('keydown', handler)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [handleFocusOut])

  if (!visible) return null

  return (
    <nav data-skip-nav className="fixed top-0 left-0 z-[9999] flex flex-col gap-1 p-2" role="navigation" aria-label="Skip links">
      {links.map(link => (
        <a
          key={link.target}
          href={`#${link.target}`}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold
            focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
            transition-transform hover:scale-105"
          onClick={(e) => {
            e.preventDefault()
            const target = document.getElementById(link.target)
            if (target) {
              target.focus()
              target.scrollIntoView({ behavior: 'smooth' })
            }
          }}
        >
          {link.label}
        </a>
      ))}
    </nav>
  )
}