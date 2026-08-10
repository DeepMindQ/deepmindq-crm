'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Loader2, Shield, CheckCircle2, X, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

/* ═══════════════════════════════════════════════════
   Intelligence Health Tab
   Extracted from company-profile-screen.tsx (Task 3.2)
   ═══════════════════════════════════════════════════ */

export function IntelligenceTab({ companyId }: { companyId: string }) {
  const [validating, setValidating] = useState(false)

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['intel-health', companyId],
    queryFn: async () => {
      const r = await fetch(`/api/g-intelligence/companies/${companyId}/health`)
      if (!r.ok) throw new Error('Not calculated')
      return r.json()
    },
    retry: false,
  })

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['intel-report', companyId],
    queryFn: () => fetch(`/api/g-intelligence/companies/${companyId}/validation-report`).then(r => r.json()),
    retry: false,
  })

  const qc = useQueryClient()
  const handleValidate = async () => {
    setValidating(true)
    try {
      const res = await fetch(`/api/g-intelligence/companies/${companyId}/validate`, { method: 'POST' })
      if (!res.ok) throw new Error('Validation failed')
      toast.success('Validation complete')
      await Promise.all([qc.invalidateQueries({ queryKey: ['intel-health', companyId] }), qc.invalidateQueries({ queryKey: ['intel-report', companyId] })])
    } catch { toast.error('Validation failed') }
    finally { setValidating(false) }
  }

  const getTierLabel = (score: number) => score >= 90 ? 'EXCELLENT' : score >= 70 ? 'GOOD' : score >= 50 ? 'FAIR' : 'POOR'
  const getTierColorLocal = (score: number) => score >= 90 ? 'text-emerald-600 bg-emerald-50' : score >= 70 ? 'text-blue-600 bg-blue-50' : score >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'

  const fieldCoverage = health?.fieldCoverage as Record<string, boolean> | null
  const FIELD_LABELS: Record<string, string> = { industry: 'Industry', revenue: 'Revenue', employeeCount: 'Employees', techStack: 'Tech Stack', fundingStage: 'Funding', businessOverview: 'Overview', website: 'Website', location: 'Location', country: 'Country', contacts: 'Contacts', signals: 'Signals', evidence: 'Evidence' }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale" onClick={handleValidate} disabled={validating}>
          {validating ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Sparkles className="size-3.5 mr-1.5" />}
          Run Full Validation
        </Button>
      </div>

      {healthLoading ? <Skeleton className="h-40 w-full rounded-xl" /> : !health ? (
        <div className="text-center py-12 text-gray-400">
          <Shield className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No health data yet. Click &quot;Run Full Validation&quot; to calculate.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-800">Overall Intelligence Health</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${getTierColorLocal(health.overallHealthScore)}`}>
                {health.overallHealthScore}% — {getTierLabel(health.overallHealthScore)}
              </span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${health.overallHealthScore >= 70 ? 'bg-emerald-500' : health.overallHealthScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${health.overallHealthScore}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Data Completeness', score: health.dataCompletenessScore, detail: `${health.filledFields}/${health.totalTrackedFields} fields` },
              { label: 'Signal Coverage', score: health.signalCoverageScore, detail: `${health.activeSignals} active / ${health.totalSignals} total` },
              { label: 'Evidence Quality', score: health.evidenceCoverageScore, detail: `${health.activeEvidence} active / ${health.totalEvidence} total` },
              { label: 'Contact Coverage', score: health.contactCoverageScore, detail: `${health.totalContacts} contacts` },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{item.label}</span>
                  <span className={`text-lg font-bold ${item.score >= 70 ? 'text-emerald-600' : item.score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{item.score}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${item.score >= 70 ? 'bg-emerald-500' : item.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${item.score}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">{item.detail}</p>
              </div>
            ))}
          </div>

          {fieldCoverage && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Field Coverage</h3>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(FIELD_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    {fieldCoverage[key] ? <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" /> : <X className="size-3.5 text-red-400 shrink-0" />}
                    <span className={fieldCoverage[key] ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Signal Validation Summary</h3>
                <div className="flex gap-4">
                  {[
                    { label: 'VALID', count: report.signalValidationSummary.valid, color: 'text-emerald-600 bg-emerald-50' },
                    { label: 'WEAK', count: report.signalValidationSummary.weak, color: 'text-amber-600 bg-amber-50' },
                    { label: 'CONFLICTING', count: report.signalValidationSummary.conflicting, color: 'text-orange-600 bg-orange-50' },
                    { label: 'EXPIRED', count: report.signalValidationSummary.expired, color: 'text-gray-500 bg-gray-100' },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <div className={`text-xl font-bold ${s.color.split(' ')[0]}`}>{s.count}</div>
                      <div className="text-[11px] text-gray-500 uppercase">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Active Conflicts</h3>
                {report.topConflicts.length === 0 ? (
                  <p className="text-sm text-gray-400">No open conflicts detected</p>
                ) : (
                  <div className="space-y-2">
                    {report.topConflicts.map((c: { id: string; conflictType: string; description: string; severity: string }) => (
                      <div key={c.id} className="flex items-start gap-2 p-2 rounded-lg bg-orange-50 border border-orange-100">
                        <AlertTriangle className="size-3.5 text-orange-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-orange-700">{c.conflictType.replace(/_/g, ' ')}</span>
                            <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${c.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{c.severity.toUpperCase()}</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{c.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
