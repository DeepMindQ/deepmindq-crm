import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

afterEach(() => cleanup())
import { Building2, Users, Mail, Sparkles, FileText, ShieldCheck, Upload, Trash2, Edit3, AlertTriangle } from 'lucide-react'
import {
  EmptyState,
  ScoreGauge,
  TrendIndicator,
  Sparkline,
  StatusDot,
  SkeletonGrid,
  SortableHeader,
  getActivityIcon,
} from '../design-system'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        icon={Building2}
        title="No companies yet"
        description="Start by adding your first company to the CRM."
      />
    )
    expect(screen.getByText('No companies yet')).toBeInTheDocument()
    expect(screen.getByText('Start by adding your first company to the CRM.')).toBeInTheDocument()
  })

  it('renders action button when actionLabel is provided', () => {
    render(
      <EmptyState
        icon={Building2}
        title="Empty"
        description="Nothing here"
        actionLabel="Add Company"
        onAction={() => {}}
      />
    )
    expect(screen.getByText('Add Company')).toBeInTheDocument()
  })

  it('renders secondary action button when secondaryActionLabel is provided', () => {
    render(
      <EmptyState
        icon={Building2}
        title="Empty"
        description="Nothing here"
        actionLabel="Primary"
        onAction={() => {}}
        secondaryActionLabel="Secondary"
        onSecondaryAction={() => {}}
      />
    )
    expect(screen.getByText('Primary')).toBeInTheDocument()
    expect(screen.getByText('Secondary')).toBeInTheDocument()
  })

  it('renders nothing when actionLabel is undefined and onAction is provided', () => {
    const { container } = render(
      <EmptyState
        icon={Building2}
        title="Empty"
        description="Nothing here"
        onAction={() => {}}
      />
    )
    // No buttons should be present
    const buttons = container.querySelectorAll('button')
    expect(buttons).toHaveLength(0)
  })
})

