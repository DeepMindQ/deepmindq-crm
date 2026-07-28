'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Cpu, Building2, BookOpen, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IntelligenceCounts {
  capabilities: number;
  accounts: number;
  signals: number;
}

interface CompanyBrief {
  id: string;
  name: string;
  signalCount: number;
  topSignal: string;
  intelligenceScore: number;
}

interface UploadResult {
  capabilitiesCreated?: number;
  accountsCreated?: number;
  message?: string;
}

export function ActivationWorkspace() {
  const [counts, setCounts] = useState<IntelligenceCounts>({ capabilities: 0, accounts: 0, signals: 0 });
  const [uploadingChannel, setUploadingChannel] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<Record<string, UploadResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [briefing, setBriefing] = useState<{ companies: CompanyBrief[]; totalSignals: number } | null>(null);
  const [showBriefing, setShowBriefing] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchCounts = useCallback(async () => {
    try {
      const [capRes, compRes] = await Promise.all([
        fetch('/api/capabilities'),
        fetch('/api/companies?limit=1'),
      ]);
      const capData = await capRes.json();
      const compData = await compRes.json();
      const capCount = Array.isArray(capData) ? capData.length : capData.data?.length ?? 0;
      const compCount = compData.stats?.total ?? compData.total ?? (Array.isArray(compData.data) ? compData.data.length : 0);
      setCounts({
        capabilities: capCount,
        accounts: compCount,
        signals: 0,
      });
    } catch {
      // Silent fail on count fetch
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

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
      setUploadResults((prev) => ({ ...prev, [channel]: data }));
      await fetchCounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingChannel(null);
    }
  };

  const handleActivateIntelligence = async () => {
    setEnriching(true);
    setError(null);
    try {
      const compRes = await fetch('/api/companies?limit=100');
      const compData = await compRes.json();
      const companies = compData.data ?? compData ?? [];
      const ids = companies.map((c: any) => c.id).filter(Boolean);
      if (ids.length === 0) {
        setError('No accounts found to enrich.');
        setEnriching(false);
        return;
      }
      const enrichRes = await fetch('/api/intelligence/enrich-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyIds: ids }),
      });
      if (!enrichRes.ok) throw new Error('Enrichment failed');
      const enrichData = await enrichRes.json();
      const enrichedCompanies = (enrichData.results ?? enrichData.data ?? companies).map((c: any) => ({
        id: c.id,
        name: c.name,
        signalCount: c.signalCount ?? c._count?.signals ?? 0,
        topSignal: c.topSignal ?? 'Intelligence signal detected',
        intelligenceScore: c.intelligenceScore ?? c.score ?? 0,
      }));
      const totalSignals = enrichedCompanies.reduce((sum: number, c: CompanyBrief) => sum + c.signalCount, 0);
      setBriefing({ companies: enrichedCompanies, totalSignals });
      setShowBriefing(true);
      await fetchCounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrichment failed');
    } finally {
      setEnriching(false);
    }
  };

  const canActivate = counts.capabilities > 0 && counts.accounts > 0;

  const channels = [
    {
      key: 'capabilities',
      label: 'Capabilities',
      description: 'Upload services, solutions, case studies, proof points',
      icon: Cpu,
      result: uploadResults.capabilities,
    },
    {
      key: 'accounts',
      label: 'Accounts',
      description: 'Upload strategic accounts for intelligence analysis',
      icon: Building2,
      result: uploadResults.accounts,
    },
    {
      key: 'knowledge',
      label: 'Knowledge',
      description: 'Upload documents for context enrichment',
      icon: BookOpen,
      result: uploadResults.knowledge,
      disabled: true,
    },
  ];

  return (
    <div className="ios-background min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-2xl"
        >
          <div className="text-center mb-12">
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--ios-text-primary)' }}>
              DeepMindQ
            </h1>
            <p className="text-xs uppercase tracking-[0.2em] mt-2" style={{ color: 'var(--ios-text-muted)' }}>
              Enterprise Intelligence Operating System
            </p>
          </div>

          <div className="text-center mb-10">
            <h2 className="text-xl font-medium" style={{ color: 'var(--ios-text-primary)' }}>
              Teach DeepMindQ about your business.
            </h2>
            <p className="text-sm mt-3 max-w-md mx-auto" style={{ color: 'var(--ios-text-secondary)' }}>
              Upload your capabilities, accounts, and knowledge. The engine starts understanding immediately.
            </p>
          </div>

          <div className="flex flex-col gap-4 mb-10">
            {channels.map((ch, i) => {
              const Icon = ch.icon;
              const isUploading = uploadingChannel === ch.key;
              return (
                <motion.div
                  key={ch.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div
                    className={`ios-card-interactive p-5 ${ch.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                    onClick={() => {
                      if (ch.disabled) return;
                      fileInputRefs.current[ch.key]?.click();
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--ios-bg-elevated)' }}
                      >
                        <Icon size={18} style={{ color: 'var(--ios-accent)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium" style={{ color: 'var(--ios-text-primary)' }}>
                            {ch.label}
                          </span>
                          {isUploading && <span className="intel-pulse text-xs" style={{ color: 'var(--ios-accent)' }}>Processing...</span>}
                          {ch.disabled && <span className="text-xs" style={{ color: 'var(--ios-text-muted)' }}>Coming soon</span>}
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--ios-text-secondary)' }}>
                          {ch.description}
                        </p>
                        {ch.result && !isUploading && (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-xs mt-2"
                            style={{ color: 'var(--ios-confidence-high)' }}
                          >
                            {ch.result.message || ch.result.capabilitiesCreated !== undefined
                              ? `Understood: ${ch.result.capabilitiesCreated ?? ch.result.accountsCreated ?? 0} records processed`
                              : 'Processed successfully'}
                          </motion.p>
                        )}
                      </div>
                      {!ch.disabled && !isUploading && (
                        <Upload size={16} style={{ color: 'var(--ios-text-muted)' }} />
                      )}
                    </div>
                    <input
                      ref={(el) => { fileInputRefs.current[ch.key] = el; }}
                      type="file"
                      accept=".json,.csv"
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

          {error && (
            <div className="mb-6 p-3 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--ios-confidence-low)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <AnimatePresence>
            {!showBriefing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div
                  className="inline-flex items-center gap-6 px-6 py-3 rounded-full"
                  style={{ background: 'var(--ios-bg-secondary)', border: '1px solid var(--ios-border)' }}
                >
                  <span className="text-xs" style={{ color: 'var(--ios-text-muted)' }}>DeepMindQ now understands:</span>
                  <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--ios-text-primary)' }}>
                    {counts.capabilities} capabilities
                  </span>
                  <span className="text-xs" style={{ color: 'var(--ios-text-muted)' }}>|</span>
                  <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--ios-text-primary)' }}>
                    {counts.accounts} accounts
                  </span>
                  <span className="text-xs" style={{ color: 'var(--ios-text-muted)' }}>|</span>
                  <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--ios-text-primary)' }}>
                    {counts.signals} intelligence signals
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {canActivate && !showBriefing && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="flex justify-center mt-8"
              >
                <Button
                  onClick={handleActivateIntelligence}
                  disabled={enriching}
                  className="gap-2 px-6"
                  style={{ background: 'var(--ios-accent)', color: 'white' }}
                >
                  {enriching ? (
                    <span className="intel-pulse">Activating Intelligence...</span>
                  ) : (
                    <>
                      Activate Intelligence
                      <ArrowRight size={14} />
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showBriefing && briefing && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-10 intel-reveal"
              >
                <div className="ios-card p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--ios-accent)' }}>
                    Intelligence Briefing
                  </h3>
                  <p className="text-sm mb-6" style={{ color: 'var(--ios-text-secondary)' }}>
                    After analyzing {counts.accounts} accounts, DeepMindQ identified {briefing.totalSignals} intelligence signals.
                  </p>
                  <div className="flex flex-col gap-3 mb-8">
                    {briefing.companies.slice(0, 10).map((company) => (
                      <div
                        key={company.id}
                        className="flex items-center justify-between py-3 px-4 rounded-lg"
                        style={{ background: 'var(--ios-bg-secondary)' }}
                      >
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--ios-text-primary)' }}>{company.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--ios-text-secondary)' }}>{company.topSignal}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--ios-text-primary)' }}>{company.signalCount}</p>
                          <p className="text-xs" style={{ color: 'var(--ios-text-muted)' }}>signals</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-center">
                    <p className="text-xs mb-4" style={{ color: 'var(--ios-text-secondary)' }}>
                      Your intelligence is active. Continue to the Command Center to see prioritized recommendations.
                    </p>
                    <Button
                      onClick={() => {
                        const { useAppStore } = require('@/lib/store');
                        useAppStore.getState().setActiveView('intelligence-briefing');
                      }}
                      className="gap-2"
                      style={{ background: 'var(--ios-accent)', color: 'white' }}
                    >
                      Continue to Command Center
                      <ArrowRight size={14} />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}