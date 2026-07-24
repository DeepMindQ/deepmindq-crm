'use client';

import { Lightbulb, Sparkles, FileText, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfidenceBar } from './ConfidenceBar';
import { EvidenceBadge } from './EvidenceBadge';

interface AIInsightCardProps {
  signal: string;
  evidence: string;
  confidence: number;
  businessImpact: string;
  recommendedAction: string;
  source?: string;
  sourceDate?: string;
  className?: string;
}

function getAccentFromConfidence(confidence: number): 'signal' | 'opportunity' | 'risk' {
  if (confidence >= 80) return 'opportunity';
  if (confidence >= 60) return 'signal';
  return 'risk';
}

export function AIInsightCard({
  signal,
  evidence,
  confidence,
  businessImpact,
  recommendedAction,
  source,
  sourceDate,
  className,
}: AIInsightCardProps) {
  const accent = getAccentFromConfidence(confidence);

  return (
    <div data-accent={accent} className={cn('intel-card', className)}>
      <div className="pl-4 pr-5 py-4 sm:pl-5 sm:pr-6 sm:py-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
            <Sparkles className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 leading-snug">
              {signal}
            </h3>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              {businessImpact}
            </p>
          </div>
        </div>

        {/* Confidence */}
        <ConfidenceBar value={confidence} label="Confidence" size="sm" />

        {/* Evidence */}
        <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <FileText className="h-3 w-3 text-slate-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Evidence
            </span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{evidence}</p>
          {(source || sourceDate) && (
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              {source && <EvidenceBadge source={source} />}
              {sourceDate && (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <Calendar className="h-3 w-3" />
                  {sourceDate}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Recommended Action */}
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
              Recommended Action
            </span>
          </div>
          <p className="text-sm text-slate-800 font-medium leading-relaxed">
            {recommendedAction}
          </p>
        </div>
      </div>
    </div>
  );
}
