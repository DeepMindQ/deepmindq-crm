'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchApi } from '@/lib/fetchApi';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PageTransition,
  StaggerGrid,
  StaggerItem,
  AnimatedCard,
  GlassPanel,
} from '@/components/ui/animated-components';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  Search,
  X,
  Building2,
  Activity,
  User,
  BookOpen,
  FileText,
  ArrowRight,
  Clock,
  Filter,
  ChevronDown,
  Mail,
  Tag,
  Brain,
} from 'lucide-react';

/* ── Types ── */

interface CompanyResult {
  id: string;
  name: string;
  domain: string;
  industry: string;
  score: number;
  signals: number;
  location: string;
}

interface SignalResult {
  id: string;
  type: string;
  description: string;
  severity: 'High' | 'Medium' | 'Low';
  source: string;
  timestamp: string;
}

interface ContactResult {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
}

interface KnowledgeResult {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  date: string;
  color: string;
}

/* ── Constants ── */

const SEARCH_CATEGORIES = [
  'All',
  'Companies',
  'Signals',
  'Contacts',
  'Knowledge',
  'Briefings',
] as const;
type SearchCategory = (typeof SEARCH_CATEGORIES)[number];

const SEVERITY_CONFIG: Record<string, { color: string; bg: string }> = {
  High: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  Medium: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  Low: { color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
};

/* ── Main Component ── */

export function IntelligenceSearch() {
  const [query, setQuery] = useState('enterprise AI');
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('All');
  const [showResults, setShowResults] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyResults, setCompanyResults] = useState<CompanyResult[]>([]);
  const [signalResults, setSignalResults] = useState<SignalResult[]>([]);
  const [contactResults, setContactResults] = useState<ContactResult[]>([]);
  const [knowledgeResults, setKnowledgeResults] = useState<KnowledgeResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch knowledge folders on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchKnowledge() {
      try {
        const res = await fetchApi('/api/knowledge-folders');
        if (cancelled) return;
        if (!res.error && res.data?.nodes) {
          const nodes = res.data.nodes as Record<string, unknown>[];
          const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
          setKnowledgeResults(
            nodes.slice(0, 10).map((node, i) => ({
              id: (node.id as string) || `k-${i}`,
              title: (node.name as string) || 'Knowledge Entry',
              category: (node.industry as string) || 'Intelligence',
              excerpt: `Intelligence score: ${node.intelligenceScore ?? 'N/A'}. Tracking status: ${(node.trackingStatus as string) || 'active'}.`,
              date: new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }),
              color: colors[i % colors.length],
            })),
          );
        }
      } catch (_err) {
        // silently fail
      }
    }
    fetchKnowledge();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch recent searches from team activity
  useEffect(() => {
    let cancelled = false;
    async function fetchRecent() {
      try {
        const res = await fetchApi('/api/team-activity', {
          params: { limit: 5, action: 'search' },
        });
        if (cancelled) return;
        if (!res.error && res.data?.length > 0) {
          const activities = res.data as Record<string, unknown>[];
          const searches = activities
            .map((a) => a.details as string | undefined)
            .filter((d): d is string => !!d);
          if (searches.length > 0) {
            setRecentSearches(searches);
          }
        }
      } catch (_err) {
        // silently fail — empty state is fine
      }
    }
    fetchRecent();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced search across APIs
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setCompanyResults([]);
      setSignalResults([]);
      setContactResults([]);
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const [orgsRes, signalsRes, peopleRes] = await Promise.all([
        fetchApi('/api/organizations', {
          params: { search: searchQuery, limit: 10, status: 'all' },
        }),
        fetchApi('/api/signals', { params: { limit: 10 } }),
        fetchApi('/api/people', { params: { search: searchQuery, limit: 10 } }),
      ]);

      // Map organizations to company results
      if (!orgsRes.error && orgsRes.data?.length > 0) {
        setCompanyResults(
          (orgsRes.data as Record<string, unknown>[]).map((o) => ({
            id: (o.id as string) || '',
            name: (o.name as string) || '',
            domain: (o.domain as string) || '',
            industry: (o.industry as string) || '',
            score: (o.intelligenceScore as number) ?? 0,
            signals: (o.signalCount as number) ?? 0,
            location: '',
          })),
        );
      } else {
        setCompanyResults([]);
      }

      // Filter signals by query
      if (!signalsRes.error && signalsRes.data?.length > 0) {
        const q = searchQuery.toLowerCase();
        const filtered = (signalsRes.data as Record<string, unknown>[])
          .filter(
            (s) =>
              ((s.title as string) || '').toLowerCase().includes(q) ||
              ((s.description as string) || '').toLowerCase().includes(q) ||
              ((s.organization as Record<string, string>)?.name || '').toLowerCase().includes(q),
          )
          .slice(0, 5);
        if (filtered.length > 0) {
          setSignalResults(
            filtered.map((s) => ({
              id: (s.id as string) || `sig-${Math.random()}`,
              type: (s.signalType as string) || (s.title as string) || 'Signal',
              description: (s.description as string) || (s.title as string) || '',
              severity: ((s.severity as string)?.charAt(0).toUpperCase() +
                (s.severity as string)?.slice(1) || 'Medium') as 'High' | 'Medium' | 'Low',
              source: (s.organization as Record<string, string>)?.name || 'System',
              timestamp: s.detectedAt ? new Date(s.detectedAt as string).toLocaleString() : '',
            })),
          );
        } else {
          setSignalResults([]);
        }
      } else {
        setSignalResults([]);
      }

      // Map people to contact results
      if (!peopleRes.error && peopleRes.data?.length > 0) {
        setContactResults(
          (peopleRes.data as Record<string, unknown>[]).map((p) => ({
            id: (p.id as string) || '',
            name: (p.fullName as string) || '',
            title: (p.title as string) || '',
            company: (p.organization as Record<string, string>)?.name || '',
            email: (p.email as string) || '',
          })),
        );
      } else {
        setContactResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounce query changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (showResults) performSearch(query);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, showResults, performSearch]);

  const totalResults =
    companyResults.length + signalResults.length + contactResults.length + knowledgeResults.length;

  return (
    <PageTransition className="p-6 space-y-6">
      {/* ── Search Header ── */}
      <div className="max-w-3xl mx-auto pt-8">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
            style={{ color: 'var(--ios-text-secondary)' }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            placeholder="Search companies, signals, contacts, knowledge..."
            className="w-full h-14 pl-12 pr-12 rounded-2xl text-base outline-none transition-all focus:ring-2 focus:ring-[#3B82F6]/40"
            style={{
              color: 'var(--ios-text-primary)',
              background: 'var(--ios-bg-card)',
              border: '1px solid var(--ios-border)',
            }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setShowResults(false);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors hover:bg-[var(--ios-bg-elevated)]"
              style={{ color: 'var(--ios-text-secondary)' }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
          {SEARCH_CATEGORIES.map((cat) => {
            const isActive = cat === activeCategory;
            return (
              <motion.button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive ? 'text-white' : ''
                }`}
                style={{
                  color: isActive ? '#fff' : 'var(--ios-text-secondary)',
                  background: isActive ? '#3B82F6' : 'var(--ios-bg-card)',
                  border: `1px solid ${isActive ? '#3B82F6' : 'var(--ios-border)'}`,
                }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                {cat}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Recent Searches (shown when no query) ── */}
      <AnimatePresence>
        {!showResults && !query && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="max-w-3xl mx-auto"
          >
            <h3
              className="text-xs font-medium uppercase tracking-wider mb-3"
              style={{ color: 'var(--ios-text-secondary)' }}
            >
              Recent Searches
            </h3>
            {recentSearches.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term, i) => (
                  <motion.button
                    key={term}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04, duration: 0.25 }}
                    onClick={() => {
                      setQuery(term);
                      setShowResults(true);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
                    style={{
                      color: 'var(--ios-text-primary)',
                      background: 'var(--ios-bg-card)',
                      border: '1px solid var(--ios-border)',
                    }}
                  >
                    <Clock className="w-3 h-3" style={{ color: 'var(--ios-text-secondary)' }} />
                    {term}
                  </motion.button>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                No recent searches. Start by typing a query above.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search Results ── */}
      <AnimatePresence>
        {showResults && query && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Results Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--ios-text-primary)' }}>
                  {searching ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
                      <span style={{ color: 'var(--ios-text-secondary)' }}>Searching…</span>
                    </span>
                  ) : (
                    <>
                      <span style={{ color: '#3B82F6' }}>{totalResults}</span> results for &ldquo;
                      {query}&rdquo;
                    </>
                  )}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ios-text-secondary)' }}>
                  Searched across all intelligence data sources
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    color: 'var(--ios-text-secondary)',
                    background: 'var(--ios-bg-card)',
                    border: '1px solid var(--ios-border)',
                  }}
                >
                  <Filter className="w-3 h-3" />
                  Filters
                  <ChevronDown className="w-3 h-3" />
                </button>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    color: 'var(--ios-text-secondary)',
                    background: 'var(--ios-bg-card)',
                    border: '1px solid var(--ios-border)',
                  }}
                >
                  Sort: Relevance
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Companies Section */}
            {(activeCategory === 'All' || activeCategory === 'Companies') &&
              companyResults.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4" style={{ color: '#3B82F6' }} />
                    <h3
                      className="text-sm font-semibold"
                      style={{ color: 'var(--ios-text-primary)' }}
                    >
                      Companies
                    </h3>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{
                        color: 'var(--ios-text-secondary)',
                        background: 'var(--ios-bg-elevated)',
                      }}
                    >
                      {companyResults.length}
                    </span>
                  </div>
                  <StaggerGrid className="space-y-3" stagger={0.06}>
                    {companyResults.map((company) => (
                      <StaggerItem key={company.id || company.domain}>
                        <AnimatedCard className="p-4" delay={0}>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p
                                  className="text-sm font-semibold"
                                  style={{ color: 'var(--ios-text-primary)' }}
                                >
                                  {company.name}
                                </p>
                                <span
                                  className="text-xs"
                                  style={{ color: 'var(--ios-text-secondary)' }}
                                >
                                  {company.domain}
                                </span>
                              </div>
                              <div
                                className="flex items-center gap-3 text-xs"
                                style={{ color: 'var(--ios-text-secondary)' }}
                              >
                                <span>{company.industry}</span>
                                <span>·</span>
                                <span>{company.location}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div>
                                <p
                                  className="text-[11px] mb-1"
                                  style={{ color: 'var(--ios-text-secondary)' }}
                                >
                                  Intel Score
                                </p>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-24 h-2 rounded-full"
                                    style={{ background: 'var(--ios-bg-elevated)' }}
                                  >
                                    <motion.div
                                      className="h-full rounded-full"
                                      style={{
                                        background:
                                          company.score >= 90
                                            ? '#10B981'
                                            : company.score >= 80
                                              ? '#3B82F6'
                                              : '#F59E0B',
                                      }}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${company.score}%` }}
                                      transition={{ duration: 0.8, ease: 'easeOut' }}
                                    />
                                  </div>
                                  <span
                                    className="text-xs font-semibold tabular-nums"
                                    style={{ color: 'var(--ios-text-primary)' }}
                                  >
                                    {company.score}
                                  </span>
                                </div>
                              </div>
                              <div className="text-center">
                                <p
                                  className="text-[11px]"
                                  style={{ color: 'var(--ios-text-secondary)' }}
                                >
                                  Signals
                                </p>
                                <p className="text-sm font-semibold" style={{ color: '#3B82F6' }}>
                                  {company.signals}
                                </p>
                              </div>
                              <button
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.1)' }}
                              >
                                View
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </AnimatedCard>
                      </StaggerItem>
                    ))}
                  </StaggerGrid>
                </div>
              )}

            {/* Signals Section */}
            {(activeCategory === 'All' || activeCategory === 'Signals') &&
              signalResults.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4" style={{ color: '#F59E0B' }} />
                    <h3
                      className="text-sm font-semibold"
                      style={{ color: 'var(--ios-text-primary)' }}
                    >
                      Signals
                    </h3>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{
                        color: 'var(--ios-text-secondary)',
                        background: 'var(--ios-bg-elevated)',
                      }}
                    >
                      {signalResults.length}
                    </span>
                  </div>
                  <StaggerGrid className="space-y-3" stagger={0.06}>
                    {signalResults.map((signal) => {
                      const sev = SEVERITY_CONFIG[signal.severity];
                      return (
                        <StaggerItem key={signal.id}>
                          <AnimatedCard className="p-4" delay={0}>
                            <div className="flex items-start gap-3">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                style={{ background: `${sev.color}15` }}
                              >
                                <Activity className="w-4 h-4" style={{ color: sev.color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span
                                    className="text-sm font-medium"
                                    style={{ color: 'var(--ios-text-primary)' }}
                                  >
                                    {signal.type}
                                  </span>
                                  <span
                                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                    style={{ color: sev.color, background: sev.bg }}
                                  >
                                    {signal.severity}
                                  </span>
                                </div>
                                <p
                                  className="text-xs leading-relaxed"
                                  style={{ color: 'var(--ios-text-secondary)' }}
                                >
                                  {signal.description}
                                </p>
                                <div
                                  className="flex items-center gap-3 mt-2 text-[11px]"
                                  style={{ color: 'var(--ios-text-secondary)', opacity: 0.7 }}
                                >
                                  <span>{signal.source}</span>
                                  <span>·</span>
                                  <span>{signal.timestamp}</span>
                                </div>
                              </div>
                            </div>
                          </AnimatedCard>
                        </StaggerItem>
                      );
                    })}
                  </StaggerGrid>
                </div>
              )}

            {/* Contacts Section */}
            {(activeCategory === 'All' || activeCategory === 'Contacts') &&
              contactResults.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4" style={{ color: '#10B981' }} />
                    <h3
                      className="text-sm font-semibold"
                      style={{ color: 'var(--ios-text-primary)' }}
                    >
                      Contacts
                    </h3>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{
                        color: 'var(--ios-text-secondary)',
                        background: 'var(--ios-bg-elevated)',
                      }}
                    >
                      {contactResults.length}
                    </span>
                  </div>
                  <StaggerGrid className="space-y-3" stagger={0.06}>
                    {contactResults.map((contact) => (
                      <StaggerItem key={contact.id || contact.email}>
                        <AnimatedCard className="p-4" delay={0}>
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                              style={{ color: '#10B981', background: 'rgba(16,185,129,0.15)' }}
                            >
                              {(contact.name || '')
                                .split(' ')
                                .map((n: string) => n[0])
                                .join('')
                                .slice(0, 2)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm font-medium"
                                style={{ color: 'var(--ios-text-primary)' }}
                              >
                                {contact.name}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                                {contact.title} · {contact.company}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className="text-xs"
                                style={{ color: 'var(--ios-text-secondary)' }}
                              >
                                {contact.email}
                              </span>
                              <button
                                className="p-2 rounded-lg transition-colors"
                                style={{ color: 'var(--ios-text-secondary)' }}
                              >
                                <Mail className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </AnimatedCard>
                      </StaggerItem>
                    ))}
                  </StaggerGrid>
                </div>
              )}

            {/* Knowledge Section */}
            {(activeCategory === 'All' ||
              activeCategory === 'Knowledge' ||
              activeCategory === 'Briefings') &&
              knowledgeResults.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4" style={{ color: '#8B5CF6' }} />
                    <h3
                      className="text-sm font-semibold"
                      style={{ color: 'var(--ios-text-primary)' }}
                    >
                      Knowledge
                    </h3>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{
                        color: 'var(--ios-text-secondary)',
                        background: 'var(--ios-bg-elevated)',
                      }}
                    >
                      {knowledgeResults.length}
                    </span>
                  </div>
                  <StaggerGrid className="space-y-3" stagger={0.06}>
                    {knowledgeResults.map((article) => (
                      <StaggerItem key={article.id}>
                        <AnimatedCard className="p-4" delay={0}>
                          <div className="flex items-start gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                              style={{ background: `${article.color}15` }}
                            >
                              <FileText className="w-4 h-4" style={{ color: article.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm font-medium mb-1"
                                style={{ color: 'var(--ios-text-primary)' }}
                              >
                                {article.title}
                              </p>
                              <p
                                className="text-xs leading-relaxed mb-2"
                                style={{ color: 'var(--ios-text-secondary)' }}
                              >
                                {article.excerpt}
                              </p>
                              <div
                                className="flex items-center gap-3 text-[11px]"
                                style={{ color: 'var(--ios-text-secondary)', opacity: 0.7 }}
                              >
                                <span className="flex items-center gap-1">
                                  <Tag className="w-3 h-3" />
                                  {article.category}
                                </span>
                                <span>·</span>
                                <span>{article.date}</span>
                              </div>
                            </div>
                          </div>
                        </AnimatedCard>
                      </StaggerItem>
                    ))}
                  </StaggerGrid>
                </div>
              )}

            {/* Empty state when no results */}
            {!searching && totalResults === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <Search className="w-10 h-10 mb-3" style={{ color: 'var(--ios-text-secondary)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--ios-text-primary)' }}>
                  No results found
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--ios-text-secondary)' }}>
                  Try adjusting your search or filters
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
