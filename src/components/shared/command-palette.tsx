'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard, Building2, Users, Upload, Settings, Mail, BookOpen,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import type { ActiveView, Company, Contact } from '@/lib/types'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/components/ui/command'

const navCommands: {
  id: string
  label: string
  icon: typeof LayoutDashboard
  view: ActiveView
  shortcut: string
}[] = [
  { id: 'dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, view: 'dashboard', shortcut: '⌘1' },
  { id: 'companies', label: 'Go to Companies', icon: Building2, view: 'companies', shortcut: '⌘2' },
  { id: 'contacts', label: 'Go to Contacts', icon: Users, view: 'contacts', shortcut: '⌘3' },
  { id: 'email-generation', label: 'Go to AI Emails', icon: Mail, view: 'email-generation', shortcut: '⌘4' },
  { id: 'knowledge-library', label: 'Go to Knowledge', icon: BookOpen, view: 'knowledge-library', shortcut: '⌘5' },
  { id: 'import', label: 'Go to Import', icon: Upload, view: 'import', shortcut: '⌘6' },
  { id: 'settings', label: 'Go to Settings', icon: Settings, view: 'settings', shortcut: '⌘7' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])

  const { setActiveView, setSelectedCompanyId, setSelectedContactId } = useAppStore()

  // Cmd+K / Ctrl+K global listener
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

  // Debounced search for companies and contacts
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setCompanies([])
      setContacts([])
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const q = encodeURIComponent(trimmed)
        const [compRes, contRes] = await Promise.all([
          fetch(`/api/companies?search=${q}&pageSize=5`, { signal: controller.signal }),
          fetch(`/api/contacts?search=${q}&pageSize=5`, { signal: controller.signal }),
        ])
        if (!controller.signal.aborted) {
          const compData = await compRes.json()
          const contData = await contRes.json()
          setCompanies(compData.companies ?? [])
          setContacts(contData.contacts ?? [])
        }
      } catch {
        // Ignore aborted or failed requests
      }
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const handleSelectNav = useCallback(
    (view: ActiveView) => {
      setActiveView(view)
      setOpen(false)
    },
    [setActiveView]
  )

  const handleSelectCompany = useCallback(
    (id: string) => {
      setSelectedCompanyId(id)
      setActiveView('company-profile')
      setOpen(false)
    },
    [setSelectedCompanyId, setActiveView]
  )

  const handleSelectContact = useCallback(
    (id: string) => {
      setSelectedContactId(id)
      setActiveView('contact-profile')
      setOpen(false)
    },
    [setSelectedContactId, setActiveView]
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search companies, contacts, or type a command..."
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
                value={`company-${company.name}-${company.id}`}
                onSelect={() => handleSelectCompany(company.id)}
              >
                <Building2 className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{company.name}</span>
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
                onSelect={() => handleSelectContact(contact.id)}
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

        {/* Navigation commands */}
        <CommandGroup heading="Navigation">
          {navCommands.map((cmd) => {
            const Icon = cmd.icon
            return (
              <CommandItem
                key={cmd.id}
                value={cmd.label}
                onSelect={() => handleSelectNav(cmd.view)}
              >
                <Icon className="size-4 text-muted-foreground" />
                <span>{cmd.label}</span>
                <CommandShortcut>{cmd.shortcut}</CommandShortcut>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}