'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Search, MessageSquare, Target, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Loader2, Brain, User, Building2,
  Clock, Zap, Shield, ArrowRight,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────

interface Company {
  id: string;
  rawName: string;
  normalizedName?: string;
  industry?: string;
}

interface BuyerProfile {
  name: string;
  role: string;
  seniority: string;
  buyerRole: string;
  influenceScore: number;
  detectedPriorities: string[];
  relationshipStrength: string;
  communicationStyle: string;
}

interface BriefingResult {
  success: boolean;
  error?: string | null;
  companyName: string;
  briefingType: string;
  meetingObjective: string;
  meetingType: string;
  suggestedDuration: string;
  buyerProfile: BuyerProfile;
  talkingPoints: Array<{
    point: string;
    evidence: string;
    priority: string;
  }>;
  questionsToAsk: Array<{
    question: string;
    purpose: string;
    timing: string;
  }>;
  objectionsToPrepare: Array<{
    objection: string;
    preparedResponse: string;
    evidence: string;
    probability: string;
  }>;
  topicsToAvoid: string[];
  recommendedPositioning: string;
  valuePropositionAngle: string;
  postMeetingActions: string[];
  preparationChecklist: string[];
  companyContext: string;
  signalContext: string[];
  confidenceScore: number;
  briefingNarrative: string | null;
}

// ─── Component ──────────────────────────────────────────────────────────