describe('ScoreGauge', () => {
  it('renders with a score value', () => {
    render(<ScoreGauge score={75} />)
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('renders the default label', () => {
    const { container } = render(<ScoreGauge score={50} />)
    expect(container.querySelector('p.text-sm')).toHaveTextContent('Intel Score')
  })

  it('renders custom label and sublabel', () => {
    render(<ScoreGauge score={90} label="Health" sublabel="Updated today" />)
    expect(screen.getByText('Health')).toBeInTheDocument()
    expect(screen.getByText('Updated today')).toBeInTheDocument()
  })

  it('renders "of 100" text', () => {
    const { container } = render(<ScoreGauge score={42} />)
    expect(container.querySelector('span.text-\\[10px\\]')).toHaveTextContent('of 100')
  })

  it('renders segments when provided', () => {
    const segments = [
      { label: 'Tech', value: 80, color: '#059669' },
      { label: 'Size', value: 60, color: '#D97706' },
    ]
    render(<ScoreGauge score={70} segments={segments} />)
    expect(screen.getByText('Tech')).toBeInTheDocument()
    expect(screen.getByText('Size')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
  })

  it('renders an SVG element', () => {
    const { container } = render(<ScoreGauge score={50} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})

describe('TrendIndicator', () => {
  it('renders with a positive value showing up arrow', () => {
    render(<TrendIndicator value={12} />)
    expect(screen.getByText(/↑ 12%/)).toBeInTheDocument()
  })

  it('renders with a negative value showing down arrow', () => {
    render(<TrendIndicator value={-8} />)
    expect(screen.getByText(/↓ 8%/)).toBeInTheDocument()
  })

  it('renders with zero value', () => {
    render(<TrendIndicator value={0} />)
    expect(screen.getByText(/↑ 0%/)).toBeInTheDocument()
  })

  it('renders default period text', () => {
    const { container } = render(<TrendIndicator value={5} />)
    expect(container.querySelector('span.text-gray-400')).toHaveTextContent('vs last week')
  })

  it('renders custom period text', () => {
    render(<TrendIndicator value={5} period="vs yesterday" />)
    expect(screen.getByText('vs yesterday')).toBeInTheDocument()
  })

  it('applies emerald color for positive values', () => {
    const { container } = render(<TrendIndicator value={10} />)
    const span = container.querySelector('.text-emerald-600')
    expect(span).toBeInTheDocument()
  })

  it('applies red color for negative values', () => {
    const { container } = render(<TrendIndicator value={-10} />)
    const span = container.querySelector('.text-red-600')
    expect(span).toBeInTheDocument()
  })
})

describe('Sparkline', () => {
  it('renders with a data array', () => {
    const { container } = render(<Sparkline data={[1, 3, 2, 5, 4]} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders nothing with fewer than 2 data points', () => {
    const { container } = render(<Sparkline data={[1]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing with empty data', () => {
    const { container } = render(<Sparkline data={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing with null data', () => {
    const { container } = render(<Sparkline data={null as unknown as number[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('contains a polyline element', () => {
    const { container } = render(<Sparkline data={[1, 3, 2, 5, 4]} />)
    const polyline = container.querySelector('polyline')
    expect(polyline).toBeInTheDocument()
  })

  it('contains a polygon element for area fill', () => {
    const { container } = render(<Sparkline data={[1, 3, 2, 5, 4]} />)
    const polygon = container.querySelector('polygon')
    expect(polygon).toBeInTheDocument()
  })

  it('renders with custom color', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} color="#FF0000" />)
    const polyline = container.querySelector('polyline')
    expect(polyline?.getAttribute('stroke')).toBe('#FF0000')
  })
})

describe('StatusDot', () => {
  it('renders for fresh status', () => {
    const { container } = render(<StatusDot status="fresh" />)
    expect(container.querySelector('.bg-emerald-500')).toBeInTheDocument()
  })

  it('renders for stale status', () => {
    const { container } = render(<StatusDot status="stale" />)
    expect(container.querySelector('.bg-amber-400')).toBeInTheDocument()
  })

  it('renders for old status', () => {
    const { container } = render(<StatusDot status="old" />)
    expect(container.querySelector('.bg-red-400')).toBeInTheDocument()
  })

  it('renders for unknown status', () => {
    const { container } = render(<StatusDot status="unknown" />)
    expect(container.querySelector('.bg-gray-300')).toBeInTheDocument()
  })

  it('renders pulse animation when pulse is true and status is fresh', () => {
    const { container } = render(<StatusDot status="fresh" pulse={true} />)
    expect(container.querySelector('.animate-ping')).toBeInTheDocument()
  })

  it('does not render pulse when status is not fresh', () => {
    const { container } = render(<StatusDot status="stale" pulse={true} />)
    expect(container.querySelector('.animate-ping')).not.toBeInTheDocument()
  })

  it('does not render pulse when pulse is false', () => {
    const { container } = render(<StatusDot status="fresh" pulse={false} />)
    expect(container.querySelector('.animate-ping')).not.toBeInTheDocument()
  })
})

describe('SkeletonGrid', () => {
  it('renders with default props', () => {
    const { container } = render(<SkeletonGrid />)
    // Default cols=4, so there should be 4 skeleton cards in the grid
    const gridCards = container.querySelectorAll('.grid > div')
    expect(gridCards).toHaveLength(4)
  })

  it('renders panel skeletons (default 2 panels)', () => {
    const { container } = render(<SkeletonGrid />)
    // Panels are outside the grid
    const panels = container.querySelectorAll(':scope > div:not(.grid)')
    // The top-level div wraps the grid and panels; panels are direct children of the space-y-6 wrapper
    // Actually, the structure is: div.space-y-6 > div.grid + div + div (panels)
    const allChildren = container.firstElementChild?.children
    // First child is grid, rest are panels
    expect(allChildren?.length).toBe(3) // 1 grid + 2 panels
  })

  it('renders with custom cols and panels', () => {
    const { container } = render(<SkeletonGrid cols={2} panels={1} />)
    const gridCards = container.querySelector('.grid')?.children
    expect(gridCards?.length).toBe(2)
    const allChildren = container.firstElementChild?.children
    expect(allChildren?.length).toBe(2) // 1 grid + 1 panel
  })

  it('renders skeleton elements with animate-pulse', () => {
    const { container } = render(<SkeletonGrid />)
    const pulses = container.querySelectorAll('.animate-pulse')
    expect(pulses.length).toBeGreaterThan(0)
  })
})

describe('SortableHeader', () => {
  it('renders with label', () => {
    render(
      <table>
        <thead>
          <tr>
            <SortableHeader
              label="Company Name"
              sortKey="name"
              currentSort="name"
              currentDir="asc"
              onSort={() => {}}
            />
          </tr>
        </thead>
      </table>
    )
    expect(screen.getByText('Company Name')).toBeInTheDocument()
  })

  it('renders as a th element', () => {
    const { container } = render(
      <table>
        <thead>
          <tr>
            <SortableHeader
              label="Score"
              sortKey="score"
              currentSort="name"
              currentDir="asc"
              onSort={() => {}}
            />
          </tr>
        </thead>
      </table>
    )
    const th = container.querySelector('th')
    expect(th).toBeInTheDocument()
  })

  it('calls onSort when clicked', () => {
    let clickedKey = ''
    const { container } = render(
      <table>
        <thead>
          <tr>
            <SortableHeader
              label="Score"
              sortKey="score"
              currentSort="name"
              currentDir="asc"
              onSort={(key) => { clickedKey = key }}
            />
          </tr>
        </thead>
      </table>
    )
    container.querySelector('th')!.click()
    expect(clickedKey).toBe('score')
  })
})

describe('getActivityIcon', () => {
  it('returns correct icon data for company_created', () => {
    const result = getActivityIcon('company_created')
    expect(result.icon).toBe(Building2)
    expect(result.color).toBe('text-blue-600')
    expect(result.bg).toBe('bg-blue-50')
  })

  it('returns correct icon data for contact_added', () => {
    const result = getActivityIcon('contact_added')
    expect(result.icon).toBe(Users)
    expect(result.color).toBe('text-violet-600')
  })

  it('returns correct icon data for email_generated', () => {
    const result = getActivityIcon('email_generated')
    expect(result.icon).toBe(Mail)
    expect(result.color).toBe('text-amber-600')
  })

  it('returns correct icon data for research_generated', () => {
    const result = getActivityIcon('research_generated')
    expect(result.icon).toBe(Sparkles)
    expect(result.color).toBe('text-indigo-600')
  })

  it('returns correct icon data for note_added', () => {
    const result = getActivityIcon('note_added')
    expect(result.icon).toBe(FileText)
    expect(result.color).toBe('text-gray-600')
  })

  it('returns correct icon data for email_validated', () => {
    const result = getActivityIcon('email_validated')
    expect(result.icon).toBe(ShieldCheck)
    expect(result.color).toBe('text-emerald-600')
  })

  it('returns correct icon data for import_completed', () => {
    const result = getActivityIcon('import_completed')
    expect(result.icon).toBe(Upload)
    expect(result.color).toBe('text-blue-600')
  })

  it('returns correct icon data for deleted', () => {
    const result = getActivityIcon('deleted')
    expect(result.icon).toBe(Trash2)
    expect(result.color).toBe('text-red-500')
  })

  it('returns correct icon data for status_changed', () => {
    const result = getActivityIcon('status_changed')
    expect(result.icon).toBe(Edit3)
    expect(result.color).toBe('text-amber-600')
  })

  it('returns correct icon data for error', () => {
    const result = getActivityIcon('error')
    expect(result.icon).toBe(AlertTriangle)
    expect(result.color).toBe('text-red-500')
  })

  it('returns fallback icon for unknown actions', () => {
    const result = getActivityIcon('unknown_action_xyz')
    expect(result.icon).toBe(FileText)
    expect(result.color).toBe('text-gray-500')
    expect(result.bg).toBe('bg-gray-100')
  })

  it('matches action strings with spaces (normalizes to underscores)', () => {
    const result = getActivityIcon('company created')
    expect(result.icon).toBe(Building2)
  })
})