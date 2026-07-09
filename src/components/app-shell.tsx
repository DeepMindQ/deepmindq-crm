'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  LayoutDashboard,
  Building2,
  Users,
  Upload,
  Settings,
  Search,
} from 'lucide-react'
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  SidebarSeparator,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { ActiveView } from '@/lib/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const navItems: { view: ActiveView; label: string; icon: React.ElementType }[] =
  [
    { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { view: 'companies', label: 'Companies', icon: Building2 },
    { view: 'contacts', label: 'Contacts', icon: Users },
    { view: 'import', label: 'Import', icon: Upload },
    { view: 'settings', label: 'Settings', icon: Settings },
  ]

const pageTitles: Record<ActiveView, string> = {
  dashboard: 'Dashboard',
  companies: 'Companies',
  'company-profile': 'Company Profile',
  contacts: 'Contacts',
  import: 'Import',
  settings: 'Settings',
}

const pageDescriptions: Record<ActiveView, string> = {
  dashboard: 'Overview of your lead pipeline',
  companies: 'Target company accounts',
  'company-profile': 'Detailed company intelligence',
  contacts: 'Contact database & outreach',
  import: 'Bulk data import',
  settings: 'Configuration & preferences',
}

// ---------------------------------------------------------------------------
// Animation — opacity only for subtlety
// ---------------------------------------------------------------------------

const contentVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

const contentTransition = { duration: 0.15 }

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    activeView,
    sidebarCollapsed,
    searchQuery,
    setActiveView,
    toggleSidebar,
    setSearchQuery,
  } = useAppStore()

  // When in company-profile view, keep "Companies" nav item highlighted
  const isNavActive = (view: ActiveView): boolean => {
    if (view === 'companies' && activeView === 'company-profile') return true
    return activeView === view
  }

  return (
    <SidebarProvider
      open={!sidebarCollapsed}
      onOpenChange={(open) => {
        if (open !== !sidebarCollapsed) {
          toggleSidebar()
        }
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Sidebar — Premium white theme                                      */}
      {/* ------------------------------------------------------------------ */}
      <Sidebar
        collapsible="icon"
        className="border-r border-gray-200/80 bg-white"
      >
        {/* Logo */}
        <SidebarHeader className="px-4 py-5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 ring-1 ring-amber-200/60">
              <Image
                src="/logo.png"
                alt="DeepMindQ"
                width={20}
                height={20}
                className="rounded-sm"
              />
            </div>
            <span className="truncate text-[15px] font-semibold tracking-tight text-gray-900">
              Deep<span className="text-[#B8962E]">MindQ</span>
            </span>
          </div>
        </SidebarHeader>

        {/* Navigation */}
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
                        tooltip={{
                          children: item.label,
                          side: 'right' as const,
                          align: 'center' as const,
                          className:
                            'font-medium text-xs bg-white text-gray-700 border border-gray-200 shadow-sm',
                        }}
                        className={cn(
                          'rounded-lg transition-all duration-150',
                          'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
                          'data-[active=true]:bg-amber-50 data-[active=true]:text-amber-700',
                          'data-[active=true]:font-medium data-[active=true]:shadow-none',
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

        {/* Footer — user section */}
        <SidebarFooter className="mt-auto">
          <SidebarSeparator className="bg-gray-200/80" />
          <div className="flex items-center gap-2 px-3 py-2">
            {/* Avatar + name */}
            <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="bg-amber-100 text-xs font-semibold text-amber-700">
                  R
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-none text-gray-900">
                  Ravi
                </p>
                <p className="mt-1 truncate text-[11px] text-gray-500">
                  ravi@deepmindq.com
                </p>
              </div>
            </div>
          </div>
        </SidebarFooter>

        {/* Rail — invisible hover zone to resize/collapse */}
        <SidebarRail />
      </Sidebar>

      {/* ------------------------------------------------------------------ */}
      {/* Main content area — light surface                                   */}
      {/* ------------------------------------------------------------------ */}
      <SidebarInset className="bg-gray-50/80">
        {/* Sticky header */}
        <header
          className={cn(
            'sticky top-0 z-30 flex h-14 items-center gap-3',
            'border-b border-gray-200/80 bg-white/80 px-4 backdrop-blur-xl',
          )}
        >
          <SidebarTrigger className="-ml-1.5 text-gray-400 hover:text-gray-900" />

          <Separator
            orientation="vertical"
            className="mx-1 h-4 bg-gray-200/80"
          />

          {/* Page title & description */}
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-sm font-semibold tracking-tight leading-none text-gray-900">
              {pageTitles[activeView]}
            </h1>
            <p className="hidden text-[11px] text-gray-500 leading-none sm:block mt-0.5">
              {pageDescriptions[activeView]}
            </p>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              type="search"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'h-8 w-full rounded-lg border-transparent pl-8 pr-3 text-sm',
                'bg-gray-100 shadow-none placeholder:text-gray-400',
                'transition-colors duration-150',
                'focus-visible:bg-white focus-visible:border-gray-300 focus-visible:ring-amber-200/50 focus-visible:ring-[3px]',
              )}
            />
          </div>
        </header>

        {/* Animated content */}
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
      </SidebarInset>
    </SidebarProvider>
  )
}