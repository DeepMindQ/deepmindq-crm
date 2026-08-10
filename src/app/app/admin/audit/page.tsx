/**
 * Phase 7.2 — Admin Dashboard: Activity Audit Log
 *
 * Searchable, filterable audit log of all platform activity.
 * Fetches from /api/security/audit and /api/admin/access-audit.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ──

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface AccessAuditEntry {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

type TabType = 'comprehensive' | 'access';

const ACTION_OPTIONS = [
  'all',
  'create',
  'read',
  'update',
  'delete',
  'export',
  'login',
  'logout',
  'admin_access',
  'write',
];

const ENTITY_OPTIONS = [
  'all',
  'Company',
  'Contact',
  'User',
  'Signal',
  'Intelligence',
  'Knowledge',
  'Session',
  'AuditLog',
  'ScoringConfig',
  'RetentionPolicy',
  'EnvironmentConfig',
  'DataExport',
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function AdminAuditPage() {
  // ── Filter State ──
  const [tab, setTab] = useState<TabType>('comprehensive');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [actionType, setActionType] = useState('all');
  const [entityType, setEntityType] = useState('all');
  const [userId, setUserId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [_searching, setSearching] = useState(false);

  // ── Data State ──
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [accessEntries, setAccessEntries] = useState<AccessAuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // ── Fetch comprehensive audit log ──
  const fetchAuditLog = useCallback(async () => {
    if (tab !== 'comprehensive') return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (actionType !== 'all') params.set('action', actionType);
      if (entityType !== 'all') params.set('entity', entityType);
      if (userId) params.set('actorId', userId);
      params.set('limit', String(pageSize));
      params.set('offset', String((page - 1) * pageSize));

      const res = await fetch(`/api/security/audit?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        const data = json.data;
        setAuditEntries(data.data || data.entries || data || []);
        setTotal(data.total || data.data?.length || 0);
      } else {
        setError(json.error || 'Failed to fetch audit log');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [tab, startDate, endDate, actionType, entityType, userId, page, pageSize]);

  // ── Fetch access audit log ──
  const fetchAccessAudit = useCallback(async () => {
    if (tab !== 'access') return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (actionType !== 'all') params.set('action', actionType);
      if (entityType !== 'all') params.set('entityType', entityType);
      if (userId) params.set('userId', userId);
      params.set('limit', String(pageSize));
      params.set('offset', String((page - 1) * pageSize));

      const res = await fetch(`/api/admin/access-audit?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setAccessEntries(json.data.data || json.data || []);
        setTotal(json.data.total || 0);
      } else {
        setError(json.error || 'Failed to fetch access audit');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [tab, startDate, endDate, actionType, entityType, userId, page, pageSize]);

  useEffect(() => {
    if (tab === 'comprehensive') fetchAuditLog();
    else fetchAccessAudit();
  }, [fetchAuditLog, fetchAccessAudit, tab]);

  const handleSearch = () => {
    setPage(1);
    setSearching(true);
    if (tab === 'comprehensive') fetchAuditLog();
    else fetchAccessAudit();
    setTimeout(() => setSearching(false), 300);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (actionType !== 'all') params.set('action', actionType);
      if (entityType !== 'all') params.set('entity', entityType);
      params.set('format', 'csv');
      params.set('mode', 'export');

      const res = await fetch(`/api/security/audit?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const truncate = (str: string | null | undefined, max: number) => {
    if (!str) return '—';
    return str.length > max ? str.substring(0, max) + '...' : str;
  };

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Header ── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            Searchable, filterable audit trail of all platform activity. Phase 7.2.
          </p>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-2">
          <button
            onClick={() => { setTab('comprehensive'); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              tab === 'comprehensive'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Comprehensive Audit
          </button>
          <button
            onClick={() => { setTab('access'); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              tab === 'access'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Data Access Audit
          </button>
        </div>

        {/* ── Filters Bar ── */}
        <div className="bg-white rounded-lg border p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'all' ? 'All Actions' : opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Entity Type</label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {ENTITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'all' ? 'All Entities' : opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">User ID</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Filter by user ID"
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleSearch}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Loading...' : 'Search'}
              </button>
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* ── Results Table ── */}
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {tab === 'comprehensive' ? (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actor</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Entity</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Entity ID</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">IP Address</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                        Loading...
                      </td>
                    </tr>
                  ) : auditEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                        No audit entries found.
                      </td>
                    </tr>
                  ) : (
                    auditEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {formatTimestamp(entry.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-900">{entry.actorEmail || entry.actorId || '—'}</div>
                          <div className="text-xs text-gray-400">{entry.actorRole}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            entry.action === 'create' ? 'bg-green-100 text-green-700' :
                            entry.action === 'delete' ? 'bg-red-100 text-red-700' :
                            entry.action === 'update' ? 'bg-yellow-100 text-yellow-700' :
                            entry.action === 'export' ? 'bg-purple-100 text-purple-700' :
                            entry.action === 'login' || entry.action === 'logout' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {entry.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{entry.entity}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                          {truncate(entry.entityId, 12)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {String(entry.ipAddress || entry.metadata?.ipAddress || '—')}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-48 truncate">
                          {truncate(
                            entry.metadata ? JSON.stringify(entry.metadata) : null,
                            80
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">User ID</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Entity Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Entity ID</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">IP Address</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                        Loading...
                      </td>
                    </tr>
                  ) : accessEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                        No access audit entries found.
                      </td>
                    </tr>
                  ) : (
                    accessEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {formatTimestamp(entry.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                          {truncate(entry.userId, 16)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            entry.action === 'read' ? 'bg-green-100 text-green-700' :
                            entry.action === 'export' ? 'bg-purple-100 text-purple-700' :
                            entry.action === 'delete' ? 'bg-red-100 text-red-700' :
                            entry.action === 'admin_access' ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {entry.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{entry.entityType}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                          {truncate(entry.entityId, 12)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {entry.ipAddress || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-48 truncate">
                          {truncate(
                            entry.metadata ? JSON.stringify(entry.metadata) : null,
                            80
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Pagination ── */}
        <div className="flex items-center justify-between bg-white rounded-lg border p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Page size:</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="border rounded px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span className="text-sm text-gray-500 ml-2">
              {total} total entries
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-4 py-2 bg-white border rounded text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages || loading}
              className="px-4 py-2 bg-white border rounded text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
