'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Users, Activity, FileText, Search, ArrowLeft,
  ChevronDown, ChevronRight, Mail, Bell, BookOpen, Loader2,
  X, MapPin,
} from 'lucide-react';
import { PageTransition, EmptyState } from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

/* ═══════════════════════════════════════════════════
   Org Chart Screen — Hierarchical Organization View
   
   Replaces the radial SVG mind map with a clean org-chart
   layout: Company at top → Departments → Contacts.
   Also shows Signals and Notes as expandable sections.
   White background, clean lines, no visual clutter.
   ═══════════════════════════════════════════════════ */

interface MindMapProps {
  navigateTo?: (screen: string, companyId?: string) => void;
}

interface ApiNode {
  id: string;
  type: string;
  label: string;
  data: Record<string, unknown>;
}

interface ApiEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

interface MindMapData {
  nodes: ApiNode[];
  edges: ApiEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    companies: number;
    contacts: number;
    signals: number;
    notes: number;
  };
  mode: 'focused' | 'search' | 'overview';
  focusedCompanyId?: string;
}

/* ── Parsed data structures ── */
interface OrgCompany {
  id: string;
  name: string;
  industry: string | null;
  location: string | null;
  score: number;
  status: string | null;
  contacts: OrgContact[];
  signals: OrgSignal[];
  notes: OrgNote[];
}

interface OrgContact {
  id: string;
  name: string;
  email: string | null;
  title: string | null;
  score: number;
  status: string | null;
}

interface OrgSignal {
  id: string;
  title: string;
  signalType: string | null;
  severity: string;
  source: string | null;
}

interface OrgNote {
  id: string;
  title: string;
  category: string;
  pinned: boolean;
}

