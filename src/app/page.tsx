'use client'

import { AppShell } from '@/components/app-shell'
import { DashboardScreen } from '@/components/screens/dashboard-screen'
import { CompaniesScreen } from '@/components/screens/companies-screen'
import { CompanyProfileScreen } from '@/components/screens/company-profile-screen'
import { ContactsScreen } from '@/components/screens/contacts-screen'
import { ImportScreen } from '@/components/screens/import-screen'
import { SettingsScreen } from '@/components/screens/settings-screen'
import { useAppStore } from '@/lib/store'
import type { ActiveView } from '@/lib/types'

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