'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PageTransition,
  StatCard,
  StaggerGrid,
  StaggerItem,
  AnimatedCard,
  GlassPanel,
} from '@/components/ui/animated-components';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  BookOpen,
  FileText,
  StickyNote,
  Users,
  Plus,
  Upload,
  ChevronRight,
  FolderOpen,
  TrendingUp,
  BarChart3,
  Shield,
  Lightbulb,
  Eye,
  Clock,
} from 'lucide-react';

/* ── Mock Data ── */

const FOLDERS_DATA = [
  {
    id: 'market',
    name: 'Market Intelligence',
    count: 87,
    lastUpdated: '2 hours ago',
    icon: TrendingUp,
    color: '#3B82F6',
  },
  {
    id: 'competitive',
    name: 'Competitive Analysis',
    count: 64,
    lastUpdated: '5 hours ago',
    icon: BarChart3,
    color: '#EF4444',
  },
  {
    id: 'industry',
    name: 'Industry Trends',
    count: 52,
    lastUpdated: '1 day ago',
    icon: TrendingUp,
    color: '#10B981',
  },
  {
    id: 'technology',
    name: 'Technology Radar',
    count: 41,
    lastUpdated: '3 hours ago',
    icon: Lightbulb,
    color: '#8B5CF6',
  },
  {
    id: 'regulatory',
    name: 'Regulatory Updates',
    count: 38,
    lastUpdated: '6 hours ago',
    icon: Shield,
    color: '#F59E0B',
  },
  {
    id: 'customer',
    name: 'Customer Insights',
    count: 60,
    lastUpdated: '4 hours ago',
    icon: Eye,
    color: '#06B6D4',
  },
];

const ACTIVITY_DATA = [
  {
    user: 'Sarah K.',
    action: 'published briefing',
    target: "'Q3 Market Analysis'",
    time: '12 min ago',
    color: '#3B82F6',
  },
  {
    user: 'System',
    action: 'New article:',
    target: "'AI Adoption Trends in FinTech'",
    time: '28 min ago',
    color: '#8B5CF6',
  },
  {
    user: 'Mike R.',
    action: 'updated research note',
    target: "'Enterprise Buyer Behavior Shift'",
    time: '1 hour ago',
    color: '#10B981',
  },
  {
    user: 'Sarah K.',
    action: 'created category',
    target: "'Regulatory Updates'",
    time: '2 hours ago',
    color: '#F59E0B',
  },
  {
    user: 'AI Engine',
    action: 'auto-generated summary',
    target: "'Weekly Competitive Digest'",
    time: '3 hours ago',
    color: '#06B6D4',
  },
  {
    user: 'James L.',
    action: 'imported 12 articles',
    target: 'from CRM integration',
    time: '4 hours ago',
    color: '#EF4444',
  },
  {
    user: 'System',
    action: 'Briefing completed:',
    target: "'SaaS Market Intelligence Report'",
    time: '5 hours ago',
    color: '#3B82F6',
  },
  {
    user: 'Mike R.',
    action: 'archived 5 outdated articles',
    target: 'from Technology Radar',
    time: '6 hours ago',
    color: '#8B5CF6',
  },
];

const QUICK_ACTIONS = [
  { label: 'New Article', icon: FileText, color: '#3B82F6' },
  { label: 'New Briefing', icon: BookOpen, color: '#10B981' },
  { label: 'New Note', icon: StickyNote, color: '#F59E0B' },
  { label: 'Import Content', icon: Upload, color: '#8B5CF6' },
];

/* ── Main Component ── */

