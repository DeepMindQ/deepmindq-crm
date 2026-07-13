'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PageTransition, AnimatedCard, StaggerGrid, StaggerItem,
  SectionHeader, AnimatedBar, TabBar, GradientCard, PulseDot, StatValue,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Brain, Upload, Search, FileText, Database, Cpu, BarChart3,
  Layers, BookOpen, Trophy, MessageSquare, Target, Zap,
  Plus, Trash2, Eye, X, Loader2, ChevronRight, AlertTriangle,
  CheckCircle2, ArrowUpRight, Sparkles, Filter, RefreshCw,
  TrendingUp, Globe, Users, Building2, Lightbulb, Info,
  ChevronDown, ChevronUp, Tag,
} from 'lucide-react';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
interface KnowledgeAsset {
  id: string;
  title: string;
  summary: string;
  content?: string;
  category: string;
  serviceLine?: string;
  targetIndustries?: string;
  targetRoles?: string;
  problems?: string;
  evidence?: string;
  source?: string;
  isActive: boolean;
  createdAt: string;
}

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
}

interface CoverageData {
  industries: { name: string; count: number; coverage: number; gaps: string[] }[];
  roles: { name: string; count: number; coverage: number }[];
  serviceLines: { name: string; count: number; caseStudies: number; proofPoints: number }[];
  categories: { name: string; count: number }[];
  totalAssets: number;
  engineHealth: { searchModes: string[]; lastSearch: string | null; avgScore: number };
}

interface KnowledgeScreenProps {
  navigateTo?: (screen: string) => void;
}

/* ═══════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════ */
const TABS = [
  { key: 'library', label: 'Knowledge Library' },
  { key: 'search', label: 'RAG Search Engine' },
  { key: 'coverage', label: 'Coverage & Gaps' },
  { key: 'upload', label: 'Upload & Extract' },
];

