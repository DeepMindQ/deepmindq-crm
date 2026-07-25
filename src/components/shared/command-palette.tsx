'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard, Building2, Users, Upload, Settings, Mail, BookOpen,
  Sparkles, GitBranch, BarChart3, FileText,
  Target, Layers, ScrollText, Copy, Kanban, Activity, Radar, Brain,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'

// ── Types ──
interface NavCmd {
  id: string
  label: string
  icon: React.ElementType
  screen: string
  section: string
}

// ── All navigation commands (mirrors NAV_SECTIONS in nav-config.ts) ──
const ALL_NAV: NavCmd[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, screen: 'dashboard', section: 'Intelligence' },
  { id: 'revenue-intelligence', label: 'Revenue Intelligence', icon: Sparkles, screen: 'revenue-intelligence', section: 'Intelligence' },
  { id: 'signal-intelligence', label: 'Signal Intelligence', icon: Radar, screen: 'signal-intelligence', section: 'Intelligence' },
  { id: 'companies', label: 'Companies', icon: Building2, screen: 'companies', section: 'Accounts' },
  { id: 'contacts', label: 'Stakeholders', icon: Users, screen: 'contacts', section: 'Accounts' },
  { id: 'opportunities', label: 'Opportunities', icon: Target, screen: 'opportunities', section: 'Accounts' },
  { id: 'segments', label: 'Segments', icon: Kanban, screen: 'segments', section: 'Accounts' },
  { id: 'pipeline', label: 'Pipeline', icon: GitBranch, screen: 'pipeline', section: 'Pipeline & Engagement' },
  { id: 'sequences', label: 'Sequences', icon: GitBranch, screen: 'sequences', section: 'Pipeline & Engagement' },
  { id: 'email-studio', label: 'Email Studio', icon: FileText, screen: 'email-studio', section: 'Pipeline & Engagement' },
  { id: 'inbox', label: 'Replies & Bounces', icon: Mail, screen: 'inbox', section: 'Pipeline & Engagement' },
  { id: 'import', label: 'Import', icon: Upload, screen: 'import', section: 'Operations' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, screen: 'analytics', section: 'Operations' },
  { id: 'knowledge', label: 'Knowledge Base', icon: Brain, screen: 'knowledge', section: 'Operations' },
  { id: 'ai-health', label: 'AI Health', icon: Activity, screen: 'ai-health', section: 'Operations' },
  { id: 'settings', label: 'Settings', icon: Settings, screen: 'settings', section: 'Settings' },
  { id: 'audit', label: 'Audit Log', icon: ScrollText, screen: 'audit', section: 'Settings' },
  { id: 'data-health', label: 'Data Health', icon: Layers, screen: 'data-health', section: 'Settings' },
  { id: 'duplicates', label: 'Duplicates', icon: Copy, screen: 'duplicates', section: 'Settings' },
]

interface SearchCompany { id: string; name: string; rawName?: string; industry?: string | null }
interface SearchContact { id: string; name: string; email?: string | null; company?: { name: string } | null }

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [companies, setCompanies] = useState<SearchCompany[]>([])
  const [contacts, setContacts] = useState<SearchContact[]>([])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setCompanies([])
      setContacts([])
    }
  }, [open])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 2) {
      setCompanies([])
      setContacts([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const q = encodeURIComponent(trimmed)
        const [compRes, contRes] = await Promise.all([
          fetch(`/api/companies?search=${q}&limit=5`, { signal: controller.signal }),
          fetch(`/api/contacts?search=${q}&limit=5`, { signal: controller.signal }),
        ])
        if (!controller.signal.aborted) {
          const compData = await compRes.json()
          const contData = await contRes.json()
          const compList = compData.companies ?? compData.data?.companies ?? []
          const contList = contData.contacts ?? contData.data?.contacts ?? []
          setCompanies(compList)
          setContacts(contList)
        }
      } catch {
        // Ignore aborted or failed requests
      }
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const navigateToScreen = useCallback((screen: string) => {
    window.location.hash = `#${screen}`
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    setOpen(false)
  }, [])

  const navigateToCompany = useCallback((id: string) => {
    window.location.hash = '#companies'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    useAppStore.getState().setSelectedCompanyId(id)
    setOpen(false)
  }, [])

  const navigateToContact = useCallback((id: string) => {
    window.location.hash = '#contacts'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    useAppStore.getState().setSelectedContactId(id)
    setOpen(false)
  }, [])

  const q = query.trim().toLowerCase()
  const filteredNav = q.length >= 1
    ? ALL_NAV.filter(c => c.label.toLowerCase().includes(q) || c.section.toLowerCase().includes(q))
    : ALL_NAV

  const grouped = filteredNav.reduce<Record<string, NavCmd[]>>((acc, cmd) => {
    if (!acc[cmd.section]) acc[cmd.section] = []
    acc[cmd.section].push(cmd)
    return acc
  }, {})

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search companies, contacts, or navigate..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {companies.length > 0 && (
          <CommandGroup heading="Companies">
            {companies.map((company) => (
              <CommandItem
                key={company.id}
                value={`company-${company.rawName || company.name}-${company.id}`}
                onSelect={() => navigateToCompany(company.id)}
              >
                <Building2 className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{company.rawName || company.name}</span>
                {company.industry && (
                  <span className="hidden sm:inline text-xs text-muted-foreground">
                    {company.industry}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {contacts.length > 0 && (
          <CommandGroup heading="Contacts">
            {contacts.map((contact) => (
              <CommandItem
                key={contact.id}
                value={`contact-${contact.name}-${contact.id}`}
                onSelect={() => navigateToContact(contact.id)}
              >
                <Users className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{contact.name}</span>
                {contact.company && (
                  <span className="hidden sm:inline text-xs text-muted-foreground">
                    at {contact.company.name}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {companies.length === 0 && contacts.length === 0 && (
          <>
            {Object.entries(grouped).map(([section, items]) => (
              <CommandGroup key={section} heading={section}>
                {items.map((cmd) => {
                  const Icon = cmd.icon
                  return (
                    <CommandItem
                      key={cmd.id}
                      value={cmd.label}
                      onSelect={() => navigateToScreen(cmd.screen)}
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      <span>{cmd.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </>
        )}
        {!q && companies.length === 0 && contacts.length === 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Quick Actions">
              <CommandItem onSelect={() => { navigateToScreen('contacts'); }}>
                <Users className="size-4 text-muted-foreground" />
                <span>Add New Contact</span>
              </CommandItem>
              <CommandItem onSelect={() => navigateToScreen('email-studio')}>
                <FileText className="size-4 text-muted-foreground" />
                <span>Email Studio</span>
              </CommandItem>
              <CommandItem onSelect={() => navigateToScreen('import')}>
                <Upload className="size-4 text-muted-foreground" />
                <span>Import Data</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
