'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Building2, Globe, MapPin, Briefcase, Users, X, BookOpen, StickyNote, FileText, BrainCircuit, UserCheck, Sparkles, Loader2 } from 'lucide-react';
import {
  PageTransition,
  AnimatedCard,
  StaggerGrid,
  StaggerItem,
  SectionHeader,
  StatCard,
  AnimatedCounter,
  GlassPanel,
  EmptyState,
  GradientCard,
} from '@/components/ui/animated-components';

interface Company {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  employeeSize?: string;
  country?: string;
  intelligenceScore?: number;
  status: string;
  contactCount?: number;
  research?: ResearchInfo;
  notes?: string;
  internalSummary?: string;
}

interface ResearchInfo {
  businessOverview?: string;
  currentTechLandscape?: string;
  potentialChallenges?: string;
  possibleOpportunities?: string;
  relevantServices?: string;
  keyDecisionMakers?: string;
  nextAction?: string;
  confidenceScore?: number;
}

interface Contact {
  id: string;
  name: string;
  email?: string;
  jobTitle?: string;
  status: string;
}

interface CompaniesScreenProps {
  navigateTo?: (screen: string) => void;
}

export default function CompaniesScreen({ navigateTo }: CompaniesScreenProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyContacts, setCompanyContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  useEffect(() => {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    fetch(`/api/companies${params}`)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data.companies || [];
        setCompanies(list.map((c: any) => ({ ...c, name: c.rawName || c.name })));
      })
      .catch(() => {})
      .finally(() => { setLoading(false); });
  }, [search]);

  const openCompany = async (company: Company) => {
    setSelectedCompany(company);
    setLoadingContacts(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/contacts`);
      const data = await res.json();
      setCompanyContacts((Array.isArray(data) ? data : data.contacts || []).map((c: any) => ({ ...c, name: c.rawName || c.name })));
    } catch { setCompanyContacts([]); }
    setLoadingContacts(false);
  };

  const totalCompanies = companies.length;
  const companiesWithResearch = companies.filter(c => c.research).length;
  const countText = search
    ? `${totalCompanies} result${totalCompanies !== 1 ? 's' : ''} for "${search}"`
    : `${totalCompanies} compan${totalCompanies !== 1 ? 'ies' : 'y'}`;
  const totalContacts = companies.reduce((sum, c) => sum + (c.contactCount ?? 0), 0);

  /* ── L-03: Enrich company ── */
  const handleEnrich = async (companyId: string) => {
    setEnrichingId(companyId);
    try {
      const res = await fetch('/api/companies/enrich', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Enriched ${selectedCompany?.name || 'company'} data`);
        // Refresh companies list
        const listRes = await fetch(`/api/companies${search ? `?search=${encodeURIComponent(search)}` : ''}`);
        const listData = await listRes.json();
        const list = Array.isArray(listData) ? listData : listData.companies || [];
        setCompanies(list.map((c: any) => ({ ...c, name: c.rawName || c.name })));
        // Refresh dialog company
        if (selectedCompany) {
          const updated = list.find((c: any) => c.id === companyId);
          if (updated) setSelectedCompany({ ...updated, name: updated.rawName || updated.name });
        }
      } else {
        toast.error(data.error || 'Enrichment failed');
      }
    } catch { toast.error('Enrichment failed'); }
    setEnrichingId(null);
  };


  return (
    <PageTransition>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-8 pr-1 pb-8">

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Companies"
            value={loading ? '-' : totalCompanies}
            icon={Building2}
            color="#D4AF37"
            delay={0}
          />
          <StatCard
            label="With Research"
            value={loading ? '-' : companiesWithResearch}
            icon={BrainCircuit}
            color="#3B82F6"
            delay={0.08}
          />
          <StatCard
            label="Total Contacts"
            value={loading ? '-' : totalContacts}
            icon={UserCheck}
            color="#10B981"
            delay={0.16}
          />
        </div>

        {/* Search Bar */}
        <GlassPanel className="p-0 overflow-hidden transition-all duration-300">
          <div
            className="relative p-4"
            style={searchFocused ? {
              boxShadow: '0 0 30px rgba(212, 175, 55, 0.12), 0 0 60px rgba(212, 175, 55, 0.06), inset 0 1px 0 rgba(212, 175, 55, 0.1)',
              borderRadius: 'inherit',
            } : undefined}
          >
            <Search
              className="absolute left-7 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors duration-200"
              style={searchFocused ? { color: '#D4AF37' } : undefined}
            />
            <Input
              placeholder="Search companies by name, domain, or industry..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="pl-12 h-11 text-sm bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
            />
          </div>
        </GlassPanel>

        {/* Company Grid */}
        <div>
          <SectionHeader title="Companies" subtitle={countText} />
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
            </div>
          ) : companies.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No companies found"
              description="Try adjusting your search query or add new companies to get started."
            />
          ) : (
            <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {companies.map(company => (
                <StaggerItem key={company.id}>
                  <motion.div
                    className="rounded-xl cursor-pointer relative group/card"
                    whileHover={{ y: -6, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }}
                    onClick={() => openCompany(company)}
                  >
                    {/* Outer glow on hover */}
                    <div
                      className="absolute -inset-[2px] rounded-xl opacity-0 group-hover/card:opacity-100 transition-all duration-500 blur-md"
                      style={{
                        background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.35), rgba(212, 175, 55, 0.08), rgba(59, 130, 246, 0.12), transparent 70%)',
                      }}
                    />
                    {/* Gradient border */}
                    <div
                      className="relative rounded-xl p-[1px] transition-all duration-300"
                      style={{
                        background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.05) 40%, rgba(59, 130, 246, 0.08) 80%, transparent)',
                      }}
                    >
                      <div className="rounded-xl bg-card p-5 transition-all duration-300 group-hover/card:bg-card/95">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300"
                              style={{
                                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.05))',
                                boxShadow: 'inset 0 1px 0 rgba(212, 175, 55, 0.1)',
                              }}
                            >
                              <Building2 className="w-5 h-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate group-hover/card:text-primary transition-colors duration-200">{company.name}</p>
                              {company.domain && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                                  <Globe className="w-3 h-3" />{company.domain}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="bg-primary/10 text-primary border-primary/25 shrink-0 text-xs font-semibold"
                            style={{ boxShadow: '0 0 8px rgba(212, 175, 55, 0.08)' }}
                          >
                            {company.contactCount ?? 0} contacts
                          </Badge>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                          {company.industry && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.05]">
                              <Briefcase className="w-3 h-3 text-primary/70" />{company.industry}
                            </span>
                          )}
                          {company.employeeSize && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.05]">
                              <Users className="w-3 h-3 text-primary/70" />{company.employeeSize}
                            </span>
                          )}
                          {company.country && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.05]">
                              <MapPin className="w-3 h-3 text-primary/70" />{company.country}
                            </span>
                          )}
                        </div>
                        {company.research && (
                          <div className="mt-3 flex items-center gap-1.5">
                            <BrainCircuit className="w-3 h-3 text-blue-400" />
                            <span className="text-[11px] text-blue-400/80 font-medium">Research available</span>
                          </div>
                        )}
                        {/* L-03: Enrichment indicator */}
                        {(company as any).researchCard?.enrichmentSource && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-primary/70" />
                            <span className="text-[11px] text-primary/60 font-medium">AI Enriched</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </StaggerItem>
              ))}
            </StaggerGrid>
          )}
        </div>

        {/* Company Detail Dialog */}
        <Dialog open={!!selectedCompany} onOpenChange={() => setSelectedCompany(null)}>
          <DialogContent className="bg-card/90 backdrop-blur-xl border border-white/[0.08] text-foreground max-w-2xl max-h-[85vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center justify-between pr-6">
                <span className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.05))',
                      boxShadow: '0 0 12px rgba(212, 175, 55, 0.1)',
                    }}
                  >
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  {selectedCompany?.name}
                </span>
                <div className="flex items-center gap-2">
                  {/* L-03: Enrich Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 border-primary/20 text-primary hover:bg-primary/10"
                    disabled={enrichingId === selectedCompany?.id}
                    onClick={(e) => { e.stopPropagation(); handleEnrich(selectedCompany!.id); }}
                  >
                    {enrichingId === selectedCompany?.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Enrich
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 rounded-lg" onClick={() => setSelectedCompany(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-2">
              {selectedCompany && (
                <div className="space-y-5 pb-4">
                  {/* Company Info Glass Panel */}
                  <GlassPanel className="p-4">
                    <div className="flex flex-wrap gap-x-5 gap-y-2.5 text-sm text-muted-foreground">
                      {selectedCompany.domain && (
                        <span className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                            <Globe className="w-3.5 h-3.5 text-primary" />
                          </div>
                          {selectedCompany.domain}
                        </span>
                      )}
                      {selectedCompany.industry && (
                        <span className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                            <Briefcase className="w-3.5 h-3.5 text-primary" />
                          </div>
                          {selectedCompany.industry}
                        </span>
                      )}
                      {selectedCompany.employeeSize && (
                        <span className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                            <Users className="w-3.5 h-3.5 text-primary" />
                          </div>
                          {selectedCompany.employeeSize}
                        </span>
                      )}
                      {selectedCompany.country && (
                        <span className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                            <MapPin className="w-3.5 h-3.5 text-primary" />
                          </div>
                          {selectedCompany.country}
                        </span>
                      )}
                    </div>
                  </GlassPanel>

                  {/* Research Card */}
                  {selectedCompany.research && (
                    <GlassPanel className="p-5">
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold flex items-center gap-2.5 text-foreground">
                          <div className="w-7 h-7 rounded-md bg-blue-500/15 flex items-center justify-center">
                            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                          </div>
                          Company Research
                          {selectedCompany.research.confidenceScore != null && (
                            <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {selectedCompany.research.confidenceScore}% confidence
                            </span>
                          )}
                        </h4>
                        {selectedCompany.research.businessOverview && (
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Business Overview</p>
                            <p className="text-sm text-foreground/90 leading-relaxed">{selectedCompany.research.businessOverview}</p>
                          </div>
                        )}
                        {selectedCompany.research.currentTechLandscape && (
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Tech Landscape</p>
                            <p className="text-sm text-foreground/90 leading-relaxed">{selectedCompany.research.currentTechLandscape}</p>
                          </div>
                        )}
                        {selectedCompany.research.potentialChallenges && (
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Challenges</p>
                            <p className="text-sm text-foreground/90 leading-relaxed">{selectedCompany.research.potentialChallenges}</p>
                          </div>
                        )}
                        {selectedCompany.research.possibleOpportunities && (
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Opportunities</p>
                            <p className="text-sm text-foreground/90 leading-relaxed">{selectedCompany.research.possibleOpportunities}</p>
                          </div>
                        )}
                        {selectedCompany.research.relevantServices && (
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Relevant Services</p>
                            <p className="text-sm text-foreground/90 leading-relaxed">{selectedCompany.research.relevantServices}</p>
                          </div>
                        )}
                        {selectedCompany.research.keyDecisionMakers && (
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Key Decision Makers</p>
                            <p className="text-sm text-foreground/90 leading-relaxed">{selectedCompany.research.keyDecisionMakers}</p>
                          </div>
                        )}
                        {selectedCompany.research.nextAction && (
                          <GradientCard gradient="gold">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Next Action</p>
                            <p className="text-sm text-primary font-semibold leading-relaxed">{selectedCompany.research.nextAction}</p>
                          </GradientCard>
                        )}
                      </div>
                    </GlassPanel>
                  )}

                  {/* Contacts */}
                  <GlassPanel className="p-5">
                    <div>
                      <h4 className="text-sm font-bold flex items-center gap-2.5 mb-4">
                        <div className="w-7 h-7 rounded-md bg-emerald-500/15 flex items-center justify-center">
                          <Users className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        Contacts ({companyContacts.length})
                        {navigateTo && companyContacts.length > 0 && (
                          <span
                            onClick={() => { setSelectedCompany(null); navigateTo('leads'); }}
                            className="ml-auto text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors font-normal"
                          >View all contacts &rarr;</span>
                        )}
                      </h4>
                      {loadingContacts ? (
                        <div className="space-y-3">
                          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                        </div>
                      ) : companyContacts.length > 0 ? (
                        <div className="space-y-2">
                          {companyContacts.map(c => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between py-3 px-4 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors duration-200"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <span className="text-xs font-bold text-primary">{c.name.charAt(0).toUpperCase()}</span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{c.jobTitle || c.email || '-'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {navigateTo && (
                                  <span
                                    onClick={(e) => { e.stopPropagation(); navigateTo('leads'); }}
                                    className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                                  >View</span>
                                )}
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold">
                                  {c.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground py-2">No contacts at this company.</p>
                      )}
                    </div>
                  </GlassPanel>

                  {/* Notes */}
                  {selectedCompany.notes && (
                    <GlassPanel className="p-5">
                      <div>
                        <h4 className="text-sm font-bold flex items-center gap-2.5 mb-3">
                          <div className="w-7 h-7 rounded-md bg-amber-500/15 flex items-center justify-center">
                            <StickyNote className="w-3.5 h-3.5 text-amber-400" />
                          </div>
                          Notes
                        </h4>
                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{selectedCompany.notes}</p>
                      </div>
                    </GlassPanel>
                  )}

                  {/* Internal Summary */}
                  {selectedCompany.internalSummary && (
                    <GlassPanel className="p-5">
                      <div>
                        <h4 className="text-sm font-bold flex items-center gap-2.5 mb-3">
                          <div className="w-7 h-7 rounded-md bg-purple-500/15 flex items-center justify-center">
                            <FileText className="w-3.5 h-3.5 text-purple-400" />
                          </div>
                          Internal Summary
                        </h4>
                        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{selectedCompany.internalSummary}</p>
                      </div>
                    </GlassPanel>
                  )}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}