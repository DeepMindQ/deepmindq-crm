'use client';

import {
  FileText,
  Globe,
  Database,
  Users,
  Mail,
  Newspaper,
  Building2,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EvidenceBadgeProps {
  source: string;
  confidence?: number;
  className?: string;
}

const sourceIconMap: Record<string, LucideIcon> = {
  news: Newspaper,
  filing: FileText,
  web: Globe,
  database: Database,
  social: Users,
  email: Mail,
  company: Building2,
  analytics: BarChart3,
  sec: FileText,
  press: Newspaper,
  internal: Database,
};

const sourceColorMap: Record<string, string> = {
  news: 'bg-blue-50 text-blue-700 border-blue-200',
  filing: 'bg-violet-50 text-violet-700 border-violet-200',
  web: 'bg-sky-50 text-sky-700 border-sky-200',
  database: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  social: 'bg-pink-50 text-pink-700 border-pink-200',
  email: 'bg-orange-50 text-orange-700 border-orange-200',
  company: 'bg-slate-100 text-slate-700 border-slate-300',
  analytics: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  sec: 'bg-violet-50 text-violet-700 border-violet-200',
  press: 'bg-blue-50 text-blue-700 border-blue-200',
  internal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const defaultColor = 'bg-slate-100 text-slate-600 border-slate-200';

export function EvidenceBadge({
  source,
  confidence,
  className,
}: EvidenceBadgeProps) {
  const normalizedSource = source.toLowerCase().trim();
  const Icon = sourceIconMap[normalizedSource] || FileText;
  const colors = sourceColorMap[normalizedSource] || defaultColor;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
        colors,
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="capitalize">{source}</span>
      {confidence !== undefined && (
        <span className="tabular-nums font-semibold">{confidence}%</span>
      )}
    </span>
  );
}
