'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  StaggerGrid, StaggerItem, GlassPanel, GradientCard, ShimmerText, PulseDot,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Plug, Save, RefreshCw, CheckCircle2, XCircle, Eye, Target, ShieldCheck,
} from 'lucide-react';
import { colors } from '@/components/design-system';
import { INPUT_CLS } from './settings-constants';

const goldAlpha = (a: number) => `rgba(212,175,55,${a})`;
const greenAlpha = (a: number) => `rgba(16,185,129,${a})`;
const redAlpha = (a: number) => `rgba(239,68,68,${a})`;

export function AiProvidersTab({ showToast }: { showToast: (msg: string) => void }) {
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiProviderKeys, setAiProviderKeys] = useState<Record<string, string>>({});
  const [aiProviderModels, setAiProviderModels] = useState<Record<string, string>>({});
  const [aiProviderEnabled, setAiProviderEnabled] = useState<Record<string, boolean>>({});
  const [aiTestResults, setAiTestResults] = useState<Record<string, { loading: boolean; success?: boolean; message: string }>>({});
  const [aiShowKeys, setAiShowKeys] = useState<Record<string, boolean>>({});

  const loadAIConfig = useCallback(async () => {
    try {
      setAiLoading(true);
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const config = data.aiProviders;
        setAiConfig(config);
        if (config?.providers) {
          const keys: Record<string, string> = {};
          const models: Record<string, string> = {};
          const enabled: Record<string, boolean> = {};
          for (const [id, p] of Object.entries(config.providers)) {
            const prov = p as any;
            keys[id] = prov.apiKey || '';
            models[id] = prov.model || '';
            enabled[id] = prov.enabled !== false;
          }
          setAiProviderKeys(keys); setAiProviderModels(models); setAiProviderEnabled(enabled);
        }
      }
    } catch { /* ignore */ }
    finally { setAiLoading(false); }
  }, []);

  useEffect(() => { loadAIConfig(); }, [loadAIConfig]);

  const saveAIProviders = async () => {
    setAiSaving(true);
    try {
      const providers: Record<string, any> = {};
      for (const [id, key] of Object.entries(aiProviderKeys)) {
        providers[id] = { apiKey: key, model: aiProviderModels[id] || undefined, enabled: aiProviderEnabled[id] ?? true };
      }
      const res = await fetch('/api/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiProviders: { providers } }),
      });
      if (res.ok) { showToast('AI provider settings saved — takes effect immediately'); await loadAIConfig(); }
      else { showToast('Failed to save AI settings'); }
    } catch { showToast('Failed to save AI settings'); }
    finally { setAiSaving(false); }
  };

  const testAIProvider = async (providerId: string) => {
    setAiTestResults(prev => ({ ...prev, [providerId]: { loading: true, message: 'Testing connection...' } }));
    try {
      const providers: Record<string, any> = {};
      providers[providerId] = { apiKey: aiProviderKeys[providerId], model: aiProviderModels[providerId] || undefined, enabled: aiProviderEnabled[providerId] ?? true };
      await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aiProviders: { providers } }) });
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId }) });
      const result = await res.json();
      setAiTestResults(prev => ({ ...prev, [providerId]: { loading: false, success: result.success, message: result.message } }));
    } catch {
      setAiTestResults(prev => ({ ...prev, [providerId]: { loading: false, success: false, message: 'Connection test failed' } }));
    }
  };

  return (
    <StaggerGrid stagger={0.08} className="space-y-6">
      <StaggerItem>
        <GlassPanel className="p-0 overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={{ background: `linear-gradient(135deg, ${goldAlpha(0.06)}, transparent)`, borderBottom: `1px solid ${goldAlpha(0.1)}` }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${goldAlpha(0.2)}, ${goldAlpha(0.06)})` }}>
                <Plug className="size-4.5" style={{ color: 'var(--color-gold)' }} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground tracking-tight"><ShimmerText>AI Providers & API Keys</ShimmerText></h3>
                <p className="text-xs text-muted-foreground">Manage LLM and search providers — changes take effect immediately</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><PulseDot /><span>{Object.values(aiProviderEnabled).filter(Boolean).length} active</span></div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button size="sm" onClick={saveAIProviders} disabled={aiSaving} className="gap-1.5" style={{ background: 'linear-gradient(135deg, var(--ios-gold-mid), var(--color-gold))', color: 'var(--dmq-white)' }}>
                  <Save className="size-3.5" />{aiSaving ? 'Saving...' : 'Save All'}
                </Button>
              </motion.div>
            </div>
          </div>
          <div className="p-6">
            {aiLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground"><RefreshCw className="size-4 mr-2 animate-spin" /> Loading AI provider configuration...</div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-[var(--color-gold-dim)]/20 p-3 mb-6" style={{ background: `${goldAlpha(0.04)}` }}>
                  <div className="flex items-start gap-2">
                    <Target className="size-4 text-[var(--color-gold-dim)] mt-0.5 shrink-0" />
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      <p className="font-medium text-foreground mb-1">LLM Fallback Chain</p>
                      <p>AI calls try providers in priority order. If the primary fails, it automatically falls back to the next enabled provider. This ensures your enrichment and AI features never break.</p>
                    </div>
                  </div>
                </div>
                {['nvidia', 'fireworks', 'groq', 'gemini', 'tavily'].map((providerId, idx) => {
                  const providerInfo = aiConfig?.providers?.[providerId] as any;
                  const label = providerInfo?.label || providerId;
                  const tier = providerInfo?.tier || '';
                  const baseUrl = providerInfo?.baseUrl || '';
                  const category = providerInfo?.category || 'llm';
                  const hasKey = !!aiProviderKeys[providerId];
                  const testResult = aiTestResults[providerId];
                  const showKey = aiShowKeys[providerId];
                  return (
                    <GradientCard key={providerId}>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: hasKey ? `${greenAlpha(0.12)}` : `${redAlpha(0.1)}`, color: hasKey ? colors.green : colors.red }}>{idx + 1}</div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">{label}</span>
                                <Badge variant="outline" className="text-[11px] px-1.5 py-0 font-normal">{category === 'search' ? 'Search' : 'LLM'}</Badge>
                                {tier && <span className="text-[11px] text-muted-foreground">{tier}</span>}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate max-w-md">{baseUrl}</p>
                            </div>
                          </div>
                          <Switch checked={aiProviderEnabled[providerId] ?? true} onCheckedChange={(v) => setAiProviderEnabled(prev => ({ ...prev, [providerId]: v }))} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">API Key</Label>
                            <div className="relative">
                              <Input type={showKey ? 'text' : 'password'} value={aiProviderKeys[providerId] || ''} onChange={(e) => setAiProviderKeys(prev => ({ ...prev, [providerId]: e.target.value }))} placeholder={`Enter your ${label} API key`} className={`${INPUT_CLS} pr-20`} />
                              <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-10 px-2 text-xs text-muted-foreground hover:text-foreground min-h-[44px]" onClick={() => setAiShowKeys(prev => ({ ...prev, [providerId]: !prev[providerId] }))}>
                                <Eye className="size-3 mr-1" />{showKey ? 'Hide' : 'Show'}
                              </Button>
                            </div>
                          </div>
                          {category === 'llm' && (
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Model</Label>
                              <Input value={aiProviderModels[providerId] || ''} onChange={(e) => setAiProviderModels(prev => ({ ...prev, [providerId]: e.target.value }))} placeholder="model-name" className={`${INPUT_CLS} w-48 md:w-56`} />
                            </div>
                          )}
                          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                            <Button size="sm" variant="outline" disabled={!aiProviderKeys[providerId] || testResult?.loading} onClick={() => testAIProvider(providerId)} className={testResult?.success ? 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10' : testResult?.success === false ? 'border-red-500/40 text-red-500 hover:bg-red-500/10' : 'border-[var(--color-gold-dim)]/40 text-[var(--color-gold-dim)] hover:bg-[var(--color-gold-dim)]/10'}>
                              {testResult?.loading ? <RefreshCw className="size-3.5 animate-spin" /> : testResult?.success ? <CheckCircle2 className="size-3.5" /> : testResult?.success === false ? <XCircle className="size-3.5" /> : <RefreshCw className="size-3.5" />}
                              {testResult?.loading ? 'Testing...' : testResult?.message || 'Test'}
                            </Button>
                          </motion.div>
                        </div>
                        {testResult && !testResult.loading && testResult.message !== 'Testing connection...' && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                            <div className={`rounded-lg px-3 py-2 text-xs ${testResult.success ? 'bg-emerald-500/8 text-emerald-700 border border-emerald-500/20' : 'bg-red-500/8 text-red-600 border border-red-500/20'}`}>{testResult.message}</div>
                          </motion.div>
                        )}
                      </div>
                    </GradientCard>
                  );
                })}
                <div className="mt-4 rounded-lg border border-border/50 p-3">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      <p className="font-medium text-foreground text-xs mb-1">How It Works</p>
                      <p>Keys entered here override environment variables and take effect immediately for all AI operations (enrichment, research, email generation, chat). If a key is set in both environment variables and here, the value from this page wins. If this field is empty, the system falls back to environment variables.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </GlassPanel>
      </StaggerItem>
    </StaggerGrid>
  );
}
