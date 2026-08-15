'use client';

import { useNotificationStore, type Notification } from './notification-store';
import { getNotificationStyle, formatTimeAgo } from './notification-icon';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, type ViewId } from '@/lib/store';

// FIX E5: Map notification category/type to app views for click-to-navigate
function resolveNotificationView(notification: Notification): ViewId | null {
  // Explicit link takes priority
  if (notification.link) return null; // handled by existing hash logic

  const category = notification.category?.toLowerCase() || '';
  const type = notification.type;
  const message = notification.message.toLowerCase();
  const title = notification.title.toLowerCase();

  // Signal-related notifications
  if (category.includes('signal') || title.includes('signal') || message.includes('signal')) {
    return 'signal-intelligence';
  }

  // Data ingestion / import
  if (
    category.includes('ingestion') ||
    category.includes('import') ||
    title.includes('upload') ||
    title.includes('ingestion') ||
    message.includes('upload')
  ) {
    return 'data-import';
  }

  // Pipeline
  if (category.includes('pipeline') || title.includes('pipeline') || message.includes('pipeline')) {
    return 'pipeline';
  }

  // AI/Intelligence
  if (
    category.includes('intelligence') ||
    category.includes('ai') ||
    category.includes('insight') ||
    type === 'intelligence' ||
    title.includes('insight')
  ) {
    return 'intelligence-operations';
  }

  // Company/organization
  if (category.includes('company') || category.includes('organization')) {
    return 'companies';
  }

  // Contact/person
  if (category.includes('contact') || category.includes('person')) {
    return 'contacts';
  }

  // Opportunity
  if (category.includes('opportunity') || type === 'opportunity') {
    return 'opportunities';
  }

  // Risk
  if (type === 'risk') {
    return 'signal-intelligence';
  }

  return null;
}

function NotificationItem({ notification }: { notification: Notification }) {
  const { markAsRead, removeNotification, setOpen } = useNotificationStore();
  const setActiveView = useAppStore((s) => s.setActiveView);
  const style = getNotificationStyle(notification.type);
  const Icon = style.icon;

  const handleClick = () => {
    if (!notification.read) markAsRead(notification.id);

    // FIX E5: Navigate to appropriate screen based on notification category
    if (notification.link) {
      window.location.hash = notification.link;
    } else {
      const targetView = resolveNotificationView(notification);
      if (targetView) {
        setActiveView(targetView);
      }
    }

    setOpen(false);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNotification(notification.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className={`
        group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors
        hover:bg-muted/50
        ${!notification.read ? 'bg-primary/[0.03]' : ''}
      `}
      onClick={handleClick}
      role="listitem"
      aria-label={`${notification.title}: ${notification.message}`}
    >
      <div
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
        style={{ background: style.bgColor, border: `1px solid ${style.borderColor}` }}
      >
        <Icon className="w-4 h-4" style={{ color: style.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{notification.title}</p>
          {!notification.read && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatTimeAgo(notification.createdAt)}
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100 p-1 rounded-md hover:bg-muted transition-opacity"
        aria-label="Dismiss notification"
      >
        <X className="w-3 h-3 text-muted-foreground" />
      </button>
    </motion.div>
  );
}

export function NotificationList() {
  const { notifications } = useNotificationStore();

  return (
    <div role="list" aria-label="Notifications">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} />
        ))}
      </AnimatePresence>
    </div>
  );
}
