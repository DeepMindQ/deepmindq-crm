'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Brain, Building2, Mail, Archive, Search, Sparkles, AlertTriangle,
  TrendingUp, Target, Zap, ArrowRight, ChevronRight, BarChart3,
  Activity, Lightbulb, RefreshCw, Send, FileText, Users, Globe,
  ArrowUpRight, ArrowDownRight, Minus, MessageSquare, Loader2,
  CircleDot, Radar, Cpu, ShieldCheck, Clock, Layers, Eye,
} from 'lucide-react';
import { PageTransition, StatCard, GlassPanel, AnimatedBar, PulseDot, ShimmerText, EmptyState } from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
interface CommandCenterProps { navigateTo?: (screen: string) => void }

interface Insights {
  companyEngine: {
    totalCompanies: number;
    companiesByStatus: Record<string, number>;
    companiesByIndustry: Record<string, number>;
    companiesByLifecycle: Record<string, number>;
    topScoredCompanies: Array<{ id: string; name: string; industry: string; score: number; status: string; lifecycleStage: string }>;
    unreadSignalCount: number;
    criticalSignalCount: number;
    latestSignals: Array<{ id: string; type: string; title: string; severity: string; createdAt: string }>;
  };
  emailEngine: {
    totalContacts: number;
    contactsByStatus: Record<string, number>;
    pendingDrafts: number;
    pendingQueue: number;
    totalReplies: number;
    positiveReplies: number;
    replyRate: number;
    avgLeadScore: number;
    highValueLeads: Array<{ id: string; name: string; email: string; score: number; company: string; status: string }>;
    activeSequences: number;
  };
  capabilityEngine: {
    totalCapabilities: number;
    capabilitiesByCategory: Record<string, number>;
    capabilitiesByServiceLine: Record<string, number>;
    topCapabilities: Array<{ id: string; title: string; category: string; serviceLine: string; usedInEmails: number; upvotes: number }>;
  };
  recommendations: Array<{
    type: string; priority: 'high' | 'medium' | 'low'; engine: string;
    title: string; description: string; actionScreen?: string;
  }>;
  healthScore: number;
}

interface QueryResult {
  query: string;
  interpretation: string;
  engine: string;
  data: any;
  summary: string;
}

/* ═══════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════ */
const GOLD = '#D4AF37';
const GOLD_LIGHT = '#E8C860';
const GOLD_DIM = '#9A8340';

const ENGINE_CONFIG = {
  company: { label: 'Company Engine', icon: Building2, color: '#A855F7', bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.25)' },
  email: { label: 'Email Engine', icon: Mail, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)' },
  capability: { label: 'Capability Engine', icon: Archive, color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
} as const;

const PRIORITY_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  high: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'Critical' },
  medium: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Action' },
  low: { color: '#71717A', bg: 'rgba(113,113,122,0.12)', label: 'Info' },
};

const SIGNAL_TYPE_ICONS: Record<string, string> = {
  funding: '💰', hiring: '👤', leadership_change: '👔', tech_change: '⚙️',
  news: '📰', mention: '💬', partnership: '🤝', expansion: '🌍',
};

const LIFECYCLE_COLORS: Record<string, string> = {
  discovery: '#3B82F6', qualification: '#A855F7', proposal: '#F59E0B', negotiation: '#10B981', closed: '#D4AF37',
};

const SAMPLE_QUERIES = [
  'Show me high-value companies',
  'Which leads haven\'t been contacted?',
  'What are the latest signals?',
  'Show pending email drafts',
  'Best capabilities by usage',
  'Companies by industry breakdown',
];

/* ═══════════════════════════════════════════════════
   Health Gauge Component
   ═══════════════════════════════════════════════════ */
function HealthGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[9px] uppercase tracking-widest" style={{ color: '#7A8699' }}>Health</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Engine Card Component
   ═══════════════════════════════════════════════════ */
