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

/* ═══════════════════════════════════════════════════
   localStorage persistence — keeps last 100 notifications
   across page reloads to prevent data loss (E3).
   ═══════════════════════════════════════════════════ */

const STORAGE_KEY = 'dmq-notifications';

function loadFromStorage(): Notification[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: Notification[] = JSON.parse(stored);
    return parsed.map((n) => ({
      ...n,
      createdAt: new Date(n.createdAt as unknown as string),
    })) as Notification[];
  } catch {
    return [];
  }
}

function saveToStorage(notifications: Notification[]) {
  if (typeof window === 'undefined') return;
  try {
    // Keep only last 100 notifications
    const toSave = notifications.slice(0, 100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // Storage full — ignore
  }
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean;
  isPanelOpen: boolean;
  /** Whether the store has been hydrated from localStorage (prevents SSR mismatch) */
  hasHydrated: boolean;

  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  setOpen: (open: boolean) => void;
  setPanelOpen: (open: boolean) => void;
  /** Hydrate state from localStorage — call once on mount */
  hydrate: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  isPanelOpen: false,
  hasHydrated: false,

  hydrate: () => {
    const stored = loadFromStorage();
    set({
      notifications: stored,
      unreadCount: stored.filter((n) => !n.read).length,
      hasHydrated: true,
    });
  },

  setNotifications: (notifications) => {
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    });
    saveToStorage(get().notifications);
  },

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
    saveToStorage(get().notifications);
  },

  markAsRead: (id) =>
    set((state) => {
      const n = state.notifications.find((n) => n.id === id);
      const wasUnread = n && !n.read;
      const updated = {
        notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        unreadCount: wasUnread ? state.unreadCount - 1 : state.unreadCount,
      };
      // Persist after state update
      setTimeout(() => saveToStorage(updated.notifications), 0);
      return updated;
    }),

  markAllAsRead: () => {
    const updated = {
      notifications: get().notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    };
    set(updated);
    saveToStorage(updated.notifications);
  },

  removeNotification: (id) =>
    set((state) => {
      const n = state.notifications.find((n) => n.id === id);
      const updated = {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: n && !n.read ? state.unreadCount - 1 : state.unreadCount,
      };
      // Persist after state update
      setTimeout(() => saveToStorage(updated.notifications), 0);
      return updated;
    }),

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
    saveToStorage([]);
  },

  setOpen: (isOpen) => set({ isOpen }),
  setPanelOpen: (isPanelOpen) => set({ isPanelOpen }),
}));
