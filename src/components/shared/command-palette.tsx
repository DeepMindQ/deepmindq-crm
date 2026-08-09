'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Building2, Users, Upload,
  Plus, TrendingUp, FileBarChart,
  Clock, ArrowRight, X, Search,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { NAV_SECTIONS } from '@/lib/nav-config'
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

interface RecentSearch {
  query: string
  timestamp: number
}

interface RecentItem {
  id: string
  name: string
  type: 'company' | 'contact'
  subtitle?: string
  timestamp: number
}

interface QuickAction {
  id: string
  label: string
  description: string
  icon: React.ElementType
  screen: string
  shortcut?: string
}

// ── Constants ──
const RECENT_SEARCHES_KEY = 'dmq-recent-searches'
const RECENT_ITEMS_KEY = 'dmq-recent-items'
const MAX_RECENT_SEARCHES = 5
const MAX_RECENT_ITEMS = 4

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'create-company',
    label: 'Create Company',
    description: 'Add a new company to the system',
    icon: Plus,
    screen: 'accounts',
    shortcut: '⌘N',
  },
  {
    id: 'import-data',
    label: 'Import Data',
    description: 'Import CSV or connect data sources',
    icon: Upload,
    screen: 'data-import',
    shortcut: '⌘I',
  },
  {
    id: 'run-analysis',
    label: 'Run Analysis',
    description: 'Execute AI intelligence analysis',
    icon: TrendingUp,
    screen: 'signal-intelligence',
    shortcut: '⌘R',
  },
  {
    id: 'view-reports',
    label: 'View Reports',
    description: 'Open analytics and reports',
    icon: FileBarChart,
    screen: 'analytics',
    shortcut: '⌘D',
  },
]

// ── Derive navigation commands from NAV_SECTIONS (single source of truth) ──
function buildNavCommands(): NavCmd[] {
  return NAV_SECTIONS.flatMap(sec =>
    sec.items.map(item => ({
      id: item.key,
      label: item.label,
      icon: item.icon,
      screen: item.key,
      section: sec.heading,
    })),
  )
}

const ALL_NAV: NavCmd[] = buildNavCommands()

interface SearchCompany { id: string; name: string; rawName?: string; industry?: string | null }
interface SearchContact { id: string; name: string; email?: string | null; company?: { name: string } | null }

