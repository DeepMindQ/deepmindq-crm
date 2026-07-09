'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  LayoutDashboard, Building2, Users, Upload, Settings, Search,
  Bell, HelpCircle, LogOut, ChevronDown, Command,
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
import { CommandPalette } from '@/components/shared/command-palette'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { ActiveView } from '@/lib/types'

const navItems: { view: ActiveView; label: string; icon: React.ElementType }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'companies', label: 'Companies', icon: Building2 },
  { view: 'contacts', label: 'Contacts', icon: Users },
  { view: 'import', label: 'Import', icon: Upload },
  { view: 'settings', label: 'Settings', icon: Settings },
]

const pageTitles: Record<ActiveView, string> = {
  dashboard: 'Dashboard', companies: 'Companies',
  'company-profile': 'Company Profile', contacts: 'Contacts',
  import: 'Import', settings: 'Settings',
}

const pageDescriptions: Record<ActiveView, string> = {
  dashboard: 'Overview of your lead pipeline',
  companies: 'Target company accounts',
  'company-profile': 'Detailed company intelligence',
  contacts: 'Contact database & outreach',
  import: 'Bulk data import',
  settings: 'Configuration & preferences',
}

const contentVariants = { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 } }
const contentTransition = { duration: 0.2, ease: [0.16, 1, 0.3, 1] }

export function AppShell({ children }: { children: React.ReactNode }) {
  const { activeView, searchQuery, setActiveView, setSearchQuery } = useAppStore()

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
      <SidebarInset className="bg-gray-50/80">
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
          <button className="relative p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors press-scale">
            <Bell className="size-4" />
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-500 ring-2 ring-white" />
          </button>

          {/* Help */}
          <button className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors press-scale">
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
              <DropdownMenuItem className="rounded-lg text-sm text-gray-700 cursor-pointer">
                <HelpCircle className="size-4 mr-2 text-gray-400" /> Help & Documentation
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg text-sm text-red-600 cursor-pointer">
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
      </SidebarInset>

      <CommandPalette />
    </SidebarProvider>
  )
}