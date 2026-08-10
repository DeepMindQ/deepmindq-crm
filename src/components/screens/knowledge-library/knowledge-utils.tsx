import { colors } from '@/components/design-system'

/* ═══════════════════════════════════════════════════
   Knowledge Library — Data Utilities & Treemap Rendering
   Extracted from knowledge-library-screen.tsx (Task 3.2)
   ═══════════════════════════════════════════════════ */

export const INDUSTRY_LIST = [
  'Financial Services', 'Healthcare', 'Technology', 'Manufacturing',
  'Retail', 'Energy', 'Media', 'Government',
]

export const ROLE_LIST = [
  'CTO', 'CIO', 'CEO', 'COO', 'CFO', 'VP of Engineering',
  'Head of AI', 'Head of Data', 'VP of Analytics',
  'Cloud Architect', 'Head of Infrastructure', 'Chief Digital Officer',
]

export const SERVICE_LINE_LIST = [
  'AI & Machine Learning', 'Cloud Engineering', 'Data Engineering',
  'Digital Transformation', 'Cybersecurity',
]

export const CATEGORY_LABELS: Record<string, string> = {
  service_line: 'Service Line',
  case_study: 'Case Study',
  proof_point: 'Proof Point',
  objection_response: 'Objection Response',
  cta: 'CTA',
}

export interface CoverageData {
  industries: { name: string; count: number; coverage: number; gaps: string[] }[]
  roles: { name: string; count: number; coverage: number }[]
  serviceLines: { name: string; count: number; caseStudies: number; proofPoints: number }[]
  categories: { name: string; count: number }[]
  totalAssets: number
  engineHealth: { searchModes: string[]; lastSearch: string | null; avgScore: number }
}

export interface KnowledgeAsset {
  id: string
  title: string
  summary: string
  content?: string
  category: string
  serviceLine?: string
  targetIndustries?: string
  targetRoles?: string
  problems?: string
  evidence?: string
  source?: string
  isActive: boolean
  createdAt: string
  [key: string]: any
}

/** Build coverage data from knowledge assets */
export function buildCoverage(assets: KnowledgeAsset[]): CoverageData {
  const industries: CoverageData['industries'] = INDUSTRY_LIST.map(name => {
    const matching = assets.filter(a => a.targetIndustries?.toLowerCase().includes(name.toLowerCase()))
    const categories = new Set(matching.map(a => a.category))
    const gaps: string[] = []
    if (!categories.has('case_study')) gaps.push('Missing case studies')
    if (!categories.has('proof_point')) gaps.push('Missing proof points')
    if (matching.length === 0) gaps.push('No knowledge assets')
    const coverage = matching.length === 0 ? 0 : Math.min(100, Math.round((categories.size / 3) * 100) + (matching.length > 2 ? 20 : 0))
    return { name, count: matching.length, coverage: Math.min(100, coverage), gaps }
  })

  const roles: CoverageData['roles'] = ROLE_LIST.map(name => {
    const matching = assets.filter(a => a.targetRoles?.toLowerCase().includes(name.toLowerCase()))
    return { name, count: matching.length, coverage: matching.length > 0 ? Math.min(100, matching.length * 25) : 0 }
  })

  const serviceLines: CoverageData['serviceLines'] = SERVICE_LINE_LIST.map(name => {
    const matching = assets.filter(a => a.serviceLine?.toLowerCase().includes(name.toLowerCase()))
    return {
      name,
      count: matching.length,
      caseStudies: matching.filter(a => a.category === 'case_study').length,
      proofPoints: matching.filter(a => a.category === 'proof_point').length,
    }
  })

  const categories: CoverageData['categories'] = Object.entries(CATEGORY_LABELS).map(([name, label]) => ({
    name,
    count: assets.filter(a => a.category === name).length,
  }))

  return {
    industries,
    roles,
    serviceLines,
    categories,
    totalAssets: assets.length,
    engineHealth: {
      searchModes: ['keyword', 'semantic', 'hybrid'],
      lastSearch: null,
      avgScore: 0,
    },
  }
}

/** Build treemap data from graph nodes, grouped by service line */
export function buildTreemapData(nodes: any[]) {
  const grouped: Record<string, any[]> = {}
  nodes.forEach(node => {
    const group = node.group || 'Unassigned'
    if (!grouped[group]) grouped[group] = []
    grouped[group].push(node)
  })

  return [
    {
      name: 'Knowledge Base',
      children: Object.entries(grouped).map(([name, children]) => ({
        name,
        children: children.map((child: any) => ({
          name: child.label,
          size: Math.max(1, child.score || child.size || 1),
          category: child.category,
          id: child.id,
          node: child,
        })),
      })),
    },
  ]
}

const GRAPH_CATEGORY_COLORS: Record<string, string> = {
  service_line: 'var(--color-gold)',
  case_study: colors.green,
  proof_point: colors.blue,
  objection_response: colors.amber,
  cta: colors.purple,
}

const blackAlpha = (a: number) => `rgba(0,0,0,${a})`

/** Custom treemap cell renderer */
export function CustomTreemapContent(props: any) {
  const { x, y, width, height, name, depth, category, node } = props

  if (width < 40 || height < 28) return null

  if (depth === 1) {
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="${blackAlpha(0.02)}"
          stroke="${blackAlpha(0.05)}"
          rx={6}
        />
        {width > 80 && (
          <text
            x={x + 8}
            y={y + 18}
            fill="${blackAlpha(0.12)}"
            fontSize={10}
            fontWeight={600}
          >
            {name}
          </text>
        )}
      </g>
    )
  }

  const color = GRAPH_CATEGORY_COLORS[category] || 'var(--color-gold)'
  const opacity = 0.7 + (Math.min((node?.score || 1) / 10, 1)) * 0.3
  const isTooSmall = width < 60 || height < 36

  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={() => node && props.onNodeClick?.(node)}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={opacity * 0.25}
        stroke={color}
        strokeOpacity={0.4}
        strokeWidth={1}
        rx={4}
      />
      {!isTooSmall && (
        <text
          x={x + 6}
          y={y + height / 2 + 1}
          fill="${blackAlpha(0.3)}"
          fontSize={10}
          fontWeight={500}
        >
          {width > 100 && name.length > 0
            ? name.length > Math.floor((width - 12) / 6)
              ? name.slice(0, Math.floor((width - 12) / 6)) + '…'
              : name
            : ''}
        </text>
      )}
    </g>
  )
}
