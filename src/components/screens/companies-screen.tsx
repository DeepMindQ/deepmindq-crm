'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Building2, Globe, MapPin, Briefcase, Users, X, BookOpen, StickyNote, FileText } from 'lucide-react';

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

export default function CompaniesScreen() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyContacts, setCompanyContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

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

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-4 pr-1">
      {/* ── Search ── */}
      <Card className="bg-card border border-border">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search companies by name, domain, or industry..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-background border-border"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Company Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map(company => (
            <Card
              key={company.id}
              className="bg-card border border-border hover:border-primary/40 transition-colors cursor-pointer group"
              onClick={() => openCompany(company)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{company.name}</p>
                      {company.domain && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Globe className="w-3 h-3" />{company.domain}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30 shrink-0">
                    {company.contactCount ?? 0}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {company.industry && (
                    <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{company.industry}</span>
                  )}
                  {company.employeeSize && (
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{company.employeeSize}</span>
                  )}
                  {company.country && (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{company.country}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {companies.length === 0 && (
            <div className="col-span-full text-muted-foreground text-sm text-center py-12">
              No companies found.
            </div>
          )}
        </div>
      )}

      {/* ── Company Detail Dialog ── */}
      <Dialog open={!!selectedCompany} onOpenChange={() => setSelectedCompany(null)}>
        <DialogContent className="bg-card border border-border text-foreground max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center justify-between pr-6">
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                {selectedCompany?.name}
              </span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => setSelectedCompany(null)}>
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-2">
            {selectedCompany && (
              <div className="space-y-4 pb-4">
                {/* Company Info */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                  {selectedCompany.domain && (
                    <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5 text-primary" />{selectedCompany.domain}</span>
                  )}
                  {selectedCompany.industry && (
                    <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5 text-primary" />{selectedCompany.industry}</span>
                  )}
                  {selectedCompany.employeeSize && (
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-primary" />{selectedCompany.employeeSize}</span>
                  )}
                  {selectedCompany.country && (
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-primary" />{selectedCompany.country}</span>
                  )}
                </div>

                <Separator className="bg-border" />

                {/* Research Card */}
                {selectedCompany.research && (
                  <Card className="bg-background border border-border">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2 text-primary">
                        <BookOpen className="w-3.5 h-3.5" />
                        Company Research
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 space-y-2.5">
                      {selectedCompany.research.businessOverview && (
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Business Overview</p>
                          <p className="text-sm text-foreground leading-relaxed">{selectedCompany.research.businessOverview}</p>
                        </div>
                      )}
                      {selectedCompany.research.currentTechLandscape && (
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Tech Landscape</p>
                          <p className="text-sm text-foreground leading-relaxed">{selectedCompany.research.currentTechLandscape}</p>
                        </div>
                      )}
                      {selectedCompany.research.potentialChallenges && (
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Challenges</p>
                          <p className="text-sm text-foreground leading-relaxed">{selectedCompany.research.potentialChallenges}</p>
                        </div>
                      )}
                      {selectedCompany.research.possibleOpportunities && (
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Opportunities</p>
                          <p className="text-sm text-foreground leading-relaxed">{selectedCompany.research.possibleOpportunities}</p>
                        </div>
                      )}
                      {selectedCompany.research.relevantServices && (
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Relevant Services</p>
                          <p className="text-sm text-foreground leading-relaxed">{selectedCompany.research.relevantServices}</p>
                        </div>
                      )}
                      {selectedCompany.research.nextAction && (
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Next Action</p>
                          <p className="text-sm text-primary font-medium">{selectedCompany.research.nextAction}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Contacts */}
                <div>
                  <h4 className="text-xs font-semibold flex items-center gap-2 mb-2">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    Contacts ({companyContacts.length})
                  </h4>
                  {loadingContacts ? (
                    <div className="space-y-2">
                      {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : companyContacts.length > 0 ? (
                    <div className="space-y-1.5">
                      {companyContacts.map(c => (
                        <div key={c.id} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-background border border-border">
                          <div>
                            <p className="text-sm font-medium text-foreground">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.jobTitle || c.email || '—'}</p>
                          </div>
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                            {c.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No contacts at this company.</p>
                  )}
                </div>

                {/* Notes */}
                {selectedCompany.notes && (
                  <>
                    <Separator className="bg-border" />
                    <div>
                      <h4 className="text-xs font-semibold flex items-center gap-2 mb-2">
                        <StickyNote className="w-3.5 h-3.5 text-primary" />
                        Notes
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{selectedCompany.notes}</p>
                    </div>
                  </>
                )}

                {/* Internal Summary */}
                {selectedCompany.internalSummary && (
                  <>
                    <Separator className="bg-border" />
                    <div>
                      <h4 className="text-xs font-semibold flex items-center gap-2 mb-2">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        Internal Summary
                      </h4>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selectedCompany.internalSummary}</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}