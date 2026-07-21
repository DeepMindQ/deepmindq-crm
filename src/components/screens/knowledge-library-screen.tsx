'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PageTransition, AnimatedCard, StaggerGrid, StaggerItem,
  SectionHeader, AnimatedBar, TabBar, GradientCard, PulseDot, StatValue,
  GlassPanel, StatCard,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
  ChevronDown, ChevronUp, Tag, Shield, GitBranch, Network, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Treemap, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend,
} from 'recharts';

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
  { key: 'graph', label: 'Knowledge Graph' },
  { key: 'search', label: 'RAG Search Engine' },
  { key: 'coverage', label: 'Coverage & Gaps' },
  { key: 'upload', label: 'Upload & Extract' },
];

const GRAPH_CATEGORY_COLORS: Record<string, string> = {
  service_line: '#D4AF37',
  case_study: '#10b981',
  proof_point: '#3b82f6',
  objection_response: '#f59e0b',
  cta: '#a855f7',
};

const CATEGORY_CONFIG: Record<string, { icon: typeof Layers; color: string; badge: string }> = {
  service_line: { icon: Layers, color: '#3B82F6', badge: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  case_study: { icon: BookOpen, color: '#10B981', badge: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  proof_point: { icon: Trophy, color: '#8B5CF6', badge: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
  objection_response: { icon: MessageSquare, color: '#EF4444', badge: 'bg-red-500/15 text-red-600 border-red-500/30' },
  cta: { icon: Target, color: '#F59E0B', badge: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
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
  const [uploadFiles, setUploadFiles] = useState<File[]>([]); // C-14: multi-file
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadStep, setUploadStep] = useState<'idle' | 'uploading' | 'extracting' | 'generating' | 'done' | 'error'>('idle');
  const [uploadResult, setUploadResult] = useState<{
    extractedText: string;
    fileName: string;
    wordCount: number;
    readingTime: number;
    aiExtractionUsed: boolean;
    overallSummary: string;
    assetsGenerated: number;
    assets: Array<Record<string, unknown>>;
  } | null>(null);
  const [uploadError, setUploadError] = useState('');

  // ── Coverage state ──
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);

  // ── Knowledge Graph state ──
  const [graphData, setGraphData] = useState<any>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [selectedGraphNode, setSelectedGraphNode] = useState<any>(null);

  // ── Version History state ──
  const [versionHistory, setVersionHistory] = useState<any>(null);
  const [versionLoading, setVersionLoading] = useState(false);

  // ── C-13: Knowledge Health state ──
  const [healthData, setHealthData] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);

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
    if (activeTab === 'coverage') { loadCoverage(); loadHealth(); }
    if (activeTab === 'graph') { loadGraphData(); }
  }, [activeTab, loadCoverage]);

  // ── Load graph data ──
  const loadGraphData = useCallback(async () => {
    setGraphLoading(true);
    try {
      const res = await fetch('/api/knowledge/graph');
      const data = await res.json();
      setGraphData(data);
    } catch { setGraphData(null); }
    setGraphLoading(false);
  }, []);

  // ── Load version history for an asset ──
  const loadVersionHistory = useCallback(async (assetId: string) => {
    setVersionLoading(true);
    setVersionHistory(null);
    try {
      const res = await fetch(`/api/knowledge/graph?assetId=${assetId}&versions=true`);
      const data = await res.json();
      setVersionHistory(data);
    } catch { setVersionHistory(null); }
    setVersionLoading(false);
  }, []);

  // ── C-13: Load Knowledge Health ──
  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/knowledge/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'coverage_v2' }),
      });
      const data = await res.json();
      setHealthData(data);
    } catch { setHealthData(null); }
    setHealthLoading(false);
  }, []);

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

  // ── Handle file upload — C-14: supports multiple files
  const handleUpload = useCallback(async () => {
    const filesToUpload = uploadFiles.length > 0 ? uploadFiles : (uploadFile ? [uploadFile] : []);
    if (filesToUpload.length === 0) return;
    setUploadLoading(true);
    setUploadError('');
    setUploadResult(null);
    setUploadStep('uploading');
    try {
      const formData = new FormData();
      filesToUpload.forEach(f => formData.append('file', f));
      formData.append('autoGenerate', 'true');
      const res = await fetch('/api/capabilities/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      setUploadStep('done');
      // Handle multi-file results
      if (data.totalFiles > 1) {
        const firstResult = data.results?.[0] || {};
        setUploadResult({
          extractedText: firstResult.extractedText || '',
          fileName: `${data.totalFiles} files uploaded`,
          wordCount: (data.results || []).reduce((s: number, r: any) => s + (r.wordCount || 0), 0),
          readingTime: Math.max(1, Math.ceil(((data.results || []).reduce((s: number, r: any) => s + (r.wordCount || 0), 0)) / 200)),
          aiExtractionUsed: (data.results || []).some((r: any) => r.aiExtractionUsed),
          overallSummary: data.totalAssetsGenerated > 0 ? `Generated ${data.totalAssetsGenerated} assets from ${data.totalFiles} files` : '',
          assetsGenerated: data.totalAssetsGenerated || 0,
          assets: (data.results || []).flatMap((r: any) => r.assets || []),
        });
      } else {
        setUploadResult({
          extractedText: data.extractedText || '',
          fileName: data.fileName || uploadFile?.name || filesToUpload[0]?.name || '',
          wordCount: data.wordCount || 0,
          readingTime: data.readingTime || 1,
          aiExtractionUsed: data.aiExtractionUsed || false,
          overallSummary: data.overallSummary || '',
          assetsGenerated: data.assetsGenerated || 0,
          assets: data.assets || [],
        });
      }
      const totalAssets = data.totalAssetsGenerated ?? data.assetsGenerated ?? 0;
      if (totalAssets > 0) {
        toast.success(`${totalAssets} knowledge asset${totalAssets > 1 ? 's' : ''} generated from "${filesToUpload.length} file${filesToUpload.length > 1 ? 's' : ''}"`);
        loadAssets();
      } else {
        toast.success(`Text extracted from ${filesToUpload.length} file${filesToUpload.length > 1 ? 's' : ''}`);
      }
      setUploadFile(null);
      setUploadFiles([]);
    } catch (err) {
      setUploadStep('error');
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    }
    setUploadLoading(false);
  }, [uploadFile, uploadFiles, loadAssets]);

  // ── Save extracted content as a knowledge asset (manual fallback) ──
  const handleSaveExtracted = useCallback(async () => {
    if (!uploadResult?.extractedText) return;
    try {
      const nameWithoutExt = uploadResult.fileName.replace(/\.[^/.]+$/, '');
      const maxChunkLen = 2000;
      const text = uploadResult.extractedText;
      const chunks: string[] = [];

      if (text.length <= maxChunkLen) {
        chunks.push(text);
      } else {
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
            title: nameWithoutExt + suffix,
            summary: chunks[i].slice(0, 200).trim() + (chunks[i].length > 200 ? '...' : ''),
            content: chunks[i],
            category: 'service_line',
          }),
        });
      }

      toast.success(`Manually saved ${chunks.length} asset${chunks.length > 1 ? 's' : ''} to knowledge base`);
      loadAssets();
    } catch {
      toast.error('Failed to save knowledge asset');
    }
  }, [uploadResult, loadAssets]);

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

  const gold = '#B8860B';
  const goldLight = '#D4A843';

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
                              className="p-1 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(asset.id)}
                              className="p-1 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
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
            TAB 2: Knowledge Graph
            ═══════════════════════════════════════════ */}
        {activeTab === 'graph' && (
          <div className="space-y-4">
            {/* Graph stats bar */}
            <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-3" stagger={0.05}>
              <StaggerItem>
                <StatCard
                  label="Total Nodes"
                  value={graphData?.totalAssets || 0}
                  icon={Network}
                  color={gold}
                  delay={0}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="Connections"
                  value={graphData?.edges?.length || 0}
                  icon={GitBranch}
                  color="#10b981"
                  delay={0.05}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="Service Lines"
                  value={Object.keys(graphData?.serviceLines || {}).length}
                  icon={Layers}
                  color="#3b82f6"
                  delay={0.1}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="Categories"
                  value={Object.keys(graphData?.categories || {}).length}
                  icon={Target}
                  color="#a855f7"
                  delay={0.15}
                />
              </StaggerItem>
            </StaggerGrid>

            {/* Treemap visualization */}
            {graphLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card/60 p-6 space-y-4">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-[300px] w-full" />
                  </div>
                ))}
              </div>
            ) : graphData && graphData.nodes && graphData.nodes.length > 0 ? (
              <>
                {/* Treemap */}
                <AnimatedCard delay={0.1}>
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <SectionHeader title="Knowledge Map" subtitle="Assets grouped by service line — cell size reflects relevance score, color indicates category" />
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {Object.entries(GRAPH_CATEGORY_COLORS).map(([cat, color]) => (
                          <div key={cat} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                            <span className="text-[10px] text-muted-foreground">{CATEGORY_LABELS[cat] || cat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="h-[380px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <Treemap
                          data={buildTreemapData(graphData.nodes)}
                          dataKey="size"
                          aspectRatio={4 / 3}
                          stroke="rgba(0, 0, 0, 0.05)"
                          content={<CustomTreemapContent />}
                        />
                      </ResponsiveContainer>
                    </div>
                  </div>
                </AnimatedCard>

                {/* Charts row: Donut + Bar */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Category Donut */}
                  <AnimatedCard delay={0.15}>
                    <div className="p-5">
                      <SectionHeader title="Category Distribution" subtitle="Knowledge asset types breakdown" />
                      <div className="h-[260px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={Object.entries(graphData.categories || {}).map(([name, value]) => ({
                                name: CATEGORY_LABELS[name] || name,
                                value: value as number,
                                category: name,
                              }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={90}
                              paddingAngle={3}
                              dataKey="value"
                              stroke="none"
                            >
                              {Object.entries(graphData.categories || {}).map(([name]) => (
                                <Cell
                                  key={name}
                                  fill={GRAPH_CATEGORY_COLORS[name] || '#D4AF37'}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                background: '#FFFFFF', border: '1px solid rgba(0, 0, 0, 0.06)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                borderRadius: '8px',
                                fontSize: '12px',
                                color: '#374151',
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </AnimatedCard>

                  {/* Service Line Bar Chart */}
                  <AnimatedCard delay={0.2}>
                    <div className="p-5\">
                      <SectionHeader title="Service Line Distribution" subtitle="Assets per service line" />
                      <div className="h-[260px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={Object.entries(graphData.serviceLines || {})
                              .map(([name, count]) => ({ name, count: count as number }))
                              .sort((a, b) => b.count - a.count)}
                            layout="vertical"
                            margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                          >
                            <XAxis
                              type="number"
                              tick={{ fill: 'rgba(0, 0, 0, 0.1)', fontSize: 11 }}
                              axisLine={{ stroke: 'rgba(0, 0, 0, 0.06)' }}
                              tickLine={false}
                            />
                            <YAxis
                              type="category"
                              dataKey="name"
                              tick={{ fill: 'rgba(0, 0, 0, 0.12)', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              width={140}
                            />
                            <Tooltip
                              contentStyle={{
                                background: '#FFFFFF', border: '1px solid rgba(0, 0, 0, 0.06)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                borderRadius: '8px',
                                fontSize: '12px',
                                color: '#374151',
                              }}
                            />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                              {Object.entries(graphData.serviceLines || {}).map((_, idx) => (
                                <Cell
                                  key={idx}
                                  fill={idx === 0 ? gold : `rgba(212,175,55,${Math.max(0.3, 1 - idx * 0.15)})`}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </AnimatedCard>
                </div>

                {/* Selected node detail */}
                <AnimatePresence>
                  {selectedGraphNode && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                    >
                      <GlassPanel className="p-5\">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center\"
                              style={{ background: `${GRAPH_CATEGORY_COLORS[selectedGraphNode.category] || gold}15` }}
                            >
                              <Network className="w-4 h-4" style={{ color: GRAPH_CATEGORY_COLORS[selectedGraphNode.category] || gold }} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{selectedGraphNode.label}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className={`text-[10px] ${(CATEGORY_CONFIG[selectedGraphNode.category] || CATEGORY_CONFIG.service_line).badge}`}>
                                  {CATEGORY_LABELS[selectedGraphNode.category] || selectedGraphNode.category}
                                </Badge>
                                {selectedGraphNode.group && selectedGraphNode.group !== selectedGraphNode.category && (
                                  <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                                    {selectedGraphNode.group}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedGraphNode(null)}
                            className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mt-3">
                          <div className="text-center p-3 rounded-lg bg-white border border-gray-200 shadow-sm">
                            <p className="text-lg font-bold tabular-nums" style={{ color: gold }}>{selectedGraphNode.score}</p>
                            <p className="text-[10px] text-muted-foreground">Score</p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-white border border-gray-200 shadow-sm">
                            <p className="text-lg font-bold tabular-nums text-emerald-600">{selectedGraphNode.upvotes}</p>
                            <p className="text-[10px] text-muted-foreground">Upvotes</p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-white border border-gray-200 shadow-sm">
                            <p className="text-lg font-bold tabular-nums text-blue-600">{selectedGraphNode.usedInEmails}</p>
                            <p className="text-[10px] text-muted-foreground">Used in Emails</p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-white border border-gray-200 shadow-sm">
                            <p className="text-lg font-bold tabular-nums text-muted-foreground">v{selectedGraphNode.version}</p>
                            <p className="text-[10px] text-muted-foreground">Version</p>
                          </div>
                        </div>
                      </GlassPanel>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <AnimatedCard>
                <div className="text-center py-16 space-y-4">
                  <Network className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-foreground">No knowledge graph data</p>
                    <p className="text-xs text-muted-foreground mt-1">Add knowledge assets to see the knowledge graph visualization</p>
                  </div>
                </div>
              </AnimatedCard>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════
            TAB 3: RAG Search Engine
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
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-500/5 shrink-0">
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
                                background: idx === 0 ? 'linear-gradient(135deg, #D4AF37, #E8C860)' : 'rgba(0, 0, 0, 0.04)',
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
            TAB 4: Coverage & Gaps
            ═══════════════════════════════════════════ */}
        {activeTab === 'coverage' && (
          <div className="space-y-4">
            {/* C-13: Knowledge Health Card */}
            {healthLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card/60 p-5 space-y-3">
                    <Skeleton className="h-5 w-1/2" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            ) : healthData && !healthData.error ? (
              <>
                {/* Overall Health Score */}
                <GradientCard gradient="gold">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                          <Shield className="w-5 h-5" style={{ color: gold }} />
                          Knowledge Health
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Comprehensive knowledge base quality assessment</p>
                      </div>
                      <Badge
                        className="text-sm px-3 py-1 font-bold"
                        style={{
                          background: `${healthData.healthColor}20`,
                          color: healthData.healthColor,
                          border: `1px solid ${healthData.healthColor}40`,
                        }}
                      >
                        {healthData.overallHealthScore}%
                      </Badge>
                    </div>

                    {/* Dimension breakdown */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {Object.entries(healthData.dimensions || {}).map(([key, dim]: [string, any]) => (
                        <div key={key} className="p-3 rounded-lg bg-white border border-gray-200 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{dim.label}</span>
                            <span className="text-xs font-bold tabular-nums" style={{
                              color: dim.score >= 70 ? '#10B981' : dim.score >= 40 ? '#FBBF24' : '#EF4444'
                            }}>{dim.score}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: dim.score >= 70 ? '#10B981' : dim.score >= 40 ? '#FBBF24' : '#EF4444' }}
                              initial={{ width: 0 }}
                              animate={{ width: `${dim.score}%` }}
                              transition={{ duration: 0.8 }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">{dim.detail}</p>
                        </div>
                      ))}
                    </div>

                    {/* Gap Alerts */}
                    {healthData.gaps && healthData.gaps.totalGaps > 0 && (
                      <div className="mt-4 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-semibold text-amber-600">{healthData.gaps.totalGaps} Coverage Gaps Detected</span>
                        </div>
                        {healthData.gaps.industries.length > 0 && (
                          <div className="mb-1">
                            <span className="text-[10px] text-muted-foreground">No industry coverage: </span>
                            <span className="text-[10px] text-amber-700">{healthData.gaps.industries.join(', ')}</span>
                          </div>
                        )}
                        {healthData.gaps.roles.length > 0 && (
                          <div>
                            <span className="text-[10px] text-muted-foreground">No role coverage: </span>
                            <span className="text-[10px] text-amber-700">{healthData.gaps.roles.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Service Line Completeness */}
                    {healthData.serviceLines && healthData.serviceLines.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-semibold text-foreground">Service Line Completeness</p>
                        {healthData.serviceLines.map((sl: any) => (
                          <div key={sl.name} className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-40 shrink-0 truncate">{sl.name}</span>
                            <div className="flex-1">
                              <AnimatedBar value={sl.score} max={100} color={sl.score >= 70 ? '#10B981' : sl.score >= 40 ? '#FBBF24' : '#EF4444'} />
                            </div>
                            <span className="text-xs tabular-nums text-foreground w-8 text-right">{sl.score}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </GradientCard>
              </>
            ) : null}

            {/* Original coverage content */}
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
                          <Layers className="w-5 h-5 text-blue-600" />
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
                          <Globe className="w-5 h-5 text-emerald-600" />
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
                          <Users className="w-5 h-5 text-purple-600" />
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
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 cursor-help" />
                              <div className="absolute right-0 bottom-full mb-2 w-56 p-2 rounded-lg bg-card border border-border shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                <p className="text-[10px] font-medium text-amber-600 mb-1">Gaps for {ind.name}:</p>
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
                              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">
                                {sl.caseStudies} case studies
                              </Badge>
                              <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-600">
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

                {/* Category Distribution — with Donut Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

                  {/* Category Donut Chart */}
                  <AnimatedCard delay={0.35}>
                    <div className="p-5">
                      <SectionHeader title="Category Breakdown" subtitle="Visual distribution of asset types" />
                      <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={coverage.categories.map(cat => ({
                                name: CATEGORY_LABELS[cat.name] || cat.name,
                                value: cat.count,
                              }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={85}
                              paddingAngle={3}
                              dataKey="value"
                              stroke="none"
                            >
                              {coverage.categories.map((cat) => (
                                <Cell
                                  key={cat.name}
                                  fill={GRAPH_CATEGORY_COLORS[cat.name] || (CATEGORY_CONFIG[cat.name] || CATEGORY_CONFIG.service_line).color}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                background: '#FFFFFF', border: '1px solid rgba(0, 0, 0, 0.06)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                borderRadius: '8px',
                                fontSize: '12px',
                                color: '#374151',
                              }}
                            />
                            <Legend
                              iconType="circle"
                              iconSize={8}
                              wrapperStyle={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.15)' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </AnimatedCard>
                </div>

                {/* Industry Coverage Bar Chart */}
                <AnimatedCard delay={0.4}>
                  <div className="p-5">
                    <SectionHeader title="Industry Coverage Map" subtitle="Asset count per industry — highlights knowledge gaps" />
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={coverage.industries
                            .map(ind => ({ name: ind.name, count: ind.count, coverage: ind.coverage }))
                            .sort((a, b) => b.count - a.count)}
                          layout="vertical"
                          margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                        >
                          <XAxis
                            type="number"
                            tick={{ fill: 'rgba(0, 0, 0, 0.1)', fontSize: 11 }}
                            axisLine={{ stroke: 'rgba(0, 0, 0, 0.06)' }}
                            tickLine={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fill: 'rgba(0, 0, 0, 0.12)', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={120}
                          />
                          <Tooltip
                            contentStyle={{
                              background: '#FFFFFF', border: '1px solid rgba(0, 0, 0, 0.06)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                              borderRadius: '8px',
                              fontSize: '12px',
                              color: '#374151',
                            }}
                            formatter={(value: number, name: string) => [`${value} assets`, name]}
                          />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                            {coverage.industries.map((ind, idx) => (
                              <Cell
                                key={ind.name}
                                fill={ind.count === 0 ? '#EF4444' : ind.coverage >= 70 ? '#10B981' : ind.coverage >= 40 ? '#FBBF24' : '#F87171'}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Gaps legend */}
                    <div className="flex items-center gap-4 mt-3 justify-center">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                        <span className="text-[10px] text-muted-foreground">Good Coverage</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                        <span className="text-[10px] text-muted-foreground">Partial Coverage</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                        <span className="text-[10px] text-muted-foreground">Gap / No Assets</span>
                      </div>
                    </div>
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
            TAB 5: Upload & AI Knowledge Extraction
            ═══════════════════════════════════════════ */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            {/* Upload Card */}
            <AnimatedCard delay={0.1}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.05))' }}>
                    <Upload className="w-4.5 h-4.5" style={{ color: gold }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Document Upload & AI Knowledge Extraction</h3>
                    <p className="text-xs text-muted-foreground">Upload a document — text is extracted, analyzed by AI, and automatically saved as structured knowledge assets for RAG retrieval</p>
                  </div>
                </div>

                {/* Processing progress */}
                {uploadLoading && (
                  <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: gold }} />
                      <span className="text-sm text-foreground font-medium">
                        {uploadStep === 'uploading' && 'Uploading document...'}
                        {uploadStep === 'extracting' && 'Extracting text content...'}
                        {uploadStep === 'generating' && 'AI is analyzing and generating knowledge assets...'}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { label: 'Upload file', done: ['extracting', 'generating', 'done'].includes(uploadStep) },
                        { label: 'Extract text', done: ['generating', 'done'].includes(uploadStep) },
                        { label: 'AI knowledge generation', done: uploadStep === 'done' },
                        { label: 'Save to knowledge base', done: uploadStep === 'done' },
                      ].map((step, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          {step.done ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                          )}
                          <span className={`text-xs ${step.done ? 'text-emerald-600' : 'text-muted-foreground'}`}>{step.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error state */}
                {uploadStep === 'error' && (
                  <div className="mt-4 p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-600 font-medium">Upload failed</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{uploadError}</p>
                    </div>
                  </div>
                )}

                {/* Drop zone */}
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mt-4 ${
                    uploadLoading ? 'border-border/50 opacity-50 pointer-events-none' : 'border-border hover:border-primary/30'
                  }`}
                  onClick={() => !uploadLoading && fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); }}
                  onDrop={e => {
                    e.preventDefault();
                    if (uploadLoading) return;
                    const files = Array.from(e.dataTransfer.files);
                    if (files.length === 1) { setUploadFile(files[0]); setUploadFiles([]); }
                    else if (files.length > 1) { setUploadFiles(files); setUploadFile(null); }
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.pdf,.docx"
                    multiple
                    className="hidden"
                    onChange={e => {
                      const files = Array.from(e.target.files || []);
                      if (files.length === 1) { setUploadFile(files[0]); setUploadFiles([]); }
                      else if (files.length > 1) { setUploadFiles(files); setUploadFile(null); }
                    }}
                  />
                  <Upload className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">
                    {uploadFiles.length > 0 ? `${uploadFiles.length} files selected` : uploadFile ? uploadFile.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60">
                    Supports .txt, .md, .pdf, .docx (max 25MB) — multiple files supported
                  </p>
                </div>

                {/* File selected + upload button — C-14: multi-file */}
                {!uploadLoading && (uploadFile || uploadFiles.length > 0) && (
                  <div className="mt-4 space-y-2">
                    {uploadFile && (
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4" style={{ color: gold }} />
                          <div><p className="text-xs font-medium text-foreground">{uploadFile.name}</p><p className="text-[10px] text-muted-foreground">{(uploadFile.size / 1024).toFixed(1)} KB</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="h-8 text-xs gap-1.5" style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})`, color: '#000' }} onClick={handleUpload}><Sparkles className="w-3.5 h-3.5" />Upload & Generate</Button>
                          <button onClick={() => { setUploadFile(null); setUploadStep('idle'); setUploadResult(null); setUploadError(''); }} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    )}
                    {uploadFiles.length > 0 && (
                      <div className="p-3 rounded-lg border border-border bg-card/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-foreground">{uploadFiles.length} files selected</span>
                          <button onClick={() => { setUploadFiles([]); setUploadStep('idle'); setUploadResult(null); setUploadError(''); }} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1 mb-3">
                          {uploadFiles.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <FileText className="w-3 h-3" style={{ color: gold }} />
                              <span className="flex-1 truncate">{f.name}</span>
                              <span>{(f.size / 1024).toFixed(1)} KB</span>
                            </div>
                          ))}
                        </div>
                        <Button size="sm" className="h-8 text-xs gap-1.5 w-full" style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})`, color: '#000' }} onClick={handleUpload}><Sparkles className="w-3.5 h-3.5" />Upload & Generate from {uploadFiles.length} Files</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AnimatedCard>

            {/* Upload Results — Generated Assets */}
            {uploadResult && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Summary banner */}
                <AnimatedCard delay={0.15}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: uploadResult.aiExtractionUsed ? 'rgba(16,185,129,0.15)' : 'rgba(212,175,55,0.1)' }}>
                        {uploadResult.aiExtractionUsed ? (
                          <Sparkles className="w-4.5 h-4.5 text-emerald-600" />
                        ) : (
                          <FileText className="w-4.5 h-4.5" style={{ color: gold }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {uploadResult.aiExtractionUsed
                            ? `AI extracted ${uploadResult.assetsGenerated} knowledge asset${uploadResult.assetsGenerated !== 1 ? 's' : ''} and saved to knowledge base`
                            : `Text extracted (${uploadResult.wordCount.toLocaleString()} words, ~${uploadResult.readingTime} min read)`}
                        </p>
                        {uploadResult.overallSummary && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{uploadResult.overallSummary}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                            {uploadResult.fileName}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                            {uploadResult.wordCount.toLocaleString()} words
                          </Badge>
                          {uploadResult.aiExtractionUsed && (
                            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">
                              <Sparkles className="w-2.5 h-2.5 mr-1" />
                              AI-Powered
                            </Badge>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => { setUploadResult(null); setUploadStep('idle'); }}
                        className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </AnimatedCard>

                {/* Generated assets list */}
                {uploadResult.assets.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium px-1">
                      Generated Knowledge Assets
                    </p>
                    {uploadResult.assets.map((asset, i) => {
                      const cat = String(asset.category || 'service_line');
                      const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.service_line;
                      const Icon = config.icon;
                      return (
                        <motion.div
                          key={String(asset.id) || `gen-${i}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * i }}
                          className="p-3 rounded-xl border border-border bg-card/50 hover:bg-card/80 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${config.color}15` }}>
                              <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-xs font-medium text-foreground truncate">{String(asset.title || 'Untitled')}</p>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{String(asset.summary || '')}</p>
                              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                <Badge variant="outline" className={`text-[10px] ${config.badge}`}>
                                  {CATEGORY_LABELS[cat] || cat}
                                </Badge>
                                {!!asset.serviceLine && (
                                  <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                                    {String(asset.serviceLine)}
                                  </Badge>
                                )}
                                {!!asset.targetIndustries && (
                                  <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                                    <Globe className="w-2.5 h-2.5 mr-0.5" />
                                    {String(asset.targetIndustries).split(',').slice(0, 2).join(', ')}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Manual save fallback if AI didn't generate assets */}
                {uploadResult.assets.length === 0 && uploadResult.extractedText && (
                  <AnimatedCard delay={0.2}>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <p className="text-xs text-amber-600 font-medium">No knowledge assets were auto-generated</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1.5"
                          onClick={() => { setActiveTab('library'); }}
                        >
                          <Database className="w-3 h-3" />
                          View Knowledge Library
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        The document text was extracted but AI couldn&apos;t identify structured knowledge assets. You can manually save the raw text, or add assets manually via the &quot;Add Asset&quot; button.
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1.5"
                          style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})`, color: '#000' }}
                          onClick={handleSaveExtracted}
                        >
                          <Database className="w-3.5 h-3.5" />
                          Save Raw Text as Knowledge Asset
                        </Button>
                      </div>
                    </div>
                  </AnimatedCard>
                )}

                {/* Action: go test the knowledge */}
                {uploadResult.assetsGenerated > 0 && (
                  <AnimatedCard delay={0.25}>
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5" style={{ color: gold }} />
                        <div>
                          <p className="text-sm font-medium text-foreground">Test your new knowledge in the RAG engine</p>
                          <p className="text-xs text-muted-foreground">Switch to the RAG Search tab to verify the uploaded knowledge is being retrieved correctly</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                        onClick={() => setActiveTab('search')}
                      >
                        <Search className="w-3.5 h-3.5" />
                        Test RAG Search
                      </Button>
                    </div>
                  </AnimatedCard>
                )}
              </motion.div>
            )}

            {/* How it works — pipeline flow */}
            <StaggerGrid className="grid grid-cols-1 md:grid-cols-4 gap-3" stagger={0.08} delay={0.2}>
              {[
                { icon: Upload, title: '1. Upload', desc: 'Drop a .txt, .md, .pdf, or .docx file (max 5MB)', color: '#D4AF37' },
                { icon: FileText, title: '2. Extract', desc: 'Text is automatically extracted from the document content', color: '#3B82F6' },
                { icon: Sparkles, title: '3. AI Analyze', desc: 'AI identifies service lines, case studies, proof points, and more', color: '#10B981' },
                { icon: Database, title: '4. Auto-Save', desc: 'Structured assets are saved to the knowledge base for RAG retrieval', color: '#8B5CF6' },
              ].map(step => (
                <StaggerItem key={step.title}>
                  <AnimatedCard className="p-4 text-center space-y-2.5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto" style={{ background: `${step.color}15` }}>
                      <step.icon className="w-5 h-5" style={{ color: step.color }} />
                    </div>
                    <p className="text-xs font-semibold text-foreground">{step.title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{step.desc}</p>
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
      <Dialog open={!!viewAsset} onOpenChange={(open) => { if (!open) { setViewAsset(null); setVersionHistory(null); } }}>
        <DialogContent className="max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
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

                {/* Version History Section */}
                <Separator className="my-2" />
                <div>
                  <button
                    onClick={() => loadVersionHistory(viewAsset.id)}
                    className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    <GitBranch className="w-4 h-4" style={{ color: gold }} />
                    Version History
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>

                  <AnimatePresence>
                    {versionLoading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2 mt-3 py-4 justify-center"
                      >
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: gold }} />
                        <span className="text-xs text-muted-foreground">Loading version history...</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {versionHistory && !versionLoading && versionHistory.history && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 overflow-hidden"
                      >
                        <div className="relative pl-6">
                          {/* Vertical timeline line */}
                          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

                          {versionHistory.history.map((entry: any, idx: number) => {
                            const isCurrent = entry.version === versionHistory.currentVersion;
                            return (
                              <motion.div
                                key={entry.version}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.08 }}
                                className="relative pb-4 last:pb-0"
                              >
                                {/* Timeline dot */}
                                <div
                                  className="absolute left-[-17px] top-1.5 w-3.5 h-3.5 rounded-full border-2"
                                  style={{
                                    borderColor: isCurrent ? gold : 'rgba(0, 0, 0, 0.06)',
                                    background: isCurrent ? `${gold}40` : 'transparent',
                                    boxShadow: isCurrent ? `0 0 8px ${gold}60` : 'none',
                                  }}
                                />

                                <div className={`p-3 rounded-lg border ${isCurrent ? 'border-primary/30 bg-primary/5' : 'border-border bg-card/50'}`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-foreground">v{entry.version}</span>
                                      {isCurrent && (
                                        <span
                                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                          style={{ background: `${gold}20`, color: gold, border: `1px solid ${gold}40` }}
                                        >
                                          CURRENT
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                      <Clock className="w-3 h-3" />
                                      {new Date(entry.updatedAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                      })}
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{entry.changes}</p>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </>
          )}
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

/* ═══════════════════════════════════════════════════
   Knowledge Graph Helpers
   ═══════════════════════════════════════════════════ */

/** Build treemap data from graph nodes, grouped by service line */
function buildTreemapData(nodes: any[]) {
  const grouped: Record<string, any[]> = {};
  nodes.forEach(node => {
    const group = node.group || 'Unassigned';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(node);
  });

  return [
    {
      name: 'Knowledge Base',
      children: Object.entries(grouped).map(([name, children]) => ({
        name,
        children: children.map((child: any) => ({
          name: child.label,
          size: Math.max(1, child.score || child.size || 1),
          category: child.category,
          id: child.id,
          node: child,
        })),
      })),
    },
  ];
}

/** Custom treemap cell renderer */
function CustomTreemapContent(props: any) {
  const { x, y, width, height, name, depth, category, node } = props;

  // Skip rendering if too small
  if (width < 40 || height < 28) return null;

  // Service line group header
  if (depth === 1) {
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="rgba(0, 0, 0, 0.02)"
          stroke="rgba(0, 0, 0, 0.05)"
          rx={6}
        />
        {width > 80 && (
          <text
            x={x + 8}
            y={y + 18}
            fill="rgba(0, 0, 0, 0.12)"
            fontSize={10}
            fontWeight={600}
          >
            {name}
          </text>
        )}
      </g>
    );
  }

  // Leaf node (asset)
  const color = GRAPH_CATEGORY_COLORS[category] || '#D4AF37';
  const opacity = 0.7 + (Math.min((node?.score || 1) / 10, 1)) * 0.3;
  const isTooSmall = width < 60 || height < 36;

  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={() => node && props.onNodeClick?.(node)}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={opacity * 0.25}
        stroke={color}
        strokeOpacity={0.4}
        strokeWidth={1}
        rx={4}
      />
      {!isTooSmall && (
        <text
          x={x + 6}
          y={y + height / 2 + 1}
          fill="rgba(0, 0, 0, 0.3)"
          fontSize={10}
          fontWeight={500}
        >
          {width > 100 && name.length > 0
            ? name.length > Math.floor((width - 12) / 6)
              ? name.slice(0, Math.floor((width - 12) / 6)) + '…'
              : name
            : ''}
        </text>
      )}
    </g>
  );
}