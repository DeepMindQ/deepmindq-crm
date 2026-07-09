'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard, Building2, Users, Upload, Settings, Search, ArrowRight,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import type { ActiveView } from '@/lib/types'

const commands = [
  { id: 'dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, view: 'dashboard' as ActiveView, shortcut: 'G D' },
  { id: 'companies', label: 'Go to Companies', icon: Building2, view: 'companies' as ActiveView, shortcut: 'G C' },
  { id: 'contacts', label: 'Go to Contacts', icon: Users, view: 'contacts' as ActiveView, shortcut: 'G U' },
  { id: 'import', label: 'Import Data', icon: Upload, view: 'import' as ActiveView, shortcut: 'G I' },
  { id: 'settings', label: 'Open Settings', icon: Settings, view: 'settings' as ActiveView, shortcut: 'G S' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const { setActiveView } = useAppStore()

  const filtered = commands.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase())
  )

  const toggle = useCallback(() => {
    setOpen(p => !p)
    setQuery('')
    setSelected(0)
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggle()
      }
      if (open) {
        if (e.key === 'Escape') { setOpen(false); setQuery('') }
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)) }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
        if (e.key === 'Enter' && filtered[selected]) {
          setActiveView(filtered[selected].view)
          setOpen(false)
          setQuery('')
        }
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, filtered, selected, setActiveView, toggle])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px]"
        onClick={() => { setOpen(false); setQuery('') }}
      />
      {/* Dialog */}
      <div className="fixed inset-x-0 top-[15%] z-50 mx-auto max-w-lg px-4">
        <div className="rounded-2xl bg-white elevation-modal border border-gray-200/80 overflow-hidden scale-in">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-gray-100">
            <Search className="size-4 text-gray-400 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(0) }}
              placeholder="Type a command or search..."
              className="flex-1 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 bg-transparent outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
              ESC
            </kbd>
          </div>
          {/* Results */}
          <div className="p-2 max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No results found</p>
            ) : (
              filtered.map((cmd, i) => {
                const Icon = cmd.icon
                return (
                  <button
                    key={cmd.id}
                    onClick={() => { setActiveView(cmd.view); setOpen(false); setQuery('') }}
                    onMouseEnter={() => setSelected(i)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      i === selected ? 'bg-amber-50 text-amber-900' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`size-4 shrink-0 ${i === selected ? 'text-amber-600' : 'text-gray-400'}`} />
                    <span className="flex-1 font-medium">{cmd.label}</span>
                    <ArrowRight className={`size-3 transition-opacity ${i === selected ? 'opacity-100 text-amber-600' : 'opacity-0'}`} />
                  </button>
                )
              })
            )}
          </div>
          {/* Footer hint */}
          <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-4 text-[10px] text-gray-400">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>esc Close</span>
          </div>
        </div>
      </div>
    </>
  )
}