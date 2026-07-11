'use client'

import { useState } from 'react'

type View = 'dashboard' | 'companies' | 'contacts' | 'tasks' | 'opportunities'

const NAV = [
  { key: 'dashboard' as View, label: 'Dashboard', icon: '⊞' },
  { key: 'companies' as View, label: 'Companies', icon: '☐' },
  { key: 'contacts' as View, label: 'Contacts', icon: '☹' },
  { key: 'tasks' as View, label: 'Tasks', icon: '☑' },
  { key: 'opportunities' as View, label: 'Opportunities', icon: '◎' },
]

const COMPANIES = [
  { name: 'Acme Corp', industry: 'Technology', size: '500-1000', country: 'US', score: 87, status: 'Active' },
  { name: 'TechVentures Inc', industry: 'SaaS', size: '100-250', country: 'India', score: 72, status: 'New' },
  { name: 'Global Finance Solutions', industry: 'Finance', size: '1000-5000', country: 'UK', score: 91, status: 'Active' },
  { name: 'HealthTech Plus', industry: 'Healthcare', size: '250-500', country: 'US', score: 78, status: 'Researching' },
  { name: 'CloudScale Systems', industry: 'Cloud', size: '1000-5000', country: 'US', score: 93, status: 'Active' },
  { name: 'GreenEnergy Corp', industry: 'Energy', size: '50-100', country: 'Germany', score: 65, status: 'New' },
]

const CONTACTS = [
  { name: 'Sarah Johnson', title: 'VP Engineering', company: 'Acme Corp', email: 'sarah@acmecorp.com' },
  { name: 'Mike Chen', title: 'CTO', company: 'Acme Corp', email: 'mike.chen@acmecorp.com' },
  { name: 'Priya Sharma', title: 'Head of Product', company: 'TechVentures', email: 'priya@techventures.io' },
  { name: 'James Wilson', title: 'CFO', company: 'Global Finance', email: 'j.wilson@gfsolutions.com' },
  { name: 'David Park', title: 'VP Cloud Infra', company: 'CloudScale', email: 'david.park@cloudscale.dev' },
  { name: 'Dr. Emily Brown', title: 'Dir. Innovation', company: 'HealthTech', email: 'emily.b@healthtechplus.com' },
]

const TASKS = [
  { title: 'Follow up with Acme Corp', priority: 'High', status: 'Pending', due: 'Jul 13' },
  { title: 'Research HealthTech Plus', priority: 'Medium', status: 'In Progress', due: 'Jul 16' },
  { title: 'Prepare quarterly report', priority: 'Low', status: 'Done', due: 'Jul 10' },
  { title: 'Schedule CloudScale demo', priority: 'High', status: 'Pending', due: 'Jul 14' },
]

const OPPS = [
  { title: 'Enterprise License Deal', company: 'Acme Corp', value: '$120K', stage: 'Proposal' },
  { title: 'Cloud Partnership', company: 'CloudScale', value: '$250K', stage: 'Negotiation' },
  { title: 'Analytics Module', company: 'Global Finance', value: '$85K', stage: 'Researching' },
]

const S = {
  gold: '#d4af37',
  goldLight: '#fef9e7',
  goldDark: '#b8941f',
  bg: '#f7f7f5',
  white: '#ffffff',
  border: '#e8e8e5',
  text: '#1a1a1a',
  textMuted: '#6b7280',
  textLight: '#9ca3af',
  green: '#059669',
  greenBg: '#ecfdf5',
  blue: '#2563eb',
  blueBg: '#eff6ff',
  red: '#dc2626',
  redBg: '#fef2f2',
  amber: '#d97706',
  amberBg: '#fffbeb',
  purple: '#7c3aed',
  purpleBg: '#f5f3ff',
}

function Badge({ text, bg, color }: { text: string; bg: string; color: string }) {
  return <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, background: bg, color, border: `1px solid ${color}22` }}>{text}</span>
}

