'use client';

import { tokens } from '@/components/intelligence-os/design-tokens';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Cpu, Building2, BookOpen, ArrowRight, Loader2,
  CheckCircle2, Brain, Zap, Plus, FileSpreadsheet, Database,
  Link2, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';

/* ═══════════════════════════════════════════════════
   Activation Workspace
   "Teach DeepMindQ" — not a wizard, an intelligence relationship
   Always-available, not one-time setup
   ═══════════════════════════════════════════════════ */

interface IntelligenceCounts {
  capabilities: number;
  accounts: number;
  signals: number;
  knowledge: number;
}

interface UploadResult {
  success?: boolean;
  count?: number;
  message?: string;
  capabilitiesCreated?: number;
  accountsCreated?: number;
}

export function ActivationWorkspace() {
  const { intelligenceActivated, setActiveView, setIntelligenceActivated } = useAppStore();
  const [counts, setCounts] = useState<IntelligenceCounts>({ capabilities: 0, accounts: 0, signals: 0, knowledge: 0 });
  const [uploadingChannel, setUploadingChannel] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<Record<string, UploadResult>>({});
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchCounts = useCallback(async () => {
    try {
      const [capRes, compRes, sigRes] = await Promise.all([
        fetch('/api/capabilities'),
        fetch('/api/companies?limit=1'),
        fetch('/api/signals'),
      ]);
      const capData = await capRes.json();
      const compData = await compRes.json();
      const sigData = await sigRes.json();
      setCounts({
        capabilities: Array.isArray(capData) ? capData.length : capData.data?.length ?? 0,
        accounts: compData.stats?.total ?? compData.total ?? (Array.isArray(compData.data) ? compData.data.length : 0),
        signals: Array.isArray(sigData) ? sigData.length : sigData.data?.length ?? 0,
        knowledge: 0,
      });
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const handleFileUpload = async (channel: string, file: File) => {
    setUploadingChannel(channel);
    setError(null);
    try {
      const endpoint = channel === 'capabilities' ? '/api/capabilities/import' : '/api/imports';
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setUploadResults(prev => ({ ...prev, [channel]: { success: true, count: data.capabilitiesCreated ?? data.accountsCreated ?? data.count ?? 0, message: data.message } }));
      await fetchCounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploadResults(prev => ({ ...prev, [channel]: { success: false, message: err instanceof Error ? err.message : 'Upload failed' } }));
    } finally {
      setUploadingChannel(null);
    }
  };

  const canActivate = counts.capabilities > 0 && counts.accounts > 0;

  const handleActivate = () => {
    setIntelligenceActivated(true);
    setActiveView('intelligence-briefing');
  };

  const channels = [
    { key: 'capabilities', label: 'Capabilities', description: 'Upload services, solutions, case studies, proof points', icon: Cpu, accept: '.json,.csv' },
    { key: 'accounts', label: 'Accounts', description: 'Upload strategic accounts for intelligence analysis', icon: Building2, accept: '.json,.csv,.xlsx' },
    { key: 'knowledge', label: 'Knowledge', description: 'Upload documents, proposals, win/loss learning, market information', icon: BookOpen, accept: '.json,.csv,.pdf,.docx', disabled: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {intelligenceActivated ? 'Expand Intelligence' : 'Activate Intelligence'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {intelligenceActivated
              ? 'Add new data to make the intelligence engine smarter.'
              : 'Teach DeepMindQ about your business. Upload capabilities and accounts.'}
          </p>
        </div>
        {intelligenceActivated && (
          <Button variant="outline" size="sm" onClick={() => setActiveView('command-center')} className="gap-1.5 text-xs">
            <Brain className="w-3.5 h-3.5" />
            Command Center
          </Button>
        )}
      </div>

      {/* Intelligence Status Bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="section-container p-4"
      >
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">DeepMindQ understands:</span>
          </div>
          {[
            { label: 'Capabilities', value: counts.capabilities, color: tokens.extended.purple.value },
            { label: 'Accounts', value: counts.accounts, color: tokens.accent.dim },
            { label: 'Signals', value: counts.signals, color: tokens.domain.reasoning },
            { label: 'Knowledge', value: counts.knowledge, color: tokens.domain.enrichment },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className={`text-sm font-semibold tabular-nums ${item.value > 0 ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                {item.value}
              </span>
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
          {canActivate && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-auto">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                Ready to activate
              </span>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Upload Channels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {channels.map((ch, i) => {
          const Icon = ch.icon;
          const isUploading = uploadingChannel === ch.key;
          const result = uploadResults[ch.key];
          return (
            <motion.div
              key={ch.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <div
                className={`section-container p-5 h-full ${ch.disabled ? 'opacity-50 cursor-not-allowed' : 'card-interactive cursor-pointer'}`}
                onClick={() => {
                  if (ch.disabled || isUploading) return;
                  fileInputRefs.current[ch.key]?.click();
                }}
              >
                <div className="flex items-start gap-3.5 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{ch.label}</h3>
                      {isUploading && (
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="text-[10px] text-primary font-medium"
                        >
                          Processing...
                        </motion.span>
                      )}
                      {ch.disabled && (
                        <span className="text-[10px] text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded">Coming soon</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{ch.description}</p>
                  </div>
                </div>

                {/* Upload result feedback */}
                {result && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={`text-xs px-3 py-2 rounded-lg mt-2 ${result.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}
                  >
                    {result.success
                      ? `Processed: ${result.count} records`
                      : result.message || 'Upload failed'}
                  </motion.div>
                )}

                {!ch.disabled && !isUploading && (
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
                    <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Upload {ch.accept.split(',').join(', ')}
                    </span>
                  </div>
                )}

                <input
                  ref={(el) => { fileInputRefs.current[ch.key] = el; }}
                  type="file"
                  accept={ch.accept}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(ch.key, file);
                    e.target.value = '';
                  }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-xl text-xs bg-red-50 text-red-600 border border-red-100"
        >
          {error}
        </motion.div>
      )}

      {/* Activate Button */}
      <AnimatePresence>
        {canActivate && !intelligenceActivated && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex justify-center pt-4"
          >
            <Button onClick={handleActivate} size="lg" className="gap-2 px-8">
              <Zap className="w-4 h-4" />
              Activate Intelligence
              <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Already activated notice */}
      {intelligenceActivated && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center pt-2 pb-4"
        >
          <p className="text-xs text-muted-foreground">
            Intelligence is active. Continue adding data to expand your intelligence coverage.
          </p>
        </motion.div>
      )}
    </div>
  );
}
