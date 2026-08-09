'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'

interface LoadingOverlayProps {
  visible: boolean
  message?: string
  className?: string
}

export function LoadingOverlay({ visible, message = 'Loading...', className }: LoadingOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={className || 'absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { SkeletonCard } from './skeleton-card'
export { SkeletonTable } from './skeleton-table'
export { SkeletonDashboard } from './skeleton-dashboard'
export { SkeletonDetail } from './skeleton-detail'
