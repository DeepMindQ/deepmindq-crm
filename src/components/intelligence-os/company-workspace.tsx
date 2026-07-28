'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Users, Zap, TrendingUp, Target, Brain,
  ArrowLeft, ExternalLink, FileText, Network, ChevronRight,
  RefreshCw, Shield, AlertTriangle, Sparkles, BookOpen,
  GitBranch, MessageSquare, BarChart3, Monitor, Layers,
  Clock, ArrowUpRight, CheckCircle2, AlertCircle, Info,
  ChevronDown, Wrench, Eye, Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { ProgressiveDisclosure, type EvidenceItem } from './progressive-disclosure';

/* ═══════════════════════════════════════════════════
   Company Intelligence Workspace
   
   "How do I win this account?"
   Everything belongs to the company intelligence context.
   No fragmentation — unified workspace.
   
   Tabs: Intelligence | People | Signals | Technology | Alignment | Actions
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
  _count?: { signals: number; contacts: number; notes: number };
  signalCount?: number;
  topSignal?: string;
  researchCard?: any;
}

interface Contact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  role: string | null;
  seniority: string | null;
  leadScore?: number;
}

interface Signal {
  id: string;
  title: string;
  type: string;
  signalType?: string;
  description: string | null;
  severity: string;
  createdAt: string;
  source?: string;
  sourceUrl?: string;
}

/* ── Alignment API response types ── */
interface BusinessNeed {
  need: string;
  confidence: number;
  signalTypes: string[];
  signalCount: number;
  evidence: string[];
  detectedAt: string;
}

interface CapabilityMatch {
  capability: string;
  capabilityId: string;
  category: string;
  matchConfidence: number;
  matchedNeeds: string[];
  supportingEvidence: string[];
  summary: string;
}

interface RecommendedPositioning {
  message: string;
  angle: string;
  targetStakeholders: Array<{ role: string; reason: string }>;
  strengthScore: number;
  topMatches: string[];
}

interface TechnologyProfile {
  knownTech: string[];
  techSignals: Array<{ signal: string; type: string; date: string; confidence: number }>;
  digitalMaturity: string;
  techDescription: string | null;
}

interface RecommendedAction {
  action: string;
  type: 'engage' | 'research' | 'prepare' | 'monitor';
  priority: 'high' | 'medium' | 'low';
  reason: string;
  capability?: string;
  contact?: string;
  confidence: number;
}

interface AlignmentData {
  company: string;
  industry: string | null;
  domain: string | null;
  intelligenceScore: number;
  needs: BusinessNeed[];
  capabilityMatches: CapabilityMatch[];
  recommendedPositioning: RecommendedPositioning;
  technology: TechnologyProfile;
  actions: RecommendedAction[];
  signalCount: number;
  capabilityCount: number;
  contactCount: number;
}

type IntelligenceTab = 'overview' | 'people' | 'signals' | 'technology' | 'alignment' | 'actions';

const TABS: { key: IntelligenceTab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Intelligence', icon: Brain },
  { key: 'people', label: 'People', icon: Users },
  { key: 'signals', label: 'Signals', icon: Zap },
  { key: 'technology', label: 'Technology', icon: Shield },
  { key: 'alignment', label: 'Alignment', icon: Target },
  { key: 'actions', label: 'Actions', icon: Sparkles },
];

/* ═══════════════════════════════════════════════════
   Confidence color helper
   ═══════════════════════════════════════════════════ */
function confidenceColor(v: number) {
  if (v >= 80) return '#059669';
  if (v >= 60) return '#f59e0b';
  return '#ef4444';
}

function confidenceBg(v: number) {
  if (v >= 80) return 'rgba(5,150,105,0.1)';
  if (v >= 60) return 'rgba(245,158,11,0.1)';
  return 'rgba(239,68,68,0.1)';
}