export function KnowledgeWorkspace() {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  return (
    <PageTransition className="p-6 space-y-6">
      {/* ── Header ── */}
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--ios-text-primary)' }}
        >
          Knowledge Workspace
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ios-text-secondary)' }}>
          Organize findings, create intelligence briefings &amp; manage knowledge assets
        </p>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Knowledge Articles" value={342} icon={FileText} color="#3B82F6" />
        <StatCard label="Briefings Generated" value={89} icon={BookOpen} color="#10B981" />
        <StatCard label="Research Notes" value={1567} icon={StickyNote} color="#F59E0B" />
        <StatCard label="Contributors" value={24} icon={Users} color="#8B5CF6" />
      </div>

      {/* ── Main 2-Column Layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Left: Knowledge Base Browser (3 cols) */}
        <div className="xl:col-span-3">
          <GlassPanel className="p-0 overflow-hidden">
            <div
              className="px-5 py-4 flex items-center justify-between border-b"
              style={{ borderBottomColor: 'var(--ios-border)' }}
            >
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--ios-text-primary)' }}>
                  Knowledge Base
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ios-text-secondary)' }}>
                  6 categories · 342 total items
                </p>
              </div>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.1)' }}
              >
                <Plus className="w-3 h-3" />
                New Category
              </button>
            </div>
            <div
              className="divide-y"
              style={{
                ['--tw-divide-opacity' as string]: '1',
                ['--tw-divide-color' as string]: 'var(--ios-border)',
              }}
            >
              {FOLDERS_DATA.map((folder, i) => {
                const Icon = folder.icon;
                const isSelected = selectedFolder === folder.id;
                return (
                  <motion.button
                    key={folder.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    onClick={() => setSelectedFolder(isSelected ? null : folder.id)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-[var(--ios-bg-elevated)]"
                    style={{
                      borderBottom:
                        i < FOLDERS_DATA.length - 1 ? '1px solid var(--ios-border)' : 'none',
                      background: isSelected ? 'var(--ios-bg-elevated)' : undefined,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${folder.color}15` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: folder.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium"
                        style={{ color: 'var(--ios-text-primary)' }}
                      >
                        {folder.name}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                        {folder.count} items
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: 'var(--ios-text-secondary)' }}
                      >
                        <Clock className="w-3 h-3" />
                        {folder.lastUpdated}
                      </span>
                      <ChevronRight
                        className="w-4 h-4 transition-transform"
                        style={{
                          color: 'var(--ios-text-secondary)',
                          transform: isSelected ? 'rotate(90deg)' : 'rotate(0deg)',
                        }}
                      />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </GlassPanel>
        </div>

        {/* Right: Recent Activity Feed (2 cols) */}
        <div className="xl:col-span-2">
          <GlassPanel className="p-0 overflow-hidden">
            <div className="px-5 py-4 border-b" style={{ borderBottomColor: 'var(--ios-border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--ios-text-primary)' }}>
                Recent Activity
              </h2>
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              <div
                className="divide-y"
                style={{
                  ['--tw-divide-opacity' as string]: '1',
                  ['--tw-divide-color' as string]: 'var(--ios-border)',
                }}
              >
                {ACTIVITY_DATA.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    className="px-5 py-3.5"
                  >
                    <p className="text-xs leading-relaxed">
                      <span className="font-medium" style={{ color: 'var(--ios-text-primary)' }}>
                        {item.user}
                      </span>{' '}
                      <span style={{ color: 'var(--ios-text-secondary)' }}>{item.action}</span>{' '}
                      <span className="font-medium" style={{ color: item.color }}>
                        {item.target}
                      </span>
                    </p>
                    <p
                      className="text-[11px] mt-1"
                      style={{ color: 'var(--ios-text-secondary)', opacity: 0.6 }}
                    >
                      {item.time}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* ── Bottom: Quick Create Bar ── */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--ios-text-primary)' }}>
            Quick Create
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.06, duration: 0.3 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                style={{
                  background: 'var(--ios-bg-secondary)',
                  border: '1px solid var(--ios-border)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${action.color}15` }}
                >
                  <Icon className="w-4 h-4" style={{ color: action.color }} />
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--ios-text-primary)' }}>
                  {action.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </GlassPanel>
    </PageTransition>
  );
}
