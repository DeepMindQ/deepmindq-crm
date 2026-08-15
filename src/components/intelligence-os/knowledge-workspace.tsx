'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '@/lib/fetchApi';
import { motion } from 'framer-motion';
import { PageTransition, StatCard, GlassPanel } from '@/components/ui/animated-components';

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

/* ── Types ── */

interface KnowledgeFolder {
  id: string;
  name: string;
  count: number;
  lastUpdated: string;
  iconName: string;
  color: string;
}

interface KnowledgeNode {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
}

interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
}

interface ActivityItem {
  user: string;
  action: string;
  target: string;
  time: string;
  color: string;
}

interface KgStats {
  totalNodes?: number;
  totalEdges?: number;
}

const ICON_MAP: Record<string, typeof TrendingUp> = {
  TrendingUp,
  BarChart3,
  Lightbulb,
  Shield,
  Eye,
  FolderOpen,
};

const QUICK_ACTIONS = [
  { label: 'New Article', icon: FileText, color: '#3B82F6' },
  { label: 'New Briefing', icon: BookOpen, color: '#10B981' },
  { label: 'New Note', icon: StickyNote, color: '#F59E0B' },
  { label: 'Import Content', icon: Upload, color: '#8B5CF6' },
];

/* ── Main Component ── */

