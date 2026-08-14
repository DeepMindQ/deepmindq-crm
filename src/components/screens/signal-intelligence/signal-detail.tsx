'use client';

import { tokens } from '@/components/intelligence-os/design-tokens';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Globe, ExternalLink, FileText, Clock } from 'lucide-react';
import {
  type Signal,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
  SIGNAL_TYPE_LABELS,
  formatDate,
  formatRelativeTime,
} from './signal-types';

// ── Badge Components ──

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.medium;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {severity === 'critical' && <span className="inline-flex items-center">⚠</span>}
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.detected;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        textDecoration: cfg.strikethrough ? 'line-through' : 'none',
      }}
    >
      {cfg.label}
    </span>
  );
}

function ConfidenceBar({ score }: { score: number | null }) {
  const value = score ?? 0;
  const barColor =
    value >= 75
      ? tokens.confidence.high.value
      : value >= 50
        ? tokens.confidence.medium.value
        : tokens.confidence.low.value;
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: tokens.surfaceExtended }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, background: barColor }}
        />
      </div>
      <span
        className="text-xs font-medium tabular-nums"
        style={{ color: barColor, minWidth: '28px', textAlign: 'right' }}
      >
        {value > 0 ? value.toFixed(0) : '—'}
      </span>
    </div>
  );
}

// ── Signal Detail Panel ──

export function SignalDetailPanel({
  signal,
  open,
  onOpenChange,
}: {
  signal: Signal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!signal) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-hidden p-0"
        style={{
          background: tokens.surface.card,
          borderLeft: `1px solid ${tokens.border.default}`,
        }}
      >
        <SheetHeader
          className="p-5 pb-0"
          style={{ borderBottom: `1px solid ${tokens.border.default}` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <SeverityBadge severity={signal.severity} />
            <StatusBadge status={signal.status} />
          </div>
          <SheetTitle
            className="text-base font-semibold leading-snug"
            style={{ color: tokens.text.primary }}
          >
            {signal.title}
          </SheetTitle>
          <SheetDescription className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Detected {formatRelativeTime(signal.detectedAt)}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(100vh-180px)]">
          <div className="p-5 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: tokens.text.muted }}
              >
                Organization
              </span>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 shrink-0" style={{ color: tokens.text.secondary }} />
                <span className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
                  {signal.organization.name}
                </span>
              </div>
              {(signal.organization.domain || signal.organization.industry) && (
                <div className="flex items-center gap-3 ml-6">
                  {signal.organization.domain && (
                    <a
                      href={`https://${signal.organization.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs hover:underline"
                      style={{ color: tokens.accent.DEFAULT }}
                    >
                      {signal.organization.domain} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {signal.organization.industry && (
                    <span className="text-xs" style={{ color: tokens.text.muted }}>
                      {signal.organization.industry}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: tokens.text.muted }}
              >
                Signal Type
              </span>
              <span className="text-sm" style={{ color: tokens.text.primary }}>
                {SIGNAL_TYPE_LABELS[signal.signalType] ?? signal.signalType}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-lg p-3"
                style={{
                  background: tokens.surfaceExtended,
                  border: `1px solid ${tokens.border.default}`,
                }}
              >
                <span className="text-xs font-medium" style={{ color: tokens.text.muted }}>
                  Confidence
                </span>
                <div className="mt-1">
                  <ConfidenceBar score={signal.confidenceScore} />
                </div>
              </div>
              <div
                className="rounded-lg p-3"
                style={{
                  background: tokens.surfaceExtended,
                  border: `1px solid ${tokens.border.default}`,
                }}
              >
                <span className="text-xs font-medium" style={{ color: tokens.text.muted }}>
                  Impact Score
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span
                    className="text-lg font-bold tabular-nums"
                    style={{
                      color:
                        (signal.impactScore ?? 0) >= 70
                          ? tokens.confidence.high.value
                          : (signal.impactScore ?? 0) >= 40
                            ? tokens.confidence.medium.value
                            : tokens.confidence.low.value,
                    }}
                  >
                    {signal.impactScore != null ? signal.impactScore.toFixed(0) : '—'}
                  </span>
                  <span className="text-xs" style={{ color: tokens.text.muted }}>
                    / 100
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: tokens.text.muted }}
              >
                Description
              </span>
              <p className="text-sm leading-relaxed" style={{ color: tokens.text.secondary }}>
                {signal.description}
              </p>
            </div>

            {(signal.sourceUrl || signal.sourceLabel) && (
              <div className="flex flex-col gap-1.5">
                <span
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: tokens.text.muted }}
                >
                  Source
                </span>
                {signal.sourceUrl ? (
                  <a
                    href={signal.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm hover:underline break-all"
                    style={{ color: tokens.accent.DEFAULT }}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    {signal.sourceLabel || signal.sourceUrl}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <span className="text-sm" style={{ color: tokens.text.secondary }}>
                    {signal.sourceLabel}
                  </span>
                )}
              </div>
            )}

            {signal.eventDate && (
              <div className="flex flex-col gap-1.5">
                <span
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: tokens.text.muted }}
                >
                  Event Date
                </span>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" style={{ color: tokens.text.secondary }} />
                  <span className="text-sm" style={{ color: tokens.text.secondary }}>
                    {formatDate(signal.eventDate)}
                  </span>
                </div>
              </div>
            )}

            {signal.evidence.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <span
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: tokens.text.muted }}
                >
                  Evidence ({signal.evidence.length})
                </span>
                <div className="flex flex-col gap-2">
                  {signal.evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-lg p-3 transition-colors"
                      style={{
                        background: tokens.surface.secondary,
                        border: `1px solid ${tokens.border.default}`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          {ev.sourceTitle && (
                            <span
                              className="text-xs font-semibold truncate"
                              style={{ color: tokens.text.primary }}
                            >
                              {ev.sourceTitle}
                            </span>
                          )}
                          <p
                            className="text-xs leading-relaxed line-clamp-3"
                            style={{ color: tokens.text.secondary }}
                          >
                            {ev.excerpt || ev.claim}
                          </p>
                        </div>
                        <span
                          className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{
                            color:
                              ev.reliability === 'verified'
                                ? tokens.trust.verified
                                : tokens.text.muted,
                            background:
                              ev.reliability === 'verified'
                                ? tokens.trust.high?.bg || 'rgba(16,185,129,0.1)'
                                : tokens.surfaceExtended,
                          }}
                        >
                          {ev.reliability}
                        </span>
                      </div>
                      {ev.sourceUrl && (
                        <a
                          href={ev.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] mt-1.5 hover:underline"
                          style={{ color: tokens.accent.dim }}
                        >
                          View source <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