const CATEGORY_CONFIG: Record<string, { icon: typeof Layers; color: string; badge: string }> = {
  service_line: { icon: Layers, color: '#3B82F6', badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  case_study: { icon: BookOpen, color: '#10B981', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  proof_point: { icon: Trophy, color: '#8B5CF6', badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  objection_response: { icon: MessageSquare, color: '#EF4444', badge: 'bg-red-500/15 text-red-400 border-red-500/30' },
  cta: { icon: Target, color: '#F59E0B', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
};

const CATEGORY_LABELS: Record<string, string> = {
  service_line: 'Service Line',
  case_study: 'Case Study',
  proof_point: 'Proof Point',
  objection_response: 'Objection Response',
  cta: 'CTA',
};

const MATCHED_FIELD_LABELS: Record<string, string> = {
  title: 'Title', summary: 'Summary', content: 'Content',
  targetIndustries: 'Industries', targetRoles: 'Roles',
  problems: 'Problems', evidence: 'Evidence', serviceLine: 'Service Line',
};

const INDUSTRY_LIST = [
  'Financial Services', 'Healthcare', 'Technology', 'Manufacturing',
  'Retail', 'Energy', 'Media', 'Government',
];
const ROLE_LIST = [
  'CTO', 'CIO', 'CEO', 'COO', 'CFO', 'VP of Engineering',
  'Head of AI', 'Head of Data', 'VP of Analytics',
  'Cloud Architect', 'Head of Infrastructure', 'Chief Digital Officer',
];
const SERVICE_LINE_LIST = [
  'AI & Machine Learning', 'Cloud Engineering', 'Data Engineering',
  'Digital Transformation', 'Cybersecurity',
];

/* ═══════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════ */
export default function KnowledgeLibraryScreen({ navigateTo }: KnowledgeScreenProps) {
  const [activeTab, setActiveTab] = useState('library');
  const [assets, setAssets] = useState<KnowledgeAsset[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Library state ──
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryCategory, setLibraryCategory] = useState('');
  const [libraryServiceLine, setLibraryServiceLine] = useState('');
  const [viewAsset, setViewAsset] = useState<KnowledgeAsset | null>(null);

  // ── RAG Search state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndustry, setSearchIndustry] = useState('');
  const [searchRole, setSearchRole] = useState('');
  const [searchMode, setSearchMode] = useState('hybrid');
  const [minScore, setMinScore] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalMatches, setTotalMatches] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchProblems, setSearchProblems] = useState('');
  const [searchCompanySize, setSearchCompanySize] = useState('');

  // ── Upload state ──
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadExtractedText, setUploadExtractedText] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadPreviewOpen, setUploadPreviewOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('service_line');
  const [uploadServiceLine, setUploadServiceLine] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadSaving, setUploadSaving] = useState(false);

  // ── Coverage state ──
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);

  // ── Add dialog state ──
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    title: '', summary: '', content: '', category: 'service_line',
    serviceLine: '', targetIndustries: '', targetRoles: '',
    problems: '', evidence: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load assets ──
  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (libraryCategory) params.set('category', libraryCategory);
      const res = await fetch(`/api/capabilities?${params}`);
      const data = await res.json();
      setAssets(Array.isArray(data) ? data : []);
    } catch {
      setAssets([]);
    }
    setLoading(false);
  }, [libraryCategory]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  // ── Load coverage ──
  const loadCoverage = useCallback(async () => {
    setCoverageLoading(true);
    try {
      const res = await fetch('/api/knowledge/search');
      const data = await res.json();
      // Build coverage from the full capability set
      const allRes = await fetch('/api/capabilities');
      const allCaps: KnowledgeAsset[] = Array.isArray(await allRes.json()) ? await allRes.json() : [];
      const cov = buildCoverage(allCaps);
      setCoverage(cov);
    } catch {
      setCoverage(null);
    }
    setCoverageLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'coverage') loadCoverage();
  }, [activeTab, loadCoverage]);

  // ── Handle RAG Search ──
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setHasSearched(true);
    try {
      const body: Record<string, unknown> = {
        query: searchQuery.trim(),
        industry: searchIndustry || undefined,
        role: searchRole || undefined,
        category: undefined,
        companySize: searchCompanySize || undefined,
        serviceLine: undefined,
        problems: searchProblems || undefined,
        searchMode,
        minRelevanceScore: minScore > 0 ? minScore : undefined,
        includeContent: true,
        limit: 12,
      };
      const res = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
      setTotalMatches(data.totalMatches || 0);
    } catch {
      setSearchResults([]);
      setTotalMatches(0);
    }
    setSearchLoading(false);
  }, [searchQuery, searchIndustry, searchRole, searchMode, minScore, searchProblems, searchCompanySize]);

  // ── Handle file upload ──
  const handleUpload = useCallback(async () => {
    if (!uploadFile) return;
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const res = await fetch('/api/capabilities/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.extractedText) {
        setUploadExtractedText(data.extractedText);
        setUploadPreviewOpen(true);
        // Auto-derive title from filename
        const nameWithoutExt = uploadFile.name.replace(/\.[^/.]+$/, '');
        setUploadTitle(nameWithoutExt);
      } else {
        toast.error(data.error || 'Failed to extract text');
      }
    } catch {
      toast.error('Upload failed');
    }
    setUploadLoading(false);
  }, [uploadFile]);

  // ── Save extracted content as a knowledge asset ──
  const handleSaveExtracted = useCallback(async () => {
    if (!uploadTitle.trim()) {
      toast.error('Please enter a title');
      return;
    }
    setUploadSaving(true);
    try {
      // Split long text into chunks if needed
      const maxChunkLen = 2000;
      const text = uploadExtractedText;
      const chunks: string[] = [];

      if (text.length <= maxChunkLen) {
        chunks.push(text);
      } else {
        // Split by paragraphs, then group into chunks
        const paragraphs = text.split(/\n\n+/).filter(Boolean);
        let current = '';
        for (const para of paragraphs) {
          if ((current + '\n\n' + para).length > maxChunkLen && current) {
            chunks.push(current.trim());
            current = para;
          } else {
            current = current ? current + '\n\n' + para : para;
          }
        }
        if (current.trim()) chunks.push(current.trim());
      }

      for (let i = 0; i < chunks.length; i++) {
        const suffix = chunks.length > 1 ? ` (Part ${i + 1}/${chunks.length})` : '';
        await fetch('/api/capabilities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: uploadTitle.trim() + suffix,
            summary: chunks[i].slice(0, 200).trim() + (chunks[i].length > 200 ? '...' : ''),
            content: chunks[i],
            category: uploadCategory,
            serviceLine: uploadServiceLine || null,
          }),
        });
      }

      toast.success(`Saved ${chunks.length} knowledge asset${chunks.length > 1 ? 's' : ''} from upload`);
      setUploadPreviewOpen(false);
      setUploadFile(null);
      setUploadExtractedText('');
      setUploadTitle('');
      loadAssets();
    } catch {
      toast.error('Failed to save knowledge asset');
    }
    setUploadSaving(false);
  }, [uploadTitle, uploadExtractedText, uploadCategory, uploadServiceLine, loadAssets]);

  // ── Add manual asset ──
  const handleAddAsset = useCallback(async () => {
    if (!addForm.title.trim() || !addForm.summary.trim()) {
      toast.error('Title and summary are required');
      return;
    }
    try {
      await fetch('/api/capabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          serviceLine: addForm.serviceLine || null,
          targetIndustries: addForm.targetIndustries || null,
          targetRoles: addForm.targetRoles || null,
          problems: addForm.problems || null,
          evidence: addForm.evidence || null,
          content: addForm.content || null,
        }),
      });
      toast.success('Knowledge asset added');
      setAddDialogOpen(false);
      setAddForm({ title: '', summary: '', content: '', category: 'service_line', serviceLine: '', targetIndustries: '', targetRoles: '', problems: '', evidence: '' });
      loadAssets();
    } catch {
      toast.error('Failed to add asset');
    }
  }, [addForm, loadAssets]);

  // ── Delete asset ──
  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetch('/api/capabilities', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      toast.success('Asset deleted');
      loadAssets();
    } catch {
      toast.error('Failed to delete');
    }
  }, [loadAssets]);

  // ── Filtered library assets ──
  const filteredAssets = assets.filter(a => {
    if (librarySearch) {
      const q = librarySearch.toLowerCase();
      return a.title.toLowerCase().includes(q) ||
        (a.summary || '').toLowerCase().includes(q) ||
        (a.serviceLine || '').toLowerCase().includes(q);
    }
    if (libraryServiceLine) {
      return (a.serviceLine || '').toLowerCase().includes(libraryServiceLine.toLowerCase());
    }
    return true;
  });

  const categoryCounts = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + 1;
    return acc;
  }, {});

  const gold = '#D4AF37';
  const goldLight = '#E8C860';

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header with Brain icon */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})`, boxShadow: `0 0 20px rgba(212,175,55,0.2)` }}
              >
                <Brain className="w-5 h-5 text-white" />
              </div>
              Knowledge Engine
            </h1>
            <p className="text-sm text-muted-foreground mt-1 ml-[52px]">
              RAG-powered knowledge base that fuels personalized email generation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-9 text-xs gap-1.5 border border-primary/30 text-primary hover:bg-primary/10"
              variant="outline"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Asset
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

        {/* ═══════════════════════════════════════════
            TAB 1: Knowledge Library
            ═══════════════════════════════════════════ */}
        {activeTab === 'library' && (
          <div className="space-y-4">
            {/* Search + Filter bar */}
            <AnimatedCard delay={0.1}>
              <div className="p-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search knowledge assets by title, summary, or service line..."
                    value={librarySearch}
                    onChange={e => setLibrarySearch(e.target.value)}
                    className="pl-9 h-9 text-sm bg-background border-border"
                  />
                </div>
                <Select value={libraryCategory} onValueChange={v => setLibraryCategory(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="h-9 w-[160px] text-xs bg-background border-border">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="__all__" className="text-xs">All Categories</SelectItem>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={libraryServiceLine} onValueChange={v => setLibraryServiceLine(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="h-9 w-[180px] text-xs bg-background border-border">
                    <SelectValue placeholder="Service Line" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="__all__" className="text-xs">All Service Lines</SelectItem>
                    {SERVICE_LINE_LIST.map(sl => (
                      <SelectItem key={sl} value={sl} className="text-xs">{sl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={loadAssets}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                </Button>
              </div>
            </AnimatedCard>

            {/* Category stats row */}
            <StaggerGrid className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" stagger={0.05} delay={0.15}>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                const config = CATEGORY_CONFIG[key] || CATEGORY_CONFIG.service_line;
                const Icon = config.icon;
                const count = categoryCounts[key] || 0;
                return (
                  <StaggerItem key={key}>
                    <AnimatedCard hover className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${config.color}15` }}>
                          <Icon className="w-4 h-4" style={{ color: config.color }} />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-foreground tabular-nums">{count}</p>
                          <p className="text-[11px] text-muted-foreground">{label}</p>
                        </div>
                      </div>
                    </AnimatedCard>
                  </StaggerItem>
                );
              })}
            </StaggerGrid>

            {/* Assets Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredAssets.length === 0 ? (
              <AnimatedCard>
                <div className="text-center py-12 space-y-3">
                  <Database className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    {assets.length === 0 ? 'No knowledge assets yet' : 'No matching assets found'}
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    {assets.length === 0
                      ? 'Upload documents or add assets manually to build your knowledge base'
                      : 'Try adjusting your search or filters'}
                  </p>
                  {assets.length === 0 && (
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5 mt-2"
                      onClick={() => setActiveTab('upload')}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Documents
                    </Button>
                  )}
                </div>
              </AnimatedCard>
            ) : (
              <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" stagger={0.04} delay={0.2}>
                {filteredAssets.map(asset => {
                  const config = CATEGORY_CONFIG[asset.category] || CATEGORY_CONFIG.service_line;
                  const Icon = config.icon;
                  return (
                    <StaggerItem key={asset.id}>
                      <AnimatedCard hover className="p-4 flex flex-col h-full">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: `${config.color}15` }}>
                              <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{asset.title}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setViewAsset(asset)}
                              className="p-1 rounded-md hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(asset.id)}
                              className="p-1 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Summary */}
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3 flex-1">
                          {asset.summary}
                        </p>

                        {/* Meta */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] ${config.badge}`}>
                            {CATEGORY_LABELS[asset.category] || asset.category}
                          </Badge>
                          {asset.serviceLine && (
                            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                              {asset.serviceLine}
                            </Badge>
                          )}
                          {asset.targetIndustries && (
                            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                              <Globe className="w-2.5 h-2.5 mr-0.5" />
                              {asset.targetIndustries.split(',').slice(0, 2).join(', ')}
                            </Badge>
                          )}
                        </div>
                      </AnimatedCard>
                    </StaggerItem>
                  );
                })}
              </StaggerGrid>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════
            TAB 2: RAG Search Engine
            ═══════════════════════════════════════════ */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            {/* Engine info banner */}
            <AnimatedCard delay={0.1}>
              <div className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.05))' }}>
                  <Cpu className="w-5 h-5" style={{ color: gold }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">DeepMindQ Knowledge Retrieval Engine v2.0</p>
                  <p className="text-xs text-muted-foreground">
                    Hybrid search (keyword + semantic TF-overlap) with multi-field weighted scoring, industry/role boosting, and category-aware ranking
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/5 shrink-0">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>
            </AnimatedCard>

            {/* Search interface */}
            <AnimatedCard delay={0.15}>
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[240px]">
                    <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: gold }} />
                    <Input
                      placeholder="Describe a prospect's context: industry, role, company, challenges..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      className="pl-10 h-10 text-sm bg-background border-border"
                    />
                  </div>
                  <Select value={searchIndustry} onValueChange={v => setSearchIndustry(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="h-10 w-[150px] text-xs bg-background border-border">
                      <SelectValue placeholder="Industry" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="__all__" className="text-xs">Any Industry</SelectItem>
                      {INDUSTRY_LIST.map(i => (
                        <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={searchRole} onValueChange={v => setSearchRole(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="h-10 w-[160px] text-xs bg-background border-border">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="__all__" className="text-xs">Any Role</SelectItem>
                      {ROLE_LIST.map(r => (
                        <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="h-10 text-sm gap-2"
                    style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})`, color: '#000' }}
                    disabled={!searchQuery.trim() || searchLoading}
                    onClick={handleSearch}
                  >
                    {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Search Knowledge
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="h-10 text-xs text-muted-foreground"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    <Filter className="w-3.5 h-3.5 mr-1" />
                    Advanced
                    {showAdvanced ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                  </Button>
                </div>

                {/* Advanced parameters */}
                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 rounded-lg border border-border bg-card/50 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Search Mode</Label>
                            <Select value={searchMode} onValueChange={setSearchMode}>
                              <SelectTrigger className="h-8 text-xs bg-background border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                <SelectItem value="keyword" className="text-xs">Keyword</SelectItem>
                                <SelectItem value="semantic" className="text-xs">Semantic (TF-Overlap)</SelectItem>
                                <SelectItem value="hybrid" className="text-xs">Hybrid (Recommended)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Company Size</Label>
                            <Select value={searchCompanySize} onValueChange={v => setSearchCompanySize(v === '__all__' ? '' : v)}>
                              <SelectTrigger className="h-8 text-xs bg-background border-border">
                                <SelectValue placeholder="Any Size" />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                <SelectItem value="__all__" className="text-xs">Any Size</SelectItem>
                                <SelectItem value="Startup" className="text-xs">Startup</SelectItem>
                                <SelectItem value="Mid-Market" className="text-xs">Mid-Market</SelectItem>
                                <SelectItem value="Enterprise" className="text-xs">Enterprise</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Problem Statement</Label>
                            <Input
                              placeholder="e.g. data silos, legacy infrastructure"
                              value={searchProblems}
                              onChange={e => setSearchProblems(e.target.value)}
                              className="h-8 text-xs bg-background border-border"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-muted-foreground">Min Relevance</Label>
                              <span className="text-xs font-medium tabular-nums" style={{ color: gold }}>{minScore}%</span>
                            </div>
                            <Slider
                              value={[minScore]}
                              onValueChange={([v]) => setMinScore(v)}
                              min={0} max={80} step={5}
                              className="w-full mt-2"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </AnimatedCard>

            {/* Results */}
            {searchLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: gold }} />
                <span className="ml-3 text-sm text-muted-foreground">Searching knowledge base with {searchMode} mode...</span>
              </div>
            )}

            {!searchLoading && hasSearched && searchResults.length === 0 && (
              <AnimatedCard>
                <div className="text-center py-12 space-y-3">
                  <Search className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">No matching knowledge found</p>
                  <p className="text-xs text-muted-foreground/60">Try different keywords, lower the minimum score, or switch to semantic mode</p>
                </div>
              </AnimatedCard>
            )}

            {!searchLoading && searchResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{totalMatches}</span> match{totalMatches !== 1 ? 'es' : ''} found
                    </p>
                    <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                      Mode: {searchMode}
                    </Badge>
                  </div>
                  {navigateTo && (
                    <button
                      onClick={() => navigateTo('capabilities')}
                      className="text-xs flex items-center gap-1 transition-colors"
                      style={{ color: gold }}
                    >
                      Manage in Capability Library <ArrowUpRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <StaggerGrid className="space-y-3" stagger={0.04} delay={0.1}>
                  {searchResults.map((result, idx) => {
                    const config = CATEGORY_CONFIG[result.category] || CATEGORY_CONFIG.service_line;
                    return (
                      <StaggerItem key={result.id}>
                        <AnimatedCard hover className="p-4" delay={idx * 0.04}>
                          <div className="flex items-start gap-4">
                            {/* Relevance score */}
                            <div className="shrink-0 flex flex-col items-center gap-1.5 w-14">
                              <span
                                className="text-lg font-bold tabular-nums"
                                style={{
                                  color: result.relevanceScore >= 80 ? '#34D399'
                                    : result.relevanceScore >= 50 ? '#FBBF24'
                                    : '#F87171',
                                }}
                              >
                                {result.relevanceScore}%
                              </span>
                              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{
                                    background: result.relevanceScore >= 80 ? '#34D399'
                                      : result.relevanceScore >= 50 ? '#FBBF24'
                                      : '#F87171',
                                  }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${result.relevanceScore}%` }}
                                  transition={{ duration: 0.6, delay: idx * 0.05 }}
                                />
                              </div>
                              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Relevance</span>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <p className="text-sm font-semibold text-foreground truncate">{result.title}</p>
                                <Badge variant="outline" className={`text-[10px] shrink-0 ${config.badge}`}>
                                  {CATEGORY_LABELS[result.category] || result.category}
                                </Badge>
                                {result.serviceLine && (
                                  <Badge variant="outline" className="text-[10px] border-border text-muted-foreground shrink-0">
                                    {result.serviceLine}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-2">
                                {result.summary}
                              </p>

                              {/* Matched fields */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-muted-foreground">Matched:</span>
                                {result.matchedFields.map(field => (
                                  <span
                                    key={field}
                                    className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded"
                                    style={{ background: 'rgba(212,175,55,0.08)', color: gold }}
                                  >
                                    {MATCHED_FIELD_LABELS[field] || field}
                                  </span>
                                ))}
                              </div>

                              {/* Content preview */}
                              {result.content && (
                                <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                                    {result.content}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Rank badge */}
                            <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                              style={{
                                background: idx === 0 ? 'linear-gradient(135deg, #D4AF37, #E8C860)' : 'rgba(255,255,255,0.05)',
                                color: idx === 0 ? '#000' : 'text-muted-foreground',
                              }}
                            >
                              {idx + 1}
                            </div>
                          </div>
                        </AnimatedCard>
                      </StaggerItem>
                    );
                  })}
                </StaggerGrid>
              </div>
            )}

            {/* Empty state */}
            {!searchLoading && !hasSearched && (
              <AnimatedCard delay={0.2}>
                <div className="text-center py-16 space-y-4">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                    style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))' }}
                  >
                    <Brain className="w-8 h-8" style={{ color: gold }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Test the Knowledge Engine</p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Enter a prospect&apos;s context (industry, role, company, challenges) to see how the RAG engine retrieves and ranks relevant knowledge for email personalization
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {[
                      'CTO in Financial Services needing AI solutions',
                      'Healthcare VP of Engineering cloud migration',
                      'Mid-market retailer with data silos',
                    ].map(q => (
                      <button
                        key={q}
                        onClick={() => { setSearchQuery(q); }}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </AnimatedCard>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════
            TAB 3: Coverage & Gaps
            ═══════════════════════════════════════════ */}
        {activeTab === 'coverage' && (
          <div className="space-y-4">
            {coverageLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card/60 p-5 space-y-3">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            ) : coverage ? (
              <>
                {/* Summary stats */}
                <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.06}>
                  <StaggerItem>
                    <GradientCard gradient="gold">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.15)' }}>
                          <Database className="w-5 h-5" style={{ color: gold }} />
                        </div>
                        <div>
                          <StatValue value={coverage.totalAssets} />
                          <p className="text-[11px] text-muted-foreground">Total Assets</p>
                        </div>
                      </div>
                    </GradientCard>
                  </StaggerItem>
                  <StaggerItem>
                    <GradientCard gradient="blue">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/15">
                          <Layers className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <StatValue value={coverage.serviceLines.length} />
                          <p className="text-[11px] text-muted-foreground">Service Lines</p>
                        </div>
                      </div>
                    </GradientCard>
                  </StaggerItem>
                  <StaggerItem>
                    <GradientCard gradient="green">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/15">
                          <Globe className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <StatValue value={`${coverage.industries.filter(i => i.coverage >= 50).length}/${coverage.industries.length}`} />
                          <p className="text-[11px] text-muted-foreground">Industries Covered</p>
                        </div>
                      </div>
                    </GradientCard>
                  </StaggerItem>
                  <StaggerItem>
                    <GradientCard gradient="purple">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/15">
                          <Users className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <StatValue value={`${coverage.roles.filter(r => r.coverage >= 50).length}/${coverage.roles.length}`} />
                          <p className="text-[11px] text-muted-foreground">Roles Covered</p>
                        </div>
                      </div>
                    </GradientCard>
                  </StaggerItem>
                </StaggerGrid>

                {/* Industry Coverage */}
                <AnimatedCard delay={0.2}>
                  <div className="p-5">
                    <SectionHeader title="Industry Coverage" subtitle="Knowledge assets targeting each industry sector" />
                    <div className="space-y-3">
                      {coverage.industries.map((ind, i) => (
                        <div key={ind.name} className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground w-40 shrink-0 truncate">{ind.name}</span>
                          <div className="flex-1">
                            <AnimatedBar
                              value={ind.count}
                              max={Math.max(...coverage.industries.map(x => x.count), 1)}
                              color={ind.coverage >= 70 ? '#34D399' : ind.coverage >= 40 ? '#FBBF24' : '#F87171'}
                              delay={i * 0.05}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-foreground w-8 text-right">{ind.count}</span>
                          {ind.gaps.length > 0 && (
                            <div className="relative group">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 cursor-help" />
                              <div className="absolute right-0 bottom-full mb-2 w-56 p-2 rounded-lg bg-card border border-border shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                <p className="text-[10px] font-medium text-amber-400 mb-1">Gaps for {ind.name}:</p>
                                {ind.gaps.map((g, gi) => (
                                  <p key={gi} className="text-[10px] text-muted-foreground">- {g}</p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </AnimatedCard>

                {/* Service Lines Coverage */}
                <AnimatedCard delay={0.25}>
                  <div className="p-5">
                    <SectionHeader title="Service Line Depth" subtitle="Assets per service line including case studies and proof points" />
                    <div className="space-y-4">
                      {coverage.serviceLines.map((sl, i) => (
                        <div key={sl.name} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground">{sl.name}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                                {sl.caseStudies} case studies
                              </Badge>
                              <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">
                                {sl.proofPoints} proof points
                              </Badge>
                            <span className="text-xs text-muted-foreground">{sl.count} total</span>
                            </div>
                          </div>
                          <AnimatedBar
                            value={sl.count}
                            max={Math.max(...coverage.serviceLines.map(x => x.count), 1)}
                            color={gold}
                            delay={i * 0.05}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </AnimatedCard>

                {/* Category Distribution */}
                <AnimatedCard delay={0.3}>
                  <div className="p-5">
                    <SectionHeader title="Category Distribution" subtitle="Balance of knowledge asset types" />
                    <StaggerGrid className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" stagger={0.05}>
                      {coverage.categories.map(cat => {
                        const config = CATEGORY_CONFIG[cat.name] || CATEGORY_CONFIG.service_line;
                        const Icon = config.icon;
                        return (
                          <StaggerItem key={cat.name}>
                            <div className="p-4 rounded-xl border border-border bg-background/50 text-center space-y-2">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto" style={{ background: `${config.color}15` }}>
                                <Icon className="w-5 h-5" style={{ color: config.color }} />
                              </div>
                              <StatValue value={cat.count} />
                              <p className="text-[11px] text-muted-foreground">{CATEGORY_LABELS[cat.name] || cat.name}</p>
                            </div>
                          </StaggerItem>
                        );
                      })}
                    </StaggerGrid>
                  </div>
                </AnimatedCard>
              </>
            ) : (
              <AnimatedCard>
                <div className="text-center py-12">
                  <BarChart3 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Unable to load coverage data</p>
                </div>
              </AnimatedCard>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════
            TAB 4: Upload & Extract
            ═══════════════════════════════════════════ */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <AnimatedCard delay={0.1}>
              <div className="p-6">
                <SectionHeader title="Document Upload" subtitle="Upload .txt, .md, .pdf, or .docx files. Text is extracted and stored as knowledge assets for RAG retrieval." />

                {/* Drop zone */}
                <div
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/30 transition-colors mt-4"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); }}
                  onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) setUploadFile(file);
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.pdf,.docx"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) setUploadFile(file);
                    }}
                  />
                  <Upload className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">
                    {uploadFile ? uploadFile.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60">
                    Supports .txt, .md, .pdf, .docx (max 5MB)
                  </p>
                </div>

                {uploadFile && (
                  <div className="mt-4 flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4" style={{ color: gold }} />
                      <div>
                        <p className="text-xs font-medium text-foreground">{uploadFile.name}</p>
                        <p className="text-[10px] text-muted-foreground">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})`, color: '#000' }}
                        disabled={uploadLoading}
                        onClick={handleUpload}
                      >
                        {uploadLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        Extract & Preview
                      </Button>
                      <button
                        onClick={() => setUploadFile(null)}
                        className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </AnimatedCard>

            {/* How it works */}
            <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-4" stagger={0.08} delay={0.2}>
              {[
                { icon: Upload, title: '1. Upload', desc: 'Upload documents in .txt, .md, .pdf, or .docx format. The system extracts all text content automatically.' },
                { icon: Cpu, title: '2. Index', desc: 'Extracted content is chunked and stored as knowledge assets with category, service line, and industry metadata.' },
                { icon: Zap, title: '3. Retrieve', desc: 'The RAG engine retrieves relevant knowledge when generating personalized emails, matching by industry, role, and problems.' },
              ].map(step => (
                <StaggerItem key={step.title}>
                  <AnimatedCard className="p-5 text-center space-y-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto" style={{ background: 'rgba(212,175,55,0.1)' }}>
                      <step.icon className="w-6 h-6" style={{ color: gold }} />
                    </div>
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                  </AnimatedCard>
                </StaggerItem>
              ))}
            </StaggerGrid>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════
          View Asset Dialog
          ═══════════════════════════════════════════ */}
      <Dialog open={!!viewAsset} onOpenChange={() => setViewAsset(null)}>
        <DialogContent className="max-w-2xl bg-card border-border max-h-[80vh] overflow-y-auto">
          {viewAsset && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {viewAsset.title}
                  <Badge variant="outline" className={`text-[10px] ${(CATEGORY_CONFIG[viewAsset.category] || CATEGORY_CONFIG.service_line).badge}`}>
                    {CATEGORY_LABELS[viewAsset.category] || viewAsset.category}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{viewAsset.summary}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                {viewAsset.content && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Full Content</Label>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {viewAsset.content}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {viewAsset.serviceLine && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Service Line</Label>
                      <p className="text-sm text-foreground mt-0.5">{viewAsset.serviceLine}</p>
                    </div>
                  )}
                  {viewAsset.targetIndustries && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Target Industries</Label>
                      <p className="text-sm text-foreground mt-0.5">{viewAsset.targetIndustries}</p>
                    </div>
                  )}
                  {viewAsset.targetRoles && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Target Roles</Label>
                      <p className="text-sm text-foreground mt-0.5">{viewAsset.targetRoles}</p>
                    </div>
                  )}
                  {viewAsset.problems && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Problems</Label>
                      <p className="text-sm text-foreground mt-0.5">{viewAsset.problems}</p>
                    </div>
                  )}
                  {viewAsset.evidence && (
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Evidence</Label>
                      <p className="text-sm text-foreground mt-0.5">{viewAsset.evidence}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════
          Upload Preview Dialog
          ═══════════════════════════════════════════ */}
      <Dialog open={uploadPreviewOpen} onOpenChange={setUploadPreviewOpen}>
        <DialogContent className="max-w-3xl bg-card border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: gold }} />
              Extracted Knowledge Preview
            </DialogTitle>
            <DialogDescription>
              Review the extracted text, set metadata, and save as a knowledge asset for RAG retrieval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Title *</Label>
                <Input
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  className="h-9 text-sm bg-background border-border"
                  placeholder="Knowledge asset title"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger className="h-9 text-sm bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Service Line (optional)</Label>
                <Select value={uploadServiceLine} onValueChange={v => setUploadServiceLine(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-9 text-sm bg-background border-border">
                    <SelectValue placeholder="Select service line" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="__none__" className="text-xs">None</SelectItem>
                    {SERVICE_LINE_LIST.map(sl => (
                      <SelectItem key={sl} value={sl} className="text-xs">{sl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs text-muted-foreground">Extracted Content</Label>
                <span className="text-[10px] text-muted-foreground tabular-nums">{uploadExtractedText.length.toLocaleString()} characters</span>
              </div>
              <Textarea
                value={uploadExtractedText}
                onChange={e => setUploadExtractedText(e.target.value)}
                className="min-h-[200px] max-h-[400px] text-xs bg-background border-border font-mono"
              />
              {uploadExtractedText.length > 2000 && (
                <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Long content will be automatically split into {Math.ceil(uploadExtractedText.length / 2000)} chunks for optimal RAG retrieval
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setUploadPreviewOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                className="text-xs gap-1.5"
                style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})`, color: '#000' }}
                disabled={uploadSaving || !uploadTitle.trim()}
                onClick={handleSaveExtracted}
              >
                {uploadSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                Save to Knowledge Base
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════
          Add Asset Dialog
          ═══════════════════════════════════════════ */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Knowledge Asset</DialogTitle>
            <DialogDescription>Manually add a capability, case study, proof point, or other knowledge to the RAG engine.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Title *</Label>
                <Input value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} className="h-9 text-sm bg-background border-border" placeholder="e.g. AI & Machine Learning" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Category *</Label>
                <Select value={addForm.category} onValueChange={v => setAddForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-9 text-sm bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Summary *</Label>
              <Textarea value={addForm.summary} onChange={e => setAddForm(f => ({ ...f, summary: e.target.value }))} className="min-h-[60px] text-sm bg-background border-border" placeholder="Brief 1-2 sentence description" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Service Line</Label>
                <Select value={addForm.serviceLine} onValueChange={v => setAddForm(f => ({ ...f, serviceLine: v === '__none__' ? '' : v }))}>
                  <SelectTrigger className="h-9 text-sm bg-background border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="__none__" className="text-xs">None</SelectItem>
                    {SERVICE_LINE_LIST.map(sl => (
                      <SelectItem key={sl} value={sl} className="text-xs">{sl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Target Industries</Label>
                <Input value={addForm.targetIndustries} onChange={e => setAddForm(f => ({ ...f, targetIndustries: e.target.value }))} className="h-9 text-sm bg-background border-border" placeholder="e.g. Financial Services, Healthcare" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Target Roles</Label>
                <Input value={addForm.targetRoles} onChange={e => setAddForm(f => ({ ...f, targetRoles: e.target.value }))} className="h-9 text-sm bg-background border-border" placeholder="e.g. CTO, VP of Engineering" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Evidence</Label>
                <Input value={addForm.evidence} onChange={e => setAddForm(f => ({ ...f, evidence: e.target.value }))} className="h-9 text-sm bg-background border-border" placeholder="e.g. 85% reduction, $2M savings" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Problems Solved</Label>
              <Input value={addForm.problems} onChange={e => setAddForm(f => ({ ...f, problems: e.target.value }))} className="h-9 text-sm bg-background border-border" placeholder="e.g. data silos, legacy infrastructure" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Full Content</Label>
              <Textarea value={addForm.content} onChange={e => setAddForm(f => ({ ...f, content: e.target.value }))} className="min-h-[100px] text-sm bg-background border-border" placeholder="Detailed content for RAG retrieval..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                className="text-xs gap-1.5"
                style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})`, color: '#000' }}
                disabled={!addForm.title.trim() || !addForm.summary.trim()}
                onClick={handleAddAsset}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Asset
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}

/* ═══════════════════════════════════════════════════
   Coverage Builder (runs client-side)
   ═══════════════════════════════════════════════════ */
function buildCoverage(assets: KnowledgeAsset[]): CoverageData {
  const industries: CoverageData['industries'] = INDUSTRY_LIST.map(name => {
    const matching = assets.filter(a => a.targetIndustries?.toLowerCase().includes(name.toLowerCase()));
    const categories = new Set(matching.map(a => a.category));
    const gaps: string[] = [];
    if (!categories.has('case_study')) gaps.push('Missing case studies');
    if (!categories.has('proof_point')) gaps.push('Missing proof points');
    if (matching.length === 0) gaps.push('No knowledge assets');
    const coverage = matching.length === 0 ? 0 : Math.min(100, Math.round((categories.size / 3) * 100) + (matching.length > 2 ? 20 : 0));
    return { name, count: matching.length, coverage: Math.min(100, coverage), gaps };
  });

  const roles: CoverageData['roles'] = ROLE_LIST.map(name => {
    const matching = assets.filter(a => a.targetRoles?.toLowerCase().includes(name.toLowerCase()));
    return { name, count: matching.length, coverage: matching.length > 0 ? Math.min(100, matching.length * 25) : 0 };
  });

  const serviceLines: CoverageData['serviceLines'] = SERVICE_LINE_LIST.map(name => {
    const matching = assets.filter(a => a.serviceLine?.toLowerCase().includes(name.toLowerCase()));
    return {
      name,
      count: matching.length,
      caseStudies: matching.filter(a => a.category === 'case_study').length,
      proofPoints: matching.filter(a => a.category === 'proof_point').length,
    };
  });

  const categories: CoverageData['categories'] = Object.entries(CATEGORY_LABELS).map(([name, label]) => ({
    name,
    count: assets.filter(a => a.category === name).length,
  }));

  return {
    industries,
    roles,
    serviceLines,
    categories,
    totalAssets: assets.length,
    engineHealth: {
      searchModes: ['keyword', 'semantic', 'hybrid'],
      lastSearch: null,
      avgScore: 0,
    },
  };
}