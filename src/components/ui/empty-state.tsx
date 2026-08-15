'use client';

import { cn } from '@/lib/utils';
import {
  Search,
  FileX,
  Inbox,
  Building2,
  Users,
  Mail,
  Target,
  BarChart3,
  FolderOpen,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════
   EmptyState — Reusable empty/no-data display component
   
   Preset icons for common empty states (companies, contacts,
   emails, etc.) plus custom icon support.
   
   Usage:
     <EmptyState icon="building" title="No companies yet" action={<Button>Add Company</Button>} />
     <EmptyState icon={<CustomIcon />} title="Nothing here" description="Create your first item" />
     <EmptyState type="search" query="acme" />
   
   ═══════════════════════════════════════════════════ */

export type PresetIcon =
  | 'building'
  | 'users'
  | 'mail'
  | 'target'
  | 'chart'
  | 'folder'
  | 'lightbulb'
  | 'inbox'
  | 'search'
  | 'file';

const PRESET_ICONS: Record<PresetIcon, LucideIcon> = {
  building: Building2,
  users: Users,
  mail: Mail,
  target: Target,
  chart: BarChart3,
  folder: FolderOpen,
  lightbulb: Lightbulb,
  inbox: Inbox,
  search: Search,
  file: FileX,
};

const DEFAULT_TITLES: Record<PresetIcon, string> = {
  building: 'No companies found',
  users: 'No contacts found',
  mail: 'No emails yet',
  target: 'No opportunities yet',
  chart: 'No data available',
  folder: 'No items found',
  lightbulb: 'No insights yet',
  inbox: 'Inbox is empty',
  search: 'No results found',
  file: 'No files found',
};

const DEFAULT_DESCRIPTIONS: Record<PresetIcon, string> = {
  building: 'Import or add companies to start building your intelligence pipeline.',
  users: 'Add contacts to begin tracking relationships and engagement.',
  mail: 'Compose your first email or set up an automated sequence.',
  target: 'Create opportunities to track your deals through the pipeline.',
  chart: 'Data will appear here once you start using the platform.',
  folder: 'Items you add will appear here.',
  lightbulb: 'AI-generated insights will populate as your data grows.',
  inbox: 'New messages and notifications will appear here.',
  search: 'Try adjusting your search terms or filters.',
  file: 'Upload or create files to get started.',
};

export interface EmptyStateProps {
  /** Preset icon key */
  icon?: PresetIcon;
  /** Custom icon component (overrides preset) */
  customIcon?: LucideIcon;
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Search query (for search empty states) */
  query?: string;
  /** Action button / content */
  action?: React.ReactNode;
  /** Secondary action */
  secondaryAction?: React.ReactNode;
  /** Layout: 'full' centered, 'inline' minimal */
  variant?: 'full' | 'inline';
  /** Additional class names */
  className?: string;
  /** Hide the icon */
  hideIcon?: boolean;
}

/**
 * Unified empty state component.
 * Renders an icon, title, description, and optional action buttons.
 */
export function EmptyState({
  icon,
  customIcon,
  title,
  description,
  query,
  action,
  secondaryAction,
  variant = 'full',
  className,
  hideIcon = false,
}: EmptyStateProps) {
  const IconComponent = customIcon || (icon ? PRESET_ICONS[icon] : FileX);
  const displayTitle = title || (icon ? DEFAULT_TITLES[icon] : 'No data found');

  let displayDescription = description;
  if (!displayDescription && icon) {
    displayDescription = DEFAULT_DESCRIPTIONS[icon];
  }
  if (query && icon === 'search') {
    displayDescription = `No results for "${query}". Try different keywords or remove filters.`;
  }

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-3 py-8 text-center justify-center', className)}>
        {!hideIcon && <IconComponent className="w-8 h-8 text-muted-foreground/40 shrink-0" />}
        <div>
          <p className="text-sm text-muted-foreground">{displayTitle}</p>
          {displayDescription && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">{displayDescription}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4',
        className,
      )}
    >
      {/* Icon */}
      {!hideIcon && (
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <IconComponent className="w-8 h-8 text-muted-foreground/50" />
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-medium text-foreground mb-1">{displayTitle}</p>

      {/* Description */}
      {displayDescription && (
        <p className="text-xs text-muted-foreground max-w-sm mb-5">{displayDescription}</p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap gap-2 justify-center">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