export default function CompanyOrgChartScreen({ navigateTo }: MindMapProps) {
  // View state
  const [data, setData] = useState<MindMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // UI state
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedSignals, setExpandedSignals] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState(false);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Fetch data ── */
  const fetchData = useCallback(async (params: string = '') => {
    setLoading(true);
    try {
      const url = `/api/companies/mind-map${params ? `?${params}` : ''}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json && json.nodes) {
        setData(json);
      }
    } catch {
      /* silent */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Search with debounce ── */
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!value.trim()) {
      setSearchTerm('');
      setSelectedCompanyId(null);
      fetchData();
      return;
    }
    searchTimeout.current = setTimeout(() => {
      setSearchTerm(value.trim());
      setSelectedCompanyId(null);
      fetchData(`search=${encodeURIComponent(value.trim())}`);
    }, 350);
  };

  /* ── Parse API data into org structures ── */
  const companies = useMemo((): OrgCompany[] => {
    if (!data || !data.nodes) return [];

    const companyNodes = data.nodes.filter(n => n.type === 'company');
    const contactNodes = data.nodes.filter(n => n.type === 'contact');
    const signalNodes = data.nodes.filter(n => n.type === 'signal');
    const noteNodes = data.nodes.filter(n => n.type === 'note');

    return companyNodes.map(cn => {
      const cid = cn.id.replace('company-', '');
      const companyEdges = data.edges.filter(e => e.source === cn.id);

      const contacts = companyEdges
        .filter(e => e.target.startsWith('contact-'))
        .map(e => {
          const node = contactNodes.find(n => n.id === e.target);
          if (!node) return null;
          return {
            id: node.id.replace('contact-', ''),
            name: node.label,
            email: (node.data.email as string) || null,
            title: (node.data.title as string) || (node.data.role as string) || null,
            score: (node.data.score as number) || 0,
            status: (node.data.status as string) || null,
          };
        })
        .filter(Boolean) as OrgContact[];

      const signals = companyEdges
        .filter(e => e.target.startsWith('signal-'))
        .map(e => {
          const node = signalNodes.find(n => n.id === e.target);
          if (!node) return null;
          return {
            id: node.id.replace('signal-', ''),
            title: node.label,
            signalType: (node.data.type as string) || null,
            severity: (node.data.severity as string) || 'medium',
            source: (node.data.source as string) || null,
          };
        })
        .filter(Boolean) as OrgSignal[];

      const notes = companyEdges
        .filter(e => e.target.startsWith('note-'))
        .map(e => {
          const node = noteNodes.find(n => n.id === e.target);
          if (!node) return null;
          return {
            id: node.id.replace('note-', ''),
            title: node.label,
            category: (node.data.category as string) || 'general',
            pinned: (node.data.pinned as boolean) || false,
          };
        })
        .filter(Boolean) as OrgNote[];

      return {
        id: cid,
        name: cn.label,
        industry: (cn.data.industry as string) || null,
        location: (cn.data.location as string) || null,
        score: (cn.data.score as number) || 0,
        status: (cn.data.status as string) || null,
        contacts,
        signals,
        notes,
      };
    });
  }, [data]);

  // Group contacts by department/role for each company
  const companyDeptGroups = useMemo(() => {
    const map = new Map<string, Array<[string, OrgContact[]]>>();
    for (const c of companies) {
      const groups: Map<string, OrgContact[]> = new Map();
      for (const ct of c.contacts) {
        let dept = ct.title || 'General';
        if (dept.length > 40) { dept = dept.substring(0, 40) + '...'; }
        if (!groups.has(dept)) groups.set(dept, []);
        groups.get(dept)!.push(ct);
      }
      map.set(c.id, Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length));
    }
    return map;
  }, [companies]);

  const toggleDept = (id: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[560px] rounded-xl" />
      </div>
    );
  }

  if (!data || companies.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="No Organization Data"
        description="Import companies and contacts to see the organizational hierarchy."
      />
    );
  }

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-amber-500';
      case 'medium': return 'bg-blue-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <PageTransition>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100">
              <Building2 className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                Organization Hierarchy
              </h1>
              <p className="text-[11px] text-gray-500">
                {data.stats.companies} compan{data.stats.companies !== 1 ? 'ies' : 'y'}, {data.stats.contacts}{' '}
                contact{data.stats.contacts !== 1 ? 's' : ''}, {data.stats.signals} signal{data.stats.signals !== 1 ? 's' : ''}, {data.stats.notes} note{data.stats.notes !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 transition-colors focus-within:border-gray-400 focus-within:bg-white">
            <Search className="w-4 h-4 flex-shrink-0 text-gray-400" />
            <input
              type="text"
              placeholder="Search companies by name, domain, or industry…"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
            />
            {searchInput && (
              <button onClick={() => handleSearchChange('')} className="p-0.5 rounded hover:bg-gray-200 transition-colors">
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Org Chart Container */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-auto" style={{ minHeight: '560px' }}>
          <div className="p-6">
            {/* For each company, render a vertical org tree */}
            <div className="space-y-8">
              {companies.map((company) => {
                const depts = companyDeptGroups.get(company.id) || [];
                const isCompanyExpanded = expandedCompany === company.id;

                return (
                  <div key={company.id} className="flex flex-col items-center">
                    {/* Company Root Node */}
                    <button
                      onClick={() => {
                        if (depts.length > 0 || company.signals.length > 0 || company.notes.length > 0) {
                          setExpandedCompany(isCompanyExpanded ? null : company.id);
                        }
                        navigateTo?.('companies', company.id);
                      }}
                      className="inline-flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 border-gray-800 bg-gray-900 text-white shadow-sm hover:shadow-md transition-all cursor-pointer"
                    >
                      <Building2 size={18} />
                      <div className="text-left">
                        <div className="font-bold text-sm">{company.name.length > 35 ? company.name.substring(0, 35) + '...' : company.name}</div>
                        {(company.industry || company.location) && (
                          <div className="text-[11px] text-gray-400">
                            {[company.industry, company.location].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      <div className="ml-2 flex items-center gap-2">
                        {company.contacts.length > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                            {company.contacts.length} contacts
                          </span>
                        )}
                        {depts.length > 0 && (
                          isCompanyExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded tree */}
                    {isCompanyExpanded && (
                      <div className="mt-4 flex flex-col items-center w-full">
                        {/* Vertical connector */}
                        <div className="w-px h-6 bg-gray-300" />

                        {/* Department branches */}
                        <div className="relative w-full max-w-5xl">
                          {/* Horizontal connector line */}
                          <div className="flex justify-center">
                            <div
                              className="h-px bg-gray-300 absolute top-0"
                              style={{
                                width: `${Math.min(depts.length, 8) * 180}px`,
                              }}
                            />
                          </div>

                          <div className="flex flex-wrap justify-center gap-4 relative z-10">
                            {/* Department nodes */}
                            {depts.map(([dept, deptContacts], di) => {
                              const deptId = `${company.id}-dept-${di}`;
                              const isDeptExpanded = expandedDepts.has(deptId);

                              return (
                                <div key={deptId} className="flex flex-col items-center">
                                  {/* Vertical line to dept */}
                                  <div className="w-px h-6 bg-gray-200" />

                                  {/* Department Node */}
                                  <button
                                    onClick={() => toggleDept(deptId)}
                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm transition-all cursor-pointer min-w-[150px] max-w-[200px] ${isDeptExpanded ? 'border-gray-700 bg-gray-100' : 'border-gray-200 bg-white hover:border-gray-400'}`}
                                  >
                                    <Users size={13} className="text-gray-500 flex-shrink-0" />
                                    <div className="flex-1 text-left min-w-0">
                                      <div className="text-[11px] font-semibold text-gray-800 truncate">{dept}</div>
                                      <div className="text-[11px] text-gray-400">{deptContacts.length}</div>
                                    </div>
                                    {isDeptExpanded ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                                  </button>

                                  {/* Expanded contacts under dept */}
                                  {isDeptExpanded && (
                                    <div className="mt-2 flex flex-col gap-1 w-full max-w-[220px]">
                                      {deptContacts.map((ct, ci) => (
                                        <div key={ct.id || ci} className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-100 bg-white hover:border-gray-200 transition-colors">
                                          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                            <span className="text-[9px] font-bold text-gray-500">{(ct.name || '?')[0]?.toUpperCase()}</span>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-[11px] font-medium text-gray-800 truncate">{ct.name}</div>
                                            <div className="text-[9px] text-gray-400 truncate">{ct.email || ''}</div>
                                          </div>
                                          {ct.email && <Mail size={9} className="text-gray-300 flex-shrink-0" />}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Signals branch */}
                            {company.signals.length > 0 && (
                              <div className="flex flex-col items-center">
                                <div className="w-px h-6 bg-gray-200" />
                                <button
                                  onClick={() => setExpandedSignals(!expandedSignals)}
                                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm transition-all cursor-pointer ${expandedSignals ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-400'}`}
                                >
                                  <Bell size={13} className="text-amber-500" />
                                  <span className="text-[11px] font-semibold text-gray-800">Signals</span>
                                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">{company.signals.length}</span>
                                  {expandedSignals ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                                </button>
                                {expandedSignals && (
                                  <div className="mt-2 flex flex-col gap-1 w-full max-w-[240px]">
                                    {company.signals.map(s => (
                                      <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-100 bg-white">
                                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${severityColor(s.severity)}`} />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-[11px] text-gray-800 truncate">{s.title}</div>
                                          <div className="text-[9px] text-gray-400">{s.signalType || s.severity}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Notes branch */}
                            {company.notes.length > 0 && (
                              <div className="flex flex-col items-center">
                                <div className="w-px h-6 bg-gray-200" />
                                <button
                                  onClick={() => setExpandedNotes(!expandedNotes)}
                                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm transition-all cursor-pointer ${expandedNotes ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-400'}`}
                                >
                                  <FileText size={13} className="text-gray-500" />
                                  <span className="text-[11px] font-semibold text-gray-800">Notes</span>
                                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{company.notes.length}</span>
                                  {expandedNotes ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                                </button>
                                {expandedNotes && (
                                  <div className="mt-2 flex flex-col gap-1 w-full max-w-[240px]">
                                    {company.notes.map(n => (
                                      <div key={n.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-100 bg-white">
                                        <FileText size={11} className="text-gray-400 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-[11px] text-gray-800 truncate">{n.title}</div>
                                          <div className="text-[9px] text-gray-400">{n.category}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 pt-6 mt-6 border-t border-gray-100">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <div className="w-3 h-3 rounded bg-gray-900" />
                <span>Company</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <Users size={10} />
                <span>Department</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <div className="w-5 h-5 rounded-full border border-gray-200 flex items-center justify-center">
                  <span className="text-[7px] font-bold text-gray-400">A</span>
                </div>
                <span>Contact</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <Bell size={10} />
                <span>Signals</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <FileText size={10} />
                <span>Notes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