function priorityConfig(p: string) {
  switch (p) {
    case 'high': return { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'High', icon: AlertCircle };
    case 'medium': return { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Medium', icon: Info };
    case 'low': return { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'Low', icon: Eye };
    default: return { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'Info', icon: Info };
  }
}

function actionTypeIcon(type: string) {
  switch (type) {
    case 'engage': return Play;
    case 'research': return BookOpen;
    case 'prepare': return Wrench;
    case 'monitor': return Monitor;
    default: return ChevronRight;
  }
}

/* ═══════════════════════════════════════════════════
   Company Workspace Component
   ═══════════════════════════════════════════════════ */

export function CompanyWorkspace() {
  const { selectedCompanyId, setActiveView } = useAppStore();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [alignment, setAlignment] = useState<AlignmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [alignmentLoading, setAlignmentLoading] = useState(true);
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
      if (sigRes.ok) { const d = await sigRes.json(); setSignals(Array.isArray(d) ? d : d.data ?? d.signals ?? []); }
    } catch (e) { console.error('Company fetch error:', e); }
    finally { setLoading(false); }
  }, [selectedCompanyId]);

  const fetchAlignment = useCallback(async () => {
    if (!selectedCompanyId) { setAlignmentLoading(false); return; }
    setAlignmentLoading(true);
    try {
      const res = await fetch(`/api/companies/${selectedCompanyId}/alignment`);
      if (res.ok) {
        setAlignment(await res.json());
      }
    } catch (e) { console.error('Alignment fetch error:', e); }
    finally { setAlignmentLoading(false); }
  }, [selectedCompanyId]);

  useEffect(() => { fetchCompanyData(); }, [fetchCompanyData]);
  useEffect(() => { fetchAlignment(); }, [fetchAlignment]);

  // No company selected
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
  const companyName = company.name || 'Unknown Company';

  return (
    <div className="space-y-5">
      {/* Company Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
            {companyName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{companyName}</h1>
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
          <Button variant="outline" size="sm" onClick={() => { fetchCompanyData(); fetchAlignment(); }} className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Intelligence Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Signals', value: company._count?.signals ?? signals.length, icon: Zap, color: '#F59E0B' },
          { label: 'Contacts', value: company._count?.contacts ?? contacts.length, icon: Users, color: '#2563EB' },
          { label: 'Score', value: score, icon: BarChart3, color: '#059669' },
          { label: 'Needs', value: alignment?.needs.length ?? '-', icon: Target, color: '#8B5CF6' },
          { label: 'Capabilities', value: alignment?.capabilityMatches.length ?? '-', icon: Layers, color: '#06B6D4' },
        ].map(stat => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-foreground">{typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}</p>
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
                {/* Badge count for relevant tabs */}
                {tab.key === 'technology' && (alignment?.technology.knownTech.length ?? 0) > 0 && (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/8 text-primary">{alignment!.technology.knownTech.length}</span>
                )}
                {tab.key === 'alignment' && (alignment?.capabilityMatches.length ?? 0) > 0 && (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">{alignment!.capabilityMatches.length}</span>
                )}
                {tab.key === 'actions' && (alignment?.actions.length ?? 0) > 0 && (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">{alignment!.actions.length}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-5 min-h-[300px]">
          {/* ═══════════════════════════════════════
             OVERVIEW TAB
             ═══════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {company.description && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">About</h3>
                  <p className="text-sm text-foreground leading-relaxed">{company.description}</p>
                </div>
              )}

              {/* Quick Intelligence Summary from Alignment API */}
              {alignment && !alignmentLoading && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  {/* Top Needs */}
                  {alignment.needs.length > 0 && (
                    <div className="border border-gray-100 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="w-4 h-4 text-primary" />
                        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Detected Needs</h3>
                      </div>
                      <div className="space-y-2">
                        {alignment.needs.slice(0, 4).map((need, i) => (
                          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                              style={{ background: confidenceBg(need.confidence), color: confidenceColor(need.confidence) }}>
                              {need.confidence}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{need.need}</p>
                              <p className="text-[10px] text-muted-foreground">{need.signalCount} signals · {need.signalTypes.join(', ')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Capability Matches */}
                  {alignment.capabilityMatches.length > 0 && (
                    <div className="border border-gray-100 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Top Capability Matches</h3>
                      </div>
                      <div className="space-y-2">
                        {alignment.capabilityMatches.slice(0, 4).map((match, i) => (
                          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-emerald-50 text-emerald-700">
                              {match.matchConfidence}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{match.capability}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{match.matchedNeeds[0] || match.category}</p>
                            </div>
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">{match.category}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Company Details */}
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

              {signals.length === 0 && contacts.length === 0 && !alignment?.needs.length && (
                <div className="text-center py-8">
                  <Brain className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Intelligence data will appear here once enriched.</p>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════
             PEOPLE TAB
             ═══════════════════════════════════════ */}
          {activeTab === 'people' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Stakeholders ({contacts.length})
                </h3>
                {alignment && alignment.recommendedPositioning.targetStakeholders.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-primary/8 text-primary border-0">
                    {alignment.recommendedPositioning.targetStakeholders.length} recommended
                  </Badge>
                )}
              </div>

              {/* Recommended stakeholders from alignment */}
              {alignment && alignment.recommendedPositioning.targetStakeholders.length > 0 && (
                <div className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-2">
                    Recommended Targets
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {alignment.recommendedPositioning.targetStakeholders.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-gray-100 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="font-medium text-foreground">{s.role}</span>
                        <span className="text-[10px] text-muted-foreground">— {s.reason}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

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
                      {contact.leadScore !== undefined && contact.leadScore > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${contact.leadScore}%`,
                                background: contact.leadScore >= 70 ? '#059669' : contact.leadScore >= 40 ? '#f59e0b' : '#94a3b8',
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-medium tabular-nums text-muted-foreground">{contact.leadScore}</span>
                        </div>
                      )}
                      {contact.seniority && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{contact.seniority}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════
             SIGNALS TAB
             ═══════════════════════════════════════ */}
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
                <div className="space-y-2">
                  {signals.slice(0, 20).map(signal => {
                    const severityColor = signal.severity === 'high' || signal.severity === 'critical'
                      ? '#ef4444' : signal.severity === 'medium' ? '#f59e0b' : '#3b82f6';
                    return (
                      <div key={signal.id} className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: severityColor }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{signal.title || signal.type}</p>
                          {signal.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{signal.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 border-0 capitalize"
                              style={{ background: `${severityColor}15`, color: severityColor }}>
                              {signal.signalType || signal.type}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground/60">
                              {new Date(signal.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════
             TECHNOLOGY INTELLIGENCE TAB
             ═══════════════════════════════════════ */}
          {activeTab === 'technology' && (
            <div className="space-y-5">
              {alignmentLoading ? (
                <div className="flex items-center gap-2 py-8 justify-center">
                  <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Loading technology intelligence...</span>
                </div>
              ) : alignment && (
                <>
                  {/* Digital Maturity */}
                  <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Monitor className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Digital Maturity</p>
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-2 py-0 border-0 capitalize"
                          style={{
                            background: alignment.technology.digitalMaturity === 'advanced' ? 'rgba(5,150,105,0.15)' :
                              alignment.technology.digitalMaturity === 'high' ? 'rgba(59,130,246,0.15)' :
                              alignment.technology.digitalMaturity === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                            color: alignment.technology.digitalMaturity === 'advanced' ? '#059669' :
                              alignment.technology.digitalMaturity === 'high' ? '#3b82f6' :
                              alignment.technology.digitalMaturity === 'medium' ? '#f59e0b' : '#ef4444',
                          }}
                        >
                          {alignment.technology.digitalMaturity}
                        </Badge>
                      </div>
                      {alignment.technology.techDescription && (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{alignment.technology.techDescription}</p>
                      )}
                    </div>
                  </div>

                  {/* Known Technology Stack */}
                  {alignment.technology.knownTech.length > 0 ? (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Technology Stack ({alignment.technology.knownTech.length} technologies)
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {alignment.technology.knownTech.map((tech, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-medium text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors"
                          >
                            <GitBranch className="w-3 h-3 text-muted-foreground" />
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Shield className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No technology data available yet.</p>
                      <p className="text-xs text-muted-foreground mt-1">Run intelligence enrichment to discover the technology stack.</p>
                    </div>
                  )}

                  {/* Technology Change Signals */}
                  {alignment.technology.techSignals.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Technology Change Signals
                      </h3>
                      <div className="space-y-2">
                        {alignment.technology.techSignals.map((ts, i) => (
                          <ProgressiveDisclosure
                            key={i}
                            title={ts.signal}
                            confidence={ts.confidence}
                            confidenceLabel="Signal confidence"
                            badge={{ label: ts.type.replace(/_/g, ' '), variant: 'high' }}
                            timestamp={new Date(ts.date).toLocaleDateString()}
                            reasoning={`Technology change signal of type "${ts.type}" detected. This indicates active technology evolution within ${companyName}.`}
                            evidence={[]}
                            defaultExpanded={1}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state when no data */}
                  {alignment.technology.knownTech.length === 0 && alignment.technology.techSignals.length === 0 && (
                    <div className="text-center py-6">
                      <Monitor className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Technology intelligence will appear after enrichment.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchAlignment}
                        className="mt-3 gap-1.5 text-xs"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Refresh Intelligence
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════
             CAPABILITY ALIGNMENT TAB
             ═══════════════════════════════════════ */}
          {activeTab === 'alignment' && (
            <div className="space-y-5">
              {alignmentLoading ? (
                <div className="flex items-center gap-2 py-8 justify-center">
                  <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Analyzing capability alignment...</span>
                </div>
              ) : alignment ? (
                <>
                  {/* Positioning Summary */}
                  {alignment.recommendedPositioning.strengthScore > 0 && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-primary/5 to-emerald-50/50 border border-primary/10">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Target className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                            Recommended Positioning
                          </p>
                          <p className="text-sm text-foreground leading-relaxed">
                            {alignment.recommendedPositioning.message}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge variant="secondary" className="text-[10px] px-2 py-0 bg-primary/8 text-primary border-0">
                              Strength: {alignment.recommendedPositioning.strengthScore}%
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] px-2 py-0 bg-gray-100 text-muted-foreground border-0 capitalize">
                              {alignment.recommendedPositioning.angle.replace(/-/g, ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Business Needs → Capability Matches */}
                  {alignment.needs.length > 0 ? (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Detected Business Needs ({alignment.needs.length})
                      </h3>
                      <div className="space-y-2">
                        {alignment.needs.map((need, i) => {
                          const matchedCaps = alignment.capabilityMatches.filter(m =>
                            m.matchedNeeds.includes(need.need)
                          );
                          return (
                            <ProgressiveDisclosure
                              key={i}
                              title={need.need}
                              confidence={need.confidence}
                              confidenceLabel="Detection confidence"
                              badge={{
                                label: `${need.signalCount} signal${need.signalCount !== 1 ? 's' : ''}`,
                                variant: need.confidence >= 75 ? 'high' : need.confidence >= 50 ? 'medium' : 'low',
                              }}
                              timestamp={new Date(need.detectedAt).toLocaleDateString()}
                              reasoning={`Detected through ${need.signalTypes.join(', ')} signal analysis for ${companyName}. ${need.signalCount} active signals contribute to this assessment.`}
                              reasoningItems={need.evidence.slice(0, 5)}
                              evidence={matchedCaps.flatMap(m =>
                                m.supportingEvidence.map(e => ({
                                  source: m.capability,
                                  snippet: e,
                                }))
                              )}
                              impactStatement={matchedCaps.length > 0
                                ? `${matchedCaps.length} capabilities match this need — strongest: ${matchedCaps[0].capability} (${matchedCaps[0].matchConfidence}%)`
                                : undefined
                              }
                              relatedActions={alignment.actions
                                .filter(a => a.capability && matchedCaps.some(m => m.capability === a.capability))
                                .map(a => ({ title: a.action, priority: a.priority }))
                              }
                              defaultExpanded={1}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Target className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No business needs detected yet.</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Needs are derived from signals. Enrich this account or add signals to trigger alignment.
                      </p>
                    </div>
                  )}

                  {/* Capability Match Detail */}
                  {alignment.capabilityMatches.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Capability Matches ({alignment.capabilityMatches.length})
                      </h3>
                      <div className="space-y-2">
                        {alignment.capabilityMatches.map((match, i) => (
                          <div key={i} className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 hover:shadow-sm transition-all">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                <span className="text-sm font-bold text-emerald-700">{match.matchConfidence}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-foreground">{match.capability}</h4>
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">{match.category}</Badge>
                                </div>
                                {match.summary && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{match.summary}</p>
                                )}
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {match.matchedNeeds.map((need, j) => (
                                    <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 text-[10px] text-muted-foreground">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                      {need}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {alignment.needs.length === 0 && alignment.capabilityMatches.length === 0 && (
                    <div className="text-center py-8">
                      <Sparkles className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No capability alignment detected.</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload capabilities and add signals to enable alignment scoring.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveView('activation-workspace')}
                        className="mt-3 gap-1.5 text-xs"
                      >
                        <ArrowUpRight className="w-3 h-3" />
                        Manage Capabilities
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <Target className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Unable to load alignment data.</p>
                  <Button variant="outline" size="sm" onClick={fetchAlignment} className="mt-3 gap-1.5 text-xs">
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════
             ACTIONS TAB
             ═══════════════════════════════════════ */}
          {activeTab === 'actions' && (
            <div className="space-y-5">
              {alignmentLoading ? (
                <div className="flex items-center gap-2 py-8 justify-center">
                  <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Generating recommended actions...</span>
                </div>
              ) : alignment && alignment.actions.length > 0 ? (
                <>
                  {/* Actions Summary */}
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50/50 border border-amber-100">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {alignment.actions.length} recommended actions for {companyName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Prioritized by confidence and business impact
                      </p>
                    </div>
                  </div>

                  {/* Actions List with Progressive Disclosure */}
                  <div className="space-y-2">
                    {alignment.actions.map((action, i) => {
                      const config = priorityConfig(action.priority);
                      const TypeIcon = actionTypeIcon(action.type);
                      return (
                        <ProgressiveDisclosure
                          key={i}
                          title={action.action}
                          confidence={action.confidence}
                          confidenceLabel="Action confidence"
                          badge={{
                            label: action.type,
                            variant: action.priority === 'high' ? 'high' : action.priority === 'medium' ? 'medium' : 'low',
                          }}
                          reasoning={action.reason}
                          evidence={
                            action.capability ? [{
                              source: 'Capability Library',
                              snippet: `Linked to capability: ${action.capability}`,
                            }] : action.contact ? [{
                              source: 'Contact Intelligence',
                              snippet: `Target contact: ${action.contact}`,
                            }] : []
                          }
                          relatedActions={
                            action.capability
                              ? alignment.actions
                                  .filter(a => a.capability === action.capability && a.action !== action.action)
                                  .map(a => ({ title: a.action, priority: a.priority }))
                              : undefined
                          }
                          defaultExpanded={1}
                        />
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Sparkles className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No actions recommended yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Actions are generated from signals, capability matches, and contact intelligence.
                  </p>
                  <Button variant="outline" size="sm" onClick={fetchAlignment} className="mt-3 gap-1.5 text-xs">
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
