'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Building2,
  Users,
  Upload,
  Settings,
  Brain,
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
        // Sync sidebar state: only toggle if the new state differs
        if (open !== !sidebarCollapsed) {
          toggleSidebar()
        }
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Sidebar                                                           */}
      {/* ------------------------------------------------------------------ */}
      <Sidebar
        collapsible="icon"
        className="border-r border-border/50 bg-white dark:border-white/[0.06] dark:bg-slate-950"
      >
        {/* Logo */}
        <SidebarHeader className="px-4 py-5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/10">
              <Brain className="size-4 text-emerald-500" />
            </div>
            <span className="truncate text-[15px] font-semibold tracking-tight">
              Lead<span className="text-emerald-500">Intel</span>
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
                            'font-medium text-xs bg-popover text-popover-foreground border border-border/60',
                        }}
                        className={cn(
                          'rounded-lg transition-all duration-150',
                          // Default / hover
                          'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                          'dark:hover:bg-white/[0.06] dark:hover:text-foreground',
                          // Active
                          'data-[active=true]:bg-emerald-500/10 data-[active=true]:text-emerald-600',
                          'dark:data-[active=true]:bg-emerald-500/10 dark:data-[active=true]:text-emerald-400',
                          'data-[active=true]:font-medium data-[active=true]:shadow-none',
                          // Collapsed icon sizing handled by shadcn base styles
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
          <SidebarSeparator className="bg-border/50 dark:bg-white/[0.06]" />
          <div className="flex items-center gap-2 px-3 py-2">
            {/* Avatar + name */}
            <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  R
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-none">
                  Ravi
                </p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  ravi@leadintel.io
                </p>
              </div>
            </div>

            {/* Theme toggle — only visible when expanded */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="group-data-[collapsible=icon]:hidden size-8 shrink-0 text-muted-foreground hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/[0.06]"
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
                className="text-xs bg-popover text-popover-foreground border border-border/60"
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
      {/* Main content area                                                  */}
      {/* ------------------------------------------------------------------ */}
      <SidebarInset className="bg-gray-50/50 dark:bg-slate-900/80">
        {/* Sticky header */}
        <header
          className={cn(
            'sticky top-0 z-30 flex h-14 items-center gap-3',
            'border-b border-border/50 bg-white/80 px-4 backdrop-blur-xl',
            'dark:border-white/[0.06] dark:bg-slate-900/60 dark:backdrop-blur-xl',
          )}
        >
          <SidebarTrigger className="-ml-1.5 text-muted-foreground hover:text-foreground" />

          <Separator
            orientation="vertical"
            className="mx-1 h-4 bg-border/50 dark:bg-white/[0.08]"
          />

          {/* Page title & description */}
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-sm font-semibold tracking-tight leading-none">
              {pageTitles[activeView]}
            </h1>
            <p className="hidden text-[11px] text-muted-foreground leading-none sm:block mt-0.5">
              {pageDescriptions[activeView]}
            </p>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              type="search"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'h-8 w-full rounded-lg border-transparent pl-8 pr-3 text-sm',
                'bg-muted/50 shadow-none placeholder:text-muted-foreground/50',
                'transition-colors duration-150',
                'focus-visible:border-border/60 focus-visible:bg-background focus-visible:ring-ring/20 focus-visible:ring-[3px]',
                'dark:bg-white/[0.04] dark:placeholder:text-muted-foreground/40',
                'dark:focus-visible:bg-white/[0.06] dark:focus-visible:border-white/[0.1]',
              )}
            />
          </div>

          {/* Theme toggle — mobile / always-visible in header */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden size-8 text-muted-foreground hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/[0.06] md:hidden"
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
              className="text-xs bg-popover text-popover-foreground border border-border/60"
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