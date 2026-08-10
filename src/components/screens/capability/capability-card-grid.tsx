'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AnimatedCard, StaggerGrid, StaggerItem, EmptyState } from '@/components/ui/animated-components';
import {
  Tag, Layers, Search, Database, Check, Eye, Pencil, Trash2, X, Plus,
  Link2, GitBranch,
} from 'lucide-react';
import type { Capability } from './capability-shared';
import { greenAlpha, CAT_ICON, CAT_BADGE, CAT_LABEL, CAT_GRADIENT } from './capability-shared';

interface CapabilityCardGridProps {
  filtered: Capability[];
  items: Capability[];
  selectedIds: Set<string>;
  loading: boolean;
  search: string;
  filterTag: string | null;
  allTags: string[];
  onToggleSelect: (id: string) => void;
  onView: (cap: Capability) => void;
  onEdit: (cap: Capability) => void;
  onDelete: (id: string) => void;
  onFilterTag: (tag: string) => void;
  onOpenCreate: () => void;
  onClearTagFilter: () => void;
  onShowTagCloud: () => void;
}

export function CapabilityCardGrid({
  filtered, items, selectedIds, loading, search, filterTag, allTags,
  onToggleSelect, onView, onEdit, onDelete, onFilterTag, onOpenCreate, onClearTagFilter, onShowTagCloud,
}: CapabilityCardGridProps) {
  return (
    <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {filtered.map(cap => {
        const Icon = CAT_ICON[cap.category] || Tag;
        const grad = CAT_GRADIENT[cap.category] || CAT_GRADIENT.service_line;
        const hasChildren = items.some(i => i.parentAssetId === cap.id);
        const parentCap = cap.parentAssetId ? items.find(i => i.id === cap.parentAssetId) : null;
        return (
          <StaggerItem key={cap.id}>
            <AnimatedCard glow={grad.glow} className="group/card">
              <div
                className="rounded-xl p-[1.5px] transition-all duration-500 group-hover/card:shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${grad.from}, ${grad.to}, transparent 70%)`,
                  boxShadow: 'inset 0 0 0 0 transparent',
                }}
              >
                <div className="rounded-xl bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 mb-2">
                        <button
                          onClick={() => onToggleSelect(cap.id)}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                            selectedIds.has(cap.id)
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-gray-300 hover:border-primary/50'
                          }`}
                        >
                          {selectedIds.has(cap.id) && <Check className="w-2.5 h-2.5" />}
                        </button>
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-300 group-hover/card:scale-110"
                          style={{ background: `${grad.from}` }}
                        >
                          <Icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground truncate">{cap.title}</h3>
                      </div>
                      <div className="flex items-center gap-1.5 ml-[34px]">
                        <Badge variant="outline" className={`text-[11px] ${CAT_BADGE[cap.category] || ''}`}>
                          {CAT_LABEL[cap.category] || cap.category}
                        </Badge>
                        {(cap.version || 0) > 1 && (
                          <Badge variant="outline" className="text-[9px] border-primary/30 text-primary bg-primary/5">
                            v{cap.version}
                          </Badge>
                        )}
                        {parentCap && (
                          <Badge variant="outline" className="text-[9px] gap-0.5 border-purple-500/30 text-purple-700 bg-purple-500/5">
                            <Link2 className="w-2.5 h-2.5" />{parentCap.title.slice(0, 20)}
                          </Badge>
                        )}
                        {hasChildren && (
                          <Badge variant="outline" className="text-[9px] gap-0.5 border-emerald-500/30 text-emerald-700 bg-emerald-500/5">
                            <GitBranch className="w-2.5 h-2.5" />children
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span
                      className={`w-2.5 h-2.5 rounded-full mt-2 shrink-0 transition-shadow duration-300 ${
                        cap.isActive
                          ? `bg-emerald-500 shadow-[0_0_8px_${greenAlpha(0.5)}]`
                          : 'bg-zinc-600'
                      }`}
                      title={cap.isActive ? 'Active' : 'Inactive'}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground mt-3 line-clamp-3 leading-relaxed">{cap.summary}</p>

                  {cap.tags && Array.isArray(cap.tags) && cap.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-3 flex-wrap">
                      {cap.tags.slice(0, 4).map(tag => (
                        <button
                          key={tag}
                          onClick={() => onFilterTag(tag)}
                          className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all duration-200"
                        >
                          {tag}
                        </button>
                      ))}
                      {cap.tags.length > 4 && (
                        <span className="text-[9px] text-muted-foreground/50">+{cap.tags.length - 4}</span>
                      )}
                    </div>
                  )}

                  {cap.serviceLine && (
                    <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-blue-600/70" />{cap.serviceLine}
                    </p>
                  )}
                  {cap.targetIndustries && (
                    <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                      <Tag className="w-3 h-3 text-purple-600/70" />{cap.targetIndustries}
                    </p>
                  )}

                  <div className="flex items-center gap-1 mt-4 pt-3 border-t border-border/40">
                    <Button variant="ghost" size="sm" className="h-10 text-xs text-primary hover:text-primary/80 hover:bg-primary/10 px-2.5 rounded-lg min-h-[44px]"
                      onClick={() => onView(cap)}>
                      <Eye className="w-3.5 h-3.5 mr-1" />View
                    </Button>
                    <Button variant="ghost" size="sm" className="h-10 text-xs text-muted-foreground hover:text-foreground hover:bg-gray-100/50 px-2.5 rounded-lg min-h-[44px]"
                      onClick={() => onEdit(cap)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" />Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="h-10 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50 px-2.5 rounded-lg ml-auto min-h-[44px]"
                      onClick={() => onDelete(cap.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </AnimatedCard>
          </StaggerItem>
        );
      })}

      {filtered.length === 0 && !loading && (
        <div className="col-span-full">
          <EmptyState
            icon={filterTag ? Tag : search ? Search : Database}
            title={filterTag ? `No capabilities tagged "${filterTag}"` : search ? 'No matching capabilities' : 'No capabilities yet'}
            description={filterTag
              ? 'Try selecting a different tag or clearing the filter.'
              : search
                ? 'Try adjusting your search terms or clearing the filter.'
                : 'Add capabilities to improve AI draft quality and enable semantic retrieval.'}
            action={
              filterTag ? (
                <Button size="sm" variant="outline" className="h-10 text-xs gap-1.5 min-h-[44px]" onClick={onClearTagFilter}>
                  <X className="w-3 h-3" />Clear Tag Filter
                </Button>
              ) : !search ? (
                <Button size="sm" className="h-10 text-xs gap-1.5 min-h-[44px]" onClick={onOpenCreate}>
                  <Plus className="w-3 h-3" />Add First Capability
                </Button>
              ) : undefined
            }
          />
        </div>
      )}
    </StaggerGrid>
  );
}
