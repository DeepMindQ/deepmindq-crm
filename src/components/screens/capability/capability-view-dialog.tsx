'use client';

import { Hash, Link2, Mail, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/animated-components';
import type { Capability } from './capability-shared';
import { GlassDialog, greenAlpha, CAT_ICON, CAT_BADGE, CAT_LABEL } from './capability-shared';

interface CapabilityViewDialogProps {
  selected: Capability;
  items: Capability[];
  onEdit: (cap: Capability) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onFilterTag: (tag: string) => void;
}

export function CapabilityViewDialog({ selected, items, onEdit, onDelete, onClose, onFilterTag }: CapabilityViewDialogProps) {
  return (
    <GlassDialog
      title={selected.title}
      subtitle={CAT_LABEL[selected.category] || selected.category}
      onClose={onClose}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-10 text-xs gap-1.5 min-h-[44px]" onClick={() => { onEdit(selected); onClose(); }}>
            <Pencil className="w-3.5 h-3.5" />Edit
          </Button>
          <Button variant="ghost" size="sm" className="h-10 text-xs gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 min-h-[44px]" onClick={() => { onDelete(selected.id); onClose(); }}>
            <Trash2 className="w-3.5 h-3.5" />Delete
          </Button>
        </div>
      }
    >
      <div className="space-y-5 text-sm">
        <div className="flex items-center gap-2">
          {(() => { const I = CAT_ICON[selected.category]; return I ? <I className="w-4 h-4 text-primary" /> : null; })()}
          <Badge variant="outline" className={`text-[11px] ${CAT_BADGE[selected.category] || ''}`}>
            {CAT_LABEL[selected.category] || selected.category}
          </Badge>
          <span className={`w-2 h-2 rounded-full ${selected.isActive ? `bg-emerald-500 shadow-[0_0_6px_${greenAlpha(0.5)}]` : 'bg-zinc-600'}`} />
          <span className="text-[11px] text-muted-foreground">{selected.isActive ? 'Active' : 'Inactive'}</span>
          {(selected.version || 0) > 1 && (
            <Badge variant="outline" className="text-[11px] border-primary/30 text-primary bg-primary/5">
              v{selected.version}
            </Badge>
          )}
        </div>

        {selected.parentAssetId && (
          <div className="flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 text-purple-600" />
            <span className="text-[11px] text-muted-foreground">Parent: {items.find(i => i.id === selected.parentAssetId)?.title || selected.parentAssetId}</span>
          </div>
        )}

        {selected.tags && Array.isArray(selected.tags) && selected.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Hash className="w-3.5 h-3.5 text-primary/60" />
            {selected.tags.map(tag => (
              <button
                key={tag}
                onClick={() => { onClose(); onFilterTag(tag); }}
                className="text-[11px] px-2 py-0.5 rounded-full border border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {selected.serviceLine && (
          <GlassPanel className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Service Line</p>
            <p className="text-foreground">{selected.serviceLine}</p>
          </GlassPanel>
        )}
        {selected.targetIndustries && (
          <GlassPanel className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Target Industries</p>
            <p className="text-foreground">{selected.targetIndustries}</p>
          </GlassPanel>
        )}
        {selected.targetRoles && (
          <GlassPanel className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Target Roles</p>
            <p className="text-foreground">{selected.targetRoles}</p>
          </GlassPanel>
        )}
        {selected.targetCompanySizes && (
          <GlassPanel className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Target Company Sizes</p>
            <p className="text-foreground">{selected.targetCompanySizes}</p>
          </GlassPanel>
        )}
        {selected.problems && (
          <GlassPanel className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Problems Addressed</p>
            <p className="text-foreground">{selected.problems}</p>
          </GlassPanel>
        )}
        {selected.evidence && (
          <GlassPanel className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Evidence / Proof</p>
            <p className="text-foreground">{selected.evidence}</p>
          </GlassPanel>
        )}

        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-2">Summary</p>
          <p className="text-foreground leading-relaxed">{selected.summary}</p>
        </div>
        {selected.content && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-2">Full Content</p>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border/50 bg-gray-50 p-4">
              <p className="text-foreground leading-relaxed whitespace-pre-wrap text-sm">{selected.content}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 pt-2">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="text-emerald-600">▲</span> {selected.upvotes || 0} upvotes
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="text-red-600">▼</span> {selected.downvotes || 0} downvotes
          </div>
          {(selected.usedInEmails || 0) > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Mail className="w-3 h-3" /> Used in {selected.usedInEmails} email{selected.usedInEmails! > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </GlassDialog>
  );
}