function EngineCard({ engineKey, insights, navigateTo }: {
  engineKey: 'company' | 'email' | 'capability';
  insights: Insights;
  navigateTo?: (screen: string) => void;
}) {
  const config = ENGINE_CONFIG[engineKey];
  const Icon = config.icon;
  const [expanded, setExpanded] = useState(false);

  const engineData = engineKey === 'company' ? insights.companyEngine :
    engineKey === 'email' ? insights.emailEngine : insights.capabilityEngine;

  return (
    <motion.div
      layout
      className="rounded-xl border overflow-hidden"
      style={{ background: 'rgba(12,18,30,0.6)', borderColor: 'rgba(255,255,255,0.06)' }}
      whileHover={{ borderColor: config.border }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        style={{ background: config.bg }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${config.color}20` }}>
            <Icon className="w-4 h-4" style={{ color: config.color }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{config.label}</h3>
            <p className="text-[10px]" style={{ color: '#7A8699' }}>
              {engineKey === 'company' ? `${engineData.totalCompanies} companies tracked` :
               engineKey === 'email' ? `${engineData.totalContacts} contacts in pipeline` :
               `${engineData.totalCapabilities} capabilities loaded`}
            </p>
          </div>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="w-4 h-4" style={{ color: '#7A8699' }} />
        </motion.div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Company Engine Details */}
              {engineKey === 'company' && (
                <>
                  {/* Status Distribution */}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-medium mb-2" style={{ color: '#3A4555' }}>STATUS DISTRIBUTION</p>
                    <div className="space-y-1.5">
                      {Object.entries(engineData.companiesByStatus).map(([status, count]) => (
                        <div key={status} className="flex items-center gap-2">
                          <span className="text-[11px] w-20 truncate" style={{ color: '#7A8699' }}>{status}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-white/[0.04]">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: config.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${(count / Math.max(engineData.totalCompanies, 1)) * 100}%` }}
                              transition={{ duration: 0.6, delay: 0.1 }}
                            />
                          </div>
                          <span className="text-[10px] font-medium tabular-nums w-6 text-right" style={{ color: config.color }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lifecycle Stages */}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-medium mb-2" style={{ color: '#3A4555' }}>LIFECYCLE STAGES</p>
                    <div className="flex gap-1">
                      {Object.entries(engineData.companiesByLifecycle).map(([stage, count]) => (
                        <div key={stage} className="flex-1 text-center px-1 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <div className="text-xs font-bold" style={{ color: LIFECYCLE_COLORS[stage] || '#7A8699' }}>{count}</div>
                          <div className="text-[8px] mt-0.5 truncate" style={{ color: '#3A4555' }}>{stage}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Companies */}
                  {engineData.topScoredCompanies.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-medium mb-2" style={{ color: '#3A4555' }}>TOP SCORED</p>
                      <div className="space-y-1">
                        {engineData.topScoredCompanies.slice(0, 3).map((c, i) => (
                          <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                            <span className="text-[10px] font-bold w-4" style={{ color: i === 0 ? GOLD : '#3A4555' }}>#{i + 1}</span>
                            <span className="text-xs text-foreground flex-1 truncate">{c.name}</span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: `${GOLD}20`, color: GOLD }}>{c.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Latest Signals */}
                  {engineData.latestSignals.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] uppercase tracking-widest font-medium" style={{ color: '#3A4555' }}>LIVE SIGNALS</p>
                        <PulseDot color={engineData.criticalSignalCount > 0 ? '#EF4444' : GOLD} />
                      </div>
                      <div className="space-y-1">
                        {engineData.latestSignals.slice(0, 3).map((s) => (
                          <div key={s.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg" style={{ background: s.severity === 'critical' || s.severity === 'high' ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)' }}>
                            <span className="text-xs">{SIGNAL_TYPE_ICONS[s.type] || '📡'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-foreground truncate">{s.title}</p>
                              <p className="text-[9px]" style={{ color: '#3A4555' }}>{s.type.replace(/_/g, ' ')} • {s.severity}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Email Engine Details */}
              {engineKey === 'email' && (
                <>
                  {/* Pipeline Status */}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-medium mb-2" style={{ color: '#3A4555' }}>CONTACT PIPELINE</p>
                    <div className="space-y-1.5">
                      {Object.entries(engineData.contactsByStatus).slice(0, 6).map(([status, count]) => {
                        const maxStatus = Math.max(...Object.values(engineData.contactsByStatus), 1);
                        return (
                          <div key={status} className="flex items-center gap-2">
                            <span className="text-[10px] w-20 truncate capitalize" style={{ color: '#7A8699' }}>{status.replace(/_/g, ' ')}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-white/[0.04]">
                              <motion.div className="h-full rounded-full" style={{ background: config.color }}
                                initial={{ width: 0 }} animate={{ width: `${(count / maxStatus) * 100}%` }} transition={{ duration: 0.6 }} />
                            </div>
                            <span className="text-[10px] font-medium tabular-nums w-6 text-right" style={{ color: config.color }}>{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick Metrics */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center px-2 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="text-sm font-bold" style={{ color: GOLD }}>{engineData.avgLeadScore}</div>
                      <div className="text-[8px] mt-0.5" style={{ color: '#3A4555' }}>Avg Score</div>
                    </div>
                    <div className="text-center px-2 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="text-sm font-bold" style={{ color: '#10B981' }}>{engineData.replyRate}%</div>
                      <div className="text-[8px] mt-0.5" style={{ color: '#3A4555' }}>Reply Rate</div>
                    </div>
                    <div className="text-center px-2 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="text-sm font-bold" style={{ color: config.color }}>{engineData.activeSequences}</div>
                      <div className="text-[8px] mt-0.5" style={{ color: '#3A4555' }}>Sequences</div>
                    </div>
                  </div>

                  {/* High Value Leads */}
                  {engineData.highValueLeads.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-medium mb-2" style={{ color: '#3A4555' }}>HIGH-VALUE LEADS</p>
                      <div className="space-y-1">
                        {engineData.highValueLeads.slice(0, 4).map((l) => (
                          <div key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: l.score >= 80 ? '#10B981' : l.score >= 60 ? GOLD : '#3B82F6' }}>
                              {l.score}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-foreground truncate">{l.name}</p>
                              <p className="text-[9px] truncate" style={{ color: '#3A4555' }}>{l.email}</p>
                            </div>
                            <Badge variant="outline" className="text-[8px] px-1 py-0" style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#7A8699' }}>{l.status}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Capability Engine Details */}
              {engineKey === 'capability' && (
                <>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-medium mb-2" style={{ color: '#3A4555' }}>BY CATEGORY</p>
                    <div className="space-y-1.5">
                      {Object.entries(engineData.capabilitiesByCategory).map(([cat, count]) => {
                        const maxCat = Math.max(...Object.values(engineData.capabilitiesByCategory), 1);
                        return (
                          <div key={cat} className="flex items-center gap-2">
                            <span className="text-[10px] w-24 truncate capitalize" style={{ color: '#7A8699' }}>{cat.replace(/_/g, ' ')}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-white/[0.04]">
                              <motion.div className="h-full rounded-full" style={{ background: config.color }}
                                initial={{ width: 0 }} animate={{ width: `${(count / maxCat) * 100}%` }} transition={{ duration: 0.6 }} />
                            </div>
                            <span className="text-[10px] font-medium tabular-nums w-6 text-right" style={{ color: config.color }}>{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {engineData.capabilitiesByServiceLine && Object.keys(engineData.capabilitiesByServiceLine).length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-medium mb-2" style={{ color: '#3A4555' }}>BY SERVICE LINE</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(engineData.capabilitiesByServiceLine).map(([sl, count]) => (
                          <div key={sl} className="px-2.5 py-1 rounded-full text-[10px] font-medium" style={{ background: `${config.color}15`, color: config.color, border: `1px solid ${config.color}30` }}>
                            {sl}: {count}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {engineData.topCapabilities.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-medium mb-2" style={{ color: '#3A4555' }}>TOP PERFORMERS</p>
                      <div className="space-y-1">
                        {engineData.topCapabilities.slice(0, 4).map((c) => (
                          <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-foreground truncate">{c.title}</p>
                              <p className="text-[9px] capitalize" style={{ color: '#3A4555' }}>{c.category.replace(/_/g, ' ')} {c.serviceLine ? `• ${c.serviceLine}` : ''}</p>
                            </div>
                            <div className="flex items-center gap-2 text-[10px]" style={{ color: '#7A8699' }}>
                              <span className="flex items-center gap-0.5"><Send className="w-2.5 h-2.5" />{c.usedInEmails}</span>
                              <span className="flex items-center gap-0.5"><ArrowUpRight className="w-2.5 h-2.5" />{c.upvotes}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Action Button */}
              <button
                onClick={(e) => { e.stopPropagation(); navigateTo?.(engineKey === 'company' ? 'companies' : engineKey === 'email' ? 'leads' : 'capabilities'); }}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: `${config.color}10`, color: config.color, border: `1px solid ${config.color}20` }}
                onMouseEnter={e => (e.currentTarget.style.background = `${config.color}20`)}
                onMouseLeave={e => (e.currentTarget.style.background = `${config.color}10`)}
              >
                Open {config.label} <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   AI Query Bar Component
   ═══════════════════════════════════════════════════ */
function AIQueryBar({ onQuery }: { onQuery: (q: string) => void }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setSuggestionsOpen(false);
    onQuery(query.trim());
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
          <Sparkles className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSuggestionsOpen(true); }}
            onFocus={() => setSuggestionsOpen(true)}
            onBlur={() => setTimeout(() => setSuggestionsOpen(false), 200)}
            placeholder="Ask Einstein AI anything... e.g. 'Show me high-value companies in fintech'"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: GOLD }} />
          ) : (
            <button type="submit" className="p-1 rounded-lg transition-colors" style={{ color: GOLD }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,55,0.1)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {/* Suggestions Dropdown */}
      <AnimatePresence>
        {suggestionsOpen && query.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1 rounded-xl border p-2 z-20"
            style={{ background: 'rgba(12,18,30,0.95)', borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}
          >
            <p className="text-[9px] uppercase tracking-widest font-medium px-2 py-1" style={{ color: '#3A4555' }}>SUGGESTED QUERIES</p>
            {SAMPLE_QUERIES.map((sq, i) => (
              <button
                key={i}
                onMouseDown={() => { setQuery(sq); setSuggestionsOpen(false); inputRef.current?.focus(); }}
                className="w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/[0.04]"
                style={{ color: '#7A8699' }}
              >
                <Sparkles className="w-3 h-3 inline mr-2" style={{ color: GOLD_DIM }} />{sq}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Query Result Panel
   ═══════════════════════════════════════════════════ */
function QueryResultPanel({ result }: { result: QueryResult }) {
  const engineKey = result.engine as keyof typeof ENGINE_CONFIG;
  const config = ENGINE_CONFIG[engineKey] || ENGINE_CONFIG.company;
  const isArray = Array.isArray(result.data);
  const items = isArray ? result.data : result.data ? [result.data] : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-4 space-y-3"
      style={{ background: 'rgba(12,18,30,0.6)', borderColor: `${config.color}30` }}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${config.color}15` }}>
          <Brain className="w-4 h-4" style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] uppercase tracking-widest font-medium px-1.5 py-0.5 rounded" style={{ background: `${config.color}15`, color: config.color }}>
              {config.label}
            </span>
            <span className="text-[10px] italic" style={{ color: '#3A4555' }}>{result.interpretation}</span>
          </div>
          <p className="text-xs text-foreground">{result.summary}</p>
        </div>
      </div>

      {/* Data Table */}
      {items.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-lg border" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {items.slice(0, 8).map((item: any, i: number) => (
            <div key={item.id || i} className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              {item.name && <span className="text-[11px] text-foreground flex-1 truncate">{item.name}</span>}
              {item.title && <span className="text-[11px] text-foreground flex-1 truncate">{item.title}</span>}
              {item.label && <span className="text-[11px] text-foreground flex-1 truncate">{item.label}</span>}
              {item.score !== undefined && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0" style={{ background: `${GOLD}15`, color: GOLD }}>{item.score}</span>
              )}
              {item.industry && <span className="text-[9px] shrink-0" style={{ color: '#3A4555' }}>{item.industry}</span>}
              {item.count !== undefined && <span className="text-[10px] font-medium shrink-0" style={{ color: config.color }}>{item.count}</span>}
              {item.usedInEmails !== undefined && (
                <span className="text-[9px] shrink-0" style={{ color: '#3A4555' }}>{item.usedInEmails} uses</span>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Main Command Center Screen
   ═══════════════════════════════════════════════════ */
export default function CommandCenterScreen({ navigateTo }: CommandCenterProps) {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'engines' | 'query'>('overview');

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch('/api/command-center/insights');
      const data = await res.json();
      if (data && data.companyEngine) setInsights(data);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  const handleQuery = useCallback(async (q: string) => {
    setQueryLoading(true);
    setQueryResult(null);
    try {
      const res = await fetch('/api/command-center/query', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (data && data.summary) setQueryResult(data);
    } catch { toast.error('Query failed'); }
    setQueryLoading(false);
  }, []);

  /* ── Loading Skeleton ── */
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!insights) {
    return <EmptyState icon={Brain} title="Command Center Unavailable" description="Could not load AI insights. Try refreshing." />;
  }

  const ce = insights.companyEngine;
  const ee = insights.emailEngine;
  const capE = insights.capabilityEngine;

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})` }}>
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                AI Command Center
                <Sparkles className="w-4 h-4" style={{ color: GOLD }} />
              </h1>
              <p className="text-[11px]" style={{ color: '#7A8699' }}>Einstein-like intelligence across all engines</p>
            </div>
          </div>
          <button
            onClick={fetchInsights}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#7A8699' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {/* AI Query Bar */}
        <AIQueryBar onQuery={handleQuery} />

        {/* Query Result */}
        {queryLoading && (
          <div className="flex items-center gap-3 p-4 rounded-xl border" style={{ background: 'rgba(12,18,30,0.6)', borderColor: 'rgba(212,175,55,0.15)' }}>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: GOLD }} />
            <span className="text-xs" style={{ color: GOLD }}>Einstein AI is thinking...</span>
          </div>
        )}
        {queryResult && <QueryResultPanel result={queryResult} />}

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {(['overview', 'engines', 'query'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
              style={activeTab === tab
                ? { background: `${GOLD}15`, color: GOLD }
                : { color: '#7A8699' }}
            >
              {tab === 'overview' ? '📊 Overview' : tab === 'engines' ? '⚙️ Engines' : '🧠 AI Query'}
            </button>
          ))}
        </div>

        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard label="Companies" value={ce.totalCompanies} icon={Building2} color="#A855F7" delay={0} />
              <StatCard label="Contacts" value={ee.totalContacts} icon={Users} color="#3B82F6" delay={0.05} />
              <StatCard label="Capabilities" value={capE.totalCapabilities} icon={Archive} color="#10B981" delay={0.1} />
              <StatCard label="Avg Lead Score" value={ee.avgLeadScore} icon={Target} color={GOLD} delay={0.15} />
              <div className="col-span-2 lg:col-span-1 flex items-center justify-center rounded-xl border p-3" style={{ background: 'rgba(12,18,30,0.6)', borderColor: 'rgba(255,255,255,0.06)' }}>
                <HealthGauge score={insights.healthScore} />
              </div>
            </div>

            {/* AI Recommendations */}
            {insights.recommendations.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4" style={{ color: GOLD }} />
                  <h2 className="text-sm font-semibold text-foreground">AI Recommendations</h2>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0" style={{ borderColor: 'rgba(212,175,55,0.3)', color: GOLD }}>
                    {insights.recommendations.filter(r => r.priority === 'high').length} Critical
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {insights.recommendations.slice(0, 6).map((rec, i) => {
                    const pStyle = PRIORITY_STYLES[rec.priority];
                    const engConfig = ENGINE_CONFIG[rec.engine as keyof typeof ENGINE_CONFIG];
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200"
                        style={{ background: 'rgba(12,18,30,0.6)', borderColor: 'rgba(255,255,255,0.06)' }}
                        whileHover={{ borderColor: `${engConfig.color}40`, background: `${engConfig.color}05` }}
                        onClick={() => { if (rec.actionScreen) navigateTo?.(rec.actionScreen); }}
                      >
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: pStyle.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-foreground">{rec.title}</span>
                            <span className="text-[8px] uppercase tracking-wider font-medium px-1 py-0 rounded" style={{ background: pStyle.bg, color: pStyle.color }}>{pStyle.label}</span>
                          </div>
                          <p className="text-[10px] leading-relaxed" style={{ color: '#7A8699' }}>{rec.description}</p>
                        </div>
                        {rec.actionScreen && <ArrowRight className="w-3 h-3 shrink-0 mt-1" style={{ color: '#3A4555' }} />}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Engine Summary Cards (collapsed) */}
            <div className="space-y-3">
              {(['company', 'email', 'capability'] as const).map(eng => (
                <EngineCard key={eng} engineKey={eng} insights={insights} navigateTo={navigateTo} />
              ))}
            </div>
          </div>
        )}

        {/* ═══ ENGINES TAB ═══ */}
        {activeTab === 'engines' && (
          <div className="space-y-4">
            {(['company', 'email', 'capability'] as const).map(eng => (
              <EngineCard key={eng} engineKey={eng} insights={insights} navigateTo={navigateTo} />
            ))}
          </div>
        )}

        {/* ═══ AI QUERY TAB ═══ */}
        {activeTab === 'query' && (
          <div className="space-y-4">
            <AIQueryBar onQuery={handleQuery} />
            {queryLoading && (
              <div className="flex items-center gap-3 p-6 rounded-xl border justify-center" style={{ background: 'rgba(12,18,30,0.6)', borderColor: 'rgba(212,175,55,0.15)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${GOLD}15` }}>
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: GOLD }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: GOLD }}>Einstein AI is analyzing your query...</p>
                  <p className="text-[10px]" style={{ color: '#3A4555' }}>Cross-referencing all three engines</p>
                </div>
              </div>
            )}
            {queryResult && <QueryResultPanel result={queryResult} />}
            {!queryLoading && !queryResult && (
              <div className="text-center py-12 rounded-xl border" style={{ background: 'rgba(12,18,30,0.4)', borderColor: 'rgba(255,255,255,0.04)' }}>
                <Brain className="w-10 h-10 mx-auto mb-3" style={{ color: '#3A4555' }} />
                <p className="text-sm text-foreground mb-1">Ask Einstein AI Anything</p>
                <p className="text-[11px]" style={{ color: '#3A4555' }}>Natural language queries across Company, Email, and Capability engines</p>
                <div className="flex flex-wrap gap-2 justify-center mt-4 max-w-md mx-auto">
                  {SAMPLE_QUERIES.map((sq, i) => (
                    <button key={i} onClick={() => handleQuery(sq)}
                      className="px-3 py-1.5 rounded-full text-[10px] border transition-colors"
                      style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#7A8699' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = `${GOLD}40`; e.currentTarget.style.color = GOLD; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#7A8699'; }}
                    >
                      {sq}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}