export function KnowledgeWorkspace() {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [folders, setFolders] = useState<KnowledgeFolder[]>([]);
  const [_kgNodes, setKgNodes] = useState<KnowledgeNode[]>([]);
  const [_kgEdges, setKgEdges] = useState<KnowledgeEdge[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [kgStats, setKgStats] = useState<KgStats | null>(null);

  const fetchAllData = useCallback(async () => {
    let cancelled = false;
    try {
      setLoading(true);
      setError(null);

      const [foldersRes, activityRes, statsRes] = await Promise.all([
        fetchApi('/api/knowledge-folders'),
        fetchApi('/api/team-activity', { params: { limit: 8 } }),
        fetchApi('/api/knowledge-graph/stats'),
      ]);

      if (cancelled) return;

      // Process folders + graph data
      if (!foldersRes.error && foldersRes.data) {
        const payload = foldersRes.data as {
          folders?: {
            id: string;
            name: string;
            count: number;
            lastUpdated: string;
            iconName: string;
            color: string;
          }[];
          nodes?: KnowledgeNode[];
          edges?: KnowledgeEdge[];
        };
        if (payload.folders?.length) {
          setFolders(payload.folders);
        }
        if (payload.nodes?.length) {
          setKgNodes(payload.nodes);
        }
        if (payload.edges?.length) {
          setKgEdges(payload.edges);
        }
      }

      // Process activity data
      if (!activityRes.error && activityRes.data) {
        const activityPayload = activityRes.data as {
          data?: ActivityItem[];
        };
        if (activityPayload.data?.length) {
          setActivity(activityPayload.data);
        }
      }

      // Process stats
      if (!statsRes.error && statsRes.data) {
        const statsPayload = statsRes.data as { data?: KgStats };
        if (statsPayload.data) {
          setKgStats(statsPayload.data);
        }
      }
    } catch (err) {
      if (!cancelled)
        setError(err instanceof Error ? err.message : 'Failed to load knowledge workspace');
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const res = await fetchApi('/api/knowledge-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName.trim(),
          color: '#3B82F6',
          icon: 'folder',
        }),
      });
      if (!res.error) {
        setNewFolderName('');
        setShowNewFolderDialog(false);
        fetchAllData();
      }
    } catch {
      // Silent fail
    } finally {
      setCreatingFolder(false);
    }
  }, [newFolderName, fetchAllData]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Derive stats from API data
  const articleCount = kgStats?.totalNodes ?? (folders.reduce((sum, f) => sum + f.count, 0) || 0);
  const briefingCount = kgStats?.totalEdges ?? 0;
  const researchNoteCount = folders.reduce((sum, f) => sum + f.count, 0);
  const contributorCount = new Set(activity.map((a) => a.user)).size || 0;

  return (
    <div role="region" aria-label="Knowledge Workspace">
      <PageTransition className="p-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm" style={{ color: 'var(--ios-text-secondary)' }}>
                Loading knowledge workspace…
              </span>
            </div>
          </div>
        )}
        {!loading && (
          <>
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
              <div aria-label={`Knowledge Articles: ${articleCount}`}>
                <StatCard
                  label="Knowledge Articles"
                  value={articleCount}
                  icon={FileText}
                  color="#3B82F6"
                />
              </div>
              <div aria-label={`Briefings Generated: ${briefingCount}`}>
                <StatCard
                  label="Briefings Generated"
                  value={briefingCount}
                  icon={BookOpen}
                  color="#10B981"
                />
              </div>
              <div aria-label={`Research Notes: ${researchNoteCount}`}>
                <StatCard
                  label="Research Notes"
                  value={researchNoteCount}
                  icon={StickyNote}
                  color="#F59E0B"
                />
              </div>
              <div aria-label={`Contributors: ${contributorCount}`}>
                <StatCard
                  label="Contributors"
                  value={contributorCount}
                  icon={Users}
                  color="#8B5CF6"
                />
              </div>
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
                      <h2
                        className="text-sm font-semibold"
                        style={{ color: 'var(--ios-text-primary)' }}
                      >
                        Knowledge Base
                      </h2>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--ios-text-secondary)' }}>
                        {folders.length} categories · {articleCount} total items
                      </p>
                    </div>
                    <button
                      onClick={() => setShowNewFolderDialog(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.1)' }}
                    >
                      <Plus className="w-3 h-3" />
                      New Category
                    </button>
                    {showNewFolderDialog && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="rounded-xl p-5 w-full max-w-sm mx-4"
                          style={{
                            background: 'var(--ios-bg-card)',
                            border: '1px solid var(--ios-border)',
                          }}
                        >
                          <h3
                            className="text-sm font-semibold mb-3"
                            style={{ color: 'var(--ios-text-primary)' }}
                          >
                            New Knowledge Category
                          </h3>
                          <input
                            type="text"
                            autoFocus
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCreateFolder();
                              if (e.key === 'Escape') setShowNewFolderDialog(false);
                            }}
                            placeholder="Folder name..."
                            className="w-full h-9 px-3 rounded-lg text-sm outline-none transition-all focus:ring-2 focus:ring-[#3B82F6]/40"
                            style={{
                              color: 'var(--ios-text-primary)',
                              background: 'var(--ios-bg-secondary)',
                              border: '1px solid var(--ios-border)',
                            }}
                            disabled={creatingFolder}
                          />
                          <div className="flex items-center justify-end gap-2 mt-4">
                            <button
                              onClick={() => {
                                setShowNewFolderDialog(false);
                                setNewFolderName('');
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                              style={{
                                color: 'var(--ios-text-secondary)',
                                background: 'var(--ios-bg-secondary)',
                              }}
                              disabled={creatingFolder}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleCreateFolder}
                              disabled={creatingFolder || !newFolderName.trim()}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                              style={{ color: '#fff', background: '#3B82F6' }}
                            >
                              {creatingFolder ? (
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Plus className="w-3 h-3" />
                              )}
                              Create
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </div>
                  {folders.length > 0 ? (
                    <div
                      className="divide-y"
                      style={{
                        ['--tw-divide-opacity' as string]: '1',
                        ['--tw-divide-color' as string]: 'var(--ios-border)',
                      }}
                    >
                      {folders.map((folder, i) => {
                        const Icon = ICON_MAP[folder.iconName] ?? FolderOpen;
                        const isSelected = selectedFolder === folder.id;
                        return (
                          <motion.button
                            key={folder.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05, duration: 0.3 }}
                            onClick={() => setSelectedFolder(isSelected ? null : folder.id)}
                            aria-label={`${folder.name} folder, ${folder.count} items`}
                            className="w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-[var(--ios-bg-elevated)]"
                            style={{
                              borderBottom:
                                i < folders.length - 1 ? '1px solid var(--ios-border)' : 'none',
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
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                      <FolderOpen
                        className="w-10 h-10 mb-3"
                        style={{ color: 'var(--ios-text-secondary)', opacity: 0.4 }}
                      />
                      <p className="text-sm" style={{ color: 'var(--ios-text-secondary)' }}>
                        No knowledge folders yet
                      </p>
                    </div>
                  )}
                </GlassPanel>
              </div>

              {/* Right: Recent Activity Feed (2 cols) */}
              <div className="xl:col-span-2">
                <GlassPanel className="p-0 overflow-hidden">
                  <div
                    className="px-5 py-4 border-b"
                    style={{ borderBottomColor: 'var(--ios-border)' }}
                  >
                    <h2
                      className="text-sm font-semibold"
                      style={{ color: 'var(--ios-text-primary)' }}
                    >
                      Recent Activity
                    </h2>
                  </div>
                  <div className="max-h-[520px] overflow-y-auto">
                    {activity.length > 0 ? (
                      <div
                        className="divide-y"
                        style={{
                          ['--tw-divide-opacity' as string]: '1',
                          ['--tw-divide-color' as string]: 'var(--ios-border)',
                        }}
                      >
                        {activity.map((item, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05, duration: 0.3 }}
                            className="px-5 py-3.5"
                          >
                            <p className="text-xs leading-relaxed">
                              <span
                                className="font-medium"
                                style={{ color: 'var(--ios-text-primary)' }}
                              >
                                {item.user}
                              </span>{' '}
                              <span style={{ color: 'var(--ios-text-secondary)' }}>
                                {item.action}
                              </span>{' '}
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
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16">
                        <Clock
                          className="w-10 h-10 mb-3"
                          style={{ color: 'var(--ios-text-secondary)', opacity: 0.4 }}
                        />
                        <p className="text-sm" style={{ color: 'var(--ios-text-secondary)' }}>
                          No recent activity
                        </p>
                      </div>
                    )}
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
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'var(--ios-text-primary)' }}
                      >
                        {action.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </GlassPanel>
          </>
        )}
      </PageTransition>
    </div>
  );
}
