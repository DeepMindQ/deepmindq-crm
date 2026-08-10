'use client';

import { useMemo } from 'react';
import { Hash } from 'lucide-react';
import type { Capability } from './capability-shared';
import { GlassDialog } from './capability-shared';

export function TagCloudDialog({ items, onSelectTag, onClose }: { items: Capability[]; onSelectTag: (tag: string) => void; onClose: () => void }) {
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (item.tags && Array.isArray(item.tags)) {
        for (const tag of item.tags) {
          counts.set(tag, (counts.get(tag) || 0) + 1);
        }
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const maxCount = tagCounts.length > 0 ? tagCounts[0][1] : 1;

  return (
    <GlassDialog title="All Tags" subtitle={`${tagCounts.length} unique tags across ${items.length} assets`} onClose={onClose}>
      {tagCounts.length === 0 ? (
        <div className="text-center py-8">
          <Hash className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No tags have been added yet</p>
          <p className="text-xs text-muted-foreground/60">Add tags to capabilities to organize and filter your knowledge base</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tagCounts.map(([tag, count]) => {
            const intensity = Math.max(0.4, count / maxCount);
            return (
              <button
                key={tag}
                onClick={() => { onSelectTag(tag); onClose(); }}
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
              >
                <Hash className="w-3 h-3 text-primary/50 group-hover:text-primary transition-colors" />
                <span className="text-xs font-medium" style={{ color: `rgba(212, 175, 55, ${intensity})` }}>{tag}</span>
                <span className="text-[9px] tabular-nums text-muted-foreground bg-gray-100/50 rounded-full px-1.5 py-0.5">{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </GlassDialog>
  );
}
