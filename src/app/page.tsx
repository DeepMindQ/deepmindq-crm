'use client'

import { useState } from 'react'

type View = 'dashboard' | 'companies' | 'contacts' | 'tasks' | 'opportunities' | 'settings'

const NAV_ITEMS: { key: View; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'companies', label: 'Companies', icon: '🏢' },
  { key: 'contacts', label: 'Contacts', icon: '👥' },
  { key: 'tasks', label: 'Tasks', icon: '✅' },
  { key: 'opportunities', label: 'Opportunities', icon: '🎯' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
]

const COMPANIES = [
  { id: '1', name: 'Acme Corp', industry: 'Technology', size: '500-1000', country: 'US', score: 87, status: 'Active' },
  { id: '2', name: 'TechVentures Inc', industry: 'SaaS', size: '100-250', country: 'India', score: 72, status: 'New' },
  { id: '3', name: 'Global Finance Solutions', industry: 'Finance', size: '1000-5000', country: 'UK', score: 91, status: 'Active' },
  { id: '4', name: 'HealthTech Plus', industry: 'Healthcare', size: '250-500', country: 'US', score: 78, status: 'Researching' },
  { id: '5', name: 'CloudScale Systems', industry: 'Cloud Computing', size: '1000-5000', country: 'US', score: 93, status: 'Active' },
  { id: '6', name: 'GreenEnergy Corp', industry: 'Energy', size: '50-100', country: 'Germany', score: 65, status: 'New' },
]

const CONTACTS = [
  { id: '1', name: 'Sarah Johnson', email: 'sarah@acmecorp.com', title: 'VP of Engineering', company: 'Acme Corp', health: 95 },
  { id: '2', name: 'Mike Chen', email: 'mike.chen@acmecorp.com', title: 'CTO', company: 'Acme Corp', health: 92 },
  { id: '3', name: 'Priya Sharma', email: 'priya@techventures.io', title: 'Head of Product', company: 'TechVentures', health: 88 },
  { id: '4', name: 'James Wilson', email: 'j.wilson@gfsolutions.com', title: 'CFO', company: 'Global Finance', health: 90 },
  { id: '5', name: 'David Park', email: 'david.park@cloudscale.dev', title: 'VP Cloud Infra', company: 'CloudScale', health: 97 },
  { id: '6', name: 'Dr. Emily Brown', email: 'emily.b@healthtechplus.com', title: 'Director of Innovation', company: 'HealthTech', health: 60 },
]

const TASKS = [
  { id: '1', title: 'Follow up with Acme Corp', priority: 'High', status: 'Pending', due: 'Jul 13' },
  { id: '2', title: 'Research HealthTech Plus', priority: 'Medium', status: 'In Progress', due: 'Jul 16' },
  { id: '3', title: 'Prepare quarterly report', priority: 'Low', status: 'Completed', due: 'Jul 10' },
  { id: '4', title: 'Schedule demo with CloudScale', priority: 'High', status: 'Pending', due: 'Jul 14' },
]

const OPPORTUNITIES = [
  { id: '1', title: 'Enterprise License Deal', company: 'Acme Corp', value: '$120K', stage: 'Proposal Sent', contact: 'Sarah Johnson' },
  { id: '2', title: 'Cloud Integration Partnership', company: 'CloudScale', value: '$250K', stage: 'Negotiation', contact: 'David Park' },
  { id: '3', title: 'Financial Analytics Module', company: 'Global Finance', value: '$85K', stage: 'Researching', contact: 'James Wilson' },
]

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'Active': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'New': 'bg-blue-50 text-blue-700 border-blue-200',
    'Researching': 'bg-amber-50 text-amber-700 border-amber-200',
    'Proposal Sent': 'bg-purple-50 text-purple-700 border-purple-200',
    'Negotiation': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'High': 'bg-red-50 text-red-700 border-red-200',
    'Medium': 'bg-amber-50 text-amber-700 border-amber-200',
    'Low': 'bg-gray-50 text-gray-600 border-gray-200',
    'Pending': 'bg-blue-50 text-blue-700 border-blue-200',
    'In Progress': 'bg-amber-50 text-amber-700 border-amber-200',
    'Completed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-emerald-500' : score >= 70 ? 'bg-amber-500' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600">{score}</span>
    </div>
  )
}

