/**
 * G3 FIX: Admin Enterprise Configuration Page
 * Route: /admin/config
 * Consumes /api/enterprise/config API (Phase 3, Item 5.4)
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface TenantConfig {
  id?: string
  tenantId: string
  confidenceWeights: Record<string, number>
  recommendationWeights: Record<string, number>
  prioritySignals: string[]
  targetIndustries: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function AdminConfigPage() {
  const [tenantId, setTenantId] = useState('')
  const [config, setConfig] = useState<TenantConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchConfig = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/enterprise/config?tenantId=${tenantId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) setConfig(data.data)
        else setConfig(null)
      } else {
        setConfig(null)
      }
    } catch {
      setConfig(null)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const handleSave = async () => {
    if (!tenantId) { toast.error('Tenant ID is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/enterprise/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ...config }),
      })
      if (res.ok) {
        toast.success('Configuration saved')
        fetchConfig()
      } else {
        toast.error('Failed to save configuration')
      }
    } catch {
      toast.error('Error saving configuration')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enterprise Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">Manage tenant scoring weights, signal priorities, and ICP parameters (Phase 3, Item 5.4)</p>
        </div>

        <div className="bg-white rounded-lg border p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">Tenant ID</label>
          <input type="text" value={tenantId} onChange={(e) => setTenantId(e.target.value)}
            placeholder="Enter tenant ID" className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
          <button onClick={fetchConfig} disabled={loading || !tenantId} className="mt-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Loading...' : 'Load Configuration'}
          </button>
        </div>

        {config && (<>
          <div className="bg-white rounded-lg border p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Confidence Weights</h2>
            <div className="space-y-2">
              {Object.entries(config.confidenceWeights || {}).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 w-48">{key}</label>
                  <input type="range" min="0" max="1" step="0.05" value={value}
                    onChange={(e) => setConfig({ ...config, confidenceWeights: { ...config.confidenceWeights, [key]: parseFloat(e.target.value) } })}
                    className="flex-1" />
                  <span className="text-sm text-gray-500 w-12 text-right">{value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Recommendation Weights</h2>
            <div className="space-y-2">
              {Object.entries(config.recommendationWeights || {}).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 w-48">{key}</label>
                  <input type="range" min="0" max="1" step="0.05" value={value}
                    onChange={(e) => setConfig({ ...config, recommendationWeights: { ...config.recommendationWeights, [key]: parseFloat(e.target.value) } })}
                    className="flex-1" />
                  <span className="text-sm text-gray-500 w-12 text-right">{value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Priority Signals</h2>
            <input type="text" value={(config.prioritySignals || []).join(', ')}
              onChange={(e) => setConfig({ ...config, prioritySignals: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              className="w-full border rounded px-3 py-2 text-sm" placeholder="funding,hiring,technology_change" />
          </div>

          <div className="bg-white rounded-lg border p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Target Industries (ICP)</h2>
            <input type="text" value={(config.targetIndustries || []).join(', ')}
              onChange={(e) => setConfig({ ...config, targetIndustries: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              className="w-full border rounded px-3 py-2 text-sm" placeholder="Technology,Healthcare,Finance" />
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </>)}

        {!config && tenantId && !loading && (
          <div className="bg-white rounded-lg border p-8 shadow-sm text-center">
            <p className="text-gray-400">No configuration found for tenant &quot;{tenantId}&quot;</p>
          </div>
        )}
      </div>
    </div>
  )
}
