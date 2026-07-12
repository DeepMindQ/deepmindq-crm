'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Layers, BookOpen, Trophy, MessageSquare, Target, Tag, Eye,
} from 'lucide-react';

interface Capability {
  id: string;
  title: string;
  summary: string;
  category: string;
  serviceLine?: string;
  targetIndustries?: string;
  content?: string;
  isActive: boolean;
}

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'service_line', label: 'Service Lines' },
  { value: 'case_study', label: 'Case Studies' },
  { value: 'proof_point', label: 'Proof Points' },
  { value: 'objection_response', label: 'Objection Responses' },
  { value: 'cta', label: 'CTAs' },
];

const CAT_ICON: Record<string, typeof Tag> = {
  service_line: Layers, case_study: BookOpen, proof_point: Trophy,
  objection_response: MessageSquare, cta: Target,
};
const CAT_BADGE: Record<string, string> = {
  service_line: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  case_study: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  proof_point: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  objection_response: 'bg-red-500/20 text-red-300 border-red-500/30',
  cta: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};
const CAT_LABEL: Record<string, string> = {
  service_line: 'Service Line', case_study: 'Case Study', proof_point: 'Proof Point',
  objection_response: 'Objection Response', cta: 'CTA',
};

export default function CapabilityScreen() {
  const [items, setItems] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState<Capability | null>(null);

  useEffect(() => {
    const params = tab !== 'all' ? `?category=${tab}` : '';
    fetch(`/api/capabilities${params}`)
      .then(r => r.json())
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab]);

  if (loading) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}</div>;
  }

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-4 pr-1">
      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <Button key={t.value} variant={tab === t.value ? 'default' : 'ghost'} size="sm"
            className={`h-8 text-xs px-3 ${tab === t.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setTab(t.value)}>
            {t.label}
          </Button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(cap => {
          const Icon = CAT_ICON[cap.category] || Tag;
          return (
            <Card key={cap.id} className="bg-card border border-border hover:border-primary/40 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                      <h3 className="text-sm font-semibold text-foreground truncate">{cap.title}</h3>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${CAT_BADGE[cap.category] || ''}`}>
                      {CAT_LABEL[cap.category] || cap.category}
                    </Badge>
                  </div>
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cap.isActive ? 'bg-emerald-400' : 'bg-zinc-500'}`} title={cap.isActive ? 'Active' : 'Inactive'} />
                </div>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed">{cap.summary}</p>
                {cap.serviceLine && (
                  <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                    <Layers className="w-3 h-3" />{cap.serviceLine}
                  </p>
                )}
                {cap.targetIndustries && (
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Tag className="w-3 h-3" />{cap.targetIndustries}
                  </p>
                )}
                <Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:text-primary/80 mt-3 px-2"
                  onClick={() => setSelected(cap)}>
                  <Eye className="w-3.5 h-3.5 mr-1" />View
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {items.length === 0 && (
          <div className="col-span-full text-muted-foreground text-sm text-center py-12">No capabilities in this category.</div>
        )}
      </div>

      {/* View Dialog */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {(() => { const I = CAT_ICON[selected.category] || Tag; return <I className="w-4 h-4 text-primary" />; })()}
                <h2 className="text-base font-semibold text-foreground">{selected.title}</h2>
                <Badge variant="outline" className={`text-[10px] ${CAT_BADGE[selected.category] || ''}`}>{CAT_LABEL[selected.category] || selected.category}</Badge>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
            </div>
            <div className="space-y-4 text-sm">
              {selected.serviceLine && <p className="text-muted-foreground"><span className="text-foreground font-medium">Service Line:</span> {selected.serviceLine}</p>}
              {selected.targetIndustries && <p className="text-muted-foreground"><span className="text-foreground font-medium">Industries:</span> {selected.targetIndustries}</p>}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Summary</p>
                <p className="text-foreground leading-relaxed">{selected.summary}</p>
              </div>
              {selected.content && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Full Content</p>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">{selected.content}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}