export default function ConversationPlannerScreen() {
  const { selectedCompanyId, setSelectedCompanyId } = useAppStore();
  const [search, setSearch] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | undefined>(undefined);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Fetch companies for selector
  const { data: companies, isLoading: loadingCompanies } = useQuery({
    queryKey: ['conversation-planner-companies'],
    queryFn: async () => {
      const res = await fetch('/api/companies?limit=50&sortBy=updatedAt');
      if (!res.ok) throw new Error('Failed to load companies');
      const data = await res.json();
      return (data.companies || data || []) as Company[];
    },
    staleTime: 60_000,
  });

  // Fetch contacts for selected company
  const { data: contacts } = useQuery({
    queryKey: ['conversation-planner-contacts', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const res = await fetch(`/api/companies/${selectedCompanyId}/contacts`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.contacts || data || [];
    },
    enabled: !!selectedCompanyId,
    staleTime: 60_000,
  });

  // Generate briefing mutation
  const briefingMutation = useMutation({
    mutationFn: async ({ companyId, contactId }: { companyId: string; contactId?: string }) => {
      const body: Record<string, string> = { companyId };
      if (contactId) body.contactId = contactId;
      const res = await fetch('/api/engines/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to generate briefing');
      const data = await res.json();
      return data.briefing as BriefingResult;
    },
    onSuccess: () => {
      toast.success('Conversation briefing generated successfully');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to generate briefing');
    },
  });

  const selectedCompany = companies?.find(c => c.id === selectedCompanyId);

  const filteredCompanies = (companies || []).filter(c => {
    const name = c.normalizedName || c.rawName;
    return name.toLowerCase().includes(search.toLowerCase()) ||
           (c.industry || '').toLowerCase().includes(search.toLowerCase());
  });

  // ─── No company selected: Show company selector ───
  if (!selectedCompanyId) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            Conversation Planner
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered meeting preparation and conversation planning
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select a Company</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-[500px] overflow-y-auto space-y-1">
              {loadingCompanies && (
                <div className="flex items-center gap-2 text-muted-foreground p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading companies...
                </div>
              )}
              {filteredCompanies.length === 0 && !loadingCompanies && (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No companies found. Import companies to get started.</p>
                </div>
              )}
              {filteredCompanies.map(company => (
                <button
                  key={company.id}
                  onClick={() => {
                    setSelectedCompanyId(company.id);
                    setSelectedContactId(undefined);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">
                        {company.normalizedName || company.rawName}
                      </div>
                      {company.industry && (
                        <div className="text-xs text-muted-foreground">{company.industry}</div>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Company selected: Show briefing workspace ───
  const briefing = briefingMutation.data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button
              onClick={() => { setSelectedCompanyId(null); setSelectedContactId(undefined); briefingMutation.reset(); }}
              className="hover:underline"
            >
              Conversation Planner
            </button>
            <span>/</span>
            <span className="text-foreground">{selectedCompany?.normalizedName || selectedCompany?.rawName}</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            Conversation Briefing
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSelectedCompanyId(null); setSelectedContactId(undefined); briefingMutation.reset(); }}
          >
            Change Company
          </Button>
          <Button
            size="sm"
            onClick={() => briefingMutation.mutate({ companyId: selectedCompanyId, contactId: selectedContactId })}
            disabled={briefingMutation.isPending}
          >
            {briefingMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                {briefing ? 'Regenerate Briefing' : 'Generate Briefing'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Contact Selector */}
      {contacts && contacts.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Briefing for:</span>
              <button
                onClick={() => setSelectedContactId(undefined)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  !selectedContactId
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                Company Overview
              </button>
              {contacts.slice(0, 8).map((contact: any) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContactId(contact.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedContactId === contact.id
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {contact.rawName || contact.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {briefingMutation.isPending && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-5 bg-muted rounded w-2/3" />
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Briefing Content */}
      {briefing && briefing.success && (
        <div className="space-y-6">
          {/* AI Briefing Narrative */}
          {briefing.briefingNarrative && (
            <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-sm">AI Briefing Summary</span>
                  <Badge variant="secondary" className="text-xs">
                    Confidence: {briefing.confidenceScore}%
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {briefing.briefingNarrative}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Meeting Objective + Buyer Profile */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Meeting Objective */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  Meeting Objective
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-medium">{briefing.meetingObjective}</p>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs capitalize">
                    {briefing.meetingType.replace('_', ' ')}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {briefing.suggestedDuration}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Buyer Profile */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-purple-600" />
                  Buyer Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{briefing.buyerProfile.name}</div>
                    <div className="text-xs text-muted-foreground">{briefing.buyerProfile.role}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{briefing.buyerProfile.influenceScore}/100</div>
                    <div className="text-xs text-muted-foreground">Influence</div>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs capitalize">
                    {briefing.buyerProfile.buyerRole.replace('_', ' ')}
                  </Badge>
                  <Badge variant="outline" className="text-xs capitalize">
                    {briefing.buyerProfile.seniority}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-xs capitalize ${
                      briefing.buyerProfile.relationshipStrength === 'strong' || briefing.buyerProfile.relationshipStrength === 'warm'
                        ? 'text-green-600'
                        : briefing.buyerProfile.relationshipStrength === 'cold' || briefing.buyerProfile.relationshipStrength === 'none'
                        ? 'text-red-600'
                        : ''
                    }`}
                  >
                    {briefing.buyerProfile.relationshipStrength}
                  </Badge>
                </div>
                {briefing.buyerProfile.detectedPriorities.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Detected Priorities</div>
                    <div className="flex gap-1 flex-wrap">
                      {briefing.buyerProfile.detectedPriorities.map((p, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Talking Points + Questions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Talking Points */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Talking Points
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {briefing.talkingPoints.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {briefing.talkingPoints.map((tp, i) => (
                  <div key={i} className="flex gap-3">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      tp.priority === 'must_cover' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      : tp.priority === 'should_cover' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{tp.point}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{tp.evidence}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Questions to Ask */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  Questions to Ask
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {briefing.questionsToAsk.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {briefing.questionsToAsk.map((q, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className={`text-xs capitalize flex-shrink-0 mt-0.5 ${
                        q.timing === 'opening' ? 'text-blue-600' : q.timing === 'closing' ? 'text-purple-600' : ''
                      }`}>
                        {q.timing}
                      </Badge>
                      <div className="text-sm font-medium italic">&quot;{q.question}&quot;</div>
                    </div>
                    <div className="text-xs text-muted-foreground ml-16">{q.purpose}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Objection Preparation */}
          {briefing.objectionsToPrepare.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-orange-500" />
                  Objection Preparation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {briefing.objectionsToPrepare.map((obj, i) => {
                  const itemId = `obj-${i}`;
                  const isExpanded = expandedItems.has(itemId);
                  return (
                    <div key={i} className="border rounded-lg">
                      <button
                        onClick={() => toggleExpand(itemId)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={`text-xs capitalize ${
                            obj.probability === 'high' ? 'text-red-600 border-red-200'
                            : obj.probability === 'medium' ? 'text-amber-600 border-amber-200'
                            : 'text-green-600 border-green-200'
                          }`}>
                            {obj.probability}
                          </Badge>
                          <span className="text-sm font-medium">&quot;{obj.objection}&quot;</span>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-0 space-y-2 border-t">
                          <div className="mt-2">
                            <div className="text-xs font-medium text-muted-foreground mb-1">Suggested Response</div>
                            <p className="text-sm">{obj.preparedResponse}</p>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">Evidence</div>
                            <p className="text-xs text-muted-foreground">{obj.evidence}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Topics to Avoid + Recommended Positioning */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Topics to Avoid */}
            {briefing.topicsToAvoid.length > 0 && (
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Topics to Avoid
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {briefing.topicsToAvoid.map((topic, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
                        <span className="text-red-500 mt-1">&#9679;</span>
                        {topic}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Recommended Positioning */}
            <Card className="border-green-200 dark:border-green-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Recommended Positioning
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{briefing.recommendedPositioning}</p>
                <Separator />
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Value Proposition Angle</div>
                  <p className="text-sm">{briefing.valuePropositionAngle}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Post-Meeting Actions + Preparation Checklist */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Post-Meeting Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                  Post-Meeting Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {briefing.postMeetingActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      {action}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Preparation Checklist */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-purple-600" />
                  Preparation Checklist
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {briefing.preparationChecklist.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <div className="w-4 h-4 mt-0.5 rounded border border-muted-foreground/30 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Briefing error */}
      {briefing && !briefing.success && (
        <Card className="border-red-200">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-3" />
            <p className="font-medium text-red-600">Failed to generate briefing</p>
            <p className="text-sm text-muted-foreground mt-1">{briefing.error || 'Unknown error'}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty state (no briefing yet, not loading) */}
      {!briefing && !briefingMutation.isPending && (
        <div className="text-center py-16">
          <Brain className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-medium text-muted-foreground">Ready to generate briefing</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Select a company and optionally a contact, then click &quot;Generate Briefing&quot; to create
            an evidence-backed meeting preparation guide.
          </p>
        </div>
      )}
    </div>
  );
}