// ── localStorage helpers ──
function getRecentSearches(): RecentSearch[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecentSearch(query: string) {
  if (typeof window === 'undefined' || !query.trim()) return
  try {
    const existing = getRecentSearches()
    const filtered = existing.filter(s => s.query.toLowerCase() !== query.trim().toLowerCase())
    const updated = [{ query: query.trim(), timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT_SEARCHES)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch {
    // Ignore storage errors
  }
}

function removeRecentSearch(query: string) {
  if (typeof window === 'undefined') return
  try {
    const existing = getRecentSearches()
    const updated = existing.filter(s => s.query !== query)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch {
    // Ignore storage errors
  }
}

function getRecentItems(): RecentItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_ITEMS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecentItem(item: RecentItem) {
  if (typeof window === 'undefined') return
  try {
    const existing = getRecentItems()
    const filtered = existing.filter(i => i.id !== item.id)
    const updated = [item, ...filtered].slice(0, MAX_RECENT_ITEMS)
    localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(updated))
  } catch {
    // Ignore storage errors
  }
}

// ── Keyboard shortcut badge ──
function KbdBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-muted-foreground bg-muted/60 border border-border/50">
      {children}
    </kbd>
  )
}

// ── Section count badge ──
function CountBadge({ count }: { count: number }) {
  return (
    <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-medium text-muted-foreground bg-muted/50">
      {count}
    </span>
  )
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [companies, setCompanies] = useState<SearchCompany[]>([])
  const [contacts, setContacts] = useState<SearchContact[]>([])
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])
  const lastSubmittedQuery = useRef('')

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

  // Load recent data when opening
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches())
      setRecentItems(getRecentItems())
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setCompanies([])
      setContacts([])
    }
  }, [open])

  // Save recent search when submitting (navigating to a result)
  useEffect(() => {
    if (lastSubmittedQuery.current) {
      saveRecentSearch(lastSubmittedQuery.current)
      setRecentSearches(getRecentSearches())
      lastSubmittedQuery.current = ''
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
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const navigateToScreen = useCallback((screen: string) => {
    if (query.trim()) {
      lastSubmittedQuery.current = query.trim()
    }
    window.location.hash = `#${screen}`
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    setOpen(false)
  }, [query])

  const navigateToCompany = useCallback((id: string, name: string) => {
    lastSubmittedQuery.current = query.trim()
    saveRecentItem({ id, name, type: 'company', timestamp: Date.now() })
    setRecentItems(getRecentItems())
    window.location.hash = '#accounts'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    useAppStore.getState().setSelectedCompanyId(id)
    setOpen(false)
  }, [query])

  const navigateToContact = useCallback((id: string, name: string) => {
    lastSubmittedQuery.current = query.trim()
    saveRecentItem({ id, name, type: 'contact', timestamp: Date.now() })
    setRecentItems(getRecentItems())
    window.location.hash = '#contacts'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    useAppStore.getState().setSelectedContactId(id)
    setOpen(false)
  }, [query])

  const handleRecentSearchClick = useCallback((searchQuery: string) => {
    setQuery(searchQuery)
  }, [])

  const handleRemoveRecentSearch = useCallback((e: React.MouseEvent, searchQuery: string) => {
    e.stopPropagation()
    removeRecentSearch(searchQuery)
    setRecentSearches(getRecentSearches())
  }, [])

  const q = query.trim().toLowerCase()
  const hasQuery = q.length >= 1

  const filteredNav = hasQuery
    ? ALL_NAV.filter(c => c.label.toLowerCase().includes(q) || c.section.toLowerCase().includes(q))
    : ALL_NAV

  const filteredActions = hasQuery
    ? QUICK_ACTIONS.filter(a => a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))
    : QUICK_ACTIONS

  const grouped = Object.groupBy(filteredNav, cmd => cmd.section)

  const showSearchResults = hasQuery && (companies.length > 0 || contacts.length > 0)
  const showNavResults = hasQuery && filteredNav.length > 0
  const showActionResults = hasQuery && filteredActions.length > 0
  const showEmpty = hasQuery && !showSearchResults && !showNavResults && !showActionResults

  // Total result count for display
  const totalResults = companies.length + contacts.length + filteredNav.length + filteredActions.length

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search companies, contacts, or navigate..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {/* ── Recent Searches (only when no query) ── */}
        {!hasQuery && recentSearches.length > 0 && (
          <CommandGroup heading={
            <span className="flex items-center gap-2">
              <Clock className="size-3.5 text-muted-foreground" />
              Recent Searches
            </span>
          }>
            {recentSearches.map((search) => (
              <CommandItem
                key={`recent-search-${search.query}`}
                value={`recent-search-${search.query}`}
                onSelect={() => handleRecentSearchClick(search.query)}
              >
                <Search className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{search.query}</span>
                <button
                  onClick={(e) => handleRemoveRecentSearch(e, search.query)}
                  className="p-0.5 rounded hover:bg-muted/80 transition-colors"
                  aria-label={`Remove ${search.query} from recent searches`}
                >
                  <X className="size-3 text-muted-foreground hover:text-foreground" />
                </button>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* ── Quick Actions ── */}
        {(showActionResults || (!hasQuery)) && (
          <>
            {(!hasQuery && recentSearches.length > 0) && <CommandSeparator />}
            <CommandGroup heading={
              <span className="flex items-center gap-2">
                <SparkleIcon />
                Quick Actions
                {hasQuery && filteredActions.length > 0 && <CountBadge count={filteredActions.length} />}
              </span>
            }>
              {(hasQuery ? filteredActions : QUICK_ACTIONS).map((action) => {
                const Icon = action.icon
                return (
                  <CommandItem
                    key={action.id}
                    value={`action-${action.label}`}
                    onSelect={() => navigateToScreen(action.screen)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 shrink-0">
                        <Icon className="size-4 text-primary" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{action.label}</span>
                        <span className="text-xs text-muted-foreground truncate hidden sm:block">
                          {action.description}
                        </span>
                      </div>
                    </div>
                    {action.shortcut && <KbdBadge>{action.shortcut}</KbdBadge>}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        )}

        {/* ── Recent Items (only when no query) ── */}
        {!hasQuery && recentItems.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={
              <span className="flex items-center gap-2">
                <Clock className="size-3.5 text-muted-foreground" />
                Recently Viewed
              </span>
            }>
              {recentItems.map((item) => {
                const isCompany = item.type === 'company'
                const Icon = isCompany ? Building2 : Users
                return (
                  <CommandItem
                    key={`recent-item-${item.id}`}
                    value={`recent-item-${item.name}`}
                    onSelect={() => {
                      if (isCompany) navigateToCompany(item.id, item.name)
                      else navigateToContact(item.id, item.name)
                    }}
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{item.name}</span>
                    <span className="hidden sm:inline text-xs text-muted-foreground capitalize">
                      {item.type}
                    </span>
                    <ArrowRight className="size-3 text-muted-foreground/50" />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        )}

        {/* ── Search Results (when querying) ── */}
        {showEmpty && <CommandEmpty>No results found.</CommandEmpty>}

        {companies.length > 0 && (
          <>
            {(showNavResults || contacts.length > 0) && <CommandSeparator />}
            <CommandGroup heading={
              <span className="flex items-center gap-2">
                Companies
                <CountBadge count={companies.length} />
              </span>
            }>
              {companies.map((company) => (
                <CommandItem
                  key={company.id}
                  value={`company-${company.rawName || company.name}-${company.id}`}
                  onSelect={() => navigateToCompany(company.id, company.rawName || company.name)}
                >
                  <Building2 className="size-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{company.rawName || company.name}</span>
                  {company.industry && (
                    <span className="hidden sm:inline text-xs text-muted-foreground">
                      {company.industry}
                    </span>
                  )}
                  <ArrowRight className="size-3 text-muted-foreground/50" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {contacts.length > 0 && (
          <>
            {showNavResults && <CommandSeparator />}
            <CommandGroup heading={
              <span className="flex items-center gap-2">
                Contacts
                <CountBadge count={contacts.length} />
              </span>
            }>
              {contacts.map((contact) => (
                <CommandItem
                  key={contact.id}
                  value={`contact-${contact.name}-${contact.id}`}
                  onSelect={() => navigateToContact(contact.id, contact.name)}
                >
                  <Users className="size-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{contact.name}</span>
                  {contact.company && (
                    <span className="hidden sm:inline text-xs text-muted-foreground">
                      at {contact.company.name}
                    </span>
                  )}
                  <ArrowRight className="size-3 text-muted-foreground/50" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* ── Navigation (grouped by section) ── */}
        {showNavResults && (
          <>
            <CommandSeparator />
            {Object.entries(grouped).filter(([, items]) => items).map(([section, items], idx) => (
              <CommandGroup
                key={section}
                heading={
                  <span className="flex items-center gap-2">
                    {section}
                    <CountBadge count={items!.length} />
                  </span>
                }
              >
                {items!.map((cmd) => {
                  const Icon = cmd.icon
                  return (
                    <CommandItem
                      key={cmd.id}
                      value={cmd.label}
                      onSelect={() => navigateToScreen(cmd.screen)}
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{cmd.label}</span>
                      <KbdBadge>⌘K</KbdBadge>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </>
        )}

        {/* ── Navigation when idle (no query) ── */}
        {!hasQuery && companies.length === 0 && contacts.length === 0 && (
          <>
            <CommandSeparator />
            {Object.entries(grouped).filter(([, items]) => items).map(([section, items]) => (
              <CommandGroup key={section} heading={section}>
                {items!.map((cmd) => {
                  const Icon = cmd.icon
                  return (
                    <CommandItem
                      key={cmd.id}
                      value={cmd.label}
                      onSelect={() => navigateToScreen(cmd.screen)}
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{cmd.label}</span>
                      <KbdBadge>⌘K</KbdBadge>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </>
        )}
      </CommandList>

      {/* ── Footer: Keyboard hints ── */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border/50 bg-muted/20">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-muted/60 border border-border/50 font-mono text-[10px]">↑↓</kbd>
            <span>Navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-muted/60 border border-border/50 font-mono text-[10px]">↵</kbd>
            <span>Select</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-muted/60 border border-border/50 font-mono text-[10px]">Esc</kbd>
            <span>Close</span>
          </span>
        </div>
        {hasQuery && totalResults > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {totalResults} result{totalResults !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </CommandDialog>
  )
}

// ── Small sparkle icon for quick actions heading ──
function SparkleIcon() {
  return (
    <svg className="size-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  )
}