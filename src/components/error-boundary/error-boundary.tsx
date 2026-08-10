'use client'
import React from 'react'
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  AlertTriangle,
  WifiOff,
  ShieldAlert,
  Clock,
  FileWarning,
  Bug,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react'
import { logger } from '@/lib/logger'

// ── Error categorization ──
type ErrorCategory = 'network' | 'auth' | 'validation' | 'timeout' | 'runtime' | 'unknown'

function categorizeError(error: Error): ErrorCategory {
  const msg = error.message.toLowerCase()
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) return 'network'
  if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') || msg.includes('forbidden')) return 'auth'
  if (msg.includes('validation') || msg.includes('invalid')) return 'validation'
  if (msg.includes('timeout') || msg.includes('abort')) return 'timeout'
  return 'runtime'
}

const categoryConfig: Record<ErrorCategory, {
  icon: React.ElementType
  label: string
  color: string
  bgColor: string
  borderColor: string
}> = {
  runtime: {
    icon: AlertTriangle,
    label: 'Runtime Error',
    color: tokens.domain.risk,
    bgColor: tokens.confidence.low.bg,
    borderColor: tokens.confidence.low.border,
  },
  network: {
    icon: WifiOff,
    label: 'Network Error',
    color: tokens.trust.low.value,
    bgColor: tokens.trust.low.bg,
    borderColor: tokens.trust.low.border,
  },
  auth: {
    icon: ShieldAlert,
    label: 'Authentication Error',
    color: tokens.domain.risk,
    bgColor: tokens.confidence.low.bg,
    borderColor: tokens.confidence.low.border,
  },
  validation: {
    icon: FileWarning,
    label: 'Validation Error',
    color: tokens.domain.reasoning,
    bgColor: tokens.confidence.medium.bg,
    borderColor: tokens.confidence.medium.border,
  },
  timeout: {
    icon: Clock,
    label: 'Timeout Error',
    color: tokens.domain.reasoning,
    bgColor: tokens.confidence.medium.bg,
    borderColor: tokens.confidence.medium.border,
  },
  unknown: {
    icon: Bug,
    label: 'Unknown Error',
    color: tokens.text.secondary,
    bgColor: tokens.priority.low.bg,
    borderColor: tokens.priority.low.border,
  },
}

// ── Props & State ──
interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorId: string | null
  copied: boolean
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorId: null, copied: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, errorId: crypto.randomUUID?.() ?? `err-${Date.now()}` }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const category = categorizeError(error)
    logger.error('[ErrorBoundary] Caught error:', {
      error: error.message,
      category,
      errorId: this.state.errorId,
    })
    logger.error('[ErrorBoundary] Component stack:', { error: errorInfo.componentStack })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorId: null, copied: false })
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorId: null, copied: false })
    window.location.reload()
  }

  handleCopyDetails = async () => {
    const { error, errorId } = this.state
    if (!error || !errorId) return
    const details = [
      `DeepMindQ Error Report`,
      `Error ID: ${errorId}`,
      `Category: ${categorizeError(error)}`,
      `Message: ${error.message}`,
      `Stack: ${error.stack || 'N/A'}`,
      `Timestamp: ${new Date().toISOString()}`,
      `URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(details)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    } catch {
      // Fallback: do nothing
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      const error = this.state.error || new Error('Unknown error')
      const category = categorizeError(error)
      const config = categoryConfig[category]
      const Icon = config.icon

      return (
        <div
          className="flex flex-col items-center justify-center py-20 px-6"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div
            className="flex size-14 items-center justify-center rounded-2xl mb-4"
            style={{ background: config.bgColor, border: `1.5px solid ${config.borderColor}` }}
          >
            <Icon className="size-7" style={{ color: config.color }} />
          </div>

          <h3 className="text-base font-semibold text-foreground mb-1">Something went wrong</h3>

          <p
            className="text-[11px] font-semibold tracking-wider uppercase mb-3"
            style={{ color: config.color }}
          >
            {config.label}
          </p>

          <p className="text-sm text-muted-foreground max-w-sm text-center mb-2">
            {error.message || 'An unexpected error occurred'}
          </p>

          {this.state.errorId && (
            <p className="text-[11px] text-muted-foreground mb-6 font-mono">
              Error ID: {this.state.errorId}
            </p>
          )}

          <div className="flex gap-2">
            <button
              className="px-4 py-2 text-xs font-medium rounded-lg bg-card border border-border text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors flex items-center gap-2"
              onClick={this.handleRetry}
            >
              <RefreshCw className="size-3.5" /> Try Again
            </button>
            <button
              className="px-4 py-2 text-xs font-medium rounded-lg bg-card border border-border text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors flex items-center gap-2"
              onClick={this.handleCopyDetails}
              aria-label="Copy error details to clipboard"
            >
              {this.state.copied ? (
                <><Check className="size-3.5" /> Copied</>
              ) : (
                <><Copy className="size-3.5" /> Copy Details</>
              )}
            </button>
            <button
              className="px-4 py-2 text-xs font-medium rounded-lg text-white flex items-center gap-2"
              style={{ background: tokens.accent.dim }}
              onClick={this.handleReload}
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
