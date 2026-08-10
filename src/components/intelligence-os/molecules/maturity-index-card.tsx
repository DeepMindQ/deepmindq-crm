/**
 * Phase 4 — Item 7.3: Intelligence Maturity Index Card
 *
 * Displays the maturity index for a company — a composite score showing
 * how well DeepMindQ understands the company.
 *
 * Features:
 *   - Large score display with color coding
 *   - Level label (emerging → mature)
 *   - Dimension breakdown bars
 *   - Improvement suggestions
 */
'use client';

import React from 'react';

export interface MaturityDimension {
  score: number;
  weight: number;
  details: string;
}

export interface MaturityIndex {
  score: number;
  level: 'emerging' | 'developing' | 'established' | 'advanced' | 'mature';
  dimensions: {
    coverage: MaturityDimension;
    freshness: MaturityDimension;
    quality: MaturityDimension;
    diversity: MaturityDimension;
  };
  improvementSuggestions: string[];
  computedAt: string;
}

interface MaturityIndexCardProps {
  maturity: MaturityIndex;
  compact?: boolean;
}

const LEVEL_COLORS: Record<string, string> = {
  emerging: 'text-red-600',
  developing: 'text-amber-600',
  established: 'text-blue-600',
  advanced: 'text-emerald-600',
  mature: 'text-emerald-700',
};

const LEVEL_BG_COLORS: Record<string, string> = {
  emerging: 'bg-red-50',
  developing: 'bg-amber-50',
  established: 'bg-blue-50',
  advanced: 'bg-emerald-50',
  mature: 'bg-emerald-100',
};

const DIMENSION_LABELS: Record<string, string> = {
  coverage: 'Coverage',
  freshness: 'Freshness',
  quality: 'Quality',
  diversity: 'Diversity',
};

export function MaturityIndexCard({ maturity, compact = false }: MaturityIndexCardProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className={`text-lg font-bold ${LEVEL_COLORS[maturity.level]}`}>
          {maturity.score}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${LEVEL_BG_COLORS[maturity.level]} ${LEVEL_COLORS[maturity.level]}`}>
          {maturity.level}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Intelligence Maturity</h3>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-3xl font-bold ${LEVEL_COLORS[maturity.level]}`}>
              {maturity.score}
            </span>
            <span className={`text-sm px-2 py-0.5 rounded-full font-medium capitalize ${LEVEL_BG_COLORS[maturity.level]} ${LEVEL_COLORS[maturity.level]}`}>
              {maturity.level}
            </span>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>Updated</div>
          <div>{new Date(maturity.computedAt).toLocaleDateString()}</div>
        </div>
      </div>

      {/* Dimension Bars */}
      {!compact && (
        <div className="space-y-2">
          {Object.entries(maturity.dimensions).map(([key, dim]) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{DIMENSION_LABELS[key]}</span>
                <span className="text-muted-foreground">{dim.score}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${dim.score}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">{dim.details}</div>
            </div>
          ))}
        </div>
      )}

      {/* Improvement Suggestions */}
      {maturity.improvementSuggestions.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-muted-foreground">Improvement Suggestions</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            {maturity.improvementSuggestions.slice(0, 3).map((suggestion, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-amber-500 mt-0.5">→</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default MaturityIndexCard;
