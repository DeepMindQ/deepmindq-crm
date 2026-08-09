/**
 * G3 FIX: Intelligence Coverage Heatmap Page
 * Route: /admin/heatmap
 * Displays companies x intelligence dimensions matrix from Phase 3, Item 5.5
 * Consumes /api/intelligence/heatmap API
 */
'use client'

import { useState, useEffect } from 'react'

interface HeatmapRow {
  companyId: string
  companyName: string
  industry: string
  intelligenceScore: number | null
  dimensions: Record<string, number>
}

export default function AdminHeatmapPage() {
  const [rows, setRows] = useState<HeatmapRow[]>([])
  const [dimensions, setDimensions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (filter) params.set('industry', filter)
    fetch(`/api/intelligence/heatmap?${params.toString()}&limit=100`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.companies) {
          setRows(data.companies)
          if (data.companies.length > 0 && data.companies[0].dimensions) {
            setDimensions(Object.keys(data.companies[0].dimensions))
          }
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [filter])

  if (loading) return <div className="min-h-screen bg-gray-50 p-8"><div className="animate-pulse h-6 w-48 bg-gray-200 rounded mb-4" /><div className="animate-pulse h-4 w-64 bg-gray-100 rounded" /></div>

  const getColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-green-400'
    if (score >= 40) return 'bg-yellow-400'
    if (score >= 20) return 'bg-orange-400'
    return 'bg-red-400'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-full mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Intelligence Coverage Heatmap</h1>
            <p className="text-sm text-gray-500 mt-1">Companies x Intelligence Dimensions (Phase 3, Item 5.5)</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by industry" className="border rounded px-3 py-1.5 text-sm" />
            <span className="text-sm text-gray-500">{rows.length} companies</span>
          </div>
        </div>

        <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left p-2 font-medium text-gray-700 min-w-[120px]">Company</th>
                <th className="text-left p-2 font-medium text-gray-700 min-w-[80px]">Industry</th>
                <th className="text-center p-2 font-medium text-gray-700 min-w-[50px]">Score</th>
                {dimensions.map(dim => (
                  <th key={dim} className="text-center p-2 font-medium text-gray-700 min-w-[50px]">{dim.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.companyId} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                  <td className="p-2 font-medium truncate max-w-[200px]" title={row.companyName}>{row.companyName}</td>
                  <td className="p-2 text-gray-500 truncate">{row.industry || '—'}</td>
                  <td className="p-2 text-center font-bold">{row.intelligenceScore ?? '—'}</td>
                  {dimensions.map(dim => {
                    const score = (row.dimensions?.[dim] ?? 0) * 100
                    return (
                      <td key={dim} className="p-1">
                        <div className={`w-8 h-8 rounded mx-auto flex items-center justify-center text-white text-[10px] font-bold ${getColor(score)}`}
                          title={`${dim}: ${score.toFixed(0)}%`}>
                          {score.toFixed(0)}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-green-500" /> 80+</span>
          <span className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-green-400" /> 60-79</span>
          <span className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-yellow-400" /> 40-59</span>
          <span className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-orange-400" /> 20-39</span>
          <span className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-red-400" /> &lt;20</span>
        </div>
      </div>
    </div>
  )
}
