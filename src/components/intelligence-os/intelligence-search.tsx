'use client';

import { useState } from 'react';
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

/* ── Constants & Mock Data ── */

const SEARCH_CATEGORIES = [
  'All',
  'Companies',
  'Signals',
  'Contacts',
  'Knowledge',
  'Briefings',
] as const;
type SearchCategory = (typeof SEARCH_CATEGORIES)[number];

const RECENT_SEARCHES = [
  'enterprise AI adoption',
  'Series C funding Q3 2026',
  'fintech compliance requirements',
  'VP Engineering hiring trends',
  'Kubernetes migration signals',
  'Acme Corporation intelligence',
];

const COMPANY_RESULTS = [
  {
    name: 'Anthropic AI',
    domain: 'anthropic.com',
    industry: 'AI/ML',
    score: 94,
    signals: 18,
    location: 'San Francisco, CA',
  },
  {
    name: 'Databricks Inc.',
    domain: 'databricks.com',
    industry: 'Data & Analytics',
    score: 89,
    signals: 12,
    location: 'San Francisco, CA',
  },
  {
    name: 'Cohere Technologies',
    domain: 'cohere.com',
    industry: 'Enterprise AI',
    score: 76,
    signals: 7,
    location: 'Toronto, ON',
  },
];

const SIGNAL_RESULTS = [
  {
    type: 'Funding',
    description:
      'Anthropic closes $2B Series D at $18.5B valuation, focused on enterprise AI safety research expansion.',
    severity: 'High' as const,
    source: 'SEC Filing',
    timestamp: '6 hours ago',
  },
  {
    type: 'Technology',
    description:
      'Databricks announced MosaicML integration into enterprise platform, signaling consolidation in AI infrastructure.',
    severity: 'Medium' as const,
    source: 'TechCrunch',
    timestamp: '1 day ago',
  },
  {
    type: 'Hiring',
    description:
      'Cohere hiring 15 enterprise sales reps across North America, indicating go-to-market expansion phase.',
    severity: 'Medium' as const,
    source: 'LinkedIn Jobs',
    timestamp: '2 days ago',
  },
];

const CONTACT_RESULTS = [
  {
    name: 'Dr. Amanda Foster',
    title: 'VP of Enterprise AI',
    company: 'Anthropic AI',
    email: 'amanda.foster@anthropic.com',
  },
  {
    name: 'Raj Patel',
    title: 'Head of Partnerships',
    company: 'Databricks Inc.',
    email: 'raj.patel@databricks.com',
  },
];

const KNOWLEDGE_RESULTS = [
  {
    title: 'Enterprise AI Adoption Trends in 2026',
    category: 'Market Intelligence',
    excerpt:
      'Comprehensive analysis of enterprise AI adoption patterns, budget allocation trends, and implementation challenges across Fortune 500 companies.',
    date: 'Aug 12, 2026',
    color: '#3B82F6',
  },
  {
    title: 'AI Infrastructure Build vs. Buy Decision Framework',
    category: 'Technology Radar',
    excerpt:
      'Decision matrix for enterprise teams evaluating whether to build custom AI infrastructure or adopt third-party platforms.',
    date: 'Aug 8, 2026',
    color: '#8B5CF6',
  },
];

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
            <div className="flex flex-wrap gap-2">
              {RECENT_SEARCHES.map((term, i) => (
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
                  <span style={{ color: '#3B82F6' }}>127</span> results for &ldquo;{query}&rdquo;
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
            {(activeCategory === 'All' || activeCategory === 'Companies') && (
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
                    3
                  </span>
                </div>
                <StaggerGrid className="space-y-3" stagger={0.06}>
                  {COMPANY_RESULTS.map((company) => (
                    <StaggerItem key={company.domain}>
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
            {(activeCategory === 'All' || activeCategory === 'Signals') && (
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
                    3
                  </span>
                </div>
                <StaggerGrid className="space-y-3" stagger={0.06}>
                  {SIGNAL_RESULTS.map((signal, i) => {
                    const sev = SEVERITY_CONFIG[signal.severity];
                    return (
                      <StaggerItem key={i}>
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
            {(activeCategory === 'All' || activeCategory === 'Contacts') && (
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
                    2
                  </span>
                </div>
                <StaggerGrid className="space-y-3" stagger={0.06}>
                  {CONTACT_RESULTS.map((contact) => (
                    <StaggerItem key={contact.email}>
                      <AnimatedCard className="p-4" delay={0}>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                            style={{ color: '#10B981', background: 'rgba(16,185,129,0.15)' }}
                          >
                            {contact.name
                              .split(' ')
                              .map((n) => n[0])
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
              activeCategory === 'Briefings') && (
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
                    2
                  </span>
                </div>
                <StaggerGrid className="space-y-3" stagger={0.06}>
                  {KNOWLEDGE_RESULTS.map((article) => (
                    <StaggerItem key={article.title}>
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
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
