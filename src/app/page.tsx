'use client'

import dynamic from 'next/dynamic'
import { AppShell } from '@/components/app-shell'
import { useAppStore } from '@/lib/store'
import type { ActiveView } from '@/lib/types'
import { SkeletonGrid } from '@/components/shared/design-system'

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
const ImportScreen = dynamic(
  () => import('@/components/screens/import-screen'),
  { loading: () => <SkeletonGrid panels={1} />, ssr: false }
)
const SettingsScreen = dynamic(
  () => import('@/components/screens/settings-screen').then(m => ({ default: m.SettingsScreen })),
  { loading: () => <SkeletonGrid panels={1} />, ssr: false }
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