'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  LayoutDashboard, Building2, Users, Upload, Settings, Search,
  Bell, HelpCircle, LogOut, ChevronDown, Command, X, CheckCircle2, Sparkles,
  BookOpen, MailPlus,
} from 'lucide-react'
import {
  SidebarProvider, Sidebar, SidebarHeader, SidebarContent,
  SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuItem, SidebarMenuButton, SidebarRail, SidebarSeparator,
  SidebarInset, SidebarTrigger,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { CommandPalette } from '@/components/shared/command-palette'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { ActiveView } from '@/lib/types'

const navItems: { view: ActiveView; label: string; icon: React.ElementType }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'companies', label: 'Companies', icon: Building2 },
  { view: 'contacts', label: 'Contacts', icon: Users },
  { view: 'email-generation', label: 'AI Emails', icon: MailPlus },
  { view: 'knowledge-library', label: 'Knowledge', icon: BookOpen },
  { view: 'import', label: 'Import', icon: Upload },
  { view: 'settings', label: 'Settings', icon: Settings },
]

const pageTitles: Record<ActiveView, string> = {
  dashboard: 'Dashboard', companies: 'Companies',
  'company-profile': 'Company Profile', contacts: 'Contacts',
  'contact-profile': 'Contact Profile',
  'email-generation': 'AI Emails',
  'knowledge-library': 'Knowledge Library',
  import: 'Import', settings: 'Settings',
}

const pageDescriptions: Record<ActiveView, string> = {
  dashboard: 'Overview of your lead pipeline',
  companies: 'Target company accounts',
  'company-profile': 'Detailed company intelligence',
  contacts: 'Contact database & outreach',
  'contact-profile': 'Contact details & activity',
  'email-generation': 'Generate AI outreach emails',
  'knowledge-library': 'Capability documents & snippets',
  import: 'Bulk data import',
  settings: 'Configuration & preferences',
}

const contentVariants = { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 } }
const contentTransition = { duration: 0.2, ease: [0.16, 1, 0.3, 1] }

