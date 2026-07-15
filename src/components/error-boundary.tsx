'use client'
import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
          <div className="flex size-14 items-center justify-center rounded-2xl bg-red-50 mb-4">
            <AlertTriangle className="size-7 text-red-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Something went wrong</h3>
          <p className="text-sm text-gray-500 max-w-sm text-center mb-6">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <RefreshCw className="size-4 mr-2" /> Try Again
            </Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg" onClick={this.handleReload}>
              Reload Page
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}