function DashboardView() {
  const stats = [
    { label: 'Total Companies', value: '247', change: '+12%', up: true },
    { label: 'Active Contacts', value: '1,843', change: '+8%', up: true },
    { label: 'Open Opportunities', value: '38', change: '+15%', up: true },
    { label: 'Emails Sent', value: '156', change: '-3%', up: false },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back, Ravi</h1>
        <p className="text-gray-500 text-sm mt-1">Here&apos;s what&apos;s happening with your sales pipeline today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{s.label}</p>
            <div className="flex items-end justify-between mt-2">
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <span className={`text-xs font-medium ${s.up ? 'text-emerald-600' : 'text-red-500'}`}>
                {s.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Two column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Opportunities */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900">Recent Opportunities</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {OPPORTUNITIES.map((o) => (
              <div key={o.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{o.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{o.company} &middot; {o.contact}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{o.value}</p>
                  <StatusBadge status={o.stage} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Tasks */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900">Active Tasks</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {TASKS.map((t) => (
              <div key={t.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Due: {t.due}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <StatusBadge status={t.priority} />
                  <StatusBadge status={t.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline Chart Placeholder */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Pipeline Overview</h2>
        <div className="flex items-end gap-3 h-40">
          {[
            { label: 'Researching', value: 12, color: 'bg-blue-400' },
            { label: 'Qualified', value: 8, color: 'bg-indigo-400' },
            { label: 'Proposal', value: 6, color: 'bg-purple-400' },
            { label: 'Negotiation', value: 4, color: 'bg-amber-400' },
            { label: 'Closed Won', value: 8, color: 'bg-emerald-400' },
          ].map((bar) => (
            <div key={bar.label} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-gray-50 rounded-t-lg relative" style={{ height: '120px' }}>
                <div className={`absolute bottom-0 left-0 right-0 ${bar.color} rounded-t-lg transition-all`} style={{ height: `${(bar.value / 12) * 100}%` }} />
              </div>
              <span className="text-[10px] text-gray-500 font-medium text-center leading-tight">{bar.label}</span>
              <span className="text-xs font-bold text-gray-700">{bar.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CompaniesView() {
  const [search, setSearch] = useState('')
  const filtered = COMPANIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Companies</h1>
          <p className="text-gray-500 text-sm mt-1">{COMPANIES.length} companies in your workspace</p>
        </div>
      </div>
      <input
        type="text"
        placeholder="Search companies..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full sm:w-80 h-10 px-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all"
      />
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Company</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3 hidden sm:table-cell">Industry</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3 hidden md:table-cell">Size</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3 hidden lg:table-cell">Country</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Score</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center text-amber-700 font-bold text-sm flex-shrink-0">
                      {c.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{c.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-600 hidden sm:table-cell">{c.industry}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600 hidden md:table-cell">{c.size}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600 hidden lg:table-cell">{c.country}</td>
                <td className="px-5 py-3.5"><ScoreBar score={c.score} /></td>
                <td className="px-5 py-3.5"><StatusBadge status={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ContactsView() {
  const [search, setSearch] = useState('')
  const filtered = CONTACTS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Contacts</h1>
        <p className="text-gray-500 text-sm mt-1">{CONTACTS.length} contacts in your workspace</p>
      </div>
      <input
        type="text"
        placeholder="Search contacts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full sm:w-80 h-10 px-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md hover:border-amber-200 transition-all cursor-pointer">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {c.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                <p className="text-xs text-gray-500 truncate">{c.title}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{c.company}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-gray-500 truncate">{c.email}</span>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.health >= 85 ? 'bg-emerald-500' : c.health >= 70 ? 'bg-amber-500' : 'bg-red-400'}`} title={`Email health: ${c.health}%`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TasksView() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tasks</h1>
        <p className="text-gray-500 text-sm mt-1">{TASKS.length} tasks in your workspace</p>
      </div>
      <div className="space-y-3">
        {TASKS.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${t.status === 'Completed' ? 'bg-emerald-500' : t.priority === 'High' ? 'bg-red-400' : 'bg-amber-400'}`} />
              <div>
                <p className={`text-sm font-medium ${t.status === 'Completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{t.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">Due: {t.due}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={t.priority} />
              <StatusBadge status={t.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OpportunitiesView() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Opportunities</h1>
        <p className="text-gray-500 text-sm mt-1">{OPPORTUNITIES.length} active opportunities &middot; Total pipeline: $455K</p>
      </div>
      <div className="space-y-3">
        {OPPORTUNITIES.map((o) => (
          <div key={o.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{o.title}</p>
                <p className="text-xs text-gray-500 mt-1">{o.company} &middot; {o.contact}</p>
              </div>
              <p className="text-lg font-bold text-gray-900">{o.value}</p>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
              <StatusBadge status={o.stage} />
              <span className="text-xs text-gray-400">Created 2 weeks ago</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SettingsView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your workspace preferences</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
        <div>
          <h2 className="font-semibold text-gray-900 mb-1">Profile</h2>
          <p className="text-xs text-gray-500 mb-4">Your account information</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input defaultValue="Ravi Shanker" className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input defaultValue="ravi@deepmindq.com" className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <input defaultValue="Admin" disabled className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Timezone</label>
              <input defaultValue="Asia/Calcutta (IST)" disabled className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-500" />
            </div>
          </div>
        </div>
        <div className="pt-4 border-t border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-1">AI Preferences</h2>
          <p className="text-xs text-gray-500 mb-4">Configure AI-powered features</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email Tone</label>
              <select className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30">
                <option>Professional</option>
                <option>Casual</option>
                <option>Formal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email Length</label>
              <select className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30">
                <option>Short (2-3 sentences)</option>
                <option>Medium (4-6 sentences)</option>
                <option>Long (detailed)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const [activeView, setActiveView] = useState<View>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const views: Record<View, React.ReactNode> = {
    dashboard: <DashboardView />,
    companies: <CompaniesView />,
    contacts: <ContactsView />,
    tasks: <TasksView />,
    opportunities: <OpportunitiesView />,
    settings: <SettingsView />,
  }

  return (
    <div className="min-h-screen bg-gray-50/50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-100 flex flex-col transition-transform duration-200`}>
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-gray-50">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #d4af37, #b8941f)' }}>
            <span className="text-white font-bold text-sm">Q</span>
          </div>
          <span className="font-bold text-gray-900 tracking-tight">
            DeepMind<span style={{ color: '#d4af37' }}>Q</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => { setActiveView(item.key); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeView === item.key
                  ? 'bg-amber-50 text-amber-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white font-semibold text-xs">
              RS
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">Ravi Shanker</p>
              <p className="text-xs text-gray-500 truncate">ravi@deepmindq.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-50 text-gray-500"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h2 className="text-sm font-medium text-gray-500 capitalize">{activeView.replace('-', ' ')}</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">Demo Mode</span>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-8">
          {views[activeView]}
        </div>
      </main>
    </div>
  )
}