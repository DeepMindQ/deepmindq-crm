'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  LayoutDashboard,
  Building2,
  Users,
  Upload,
  Settings,
  Search,
  Sun,
  Moon,
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
import { Button } from '@/components/ui/button'
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
// Animation
// ---------------------------------------------------------------------------

const contentVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
}

const contentTransition = {
  duration: 0.18,
  ease: [0.25, 0.1, 0.25, 1] as const,
}

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

  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

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
      {/* Sidebar — DeepMindQ dark navy theme                                */}
      {/* ------------------------------------------------------------------ */}
      <Sidebar
        collapsible="icon"
        className="border-r border-white/[0.06] bg-[#0A0E1A]"
      >
        {/* Logo */}
        <SidebarHeader className="px-4 py-5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37]/10 ring-1 ring-[#D4AF37]/20">
              <Image
                src="/logo.png"
                alt="DeepMindQ"
                width={20}
                height={20}
                className="rounded-sm"
              />
            </div>
            <span className="truncate text-[15px] font-semibold tracking-tight text-white">
              Deep<span className="text-[#D4AF37]">MindQ</span>
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
                            'font-medium text-xs bg-[#1E1E1E] text-[#CCCCCC] border border-white/[0.06]',
                        }}
                        className={cn(
                          'rounded-lg transition-all duration-150',
                          // Default / hover
                          'text-[#888888] hover:bg-white/[0.04] hover:text-[#CCCCCC]',
                          // Active — gold accent
                          'data-[active=true]:bg-[#D4AF37]/10 data-[active=true]:text-[#D4AF37]',
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

        {/* Footer — user & theme toggle */}
        <SidebarFooter className="mt-auto">
          <SidebarSeparator className="bg-white/[0.06]" />
          <div className="flex items-center gap-2 px-3 py-2">
            {/* Avatar + name */}
            <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="bg-[#D4AF37]/10 text-xs font-semibold text-[#D4AF37]">
                  R
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-none text-white">
                  Ravi
                </p>
                <p className="mt-1 truncate text-[11px] text-[#888888]">
                  ravi@deepmindq.com
                </p>
              </div>
            </div>

            {/* Theme toggle — only visible when expanded */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="group-data-[collapsible=icon]:hidden size-8 shrink-0 text-[#888888] hover:bg-white/[0.04] hover:text-white"
                  onClick={() =>
                    setTheme(theme === 'dark' ? 'light' : 'dark')
                  }
                  aria-label="Toggle theme"
                >
                  {mounted && theme === 'dark' ? (
                    <Sun className="size-4" />
                  ) : (
                    <Moon className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="text-xs bg-[#1E1E1E] text-[#CCCCCC] border border-white/[0.06]"
              >
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </TooltipContent>
            </Tooltip>
          </div>
        </SidebarFooter>

        {/* Rail — invisible hover zone to resize/collapse */}
        <SidebarRail />
      </Sidebar>

      {/* ------------------------------------------------------------------ */}
      {/* Main content area — dark surface                                   */}
      {/* ------------------------------------------------------------------ */}
      <SidebarInset className="bg-[#121212]">
        {/* Sticky header */}
        <header
          className={cn(
            'sticky top-0 z-30 flex h-14 items-center gap-3',
            'border-b border-white/[0.06] bg-[#121212]/80 px-4 backdrop-blur-xl',
          )}
        >
          <SidebarTrigger className="-ml-1.5 text-[#888888] hover:text-white" />

          <Separator
            orientation="vertical"
            className="mx-1 h-4 bg-white/[0.08]"
          />

          {/* Page title & description */}
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-sm font-semibold tracking-tight leading-none text-white">
              {pageTitles[activeView]}
            </h1>
            <p className="hidden text-[11px] text-[#888888] leading-none sm:block mt-0.5">
              {pageDescriptions[activeView]}
            </p>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#888888]/60" />
            <Input
              type="search"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'h-8 w-full rounded-lg border-transparent pl-8 pr-3 text-sm',
                'bg-white/[0.04] shadow-none placeholder:text-[#888888]/50',
                'transition-colors duration-150',
                'focus-visible:border-[#D4AF37]/30 focus-visible:bg-white/[0.06] focus-visible:ring-[#D4AF37]/20 focus-visible:ring-[3px]',
              )}
            />
          </div>

          {/* Theme toggle — mobile */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden size-8 text-[#888888] hover:bg-white/[0.04] hover:text-white md:hidden"
                onClick={() =>
                  setTheme(theme === 'dark' ? 'light' : 'dark')
                }
                aria-label="Toggle theme"
              >
                {mounted && theme === 'dark' ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="text-xs bg-[#1E1E1E] text-[#CCCCCC] border border-white/[0.06]"
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </TooltipContent>
          </Tooltip>
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