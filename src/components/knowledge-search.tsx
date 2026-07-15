'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, BookOpen, Plus, Loader2, ArrowUpRight, X, SlidersHorizontal, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown } from 'lucide-react';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
interface SearchResult {
  id: string;
  title: string;
  summary: string;
  category: string;
  relevanceScore: number;
  matchedFields: string[];
  serviceLine?: string;
  targetIndustries?: string;
  content?: string;
  upvotes?: number;
  downvotes?: number;
  usedInEmails?: number;
  tags?: string[];
}

interface KnowledgeSearchProps {
  onUseCapability?: (cap: SearchResult) => void;
  navigateTo?: (screen: string) => void;
  /** If true, shows a compact single-line layout */
  compact?: boolean;
  /** Pre-fill query */
  defaultQuery?: string;
  /** Hide the "Use in Draft" button */
  hideUseButton?: boolean;
  /** Pre-fill industry */
  defaultIndustry?: string;
  /** Pre-fill role */
  defaultRole?: string;
  /** Pre-fill company size */
  defaultCompanySize?: string;
  /** Pre-fill service line */
  defaultServiceLine?: string;
  /** Pre-fill problems */
  defaultProblems?: string;
  /** Show advanced parameters panel by default */
  showAdvanced?: boolean;
}

/* ═══════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════ */
const CATEGORY_COLORS: Record<string, string> = {
  service_line: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  case_study: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  proof_point: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  objection_response: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  cta: 'bg-violet-500/15 text-violet-600 border-violet-500/30',
};

const CATEGORY_LABELS: Record<string, string> = {
  service_line: 'Service Line',
  case_study: 'Case Study',
  proof_point: 'Proof Point',
  objection_response: 'Objection Response',
  cta: 'CTA',
};

const MATCHED_FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  summary: 'Summary',
  content: 'Content',
  targetIndustries: 'Industries',
  targetRoles: 'Roles',
  problems: 'Problems',
  evidence: 'Evidence',
  serviceLine: 'Service Line',
  targetCompanySizes: 'Company Size',
};

const INDUSTRY_OPTIONS = [
  'Financial Services',
  'Healthcare',
  'Technology',
  'Manufacturing',
  'Retail',
  'Energy',
  'Media',
  'Government',
];

const ROLE_OPTIONS = [
  'CTO',
  'CIO',
  'CEO',
  'COO',
  'CFO',
  'VP of Engineering',
  'Head of AI',
  'Head of Data',
  'VP of Analytics',
  'Cloud Architect',
  'Head of Infrastructure',
  'Chief Digital Officer',
];

const COMPANY_SIZE_OPTIONS = ['Startup', 'Mid-Market', 'Enterprise'];

const SERVICE_LINE_OPTIONS = [
  'AI & Machine Learning',
  'Cloud Engineering',
  'Data Engineering',
  'Digital Transformation',
  'Cybersecurity',
];

const SEARCH_MODE_OPTIONS = [
  { value: 'keyword', label: 'Keyword' },
  { value: 'semantic', label: 'Semantic' },
  { value: 'hybrid', label: 'Hybrid' },
];

