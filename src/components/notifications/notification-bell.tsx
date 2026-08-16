'use client';

import { useEffect, useRef } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotificationStore, type Notification } from './notification-store';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationList } from './notification-list';
import { fetchApi } from '@/lib/fetchApi';

/* ═══════════════════════════════════════════════════
   Helpers — map activity API types to notification types
   ═══════════════════════════════════════════════════ */

interface TeamActivityItem {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  title: string;
  description: string;
  timestamp: string;
}

function mapActivityType(type: string): Notification['type'] {
  switch (type) {
    case 'signal_detected':
      return 'risk';
    case 'ingestion_upload':
      return 'success';
    case 'briefing_generated':
      return 'intelligence';
    default:
      return 'info';
  }
}

function mapActivityLink(item: TeamActivityItem): string | undefined {
  switch (item.entityType) {
    case 'signal':
      return 'signal-intelligence';
    case 'ingestion':
      return 'data-import';
    case 'briefing':
      return 'intelligence-briefing';
    default:
      return undefined;
  }
}

export function NotificationBell() {
  const { unreadCount, notifications, addNotification, markAllAsRead, isOpen, setOpen, hydrate } =
    useNotificationStore();

  // Hydrate from localStorage on first mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Real-time polling for new team activity (E6)
  const lastActivityId = useRef<string | null>(null);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const { data } = await fetchApi<TeamActivityItem[]>('/api/team-activity', {
          params: { limit: 5 },
        });
        if (data && data.length > 0) {
          if (lastActivityId.current && data[0].id !== lastActivityId.current) {
            // New activity detected — create notifications for unseen items
            const newItems = data.filter((d) => d.id !== lastActivityId.current);
            for (const item of [...newItems].reverse()) {
              addNotification({
                title: item.title,
                message: item.description,
                type: mapActivityType(item.type),
                link: mapActivityLink(item),
              });
            }
          }
          lastActivityId.current = data[0].id;
        }
      } catch {
        // Silently ignore polling errors
      }
    };

    fetchActivities();
    pollInterval.current = setInterval(fetchActivities, 30000); // Poll every 30 seconds

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [addNotification]);

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length > 0 ? (
            <NotificationList />
          ) : (
            <div className="px-4 py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
