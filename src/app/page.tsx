'use client'

import dynamic from 'next/dynamic'
import { AppShell } from '@/components/app-shell'
import { useAppStore } from '@/lib/store'
import type { ActiveView } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'

function ScreenLoader() {
  return (
    <div className="space-y-4 p-1">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

const DashboardScreen = dynamic(
  () => import('@/components/screens/dashboard-screen').then(m => ({ default: m.DashboardScreen })),
  { loading: ScreenLoader, ssr: false }
)
const CompaniesScreen = dynamic(
  () => import('@/components/screens/companies-screen').then(m => ({ default: m.CompaniesScreen })),
  { loading: ScreenLoader, ssr: false }
)
const CompanyProfileScreen = dynamic(
  () => import('@/components/screens/company-profile-screen'),
  { loading: ScreenLoader, ssr: false }
)
const ContactsScreen = dynamic(
  () => import('@/components/screens/contacts-screen'),
  { loading: ScreenLoader, ssr: false }
)
const ImportScreen = dynamic(
  () => import('@/components/screens/import-screen'),
  { loading: ScreenLoader, ssr: false }
)
const SettingsScreen = dynamic(
  () => import('@/components/screens/settings-screen').then(m => ({ default: m.SettingsScreen })),
  { loading: ScreenLoader, ssr: false }
)

const screenMap: Record<ActiveView, React.ComponentType> = {
  dashboard: DashboardScreen,
  companies: CompaniesScreen,
  'company-profile': CompanyProfileScreen,
  contacts: ContactsScreen,
  import: ImportScreen,
  settings: SettingsScreen,
}

export default function Home() {
  const { activeView } = useAppStore()
  const ActiveScreen = screenMap[activeView]

  return (
    <AppShell>
      <ActiveScreen />
    </AppShell>
  )
}