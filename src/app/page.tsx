'use client'

import { Component, type ReactNode, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { AppShell } from '@/components/app-shell'
import { useAppStore } from '@/lib/store'
import type { ActiveView } from '@/lib/types'
import { SkeletonGrid } from '@/components/shared/design-system'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

const DashboardScreen = dynamic(
  () => import('@/components/screens/dashboard-screen').then(m => ({ default: m.DashboardScreen })),
  { loading: () => <SkeletonGrid />, ssr: false }
)
const CompaniesScreen = dynamic(
  () => import('@/components/screens/companies-screen').then(m => ({ default: m.CompaniesScreen })),
  { loading: () => <SkeletonGrid />, ssr: false }
)
const CompanyProfileScreen = dynamic(
  () => import('@/components/screens/company-profile-screen'),
  { loading: () => <SkeletonGrid panels={1} />, ssr: false }
)
const ContactsScreen = dynamic(
  () => import('@/components/screens/contacts-screen'),
  { loading: () => <SkeletonGrid />, ssr: false }
)
const ContactDetailScreen = dynamic(
  () => import('@/components/screens/contact-detail-screen'),
  { loading: () => <SkeletonGrid panels={1} />, ssr: false }
)
const EmailGenerationScreen = dynamic(
  () => import('@/components/screens/email-generation-screen').then(m => ({ default: m.EmailGenerationScreen })),
  { loading: () => <SkeletonGrid panels={1} />, ssr: false }
)
const KnowledgeLibraryScreen = dynamic(
  () => import('@/components/screens/knowledge-library-screen'),
  { loading: () => <SkeletonGrid panels={1} />, ssr: false }
)
const ImportScreen = dynamic(
  () => import('@/components/screens/import-screen'),
  { loading: () => <SkeletonGrid panels={1} />, ssr: false }
)
const SettingsScreen = dynamic(
  () => import('@/components/screens/settings-screen').then(m => ({ default: m.SettingsScreen })),
  { loading: () => <SkeletonGrid panels={1} />, ssr: false }
)
const TasksScreen = dynamic(
  () => import('@/components/screens/tasks-screen').then(m => ({ default: m.TasksScreen })),
  { loading: () => <SkeletonGrid />, ssr: false }
)
const OpportunitiesScreen = dynamic(
  () => import('@/components/screens/opportunities-screen').then(m => ({ default: m.OpportunitiesScreen })),
  { loading: () => <SkeletonGrid />, ssr: false }
)
const AuditLogsScreen = dynamic(
  () => import('@/components/screens/audit-logs-screen').then(m => ({ default: m.AuditLogsScreen })),
  { loading: () => <SkeletonGrid panels={1} />, ssr: false }
)
const PromptTemplatesScreen = dynamic(
  () => import('@/components/screens/prompt-templates-screen').then(m => ({ default: m.PromptTemplatesScreen })),
  { loading: () => <SkeletonGrid panels={1} />, ssr: false }
)
const SequencesScreen = dynamic(
  () => import('@/components/screens/sequences-screen').then(m => ({ default: m.SequencesScreen })),
  { loading: () => <SkeletonGrid />, ssr: false }
)
const ReportsScreen = dynamic(
  () => import('@/components/screens/reports-screen').then(m => ({ default: m.ReportsScreen })),
  { loading: () => <SkeletonGrid panels={1} />, ssr: false }
)

const screenMap: Record<ActiveView, React.ComponentType> = {
  dashboard: DashboardScreen,
  companies: CompaniesScreen,
  'company-profile': CompanyProfileScreen,
  contacts: ContactsScreen,
  'contact-profile': ContactDetailScreen,
  tasks: TasksScreen,
  opportunities: OpportunitiesScreen,
  'email-generation': EmailGenerationScreen,
  'knowledge-library': KnowledgeLibraryScreen,
  import: ImportScreen,
  settings: SettingsScreen,
  'audit-logs': AuditLogsScreen,
  'prompt-templates': PromptTemplatesScreen,
  sequences: SequencesScreen,
  reports: ReportsScreen,
}

/* ── Error Boundary ────────────────────────────────────────── */

interface ErrorFallbackProps {
  error?: Error
  resetErrorBoundary?: () => void
}

function ErrorFallback({ error }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full rounded-xl border border-red-200 bg-white p-6 text-center space-y-4 shadow-sm">
        <div className="mx-auto size-14 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle className="size-7 text-red-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Something went wrong</h2>
          <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
            An unexpected error occurred.
          </p>
          {error?.message && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2.5 mt-3 font-mono break-all text-left">
              {error.message}
            </p>
          )}
        </div>
        <Button
          onClick={() => window.location.reload()}
          className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale"
        >
          <RefreshCw className="size-4 mr-1.5" />
          Reload Page
        </Button>
      </div>
    </div>
  )
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: React.ComponentType<ErrorFallbackProps>
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[PageErrorBoundary]', error, errorInfo.componentStack)
  }

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback
      return <Fallback error={this.state.error!} />
    }
    return this.props.children
  }
}

/* ── Page ──────────────────────────────────────────────────── */

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  const { activeView } = useAppStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <SkeletonGrid />
      </div>
    )
  }

  const ActiveScreen = screenMap[activeView]

  return (
    <ErrorBoundary fallback={ErrorFallback}>
      <AppShell>
        <ActiveScreen />
      </AppShell>
    </ErrorBoundary>
  )
}