'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard, Building2, Users, Upload, Settings, Mail, BookOpen,
  Sparkles, Network, GitBranch, BarChart3, Send, FileText, XCircle,
  Target, Layers, ScrollText, LayoutTemplate, Archive, ClipboardList,
  FileBarChart, Code2, Copy, Kanban, MailPlus,
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

// ── All navigation commands (mirrors NAV_SECTIONS in page.tsx) ──
const ALL_NAV: NavCmd[] = [
  { id: 'command-center', label: 'Command Center', icon: Sparkles, screen: 'command-center', section: 'AI Command' },
  { id: 'mind-map', label: 'Company Mind Map', icon: Network, screen: 'mind-map', section: 'AI Command' },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, screen: 'dashboard', section: 'Workspace' },
  { id: 'pipeline', label: 'Pipeline', icon: GitBranch, screen: 'pipeline', section: 'Workspace' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, screen: 'analytics', section: 'Workspace' },
  { id: 'contacts', label: 'Contacts', icon: Users, screen: 'contacts', section: 'People' },
  { id: 'companies', label: 'Companies', icon: Building2, screen: 'companies', section: 'People' },
  { id: 'opportunities', label: 'Opportunities', icon: Target, screen: 'opportunities', section: 'People' },
  { id: 'import', label: 'Import', icon: Upload, screen: 'import', section: 'Operations' },
  { id: 'leads', label: 'Leads', icon: Layers, screen: 'leads', section: 'Operations' },
  { id: 'segments', label: 'Segments', icon: Kanban, screen: 'segments', section: 'Operations' },
  { id: 'duplicates', label: 'Duplicates', icon: Copy, screen: 'duplicates', section: 'Operations' },
  { id: 'capabilities', label: 'Capability Library', icon: Archive, screen: 'capabilities', section: 'Operations' },
  { id: 'knowledge', label: 'Knowledge Engine', icon: BookOpen, screen: 'knowledge', section: 'Operations' },
  { id: 'email-generation', label: 'Email Generator', icon: MailPlus, screen: 'email-generation', section: 'Outreach' },
  { id: 'drafts', label: 'Drafts', icon: FileText, screen: 'drafts', section: 'Outreach' },
  { id: 'queue', label: 'Send Queue', icon: Send, screen: 'queue', section: 'Outreach' },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate, screen: 'templates', section: 'Outreach' },
  { id: 'sequences', label: 'Sequences', icon: GitBranch, screen: 'sequences', section: 'Outreach' },
  { id: 'replies', label: 'Replies', icon: Mail, screen: 'replies', section: 'Outreach' },
  { id: 'bounces', label: 'Bounces & Suppressions', icon: XCircle, screen: 'bounces', section: 'Outreach' },
  { id: 'reports', label: 'Reports', icon: FileBarChart, screen: 'reports', section: 'Insights' },
  { id: 'tasks', label: 'Tasks', icon: ClipboardList, screen: 'tasks', section: 'Insights' },
  { id: 'prompt-templates', label: 'AI Prompts', icon: Code2, screen: 'prompt-templates', section: 'Insights' },
  { id: 'audit', label: 'Audit Log', icon: ScrollText, screen: 'audit', section: 'System' },
  { id: 'settings', label: 'Settings', icon: Settings, screen: 'settings', section: 'System' },
]

interface SearchCompany { id: string; name: string; rawName?: string; industry?: string | null }
interface SearchContact { id: string; name: string; email?: string | null; company?: { name: string } | null }

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [companies, setCompanies] = useState<SearchCompany[]>([])
  const [contacts, setContacts] = useState<SearchContact[]>([])

  // ── ⌘K / Ctrl+K global listener ──
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

  // Reset search state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setCompanies([])
      setContacts([])
    }
  }, [open])

  // Debounced search
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

  // ── Navigation: uses URL hash (works with active system) ──
  const navigateToScreen = useCallback((screen: string) => {
    window.location.hash = `#${screen}`
    // Dispatch a hashchange event so the AppShell picks it up
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    setOpen(false)
  }, [])

  const navigateToCompany = useCallback((id: string) => {
    window.location.hash = '#companies'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    // Use the store to set the company ID so the AppShell detects it
    useAppStore.getState().setSelectedCompanyId(id)
    setOpen(false)
  }, [])

  const navigateToContact = useCallback((id: string) => {
    window.location.hash = '#contacts'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    useAppStore.getState().setSelectedContactId(id)
    setOpen(false)
  }, [])

  // Filter nav items by query
  const q = query.trim().toLowerCase()
  const filteredNav = q.length >= 1
    ? ALL_NAV.filter(c => c.label.toLowerCase().includes(q) || c.section.toLowerCase().includes(q))
    : ALL_NAV

  // Group by section
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

        {/* Search results: Companies */}
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

        {/* Search results: Contacts */}
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

        {/* Navigation commands — grouped by section */}
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

        {/* Quick actions */}
        {!q && companies.length === 0 && contacts.length === 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Quick Actions">
              <CommandItem onSelect={() => { navigateToScreen('contacts'); }}>
                <Users className="size-4 text-muted-foreground" />
                <span>Add New Contact</span>
              </CommandItem>
              <CommandItem onSelect={() => navigateToScreen('email-generation')}>
                <MailPlus className="size-4 text-muted-foreground" />
                <span>Generate Email</span>
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