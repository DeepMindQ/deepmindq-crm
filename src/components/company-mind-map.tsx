'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Building2, Users, ChevronDown, ChevronRight, Mail, FileText, Bell, BookOpen } from 'lucide-react';

/* ═══════════════════════════════════════════════════
   Company Org Chart — Hierarchical Organization View
   
   Company at top → Departments (grouped by role/title) → Contacts
   Also shows Signals and Notes as separate branches.
   Clean white background, no visual clutter, interconnecting lines.
   ═══════════════════════════════════════════════════ */

interface CompanyMindMapProps {
  company: any;
  contacts: any[];
  notes: any[];
  signals: any[];
  researchCard: any;
}

interface OrgNode {
  id: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  children?: OrgNode[];
  count?: number;
  nodeType: 'root' | 'department' | 'contact' | 'signal' | 'note' | 'info';
}

function parseJsonField(field: string | null | undefined): any {
  if (!field) return null;
  try { return JSON.parse(field); } catch { return null; }
}

export function CompanyMindMap({ company, contacts, notes, signals, researchCard }: CompanyMindMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['contacts']));

  const companyName = company?.rawName || company?.name || 'Company';
  const companyIndustry = company?.industry || '';
  const companyLocation = company?.location || '';

  // Toggle department expand/collapse
  const toggleDept = (id: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Group contacts by department/role hierarchy ──
  const contactTree = useMemo(() => {
    const groups: Map<string, typeof contacts> = new Map();
    for (const c of (contacts || [])) {
      // Normalize role/title to a department category
      let dept = c.title || c.role || 'General';
      // Trim long titles
      if (dept.length > 40) dept = dept.substring(0, 40) + '...';
      if (!groups.has(dept)) groups.set(dept, []);
      groups.get(dept)!.push(c);
    }
    // Sort departments by contact count (most contacts first)
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [contacts]);

  const totalContacts = contacts?.length || 0;
  const totalSignals = signals?.length || 0;
  const totalNotes = notes?.length || 0;

  const signalSeverities = (signals || []).map((s: any) => s.severity);
  const hasCritical = signalSeverities.includes('critical');
  const hasHigh = signalSeverities.includes('high');

  return (
    <div ref={containerRef} className="w-full min-h-[550px] relative bg-white">
      <div className="p-6 space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-center">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-xs mb-2">
              <Building2 size={12} />
              Organization Chart
            </div>
            <h2 className="text-xl font-bold text-gray-900">{companyName}</h2>
            {(companyIndustry || companyLocation) && (
              <p className="text-sm text-gray-500 mt-0.5">
                {[companyIndustry, companyLocation].filter(Boolean).join(' · ')}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {totalContacts} contact{totalContacts !== 1 ? 's' : ''} · {totalSignals} signal{totalSignals !== 1 ? 's' : ''} · {totalNotes} note{totalNotes !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* ── Org Tree ── */}
        <div className="flex flex-col items-center">
          {/* ROOT: Company */}
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl border-2 border-gray-800 bg-gray-900 text-white shadow-sm">
              <Building2 size={16} className="text-white" />
              <div>
                <div className="font-bold text-sm">{companyName.length > 28 ? companyName.substring(0, 28) + '...' : companyName}</div>
                {companyIndustry && <div className="text-xs text-gray-400">{companyIndustry}</div>}
              </div>
            </div>
          </div>

          {/* Vertical line from root */}
          <div className="w-px h-8 bg-gray-300" />

          {/* BRANCH POINT: horizontal connector */}
          <div className="relative flex items-start justify-center w-full max-w-4xl">
            {/* Horizontal line */}
            <div className="absolute top-0 left-1/2 h-px bg-gray-300"
              style={{
                width: `${Math.min(contactTree.length, 6) * 200}px`,
                marginLeft: `${-Math.min(contactTree.length, 6) * 100}px`,
              }}
            />

            {/* ── Contacts Section ── */}
            <div className="flex flex-wrap justify-center gap-4 px-4 relative z-10">
              {contactTree.map(([dept, deptContacts], di) => {
                const deptId = `dept-${di}`;
                const isExpanded = expandedDepts.has(deptId);
                const deptColor = isExpanded ? 'border-gray-800 bg-gray-50' : 'border-gray-200 bg-white';

                return (
                  <div key={deptId} className="flex flex-col items-center">
                    {/* Vertical line down to department */}
                    <div className="w-px h-8 bg-gray-300" />

                    {/* Department Node */}
                    <button
                      onClick={() => toggleDept(deptId)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg border ${deptColor} shadow-sm transition-all hover:shadow-md cursor-pointer min-w-[160px] max-w-[220px]`}
                    >
                      <Users size={13} className="text-gray-500 flex-shrink-0" />
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-xs font-semibold text-gray-800 truncate">{dept}</div>
                        <div className="text-[10px] text-gray-400">{deptContacts.length} contact{deptContacts.length !== 1 ? 's' : ''}</div>
                      </div>
                      {isExpanded ? (
                        <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight size={13} className="text-gray-400 flex-shrink-0" />
                      )}
                    </button>

                    {/* Expanded contacts */}
                    {isExpanded && (
                      <>
                        <div className="w-px h-4 bg-gray-200" />
                        <div className="flex flex-col gap-1.5 pb-2 w-full max-w-[220px]">
                          {deptContacts.slice(0, 12).map((c: any, ci: number) => {
                            const cName = c.rawName || c.name || c.email || 'Unknown';
                            const cTitle = c.title || c.role || '';
                            const cEmail = c.email || '';
                            return (
                              <div
                                key={c.id || `c-${ci}`}
                                className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-100 bg-white hover:border-gray-300 transition-colors"
                              >
                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-[10px] font-bold text-gray-500">
                                    {(cName || '?')[0]?.toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium text-gray-800 truncate">{cName}</div>
                                  <div className="text-[10px] text-gray-400 truncate">{cTitle || cEmail}</div>
                                </div>
                                {cEmail && (
                                  <Mail size={10} className="text-gray-300 flex-shrink-0" />
                                )}
                              </div>
                            );
                          })}
                          {deptContacts.length > 12 && (
                            <div className="text-[10px] text-gray-400 text-center px-3 py-1">
                              +{deptContacts.length - 12} more contact{deptContacts.length - 12 !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Signals & Notes Section (below contacts) ── */}
          {(totalSignals > 0 || totalNotes > 0) && (
            <>
              <div className="w-px h-8 bg-gray-300" />
              <div className="flex flex-wrap justify-center gap-6 px-4">
                {/* Signals */}
                {totalSignals > 0 && (
                  <div className="flex flex-col items-center">
                    <div className="w-px h-4 bg-gray-200" />
                    <button
                      onClick={() => toggleSection('signals')}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border shadow-sm transition-all cursor-pointer ${expandedSections.has('signals') ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}
                    >
                      <Bell size={13} className={hasCritical ? 'text-red-500' : hasHigh ? 'text-amber-500' : 'text-gray-500'} />
                      <div className="text-xs font-semibold text-gray-800">Signals</div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${hasCritical ? 'bg-red-100 text-red-600' : hasHigh ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                        {totalSignals}
                      </span>
                      {expandedSections.has('signals') ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                    </button>

                    {expandedSections.has('signals') && (
                      <div className="flex flex-col gap-1 mt-2 w-full max-w-[280px]">
                        {(signals || []).slice(0, 6).map((s: any, i: number) => (
                          <div key={s.id || `sig-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-100 bg-white">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.severity === 'critical' ? 'bg-red-500' : s.severity === 'high' ? 'bg-amber-500' : s.severity === 'medium' ? 'bg-blue-500' : 'bg-gray-400'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-gray-800 truncate">{s.title || 'Signal'}</div>
                              <div className="text-[10px] text-gray-400">{s.signalType || s.severity || ''}</div>
                            </div>
                          </div>
                        ))}
                        {totalSignals > 6 && (
                          <div className="text-[10px] text-gray-400 text-center py-1">
                            +{totalSignals - 6} more signal{totalSignals - 6 !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                {totalNotes > 0 && (
                  <div className="flex flex-col items-center">
                    <div className="w-px h-4 bg-gray-200" />
                    <button
                      onClick={() => toggleSection('notes')}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border shadow-sm transition-all cursor-pointer ${expandedSections.has('notes') ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}
                    >
                      <FileText size={13} className="text-gray-500" />
                      <div className="text-xs font-semibold text-gray-800">Notes</div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{totalNotes}</span>
                      {expandedSections.has('notes') ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                    </button>

                    {expandedSections.has('notes') && (
                      <div className="flex flex-col gap-1 mt-2 w-full max-w-[280px]">
                        {(notes || []).slice(0, 6).map((n: any, i: number) => (
                          <div key={n.id || `note-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-100 bg-white">
                            <FileText size={11} className="text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-gray-800 truncate">{n.title || 'Note'}</div>
                              <div className="text-[10px] text-gray-400">{n.category || 'general'}</div>
                            </div>
                          </div>
                        ))}
                        {totalNotes > 6 && (
                          <div className="text-[10px] text-gray-400 text-center py-1">
                            +{totalNotes - 6} more note{totalNotes - 6 !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Research */}
                {researchCard?.businessOverview && (
                  <div className="flex flex-col items-center">
                    <div className="w-px h-4 bg-gray-200" />
                    <button
                      onClick={() => toggleSection('research')}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border shadow-sm transition-all cursor-pointer ${expandedSections.has('research') ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}
                    >
                      <BookOpen size={13} className="text-gray-500" />
                      <div className="text-xs font-semibold text-gray-800">Research</div>
                      {expandedSections.has('research') ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                    </button>

                    {expandedSections.has('research') && (
                      <div className="flex flex-col gap-1 mt-2 w-full max-w-[280px]">
                        {researchCard.businessOverview && (
                          <div className="px-3 py-2 rounded-md border border-gray-100 bg-white">
                            <div className="text-[10px] text-gray-400 mb-1">Business Overview</div>
                            <div className="text-xs text-gray-700 line-clamp-3">
                              {typeof researchCard.businessOverview === 'string'
                                ? researchCard.businessOverview.substring(0, 200)
                                : 'Research data available'}
                            </div>
                          </div>
                        )}
                        {researchCard.possibleOpportunities && (
                          <div className="px-3 py-2 rounded-md border border-gray-100 bg-white">
                            <div className="text-[10px] text-gray-400 mb-1">Opportunities</div>
                            <div className="text-xs text-gray-700 line-clamp-3">
                              {typeof researchCard.possibleOpportunities === 'string'
                                ? researchCard.possibleOpportunities.substring(0, 200)
                                : 'Available'}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 pt-2 pb-4 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <div className="w-2 h-2 rounded-full bg-gray-800" />
            <span>Company</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <Users size={10} />
            <span>Departments</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <Bell size={10} />
            <span>Signals</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <FileText size={10} />
            <span>Notes</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <BookOpen size={10} />
            <span>Research</span>
          </div>
        </div>
      </div>
    </div>
  );
}
