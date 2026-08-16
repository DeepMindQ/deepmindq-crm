'use client';

import { useState } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCheck, Trash2, Bell } from 'lucide-react';
import { useNotificationStore, type Notification } from './notification-store';
import { getNotificationStyle } from './notification-icon';
import { NotificationList } from './notification-list';
import { motion, AnimatePresence } from 'framer-motion';

export function NotificationPanel() {
  const { isPanelOpen, setPanelOpen, notifications, unreadCount, markAllAsRead, clearAll } =
    useNotificationStore();
  const [filter, setFilter] = useState<'all' | 'unread' | 'intelligence' | 'opportunities'>('all');

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'intelligence') return n.type === 'intelligence' || n.type === 'info';
    if (filter === 'opportunities') return n.type === 'opportunity' || n.type === 'success';
    return true;
  });

  return (
    <Sheet open={isPanelOpen} onOpenChange={setPanelOpen}>
      <SheetContent className="w-full sm:w-96 p-0" side="right">
        <SheetHeader className="px-4 py-3 border-b border-border space-y-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              Notifications
              {unreadCount > 0 && (
                <span className="inline-flex items-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </SheetTitle>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAsRead}>
                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                  Read all
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive"
                  onClick={clearAll}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as typeof filter)}
            className="mt-2"
          >
            <TabsList className="w-full h-8">
              <TabsTrigger value="all" className="text-xs flex-1">
                All
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-xs flex-1">
                Unread
              </TabsTrigger>
              <TabsTrigger value="intelligence" className="text-xs flex-1">
                Intel
              </TabsTrigger>
              <TabsTrigger value="opportunities" className="text-xs flex-1">
                Opps
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-180px)]">
          <AnimatePresence mode="popLayout">
            {filtered.length > 0 ? (
              <NotificationList />
            ) : (
              <motion.div
                key={`empty-${filter}`}
                className="flex flex-col items-center justify-center py-16 px-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                  style={{
                    background: tokens.accent.subtle,
                    border: '1px solid rgba(59,130,246,0.2)',
                  }}
                >
                  <Bell className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium mb-1">No notifications</p>
                <p className="text-xs text-muted-foreground text-center">
                  {filter === 'all' ? "You're all caught up" : `No ${filter} notifications`}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
