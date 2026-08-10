import {
  Info, CheckCircle2, AlertTriangle, XCircle,
  Brain, Target, ShieldAlert, type LucideIcon
} from 'lucide-react'
import { tokens } from '@/components/intelligence-os/design-tokens';

export interface NotificationStyle {
  icon: LucideIcon
  color: string
  bgColor: string
  borderColor: string
}

export function getNotificationStyle(type: string): NotificationStyle {
  switch (type) {
    case 'success':
      return {
        icon: CheckCircle2,
        color: tokens.domain.action,
        bgColor: tokens.trust.verified.bg,
        borderColor: tokens.trust.verified.border,
      }
    case 'warning':
      return {
        icon: AlertTriangle,
        color: tokens.domain.reasoning,
        bgColor: tokens.confidence.medium.bg,
        borderColor: tokens.confidence.medium.border,
      }
    case 'error':
    case 'risk':
      return {
        icon: type === 'risk' ? ShieldAlert : XCircle,
        color: tokens.domain.risk,
        bgColor: tokens.confidence.low.bg,
        borderColor: tokens.confidence.low.border,
      }
    case 'intelligence':
      return {
        icon: Brain,
        color: tokens.accent.DEFAULT,
        bgColor: tokens.accent.subtle,
        borderColor: tokens.accent.strong,
      }
    case 'opportunity':
      return {
        icon: Target,
        color: tokens.domain.opportunity,
        bgColor: tokens.domain.opportunity,
        borderColor: tokens.domain.opportunity,
      }
    default:
      return {
        icon: Info,
        color: tokens.accent.DEFAULT,
        bgColor: tokens.accent.subtle,
        borderColor: tokens.accent.strong,
      }
  }
}

export function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}
