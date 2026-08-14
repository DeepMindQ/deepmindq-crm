'use client';

import { useState } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  Users,
  Upload,
  Send,
  AlertTriangle,
  BookOpen,
  Copy,
  Zap,
  Lightbulb,
  Server,
  DollarSign,
} from 'lucide-react';
import Leads from '@/components/screens/leads-screen';
import Import from '@/components/screens/import-screen';
import Queue from '@/components/screens/queue-screen';
import Bounces from '@/components/screens/bounces-screen';
import KnowledgeLibrary from '@/components/screens/knowledge-library-screen';
import Duplicates from '@/components/screens/duplicates-screen';
import Capability from '@/components/screens/capability-screen';
import InternalIntelligence from '@/components/screens/internal-intelligence-screen';
import Enterprise from '@/components/screens/enterprise-screen';
import RevOps from '@/components/screens/revops-screen';

const SCREENS = [
  { id: 'leads', label: 'Leads', icon: Users, component: Leads },
  { id: 'import', label: 'Import', icon: Upload, component: Import },
  { id: 'queue', label: 'Queue', icon: Send, component: Queue },
  { id: 'bounces', label: 'Bounces', icon: AlertTriangle, component: Bounces },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen, component: KnowledgeLibrary },
  { id: 'duplicates', label: 'Duplicates', icon: Copy, component: Duplicates },
  { id: 'capability', label: 'Capabilities', icon: Zap, component: Capability },
  { id: 'intel', label: 'Intelligence', icon: Lightbulb, component: InternalIntelligence },
  { id: 'enterprise', label: 'Enterprise', icon: Server, component: Enterprise },
  { id: 'revops', label: 'RevOps', icon: DollarSign, component: RevOps },
] as const;

type ScreenId = (typeof SCREENS)[number]['id'];

export default function Page() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('leads');
  const ActiveComponent = SCREENS.find((s) => s.id === activeScreen)!.component;

  return (
    <div className="h-screen flex flex-col" style={{ background: tokens.surface.secondary }}>
      {/* Tab Bar */}
      <nav
        className="shrink-0 flex items-center gap-1 px-4 py-2 overflow-x-auto"
        style={{
          background: tokens.surface.card,
          borderBottom: `1px solid ${tokens.border.default}`,
        }}
      >
        {SCREENS.map((screen) => {
          const isActive = activeScreen === screen.id;
          return (
            <button
              key={screen.id}
              onClick={() => setActiveScreen(screen.id)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
              style={{
                background: isActive ? tokens.accent.primary : 'transparent',
                color: isActive ? tokens.flat.white : tokens.text.secondary,
              }}
            >
              <screen.icon className="h-4 w-4" />
              {screen.label}
            </button>
          );
        })}
      </nav>

      {/* Screen Content */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
}