export function AppShell({ children }: { children: React.ReactNode }) {
  const { activeView, searchQuery, setActiveView, setSearchQuery } = useAppStore()
  const [showNotifications, setShowNotifications] = React.useState(false)
  const [showHelp, setShowHelp] = React.useState(false)

  const { data: notifData, isLoading: notifLoading } = useQuery({
    queryKey: ['recent-notifications'],
    queryFn: () => fetch('/api/timeline?limit=5').then(r => r.json()),
  })
  const notifications = notifData?.entries?.slice(0, 5) || []

  const isNavActive = (view: ActiveView): boolean => {
    if (view === 'companies' && activeView === 'company-profile') return true
    return activeView === view
  }

  const breadcrumbItems: { label: string; isPage?: boolean }[] =
    activeView === 'company-profile'
      ? [{ label: 'Companies' }, { label: 'Company Profile', isPage: true }]
      : [{ label: pageTitles[activeView], isPage: true }]

  return (
    <SidebarProvider>
      {/* ── Sidebar ── */}
      <Sidebar collapsible="icon" className="border-r border-gray-200/80 bg-white">
        <SidebarHeader className="px-4 py-5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 ring-1 ring-amber-200/60">
              <Image src="/logo.png" alt="DeepMindQ" width={20} height={20} className="rounded-sm" />
            </div>
            <span className="truncate text-[15px] font-semibold tracking-tight text-gray-900">
              Deep<span className="text-amber-600">MindQ</span>
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-3">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = item.icon
                  const active = isNavActive(item.view)
                  return (
                    <SidebarMenuItem key={item.view}>
                      <SidebarMenuButton
                        isActive={active}
                        onClick={() => setActiveView(item.view)}
                        tooltip={{ children: item.label, side: 'right' as const, align: 'center' as const, className: 'font-medium text-xs bg-white text-gray-700 border border-gray-200 shadow-sm' }}
                        className={cn(
                          'rounded-lg transition-all duration-150',
                          'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
                          'data-[active=true]:bg-amber-50 data-[active=true]:text-amber-700',
                          'data-[active=true]:font-medium',
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="mt-auto">
          <SidebarSeparator className="bg-gray-200/80" />
          <div className="flex items-center gap-2 px-3 py-2">
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="bg-amber-100 text-xs font-semibold text-amber-700">R</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-none text-gray-900">Ravi</p>
              <p className="mt-1 truncate text-[11px] text-gray-500">ravi@deepmindq.com</p>
            </div>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      {/* ── Main ── */}
      <SidebarInset className="relative bg-gray-50/80">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200/80 bg-white/80 px-4 backdrop-blur-xl">
          <SidebarTrigger className="-ml-1.5 text-gray-400 hover:text-gray-900 transition-colors" />
          <Separator orientation="vertical" className="mx-1 h-4 bg-gray-200/80" />

          {/* Breadcrumbs */}
          <Breadcrumb className="hidden sm:flex">
            <BreadcrumbList>
              {breadcrumbItems.map((item, i) => (
                <React.Fragment key={item.label}>
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {item.isPage ? (
                      <BreadcrumbPage className="text-sm font-medium text-gray-900">{item.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        href="#"
                        onClick={(e) => { e.preventDefault(); setActiveView('companies') }}
                        className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        {item.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex-1" />

          {/* Cmd+K Search */}
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="hidden md:flex items-center gap-2 h-8 w-56 rounded-lg border border-gray-200 bg-gray-50/80 px-3 text-sm text-gray-400 hover:bg-gray-100 hover:border-gray-300 transition-all duration-150 cursor-pointer group"
          >
            <Search className="size-3.5 text-gray-400" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="flex items-center gap-0.5 rounded border border-gray-200 bg-white px-1 py-0.5 text-[10px] font-medium text-gray-400 group-hover:border-gray-300 transition-colors">
              <Command className="size-2.5" />K
            </kbd>
          </button>

          {/* Notification bell */}
          <button onClick={() => setShowNotifications((prev) => !prev)} className="relative p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors press-scale">
            <Bell className="size-4" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-500 ring-2 ring-white" />
            )}
          </button>

          {/* Help */}
          <button onClick={() => setShowHelp(true)} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors press-scale">
            <HelpCircle className="size-4" />
          </button>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-amber-100 text-[10px] font-semibold text-amber-700">R</AvatarFallback>
                </Avatar>
                <ChevronDown className="size-3 text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5 elevation-float">
              <div className="px-2 py-1.5 mb-1">
                <p className="text-sm font-semibold text-gray-900">Ravi</p>
                <p className="text-xs text-gray-500">ravi@deepmindq.com</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-lg text-sm text-gray-700 cursor-pointer" onClick={() => setShowHelp(true)}>
                <HelpCircle className="size-4 mr-2 text-gray-400" /> Help & Documentation
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg text-sm text-red-600 cursor-pointer" onClick={() => toast.info('Sign out is not configured in demo mode')}>
                <LogOut className="size-4 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeView}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={contentTransition}
              className="mx-auto h-full max-w-7xl"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Notification Panel */}
        <AnimatePresence>
          {showNotifications && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-14 bottom-0 w-80 bg-white border-l border-gray-200/80 shadow-modal z-40 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                <button onClick={() => setShowNotifications(false)} className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                  <X className="size-4 text-gray-400" />
                </button>
              </div>
              <div className="p-3 space-y-1 max-h-[calc(100%-3.5rem)] overflow-y-auto">
                {notifLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
                        <Skeleton className="size-8 rounded-lg shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3.5 w-3/4 rounded" />
                          <Skeleton className="h-3 w-full rounded" />
                        </div>
                      </div>
                    ))
                  : notifications.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-8">No recent activity</p>
                    : notifications.map((n: any) => {
                        const iconMap: Record<string, { bg: string; icon: React.ElementType; color: string }> = {
                          import: { bg: 'bg-emerald-50', icon: CheckCircle2, color: 'text-emerald-600' },
                          email: { bg: 'bg-blue-50', icon: MailPlus, color: 'text-blue-600' },
                          research: { bg: 'bg-amber-50', icon: Sparkles, color: 'text-amber-600' },
                        }
                        const type = (n.type || n.action || '').toLowerCase().includes('import') ? 'import'
                          : (n.type || n.action || '').toLowerCase().includes('email') ? 'email'
                          : (n.type || n.action || '').toLowerCase().includes('research') ? 'research'
                          : 'import'
                        const cfg = iconMap[type] || iconMap.import
                        const IconComp = cfg.icon
                        const timeAgo = n.createdAt ? new Date(n.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
                        return (
                          <div key={n.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                            <div className={`size-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}><IconComp className={`size-4 ${cfg.color}`} /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{n.title || n.description || n.action || 'Activity'}</p>
                              {n.description && <p className="text-[11px] text-gray-500 truncate">{n.description}</p>}
                            </div>
                            {timeAgo && <span className="text-[10px] text-gray-400 shrink-0">{timeAgo}</span>}
                          </div>
                        )
                      })
                }
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SidebarInset>

      <CommandPalette />

      {/* Help Dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="sm:max-w-md rounded-xl p-6">
          <DialogHeader><DialogTitle className="text-gray-900">Help & Documentation</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2 text-sm text-gray-700">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Keyboard Shortcuts:</h4>
              <ul className="space-y-1.5 text-gray-600">
                <li className="flex items-center gap-2"><kbd className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">Cmd/Ctrl + K</kbd> Open command palette</li>
                <li className="flex items-center gap-2"><kbd className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">Cmd/Ctrl + B</kbd> Toggle sidebar</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Getting Started:</h4>
              <ol className="list-decimal list-inside space-y-1.5 text-gray-600">
                <li>Import companies via CSV or add manually</li>
                <li>Generate AI research cards for companies</li>
                <li>Validate email addresses</li>
                <li>Generate personalized outreach emails</li>
                <li>Track opportunities through the pipeline</li>
              </ol>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}