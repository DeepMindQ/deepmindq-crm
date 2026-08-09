import {
  Info, CheckCircle2, AlertTriangle, XCircle,
  Brain, Target, ShieldAlert, type LucideIcon
} from 'lucide-react'

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
        color: '#22c55e',
        bgColor: 'rgba(34,197,94,0.1)',
        borderColor: 'rgba(34,197,94,0.2)',
      }
    case 'warning':
      return {
        icon: AlertTriangle,
        color: '#f59e0b',
        bgColor: 'rgba(245,158,11,0.1)',
        borderColor: 'rgba(245,158,11,0.2)',
      }
    case 'error':
    case 'risk':
      return {
        icon: type === 'risk' ? ShieldAlert : XCircle,
        color: '#ef4444',
        bgColor: 'rgba(239,68,68,0.1)',
        borderColor: 'rgba(239,68,68,0.2)',
      }
    case 'intelligence':
      return {
        icon: Brain,
        color: '#3b82f6',
        bgColor: 'rgba(59,130,246,0.1)',
        borderColor: 'rgba(59,130,246,0.2)',
      }
    case 'opportunity':
      return {
        icon: Target,
        color: '#a855f7',
        bgColor: 'rgba(168,85,247,0.1)',
        borderColor: 'rgba(168,85,247,0.2)',
      }
    default:
      return {
        icon: Info,
        color: '#3b82f6',
        bgColor: 'rgba(59,130,246,0.1)',
        borderColor: 'rgba(59,130,246,0.2)',
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