function Dashboard() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: S.text, letterSpacing: '-0.02em' }}>Welcome back, Ravi</h1>
        <p style={{ fontSize: 13, color: S.textMuted, marginTop: 4 }}>Here is your sales pipeline overview.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Companies', value: '247', sub: '+12%', up: true },
          { label: 'Contacts', value: '1,843', sub: '+8%', up: true },
          { label: 'Opportunities', value: '38', sub: '+15%', up: true },
          { label: 'Emails Sent', value: '156', sub: '-3%', up: false },
        ].map(s => (
          <div key={s.label} style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: S.text }}>{s.value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: s.up ? S.green : S.red }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        <div style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${S.border}` }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: S.text }}>Recent Opportunities</h2>
          </div>
          {OPPS.map(o => (
            <div key={o.title} style={{ padding: '12px 20px', borderBottom: `1px solid #f3f3f0`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{o.title}</div>
                <div style={{ fontSize: 11, color: S.textMuted, marginTop: 2 }}>{o.company}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: S.text }}>{o.value}</div>
                <Badge text={o.stage} bg={o.stage === 'Proposal' ? S.purpleBg : o.stage === 'Negotiation' ? S.blueBg : S.amberBg} color={o.stage === 'Proposal' ? S.purple : o.stage === 'Negotiation' ? S.blue : S.amber} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${S.border}` }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: S.text }}>Active Tasks</h2>
          </div>
          {TASKS.map(t => (
            <div key={t.title} style={{ padding: '12px 20px', borderBottom: `1px solid #f3f3f0`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.text, textDecoration: t.status === 'Done' ? 'line-through' : 'none', opacity: t.status === 'Done' ? 0.5 : 1 }}>{t.title}</div>
                <div style={{ fontSize: 11, color: S.textMuted, marginTop: 2 }}>Due: {t.due}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Badge text={t.priority} bg={t.priority === 'High' ? S.redBg : t.priority === 'Medium' ? S.amberBg : '#f3f4f6'} color={t.priority === 'High' ? S.red : t.priority === 'Medium' ? S.amber : S.textMuted} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Companies() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: S.text, letterSpacing: '-0.02em', marginBottom: 4 }}>Companies</h1>
      <p style={{ fontSize: 13, color: S.textMuted, marginBottom: 20 }}>{COMPANIES.length} companies in workspace</p>
      <div style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                {['Company', 'Industry', 'Size', 'Score', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, fontWeight: 600, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPANIES.map(c => (
                <tr key={c.name} style={{ borderBottom: '1px solid #f3f3f0' }}>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: S.goldLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.goldDark, fontWeight: 700, fontSize: 13 }}>{c.name[0]}</div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{c.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: S.textMuted }}>{c.industry}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: S.textMuted }}>{c.size}</td>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 50, height: 5, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${c.score}%`, background: c.score >= 85 ? S.green : c.score >= 70 ? S.amber : S.red, borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: S.textMuted }}>{c.score}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <Badge text={c.status} bg={c.status === 'Active' ? S.greenBg : c.status === 'New' ? S.blueBg : S.amberBg} color={c.status === 'Active' ? S.green : c.status === 'New' ? S.blue : S.amber} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Contacts() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: S.text, letterSpacing: '-0.02em', marginBottom: 4 }}>Contacts</h1>
      <p style={{ fontSize: 13, color: S.textMuted, marginBottom: 20 }}>{CONTACTS.length} contacts in workspace</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {CONTACTS.map(c => (
          <div key={c.email} style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 12, padding: 20, transition: 'box-shadow 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg, ${S.gold}, ${S.goldDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                {c.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: S.textMuted }}>{c.title}</div>
                <div style={{ fontSize: 11, color: S.textLight, marginTop: 1 }}>{c.company}</div>
              </div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid #f3f3f0`, fontSize: 12, color: S.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Tasks() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: S.text, letterSpacing: '-0.02em', marginBottom: 4 }}>Tasks</h1>
      <p style={{ fontSize: 13, color: S.textMuted, marginBottom: 20 }}>{TASKS.length} tasks</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TASKS.map(t => (
          <div key={t.title} style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.status === 'Done' ? S.green : t.priority === 'High' ? S.red : S.amber }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.text, textDecoration: t.status === 'Done' ? 'line-through' : 'none', opacity: t.status === 'Done' ? 0.5 : 1 }}>{t.title}</div>
                <div style={{ fontSize: 11, color: S.textMuted, marginTop: 2 }}>Due: {t.due}</div>
              </div>
            </div>
            <Badge text={t.priority} bg={t.priority === 'High' ? S.redBg : t.priority === 'Medium' ? S.amberBg : '#f3f4f6'} color={t.priority === 'High' ? S.red : t.priority === 'Medium' ? S.amber : S.textMuted} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Opportunities() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: S.text, letterSpacing: '-0.02em', marginBottom: 4 }}>Opportunities</h1>
      <p style={{ fontSize: 13, color: S.textMuted, marginBottom: 20 }}>{OPPS.length} active &middot; Pipeline: $455K</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {OPPS.map(o => (
          <div key={o.title} style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: S.text }}>{o.title}</div>
                <div style={{ fontSize: 12, color: S.textMuted, marginTop: 3 }}>{o.company}</div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: S.text }}>{o.value}</div>
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid #f3f3f0`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Badge text={o.stage} bg={o.stage === 'Proposal' ? S.purpleBg : o.stage === 'Negotiation' ? S.blueBg : S.amberBg} color={o.stage === 'Proposal' ? S.purple : o.stage === 'Negotiation' ? S.blue : S.amber} />
              <span style={{ fontSize: 11, color: S.textLight }}>2 weeks ago</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const VIEWS: Record<View, () => React.ReactNode> = {
  dashboard: Dashboard,
  companies: Companies,
  contacts: Contacts,
  tasks: Tasks,
  opportunities: Opportunities,
}

