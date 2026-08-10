/**
 * G3 FIX: Admin Calibration Dashboard
 * Route: /admin/calibration
 * Displays calibration curve data from Phase 3, Item 3.1
 * Consumes /api/intelligence/calibration API
 */
'use client'

import { useState, useEffect } from 'react'
import { tokens } from '@/components/intelligence-os/design-tokens';

interface CalibrationSummary {
  dimensions: Array<{
    dimension: string
    sampleCount: number
    accuracy: number
    correctionFactor: number
    status: 'uncalibrated' | 'partially_calibrated' | 'calibrated'
    lastCalibratedAt: string | null
  }>
  overallCorrectionFactor: number
  totalSamples: number
  isCalibrated: boolean
  recommendations: string[]
}

export default function AdminCalibrationPage() {
  const [data, setData] = useState<CalibrationSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/intelligence/calibration')
      .then(res => res.ok ? res.json() : null)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="min-h-screen bg-gray-50 p-8"><div className="animate-pulse h-6 w-48 bg-gray-200 rounded mb-4" /><div className="animate-pulse h-4 w-64 bg-gray-100 rounded" /></div>

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Confidence Calibration Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor and manage confidence calibration curves (Phase 3, Item 3.1)</p>
        </div>

        {!data ? (
          <div className="bg-white rounded-lg border p-8 shadow-sm text-center">
            <p className="text-gray-400">Calibration data not available</p>
            <p className="text-sm text-gray-300 mt-2">Ensure feedback is being collected via recommendations</p>
          </div>
        ) : (<>
          {/* Overall stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border p-4 shadow-sm text-center">
              <p className="text-3xl font-bold" style={{ color: data.isCalibrated ? tokens.extended.emeraldDeep.value : tokens.extended.amberDeep.value }}>{data.isCalibrated ? 'CALIBRATED' : 'LEARNING'}</p>
              <p className="text-xs text-gray-500 mt-1">System Status</p>
            </div>
            <div className="bg-white rounded-lg border p-4 shadow-sm text-center">
              <p className="text-3xl font-bold text-gray-900">{data.totalSamples}</p>
              <p className="text-xs text-gray-500 mt-1">Total Samples</p>
            </div>
            <div className="bg-white rounded-lg border p-4 shadow-sm text-center">
              <p className="text-3xl font-bold text-gray-900">{data.overallCorrectionFactor.toFixed(3)}</p>
              <p className="text-xs text-gray-500 mt-1">Overall Correction Factor</p>
            </div>
            <div className="bg-white rounded-lg border p-4 shadow-sm text-center">
              <p className="text-3xl font-bold text-gray-900">{data.dimensions.length}</p>
              <p className="text-xs text-gray-500 mt-1">Dimensions Tracked</p>
            </div>
          </div>

          {/* Dimension details */}
          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-700">Dimension</th>
                  <th className="text-right p-3 font-medium text-gray-700">Samples</th>
                  <th className="text-right p-3 font-medium text-gray-700">Accuracy</th>
                  <th className="text-right p-3 font-medium text-gray-700">Correction</th>
                  <th className="text-center p-3 font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.dimensions.map((dim, i) => (
                  <tr key={dim.dimension} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    <td className="p-3 font-medium">{dim.dimension}</td>
                    <td className="p-3 text-right tabular-nums">{dim.sampleCount}</td>
                    <td className="p-3 text-right tabular-nums">{(dim.accuracy * 100).toFixed(1)}%</td>
                    <td className="p-3 text-right tabular-nums">{dim.correctionFactor.toFixed(3)}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        dim.status === 'calibrated' ? 'bg-green-100 text-green-700' :
                        dim.status === 'partially_calibrated' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{dim.status.replace(/_/g, ' ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recommendations */}
          {data.recommendations.length > 0 && (
            <div className="bg-white rounded-lg border p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Recommendations</h2>
              <ul className="space-y-1">
                {data.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">&#8226;</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>)}
      </div>
    </div>
  )
}
