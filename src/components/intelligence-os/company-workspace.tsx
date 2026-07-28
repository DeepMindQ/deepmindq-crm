'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Users, Zap, TrendingUp, Target, Brain,
  ArrowLeft, ExternalLink, FileText, Network, ChevronRight,
  RefreshCw, Shield, AlertTriangle, Sparkles, BookOpen,
  GitBranch, MessageSquare, BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';

/* ═══════════════════════════════════════════════════
   Company Intelligence Workspace
   
   "How do I win this account?"
   Everything belongs to the company intelligence context.
   No fragmentation — unified workspace.
   ═══════════════════════════════════════════════════ */

interface CompanyData {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  country: string | null;
  website: string | null;
  description: string | null;
  employeeCount: number | null;
  revenue: string | null;
  score: number;
  intelligenceScore?: number;
  _count?: { signals: number; contacts: number };
  signalCount?: number;
  topSignal?: string;
}

interface Contact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  role: string | null;
  seniority: string | null;
}

interface Signal {
  id: string;
  title: string;
  type: string;
  description: string | null;
  severity: string;
  createdAt: string;
}

type IntelligenceTab = 'overview' | 'people' | 'signals' | 'technology' | 'alignment' | 'actions';

const TABS: { key: IntelligenceTab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Intelligence', icon: Brain },
  { key: 'people', label: 'People', icon: Users },
  { key: 'signals', label: 'Signals', icon: Zap },
  { key: 'technology', label: 'Technology', icon: Shield },
  { key: 'alignment', label: 'Capability Alignment', icon: Target },
  { key: 'actions', label: 'Actions', icon: Sparkles },
];

export function CompanyWorkspace() {
  const { selectedCompanyId, setActiveView } = useAppStore();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<IntelligenceTab>('overview');

  const fetchCompanyData = useCallback(async () => {
    if (!selectedCompanyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [compRes, contRes, sigRes] = await Promise.all([
        fetch(`/api/companies/${selectedCompanyId}`),
        fetch(`/api/companies/${selectedCompanyId}/contacts`),
        fetch(`/api/companies/${selectedCompanyId}/signals`),
      ]);
      if (compRes.ok) setCompany(await compRes.json());
      if (contRes.ok) { const d = await contRes.json(); setContacts(Array.isArray(d) ? d : d.data ?? []); }
      if (sigRes.ok) { const d = await sigRes.json(); setSignals(Array.isArray(d) ? d : d.data ?? []); }
    } catch (e) { console.error('Company fetch error:', e); }
    finally { setLoading(false); }
  }, [selectedCompanyId]);

  useEffect(() => { fetchCompanyData(); }, [fetchCompanyData]);

  // No company selected — redirect or show empty
  if (!selectedCompanyId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Building2 className="w-12 h-12 text-muted-foreground/20 mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Select an Account</h2>
        <p className="text-sm text-muted-foreground mb-6">Choose an account from the Command Center to explore its intelligence workspace.</p>
        <Button variant="outline" onClick={() => setActiveView('command-center')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Command Center
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-gray-200 animate-pulse" />
        <div className="h-40 rounded-xl bg-white border border-gray-200 animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-white border border-gray-200 animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!company) return null;

  const score = company.intelligenceScore ?? company.score ?? 0;

  return (
    <div className="space-y-5">
      {/* Company Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
            {company.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{company.name}</h1>
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border-0">
                Score: {score}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {company.industry || 'Technology'} {company.country ? `· ${company.country}` : ''} {company.domain ? `· ${company.domain}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setActiveView('accounts'); }} className="gap-1.5 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Button>
          <Button variant="outline" size="sm" onClick={fetchCompanyData} className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Intelligence Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Signals', value: company._count?.signals ?? signals.length, icon: Zap, color: '#F59E0B' },
          { label: 'Contacts', value: company._count?.contacts ?? contacts.length, icon: Users, color: '#2563EB' },
          { label: 'Score', value: score, icon: BarChart3, color: '#059669' },
          { label: 'Industry', value: company.industry || 'N/A', icon: Building2, color: '#8B5CF6' },
        ].map(stat => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Intelligence Tabs */}
      <div className="section-container">
        <div className="flex items-center border-b border-gray-100 px-2 overflow-x-auto scrollbar-hide">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-5 min-h-[300px]">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {company.description && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">About</h3>
                  <p className="text-sm text-foreground leading-relaxed">{company.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                {[
                  { label: 'Employees', value: company.employeeCount?.toLocaleString() || 'N/A' },
                  { label: 'Revenue', value: company.revenue || 'N/A' },
                  { label: 'Domain', value: company.domain || 'N/A' },
                  { label: 'Country', value: company.country || 'N/A' },
                  { label: 'Website', value: company.website || 'N/A' },
                  { label: 'Top Signal', value: company.topSignal || 'None yet' },
                ].map(item => (
                  <div key={item.label} className="px-3 py-2.5 rounded-lg bg-gray-50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-medium text-foreground mt-0.5 truncate">{item.value}</p>
                  </div>
                ))}
              </div>
              {signals.length === 0 && contacts.length === 0 && (
                <div className="text-center py-8">
                  <Brain className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Intelligence data will appear here once enriched.</p>
                </div>
              )}
            </div>
          )}

          {/* PEOPLE TAB */}
          {activeTab === 'people' && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Stakeholders ({contacts.length})
              </h3>
              {contacts.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No contacts yet. Enrich this account to discover stakeholders.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {contacts.slice(0, 20).map(contact => (
                    <div key={contact.id} className="flex items-center gap-3 py-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                        {contact.name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{contact.title || 'Unknown role'}</p>
                      </div>
                      {contact.seniority && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{contact.seniority}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SIGNALS TAB */}
          {activeTab === 'signals' && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Market Signals ({signals.length})
              </h3>
              {signals.length === 0 ? (
                <div className="text-center py-8">
                  <Zap className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No signals detected yet. Signals appear after intelligence enrichment.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {signals.slice(0, 20).map(signal => (
                    <div key={signal.id} className="flex items-start gap-3 py-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        signal.severity === 'high' ? 'bg-red-500' : signal.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{signal.title || signal.type}</p>
                        {signal.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{signal.description}</p>}
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{signal.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TECHNOLOGY TAB */}
          {activeTab === 'technology' && (
            <div className="text-center py-12">
              <Shield className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-2">Technology Intelligence</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Technology stack, digital footprint, and competitive positioning will appear after enrichment.
              </p>
            </div>
          )}

          {/* ALIGNMENT TAB */}
          {activeTab === 'alignment' && (
            <div className="text-center py-12">
              <Target className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-2">Capability Alignment</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                How your capabilities align with this account&apos;s needs. Activates after intelligence enrichment.
              </p>
            </div>
          )}

          {/* ACTIONS TAB */}
          {activeTab === 'actions' && (
            <div className="text-center py-12">
              <Sparkles className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-2">Recommended Actions</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                AI-recommended next steps for engaging this account. Appears after full intelligence analysis.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