export default function HomePage() {
  const [view, setView] = useState<View>('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const ViewComponent = VIEWS[view]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: S.bg }}>
      {/* Sidebar */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 240, background: S.white,
        borderRight: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column', zIndex: 50,
        transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.2s',
      }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', borderBottom: `1px solid ${S.border}` }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${S.gold}, ${S.goldDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>Q</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: S.text, letterSpacing: '-0.01em' }}>DeepMind<span style={{ color: S.gold }}>Q</span></span>
        </div>
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => { setView(n.key); setMenuOpen(false) }} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8,
              fontSize: 13, fontWeight: 500, textAlign: 'left',
              background: view === n.key ? S.goldLight : 'transparent',
              color: view === n.key ? S.goldDark : S.textMuted,
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: 14, borderTop: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${S.gold}, ${S.goldDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 12 }}>RS</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: S.text }}>Ravi Shanker</div>
            <div style={{ fontSize: 11, color: S.textMuted }}>ravi@deepmindq.com</div>
          </div>
        </div>
      </aside>

      {menuOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 40 }} onClick={() => setMenuOpen(false)} />}

      <main style={{ flex: 1, marginLeft: 0 }}>
        <header style={{ height: 56, background: S.white, borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 30 }}>
          <button onClick={() => setMenuOpen(true)} style={{ display: 'none', padding: 6, color: S.textMuted }} aria-label="Menu">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span style={{ fontSize: 13, fontWeight: 500, color: S.textMuted, textTransform: 'capitalize' }}>{view}</span>
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: S.greenBg, color: S.green, fontWeight: 600, border: `1px solid ${S.green}22` }}>Demo</span>
        </header>
        <div style={{ padding: 24 }}>
          <ViewComponent />
        </div>
      </main>
    </div>
  )
}