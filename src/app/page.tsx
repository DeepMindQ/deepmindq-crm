'use client';

import { AppShell } from '@/components/app-shell';
import { useAppStore } from '@/lib/store';
import { Toaster } from '@/components/ui/sonner';
import { DashboardScreen } from '@/components/screens/dashboard-screen';
import { LeadsScreen } from '@/components/screens/leads-screen';
import { CompaniesScreen } from '@/components/screens/companies-screen';
import { ImportScreen } from '@/components/screens/import-screen';
import DraftsScreen from '@/components/screens/drafts-screen';
import { QueueScreen } from '@/components/screens/queue-screen';
import CapabilityLibraryScreen from '@/components/screens/capability-library-screen';
import { RepliesScreen } from '@/components/screens/replies-screen';
import { DuplicatesScreen } from '@/components/screens/duplicates-screen';
import { AuditScreen } from '@/components/screens/audit-screen';
import { SettingsScreen } from '@/components/screens/settings-screen';

function ScreenRouter() {
  const activeView = useAppStore((s) => s.activeView);

  switch (activeView) {
    case 'dashboard':
      return <DashboardScreen />;
    case 'leads':
      return <LeadsScreen />;
    case 'companies':
      return <CompaniesScreen />;
    case 'import':
      return <ImportScreen />;
    case 'drafts':
      return <DraftsScreen />;
    case 'queue':
      return <QueueScreen />;
    case 'capability-library':
      return <CapabilityLibraryScreen />;
    case 'replies':
      return <RepliesScreen />;
    case 'duplicates':
      return <DuplicatesScreen />;
    case 'audit':
      return <AuditScreen />;
    case 'settings':
      return <SettingsScreen />;
    default:
      return <DashboardScreen />;
  }
}

export default function Home() {
  return (
    <AppShell>
      <ScreenRouter />
      <Toaster position="bottom-right" richColors />
    </AppShell>
  );
}