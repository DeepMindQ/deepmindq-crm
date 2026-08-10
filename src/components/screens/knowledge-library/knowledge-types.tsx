'use client'

import { cardSolid, colors } from '@/components/design-system'

export const goldAlpha = (a: number) => `rgba(212,175,55,${a})`
export const greenAlpha = (a: number) => `rgba(16,185,129,${a})`
export const redAlpha = (a: number) => `rgba(239,68,68,${a})`
export const blueAlpha = (a: number) => `rgba(59,130,246,${a})`
export const blackAlpha = (a: number) => `rgba(0,0,0,${a})`
export const purpleAlpha = (a: number) => `rgba(168,85,247,${a})`
export const amberAlpha = (a: number) => `rgba(245,158,11,${a})`
export const neutralAlpha = (a: number) => `rgba(113,113,122,${a})`
export const violetAlpha = (a: number) => `rgba(139,92,246,${a})`
export const indigoAlpha = (a: number) => `rgba(99,102,241,${a})`

export const TABS = [
  { key: 'library', label: 'Knowledge Library' },
  { key: 'graph', label: 'Knowledge Graph' },
  { key: 'search', label: 'RAG Search Engine' },
  { key: 'coverage', label: 'Coverage & Gaps' },
  { key: 'upload', label: 'Upload & Extract' },
]

export const GRAPH_CATEGORY_COLORS: Record<string, string> = {
  service_line: 'var(--color-gold)',
  case_study: colors.green,
  proof_point: colors.blue,
  objection_response: colors.amber,
  cta: colors.purple,
}

export const CATEGORY_CONFIG: Record<string, { icon: typeof Layers; color: string; badge: string }> = {
  service_line: { icon: Layers, color: colors.blue, badge: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  case_study: { icon: BookOpen, color: colors.green, badge: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  proof_point: { icon: Trophy, color: colors.purple, badge: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
  objection_response: { icon: MessageSquare, color: colors.red, badge: 'bg-red-500/15 text-red-600 border-red-500/30' },
  cta: { icon: Target, color: colors.amber, badge: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
}

export const CATEGORY_LABELS: Record<string, string> = {
  service_line: 'Service Line',
  case_study: 'Case Study',
  proof_point: 'Proof Point',
  objection_response: 'Objection Response',
  cta: 'CTA',
}

export const MATCHED_FIELD_LABELS: Record<string, string> = {
  title: 'Title', summary: 'Summary', content: 'Content',
  targetIndustries: 'Industries', targetRoles: 'Roles',
  problems: 'Problems', evidence: 'Evidence', serviceLine: 'Service Line',
}

export const INDUSTRY_LIST = ['Financial Services', 'Healthcare', 'Technology', 'Manufacturing', 'Retail', 'Energy', 'Media', 'Government']
export const ROLE_LIST = ['CTO', 'CIO', 'CEO', 'COO', 'CFO', 'VP of Engineering', 'Head of AI', 'Head of Data', 'VP of Analytics', 'Cloud Architect', 'Head of Infrastructure', 'Chief Digital Officer']
export const SERVICE_LINE_LIST = ['AI & Machine Learning', 'Cloud Engineering', 'Data Engineering', 'Digital Transformation', 'Cybersecurity']

export { type KnowledgeAsset, type CoverageData, buildCoverage, buildTreemapData, CustomTreemapContent } from './knowledge-utils'

// Re-export icons used in CATEGORY_CONFIG
import { Layers, BookOpen, Trophy, MessageSquare, Target } from 'lucide-react'
