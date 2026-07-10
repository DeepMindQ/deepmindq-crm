'use client'

import { AppShell } from '@/components/app-shell'
import { useAppStore } from '@/lib/store'
import { DashboardScreen } from '@/components/screens/dashboard-screen'
import { CompaniesScreen } from '@/components/screens/companies-screen'
import CompanyProfileScreen from '@/components/screens/company-profile-screen'
import ContactsScreen from '@/components/screens/contacts-screen'
import ContactDetailScreen from '@/components/screens/contact-detail-screen'
import EmailGenerationScreen from '@/components/screens/email-generation-screen'
import KnowledgeLibraryScreen from '@/components/screens/knowledge-library-screen'
import ImportScreen from '@/components/screens/import-screen'
import { SettingsScreen } from '@/components/screens/settings-screen'

function AppContent() {
  const { activeView } = useAppStore()

  switch (activeView) {
    case 'dashboard':
      return <DashboardScreen />
    case 'companies':
      return <CompaniesScreen />
    case 'company-profile':
      return <CompanyProfileScreen />
    case 'contacts':
      return <ContactsScreen />
    case 'contact-profile':
      return <ContactDetailScreen />
    case 'email-generation':
      return <EmailGenerationScreen />
    case 'knowledge-library':
      return <KnowledgeLibraryScreen />
    case 'import':
      return <ImportScreen />
    case 'settings':
      return <SettingsScreen />
    default:
      return <DashboardScreen />
  }
}

export default function HomePage() {
  return (
    <AppShell>
      <AppContent />
    </AppShell>
  )
}