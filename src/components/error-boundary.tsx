'use client'
import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-red-500/10 mb-4">
            <AlertTriangle className="size-7 text-red-400" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Something went wrong</h3>
          <p className="text-sm text-muted-foreground max-w-sm text-center mb-6">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 text-xs font-medium rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors flex items-center gap-2"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <RefreshCw className="size-3.5" /> Try Again
            </button>
            <button
              className="px-4 py-2 text-xs font-medium rounded-lg text-white flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dim))' }}
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