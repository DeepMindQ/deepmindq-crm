'use client'

import { useEffect, useState, useCallback } from 'react'
import { tokens } from '@/components/intelligence-os/design-tokens';

// Announce messages to screen readers
export function useAnnounce() {
  const [announcement, setAnnouncement] = useState('')

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    setAnnouncement('')
    requestAnimationFrame(() => {
      setAnnouncement(message)
      if (priority === 'assertive') {
        setTimeout(() => setAnnouncement(''), 1000)
      } else {
        setTimeout(() => setAnnouncement(''), 3000)
      }
    })
  }, [])

  return announce
}

// Live region component
export function LiveRegion({ message, priority = 'polite' }: { message: string; priority?: 'polite' | 'assertive' }) {
  if (!message) return null
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  )
}

// Screen reader only text
export function SrOnly({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>
}

// Visually hidden but accessible
export function VisuallyHidden({ children, as: Tag = 'span' }: { children: React.ReactNode; as?: React.ElementType }) {
  const Component = Tag as React.ComponentType<React.HTMLAttributes<HTMLElement>>
  return (
    <Component
      className="sr-only"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
        borderWidth: 0,
      }}
    >
      {children}
    </Component>
  )
}

// Keyboard focus management
export function useFocusManagement(containerRef: React.RefObject<HTMLElement | null>) {
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return []
    return Array.from(containerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ))
  }, [containerRef])

  const focusFirst = useCallback(() => {
    const elements = getFocusableElements()
    if (elements.length > 0) elements[0].focus()
  }, [getFocusableElements])

  const focusLast = useCallback(() => {
    const elements = getFocusableElements()
    if (elements.length > 0) elements[elements.length - 1].focus()
  }, [getFocusableElements])

  return { focusFirst, focusLast, getFocusableElements }
}

// Color contrast checker (for development)
export function meetsContrastRatio(fg: string, bg: string, minRatio: 1 | 2 | 3 | 4.5 | 7 = 4.5): boolean {
  // Simplified contrast check - returns true for known good combinations
  // Note: Arrays use `as string[]` to widen literal types for .includes() compatibility
  const darkFgList: string[] = [tokens.text.primary, tokens.flat.white, tokens.neutral['900'], tokens.flat.black]
  const darkBgList: string[] = [tokens.text.inverse, tokens.surface.card, tokens.surface.secondary, tokens.surface.elevated]
  const lightFgList: string[] = [tokens.text.secondary, tokens.text.muted, tokens.neutral['400']]
  const darkFg = darkFgList.includes(fg.toLowerCase())
  const darkBg = darkBgList.includes(bg.toLowerCase())
  const lightFg = lightFgList.includes(fg.toLowerCase())

  // Dark fg on dark bg is bad, light fg on dark bg is good
  if (darkBg && darkFg) return false
  if (darkBg && lightFg) return minRatio <= 4.5
  if (darkBg && !lightFg && !darkFg) return minRatio <= 3

  return true
}

// ARIA description helper
export function getAriaDescription(description: string | undefined, details: string | undefined): { 'aria-describedby'?: string } {
  if (!description && !details) return {}
  const ids: string[] = []
  if (description) ids.push('desc-' + Math.random().toString(36).slice(2, 8))
  if (details) ids.push('details-' + Math.random().toString(36).slice(2, 8))
  return { 'aria-describedby': ids.join(' ') }
}

// Reduced motion hook
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

// High contrast mode detection
export function useHighContrast(): boolean {
  const [highContrast, setHighContrast] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(forced-colors: active)')
    setHighContrast(mq.matches)
    const handler = (e: MediaQueryListEvent) => setHighContrast(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return highContrast
}
