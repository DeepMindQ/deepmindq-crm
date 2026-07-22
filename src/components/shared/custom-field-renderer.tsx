'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Calendar, Hash, ToggleLeft, List } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CustomFieldRendererProps {
  entityType: 'company' | 'contact'
  entityId: string
  compact?: boolean
}

interface FieldValue {
  id: string
  fieldId: string
  rawValue: string | null
  field: {
    id: string
    displayName: string
    dataType: string
    entityType: string
  }
}

function formatValue(dataType: string, rawValue: string | null): string {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return '—'
  }
  switch (dataType) {
    case 'date':
      try {
        const d = new Date(rawValue)
        if (isNaN(d.getTime())) return rawValue
        return d.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      } catch {
        return rawValue
      }
    case 'checkbox':
      return rawValue === 'true' || rawValue === '1' ? 'Yes' : 'No'
    case 'number':
      return rawValue
    default:
      return rawValue
  }
}

function getDataTypeIcon(dataType: string) {
  switch (dataType) {
    case 'date':
      return <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
    case 'number':
      return <Hash className="h-3.5 w-3.5 text-muted-foreground" />
    case 'checkbox':
      return <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
    case 'dropdown':
      return <List className="h-3.5 w-3.5 text-muted-foreground" />
    default:
      return <FileText className="h-3.5 w-3.5 text-muted-foreground" />
  }
}

export function CustomFieldRenderer({
  entityType,
  entityId,
  compact = false,
}: CustomFieldRendererProps) {
  const [values, setValues] = useState<FieldValue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const entityTypeUpper =
      entityType === 'company' ? 'Company' : 'Contact'

    let cancelled = false
    fetch(
      `/api/custom-fields/values?entityType=${entityTypeUpper}&entityId=${entityId}`,
    )
      .then((r) => r.json())
      .then((json) => {
        if (json.data && !cancelled) {
          // Filter to only show values that have content
          const filled = json.data.filter(
            (v: FieldValue) => v.rawValue !== null && v.rawValue !== '',
          )
          setValues(filled)
        }
      })
      .catch((err) => { console.error('[CustomFieldRenderer] Error:', err) })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [entityType, entityId])

  if (loading) {
    if (compact) {
      return <Skeleton className="h-4 w-32" />
    }
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3.5 w-3.5" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    )
  }

  if (values.length === 0) return null

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs text-muted-foreground"
          >
            <span className="font-medium text-foreground/70">
              {v.field.displayName}:
            </span>
            {formatValue(v.field.dataType, v.rawValue)}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <FileText className="h-3.5 w-3.5" />
        Custom Fields
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {values.map((v) => (
          <div
            key={v.id}
            className="flex items-center gap-2 py-1.5 text-sm"
          >
            {getDataTypeIcon(v.field.dataType)}
            <span className="text-muted-foreground min-w-[100px] truncate">
              {v.field.displayName}
            </span>
            <span className="font-medium text-foreground/90 truncate">
              {formatValue(v.field.dataType, v.rawValue)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
