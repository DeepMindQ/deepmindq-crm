import { create } from 'zustand';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'intelligence' | 'opportunity' | 'risk';
  read: boolean;
  link?: string;
  createdAt: Date;
  category?: string;
}

// FIX E3: Persist read notification IDs in localStorage
const READ_IDS_STORAGE_KEY = 'dmq_notification_read_ids';

function loadReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(READ_IDS_STORAGE_KEY);
    if (stored) return new Set(JSON.parse(stored) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

function saveReadIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(READ_IDS_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* storage full */
  }
}

// Initialize persisted read IDs on module load (client-side only)
let persistedReadIds = typeof window !== 'undefined' ? loadReadIds() : new Set<string>();

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean;
  isPanelOpen: boolean;

  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  setOpen: (open: boolean) => void;
  setPanelOpen: (open: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  isPanelOpen: false,

  setNotifications: (notifications) =>
    set({
      // Apply persisted read state to incoming notifications
      notifications: notifications.map((n) => ({
        ...n,
        read: n.read || persistedReadIds.has(n.id),
      })),
      unreadCount: notifications.filter((n) =>
        n.read || persistedReadIds.has(n.id) ? false : !n.read,
      ).length,
    }),

  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      read: false,
      createdAt: new Date(),
    };
    set((state) => ({
      notifications: [newNotification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAsRead: (id) =>
    set((state) => {
      const n = state.notifications.find((n) => n.id === id);
      const wasUnread = n && !n.read;
      if (wasUnread) {
        persistedReadIds.add(id);
        saveReadIds(persistedReadIds);
      }
      return {
        notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        unreadCount: wasUnread ? state.unreadCount - 1 : state.unreadCount,
      };
    }),

  markAllAsRead: () =>
    set((state) => {
      for (const n of state.notifications) {
        persistedReadIds.add(n.id);
      }
      saveReadIds(persistedReadIds);
      return {
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      };
    }),

  removeNotification: (id) =>
    set((state) => {
      const n = state.notifications.find((n) => n.id === id);
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: n && !n.read ? state.unreadCount - 1 : state.unreadCount,
      };
    }),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  setOpen: (isOpen) => set({ isOpen }),
  setPanelOpen: (isPanelOpen) => set({ isPanelOpen }),
}));
