'use client';

import { useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Tag, Layers, BookOpen, Trophy, MessageSquare, Target } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { colors } from '@/components/design-system';

// ── Theme color opacity helpers ─────────────
export const goldAlpha = (a: number) => `rgba(212,175,55,${a})`;
export const greenAlpha = (a: number) => `rgba(16,185,129,${a})`;
export const redAlpha = (a: number) => `rgba(239,68,68,${a})`;
export const blueAlpha = (a: number) => `rgba(59,130,246,${a})`;
export const blackAlpha = (a: number) => `rgba(0,0,0,${a})`;
export const purpleAlpha = (a: number) => `rgba(168,85,247,${a})`;
export const amberAlpha = (a: number) => `rgba(245,158,11,${a})`;
export const neutralAlpha = (a: number) => `rgba(113,113,122,${a})`;
export const violetAlpha = (a: number) => `rgba(139,92,246,${a})`;
export const indigoAlpha = (a: number) => `rgba(99,102,241,${a})`;

/* -- Types -- */
export interface Capability {
  id: string;
  title: string;
  summary: string;
  category: string;
  serviceLine?: string | null;
  targetIndustries?: string | null;
  targetRoles?: string | null;
  problems?: string | null;
  evidence?: string | null;
  content?: string | null;
  isActive: boolean;
  version?: number;
  tags?: string[];
  targetCompanySizes?: string | null;
  upvotes?: number;
  downvotes?: number;
  usedInEmails?: number;
  parentAssetId?: string | null;
}

export type CapabilityFormState = {
  title: string;
  summary: string;
  category: string;
  serviceLine: string;
  targetIndustries: string;
  targetRoles: string;
  problems: string;
  evidence: string;
  content: string;
  isActive: boolean;
  tags: string[];
  targetCompanySizes: string;
  parentAssetId: string;
};

/* -- Constants -- */
export const TABS = [
  { value: 'all', label: 'All' },
  { value: 'service_line', label: 'Service Lines' },
  { value: 'case_study', label: 'Case Studies' },
  { value: 'proof_point', label: 'Proof Points' },
  { value: 'objection_response', label: 'Objections' },
  { value: 'cta', label: 'CTAs' },
];

export const CAT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  service_line: Layers, case_study: BookOpen, proof_point: Trophy,
  objection_response: MessageSquare, cta: Target,
};
export const CAT_BADGE: Record<string, string> = {
  service_line: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  case_study: 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
  proof_point: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  objection_response: 'bg-red-500/20 text-red-600 border-red-500/30',
  cta: 'bg-amber-500/20 text-amber-700 border-amber-500/30',
};
export const CAT_LABEL: Record<string, string> = {
  service_line: 'Service Line', case_study: 'Case Study', proof_point: 'Proof Point',
  objection_response: 'Objection Response', cta: 'CTA',
};
export const CAT_GRADIENT: Record<string, { from: string; to: string; glow: string }> = {
  service_line: { from: `${blueAlpha(0.3)}`, to: `${blueAlpha(0.05)}`, glow: `${blueAlpha(0.12)}` },
  case_study: { from: `${greenAlpha(0.3)}`, to: `${greenAlpha(0.05)}`, glow: `${greenAlpha(0.12)}` },
  proof_point: { from: `${violetAlpha(0.3)}`, to: `${violetAlpha(0.05)}`, glow: `${violetAlpha(0.12)}` },
  objection_response: { from: `${redAlpha(0.3)}`, to: `${redAlpha(0.05)}`, glow: `${redAlpha(0.12)}` },
  cta: { from: `${amberAlpha(0.3)}`, to: `${amberAlpha(0.05)}`, glow: `${amberAlpha(0.12)}` },
};

export const EMPTY_FORM: CapabilityFormState = {
  title: '',
  summary: '',
  category: 'service_line',
  serviceLine: '',
  targetIndustries: '',
  targetRoles: '',
  problems: '',
  evidence: '',
  content: '',
  isActive: true,
  tags: [],
  targetCompanySizes: '',
  parentAssetId: '',
};

/* ═══════════════════════════════════════════════════════════════
   Tag Input Component (C-15)
   ═══════════════════════════════════════════════════════════════ */

export function TagInput({ tags, onChange, allTags }: { tags: string[]; onChange: (tags: string[]) => void; allTags: string[] }) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!input.trim()) return [];
    const lower = input.trim().toLowerCase();
    return allTags
      .filter(t => t.includes(lower) && !tags.includes(t))
      .slice(0, 8);
  }, [input, allTags, tags]);

  const addTag = (tag: string) => {
    const cleaned = tag.trim().toLowerCase();
    if (cleaned && !tags.includes(cleaned)) {
      onChange([...tags, cleaned]);
    }
    setInput('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (input.trim()) addTag(input.trim());
      else if (suggestions.length > 0) addTag(suggestions[0]);
    }
    if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <Label className="text-sm">Tags</Label>
      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-gray-50 border border-gray-200 focus-within:border-primary/40 min-h-[40px]">
        {tags.map(tag => (
          <Badge key={tag} variant="outline" className="text-[11px] gap-1 border-primary/30 text-primary bg-primary/5 px-2 py-0.5">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="hover:text-primary-foreground transition-colors">
              <X className="w-2.5 h-2.5" />
            </button>
          </Badge>
        ))}
        <div className="relative flex-1 min-w-[100px]">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? 'Type tag and press Enter...' : 'Add more...'}
            className="h-7 text-xs bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 w-full"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-full min-w-[180px] rounded-lg border border-gray-200 bg-card shadow-xl z-50 max-h-40 overflow-y-auto">
              {suggestions.map(s => (
                <button key={s} type="button"
                  onMouseDown={(e) => { e.preventDefault(); addTag(s); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-primary/10 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">Press Enter or select a suggestion to add tags</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Glass Dialog Shell
   ═══════════════════════════════════════════════════════════════ */

export function GlassDialog({ children, onClose, title, subtitle, actions }: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-gray-100/50 backdrop-blur-2xl shadow-2xl shadow-gray-400/30"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 left-8 right-8 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${goldAlpha(0.4)}, transparent)` }} />
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground tracking-tight">{title}</h2>
              {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
            </div>
            <button onClick={onClose}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors min-h-[44px]">
              <X className="w-4 h-4" />
            </button>
          </div>
          {children}
          {actions && <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">{actions}</div>}
        </div>
      </motion.div>
    </motion.div>
  );
}
