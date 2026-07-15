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
        'bg-gradient-to-br from-amber-400 to-amber-600',
        'text-white flex items-center justify-center',
        'hover:shadow-xl hover:scale-105 active:scale-95',
        'transition-shadow cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2',
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
    >
      {/* Pulse ring when closed */}
      {!isOpen && (
        <motion.span
          className="absolute inset-0 rounded-full bg-amber-400"
          animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
      )}

      <Sparkles className="size-6 relative z-10" />
    </motion.button>
  )
}