export default function KnowledgeSearch({
  onUseCapability,
  navigateTo,
  compact = false,
  defaultQuery = '',
  hideUseButton = false,
  defaultIndustry = '',
  defaultRole = '',
  defaultCompanySize = '',
  defaultServiceLine = '',
  defaultProblems = '',
  showAdvanced = false,
}: KnowledgeSearchProps) {
  // Basic params
  const [query, setQuery] = useState(defaultQuery);
  const [industry, setIndustry] = useState(defaultIndustry);
  const [role, setRole] = useState(defaultRole);

  // Advanced params
  const [showAdvPanel, setShowAdvPanel] = useState(showAdvanced);
  const [category, setCategory] = useState<string>('');
  const [companySize, setCompanySize] = useState(defaultCompanySize);
  const [serviceLine, setServiceLine] = useState(defaultServiceLine);
  const [problems, setProblems] = useState(defaultProblems);
  const [searchMode, setSearchMode] = useState<string>('keyword');
  const [minScore, setMinScore] = useState<number>(0);
  const [includeContent, setIncludeContent] = useState(false);

  // Tags filter (C-15)
  const [tagInput, setTagInput] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Results state
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [totalMatches, setTotalMatches] = useState(0);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});

  // Feedback state (C-09)
  const [feedbackState, setFeedbackState] = useState<Record<string, 'upvote' | 'downvote'>>({});

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const body: Record<string, unknown> = {
        query: query.trim(),
        industry: industry || undefined,
        role: role || undefined,
        category: category || undefined,
        companySize: companySize || undefined,
        serviceLine: serviceLine || undefined,
        problems: problems || undefined,
        searchMode,
        minRelevanceScore: minScore > 0 ? minScore : undefined,
        includeContent,
        limit: 10,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      };

      const res = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setResults(data.results || []);
      setTotalMatches(data.totalMatches || 0);
      setAppliedFilters(data.appliedFilters || {});
    } catch {
      setResults([]);
      setTotalMatches(0);
    }
    setLoading(false);
  }, [query, industry, role, category, companySize, serviceLine, problems, searchMode, minScore, includeContent, selectedTags]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleClear = () => {
    setResults([]);
    setSearched(false);
    setTotalMatches(0);
    setAppliedFilters({});
  };

  // Tag input handler (C-15)
  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags(prev => [...prev, tag]);
      setTagInput('');
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
    if (e.key === 'Backspace' && tagInput === '' && selectedTags.length > 0) {
      setSelectedTags(prev => prev.slice(0, -1));
    }
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
  };

  // Feedback handler (C-09)
  const handleFeedback = async (assetId: string, type: 'upvote' | 'downvote') => {
    const isToggle = feedbackState[assetId] === type;
    if (isToggle) {
      setFeedbackState(prev => {
        const next = { ...prev };
        delete next[assetId];
        return next;
      });
      return;
    }
    setFeedbackState(prev => ({ ...prev, [assetId]: type }));
    try {
      await fetch('/api/knowledge/search/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, type }),
      });
      // Update local counts
      setResults(prev => prev.map(r => {
        if (r.id !== assetId) return r;
        return {
          ...r,
          upvotes: (r.upvotes || 0) + (type === 'upvote' ? 1 : 0),
          downvotes: (r.downvotes || 0) + (type === 'downvote' ? 1 : 0),
        };
      }));
      toast.success(type === 'upvote' ? 'Upvoted' : 'Downvoted', { description: 'Feedback recorded. Results will be re-ranked in future searches.' });
    } catch {
      toast.error('Failed to record feedback');
    }
  };

  const activeFilterCount = [
    category,
    companySize,
    serviceLine,
    problems,
    searchMode !== 'keyword' ? searchMode : '',
    minScore > 0 ? String(minScore) : '',
    selectedTags.length > 0 ? `${selectedTags.length} tags` : '',
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* ── Search Bar ── */}
      <div className={`flex items-center gap-2 ${compact ? '' : 'flex-wrap'}`}>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search capabilities, case studies, proof points..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-9 pl-8 pr-3 text-sm bg-background border-border"
          />
        </div>

        {!compact && (
          <>
            <Select value={industry} onValueChange={v => setIndustry(v === '__all__' ? '' : v)}>
              <SelectTrigger className="h-9 w-[150px] text-xs bg-background border-border">
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="__all__" className="text-xs">Any Industry</SelectItem>
                {INDUSTRY_OPTIONS.map(i => (
                  <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={role} onValueChange={v => setRole(v === '__all__' ? '' : v)}>
              <SelectTrigger className="h-9 w-[160px] text-xs bg-background border-border">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="__all__" className="text-xs">Any Role</SelectItem>
                {ROLE_OPTIONS.map(r => (
                  <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* C-03: Company Size quick filter in main bar */}
            <Select value={companySize} onValueChange={v => setCompanySize(v === '__all__' ? '' : v)}>
              <SelectTrigger className="h-9 w-[130px] text-xs bg-background border-border">
                <SelectValue placeholder="Company Size" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="__all__" className="text-xs">Any Size</SelectItem>
                {COMPANY_SIZE_OPTIONS.map(cs => (
                  <SelectItem key={cs} value={cs} className="text-xs">{cs}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        <Button
          size="sm"
          className="h-9 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 gap-1.5"
          disabled={!query.trim() || loading}
          onClick={handleSearch}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
          Search
        </Button>

        {!compact && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-muted-foreground hover:text-foreground relative"
              onClick={() => setShowAdvPanel(!showAdvPanel)}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
              Advanced
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
              {showAdvPanel ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </Button>

            {searched && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleClear}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Clear
              </Button>
            )}
          </>
        )}
      </div>

      {/* ── Advanced Parameters Panel ── */}
      {!compact && showAdvPanel && (
        <div className="p-4 rounded-lg border border-border bg-card/50 space-y-4">
          <p className="text-xs font-medium text-foreground">Knowledge Engine Parameters</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Category Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={category} onValueChange={v => setCategory(v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs bg-background border-border">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="__all__" className="text-xs">All Categories</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Service Line Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Service Line</Label>
              <Select value={serviceLine} onValueChange={v => setServiceLine(v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs bg-background border-border">
                  <SelectValue placeholder="Any Service Line" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="__all__" className="text-xs">Any Service Line</SelectItem>
                  {SERVICE_LINE_OPTIONS.map(sl => (
                    <SelectItem key={sl} value={sl} className="text-xs">{sl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Company Size (C-03) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Company Size</Label>
              <Select value={companySize} onValueChange={v => setCompanySize(v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs bg-background border-border">
                  <SelectValue placeholder="Any Size" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="__all__" className="text-xs">Any Size</SelectItem>
                  {COMPANY_SIZE_OPTIONS.map(cs => (
                    <SelectItem key={cs} value={cs} className="text-xs">{cs}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Mode */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search Mode</Label>
              <Select value={searchMode} onValueChange={v => setSearchMode(v)}>
                <SelectTrigger className="h-8 text-xs bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {SEARCH_MODE_OPTIONS.map(m => (
                    <SelectItem key={m.value} value={m.value} className="text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Problems */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Problem Statement (match against capability problems)</Label>
              <Input
                placeholder="e.g. data silos, legacy infrastructure, compliance overhead"
                value={problems}
                onChange={e => setProblems(e.target.value)}
                className="h-8 text-xs bg-background border-border"
              />
            </div>
          </div>

          {/* C-15: Tags filter */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Filter by Tags</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 flex-1 min-w-[150px]">
                {selectedTags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary bg-primary/5">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-primary-foreground transition-colors">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                ))}
                <Input
                  placeholder={selectedTags.length === 0 ? "Type a tag and press Enter..." : "Add another..."}
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  className="h-7 text-xs bg-background border-border flex-1 min-w-[120px]"
                />
              </div>
              {tagInput.trim() && (
                <Button variant="ghost" size="sm" className="h-7 text-[10px] text-primary hover:bg-primary/10" onClick={handleAddTag}>
                  <Plus className="w-3 h-3 mr-1" />Add
                </Button>
              )}
            </div>
          </div>

          {/* Score threshold slider + include content toggle */}
          <div className="flex items-center gap-6">
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Min Relevance Score</Label>
                <span className="text-xs text-primary font-medium tabular-nums">{minScore}%</span>
              </div>
              <Slider
                value={[minScore]}
                onValueChange={([v]) => setMinScore(v)}
                min={0}
                max={80}
                step={5}
                className="w-full"
              />
            </div>

            <div className="flex items-center gap-2 pt-4">
              <Switch
                checked={includeContent}
                onCheckedChange={setIncludeContent}
                className="data-[state=checked]:bg-primary"
              />
              <Label className="text-xs text-muted-foreground cursor-pointer" onClick={() => setIncludeContent(!includeContent)}>
                Include full content
              </Label>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Filters Display ── */}
      {!compact && searched && Object.keys(appliedFilters).length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Active filters:</span>
          {Object.entries(appliedFilters).map(([key, value]) => (
            <Badge key={key} variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/5">
              {key}: {Array.isArray(value) ? value.join(', ') : String(value)}
            </Badge>
          ))}
        </div>
      )}

      {/* ── Results ── */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Searching knowledge base...</span>
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-8 space-y-2">
          <BookOpen className="w-8 h-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">No matching capabilities found</p>
          <p className="text-xs text-muted-foreground/60">
            Try different keywords, lower the minimum score, or remove filters
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-muted-foreground">
              {totalMatches} match{totalMatches !== 1 ? 'es' : ''} found
            </p>
            {navigateTo && (
              <button
                onClick={() => navigateTo('capabilities')}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
              >
                View all capabilities
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <ScrollArea className="max-h-96 overflow-y-auto">
            <div className="space-y-2 pr-1">
              {results.map((result) => (
                <div
                  key={result.id}
                  className="group p-3 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors"
                >
                  {/* Header row */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {result.title}
                        </p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] shrink-0 ${CATEGORY_COLORS[result.category] || 'border-border text-muted-foreground'}`}
                        >
                          {CATEGORY_LABELS[result.category] || result.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {result.summary}
                      </p>
                    </div>

                    {/* Relevance score bar */}
                    <div className="shrink-0 flex flex-col items-end gap-1 ml-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${result.relevanceScore}%`,
                            backgroundColor: result.relevanceScore >= 80
                              ? 'rgb(52 211 153)'
                              : result.relevanceScore >= 50
                                ? 'rgb(251 191 36)'
                                : 'rgb(248 113 113)',
                          }}
                        />
                      </div>
                      <span
                        className={`text-[10px] tabular-nums font-medium ${
                          result.relevanceScore >= 80
                            ? 'text-emerald-600'
                            : result.relevanceScore >= 50
                              ? 'text-amber-600'
                              : 'text-red-600'
                        }`}
                      >
                        {result.relevanceScore}%
                      </span>
                    </div>
                  </div>

                  {/* Tags row (C-15) */}
                  {result.tags && result.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {result.tags.slice(0, 5).map(tag => (
                        <Badge key={tag} variant="outline" className="text-[9px] border-border/50 text-muted-foreground bg-muted/30 px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {result.matchedFields.map(field => (
                      <span
                        key={field}
                        className="inline-flex items-center text-[10px] text-primary/70 bg-primary/5 rounded px-1.5 py-0.5"
                      >
                        {MATCHED_FIELD_LABELS[field] || field}
                      </span>
                    ))}
                    {result.serviceLine && (
                      <span className="text-[10px] text-muted-foreground/60">
                        → {result.serviceLine}
                      </span>
                    )}
                    {/* C-09: Usage indicator */}
                    {(result.usedInEmails || 0) > 0 && (
                      <span className="text-[10px] text-emerald-600/70 ml-auto">
                        Used in {result.usedInEmails} email{result.usedInEmails! > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Full content (if includeContent was enabled) */}
                  {result.content && (
                    <div className="mt-2 p-2 rounded bg-muted/30 border border-border/50">
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                        {result.content}
                      </p>
                    </div>
                  )}

                  {/* Actions: Use + Feedback (C-09) */}
                  <div className="mt-2 flex items-center justify-between">
                    {!hideUseButton && onUseCapability && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                        onClick={() => onUseCapability(result)}
                      >
                        <Plus className="w-3 h-3" />
                        Use in Draft
                      </Button>
                    )}
                    <div className="flex items-center gap-1 ml-auto">
                      <span className="text-[9px] text-muted-foreground mr-1">
                        {(result.upvotes || 0)}/{(result.downvotes || 0)}
                      </span>
                      <button
                        onClick={() => handleFeedback(result.id, 'upvote')}
                        className={`p-1 rounded transition-colors ${
                          feedbackState[result.id] === 'upvote'
                            ? 'text-emerald-600 bg-emerald-50'
                            : 'text-muted-foreground/50 hover:text-emerald-600 hover:bg-emerald-500/5'
                        }`}
                        title="Relevant result"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(result.id, 'downvote')}
                        className={`p-1 rounded transition-colors ${
                          feedbackState[result.id] === 'downvote'
                            ? 'text-red-600 bg-red-50'
                            : 'text-muted-foreground/50 hover:text-red-600 hover:bg-red-500/5'
                        }`}
                        title="Not relevant"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Empty state (not yet searched) */}
      {!loading && !searched && (
        <div className="text-center py-8 space-y-2">
          <Search className="w-8 h-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">Search the capability knowledge base</p>
          <p className="text-xs text-muted-foreground/60">
            Find relevant service lines, case studies, and proof points
          </p>
        </div>
      )}
    </div>
  );
}