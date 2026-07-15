'use client'

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AiChatButtonProps {
  isOpen: boolean
  onToggle: () => void
}

export function AiChatButton({ isOpen, onToggle }: AiChatButtonProps) {
  return (
    <motion.button
      onClick={onToggle}
      className={cn(
        'fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg',
        'text-white flex items-center justify-center',
        'hover:shadow-xl active:scale-95',
        'transition-shadow cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
      )}
      style={{
        background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dim))',
        boxShadow: '0 4px 20px rgba(212, 175, 55, 0.3)',
        '--tw-ring-color': 'var(--color-gold)',
        '--tw-ring-offset-color': 'var(--background)',
      } as React.CSSProperties}
      whileHover={{ scale: 1.05, boxShadow: '0 8px 30px rgba(212, 175, 55, 0.4)' }}
      whileTap={{ scale: 0.95 }}
      aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
    >
      {/* Pulse ring when closed */}
      {!isOpen && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: 'var(--color-gold)' }}
          animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
      )}

      <Sparkles className="size-6 relative z-10" />
    </motion.button>
  )
}