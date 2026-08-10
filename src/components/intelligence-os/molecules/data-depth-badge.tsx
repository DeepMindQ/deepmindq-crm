/**
 * Phase 4 — Item 5.6: Data Depth Badge
 *
 * Visual badge showing the data depth classification of a recommendation:
 * comprehensive, moderate, limited, or minimal.
 *
 * Design follows the Intelligence OS atom/molecule pattern.
 */
'use client';

import React from 'react';

type DataDepthLevel = 'comprehensive' | 'moderate' | 'limited' | 'minimal';

interface DataDepthBadgeProps {
  depth: DataDepthLevel;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const DEPTH_CONFIG: Record<DataDepthLevel, {
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  description: string;
  icon: string;
}> = {
  comprehensive: {
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    label: 'Comprehensive',
    description: 'Rich intelligence across all dimensions',
    icon: '●●●●',
  },
  moderate: {
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'Moderate',
    description: 'Good coverage across key dimensions',
    icon: '●●●○',
  },
  limited: {
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    label: 'Limited',
    description: 'Sparse data — some dimensions missing',
    icon: '●●○○',
  },
  minimal: {
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Minimal',
    description: 'Very little intelligence available',
    icon: '●○○○',
  },
};

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-3 py-1',
  lg: 'text-base px-4 py-1.5',
};

export function DataDepthBadge({ depth, size = 'md', showLabel = true }: DataDepthBadgeProps) {
  const config = DEPTH_CONFIG[depth];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full border
        ${config.color} ${config.bgColor} ${config.borderColor}
        ${SIZE_CLASSES[size]}
      `}
      title={config.description}
    >
      <span className="text-[0.6em] tracking-widest opacity-60" aria-hidden="true">
        {config.icon}
      </span>
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

export default DataDepthBadge;
