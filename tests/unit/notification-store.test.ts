/**
 * Tests for src/components/notifications/notification-store.ts
 *
 * Uses default jsdom environment (has window + localStorage natively).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock crypto.randomUUID before the store imports
vi.stubGlobal('crypto', {
  ...globalThis.crypto,
  randomUUID: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).slice(2)),
});

import {
  useNotificationStore,
  type Notification,
} from '@/components/notifications/notification-store';

const STORAGE_KEY = 'dmq-notifications';

describe('useNotificationStore', () => {
  beforeEach(() => {
    // Reset store state
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
      isOpen: false,
      isPanelOpen: false,
      hasHydrated: false,
    });
    // Clear actual jsdom localStorage
    localStorage.clear();
  });

  describe('initial state', () => {
    it('starts with empty notifications array', () => {
      expect(useNotificationStore.getState().notifications).toEqual([]);
    });

    it('starts with unreadCount 0', () => {
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('starts with isOpen false', () => {
      expect(useNotificationStore.getState().isOpen).toBe(false);
    });

    it('starts with isPanelOpen false', () => {
      expect(useNotificationStore.getState().isPanelOpen).toBe(false);
    });

    it('starts with hasHydrated false', () => {
      expect(useNotificationStore.getState().hasHydrated).toBe(false);
    });
  });

  describe('addNotification', () => {
    it('adds a notification to the store', () => {
      useNotificationStore.getState().addNotification({
        title: 'Test',
        message: 'Hello',
        type: 'info',
      });
      const { notifications } = useNotificationStore.getState();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe('Test');
      expect(notifications[0].message).toBe('Hello');
      expect(notifications[0].type).toBe('info');
    });

    it('sets read to false on new notification', () => {
      useNotificationStore.getState().addNotification({
        title: 'Test',
        message: 'Hello',
        type: 'success',
      });
      expect(useNotificationStore.getState().notifications[0].read).toBe(false);
    });

    it('assigns a random UUID as id', () => {
      useNotificationStore.getState().addNotification({
        title: 'Test',
        message: 'Hello',
        type: 'warning',
      });
      expect(useNotificationStore.getState().notifications[0].id).toMatch(/^mock-uuid-/);
    });

    it('sets createdAt to a Date', () => {
      useNotificationStore.getState().addNotification({
        title: 'Test',
        message: 'Hello',
        type: 'error',
      });
      expect(useNotificationStore.getState().notifications[0].createdAt).toBeInstanceOf(Date);
    });

    it('increments unreadCount', () => {
      expect(useNotificationStore.getState().unreadCount).toBe(0);
      useNotificationStore.getState().addNotification({ title: 'N1', message: 'm', type: 'info' });
      expect(useNotificationStore.getState().unreadCount).toBe(1);
      useNotificationStore.getState().addNotification({ title: 'N2', message: 'm', type: 'info' });
      expect(useNotificationStore.getState().unreadCount).toBe(2);
    });

    it('adds to front of list (newest first)', () => {
      useNotificationStore
        .getState()
        .addNotification({ title: 'First', message: 'm', type: 'info' });
      useNotificationStore
        .getState()
        .addNotification({ title: 'Second', message: 'm', type: 'info' });
      const { notifications } = useNotificationStore.getState();
      expect(notifications[0].title).toBe('Second');
      expect(notifications[1].title).toBe('First');
    });

    it('supports optional link field', () => {
      useNotificationStore.getState().addNotification({
        title: 'With Link',
        message: 'm',
        type: 'info',
        link: '/companies/123',
      });
      expect(useNotificationStore.getState().notifications[0].link).toBe('/companies/123');
    });

    it('supports optional category field', () => {
      useNotificationStore.getState().addNotification({
        title: 'With Category',
        message: 'm',
        type: 'intelligence',
        category: 'signals',
      });
      expect(useNotificationStore.getState().notifications[0].category).toBe('signals');
    });

    it('supports all notification types', () => {
      const types: Notification['type'][] = [
        'info',
        'success',
        'warning',
        'error',
        'intelligence',
        'opportunity',
        'risk',
      ];
      types.forEach((type) => {
        useNotificationStore.getState().addNotification({ title: `T-${type}`, message: 'm', type });
      });
      expect(useNotificationStore.getState().notifications).toHaveLength(7);
    });

    it('persists to localStorage via saveToStorage', () => {
      useNotificationStore
        .getState()
        .addNotification({ title: 'Persist', message: 'm', type: 'info' });
      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].title).toBe('Persist');
    });
  });

  describe('markAsRead', () => {
    it('marks a notification as read', () => {
      useNotificationStore
        .getState()
        .addNotification({ title: 'Test', message: 'm', type: 'info' });
      const id = useNotificationStore.getState().notifications[0].id;
      useNotificationStore.getState().markAsRead(id);
      expect(useNotificationStore.getState().notifications[0].read).toBe(true);
    });

    it('decrements unreadCount when marking unread notification', () => {
      useNotificationStore
        .getState()
        .addNotification({ title: 'Test', message: 'm', type: 'info' });
      expect(useNotificationStore.getState().unreadCount).toBe(1);
      const id = useNotificationStore.getState().notifications[0].id;
      useNotificationStore.getState().markAsRead(id);
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('does not decrement unreadCount for already-read notification', () => {
      useNotificationStore
        .getState()
        .addNotification({ title: 'Test', message: 'm', type: 'info' });
      const id = useNotificationStore.getState().notifications[0].id;
      useNotificationStore.getState().markAsRead(id);
      expect(useNotificationStore.getState().unreadCount).toBe(0);
      useNotificationStore.getState().markAsRead(id);
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('does nothing for non-existent id', () => {
      useNotificationStore
        .getState()
        .addNotification({ title: 'Test', message: 'm', type: 'info' });
      useNotificationStore.getState().markAsRead('non-existent-id');
      expect(useNotificationStore.getState().unreadCount).toBe(1);
      expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });
  });

  describe('markAllAsRead', () => {
    it('marks all notifications as read', () => {
      useNotificationStore.getState().addNotification({ title: 'N1', message: 'm', type: 'info' });
      useNotificationStore.getState().addNotification({ title: 'N2', message: 'm', type: 'info' });
      useNotificationStore.getState().markAllAsRead();
      const { notifications } = useNotificationStore.getState();
      expect(notifications.every((n) => n.read)).toBe(true);
    });

    it('sets unreadCount to 0', () => {
      useNotificationStore.getState().addNotification({ title: 'N1', message: 'm', type: 'info' });
      useNotificationStore.getState().addNotification({ title: 'N2', message: 'm', type: 'info' });
      expect(useNotificationStore.getState().unreadCount).toBe(2);
      useNotificationStore.getState().markAllAsRead();
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('works when there are no notifications', () => {
      useNotificationStore.getState().markAllAsRead();
      expect(useNotificationStore.getState().unreadCount).toBe(0);
      expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });
  });

  describe('removeNotification', () => {
    it('removes a notification by id', () => {
      useNotificationStore
        .getState()
        .addNotification({ title: 'Keep', message: 'm', type: 'info' });
      useNotificationStore
        .getState()
        .addNotification({ title: 'Remove', message: 'm', type: 'info' });
      // Newest first: index 0 = 'Remove', index 1 = 'Keep'
      const id = useNotificationStore.getState().notifications[0].id;
      useNotificationStore.getState().removeNotification(id);
      expect(useNotificationStore.getState().notifications).toHaveLength(1);
      expect(useNotificationStore.getState().notifications[0].title).toBe('Keep');
    });

    it('decrements unreadCount if removed notification was unread', () => {
      useNotificationStore
        .getState()
        .addNotification({ title: 'Unread', message: 'm', type: 'info' });
      const id = useNotificationStore.getState().notifications[0].id;
      useNotificationStore.getState().removeNotification(id);
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('does not decrement unreadCount if removed notification was read', () => {
      useNotificationStore
        .getState()
        .addNotification({ title: 'Test', message: 'm', type: 'info' });
      const id = useNotificationStore.getState().notifications[0].id;
      useNotificationStore.getState().markAsRead(id);
      useNotificationStore.getState().removeNotification(id);
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('does nothing for non-existent id', () => {
      useNotificationStore
        .getState()
        .addNotification({ title: 'Test', message: 'm', type: 'info' });
      useNotificationStore.getState().removeNotification('non-existent');
      expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });
  });

  describe('clearAll', () => {
    it('removes all notifications', () => {
      useNotificationStore.getState().addNotification({ title: 'N1', message: 'm', type: 'info' });
      useNotificationStore.getState().addNotification({ title: 'N2', message: 'm', type: 'info' });
      useNotificationStore.getState().clearAll();
      expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });

    it('resets unreadCount to 0', () => {
      useNotificationStore.getState().addNotification({ title: 'N1', message: 'm', type: 'info' });
      useNotificationStore.getState().clearAll();
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('persists empty array to storage', () => {
      useNotificationStore.getState().addNotification({ title: 'N1', message: 'm', type: 'info' });
      useNotificationStore.getState().clearAll();
      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).toBe('[]');
    });
  });

  describe('setNotifications', () => {
    it('replaces all notifications', () => {
      useNotificationStore.getState().addNotification({ title: 'Old', message: 'm', type: 'info' });
      const newNotifs: Notification[] = [
        { id: 'a', title: 'New1', message: 'm', type: 'info', read: false, createdAt: new Date() },
        { id: 'b', title: 'New2', message: 'm', type: 'error', read: true, createdAt: new Date() },
      ];
      useNotificationStore.getState().setNotifications(newNotifs);
      expect(useNotificationStore.getState().notifications).toHaveLength(2);
      expect(useNotificationStore.getState().notifications[0].id).toBe('a');
    });

    it('recalculates unreadCount from new notifications', () => {
      const newNotifs: Notification[] = [
        { id: 'a', title: 'N1', message: 'm', type: 'info', read: false, createdAt: new Date() },
        { id: 'b', title: 'N2', message: 'm', type: 'info', read: false, createdAt: new Date() },
        { id: 'c', title: 'N3', message: 'm', type: 'info', read: true, createdAt: new Date() },
      ];
      useNotificationStore.getState().setNotifications(newNotifs);
      expect(useNotificationStore.getState().unreadCount).toBe(2);
    });
  });

  describe('setOpen / setPanelOpen', () => {
    it('setOpen changes isOpen state', () => {
      useNotificationStore.getState().setOpen(true);
      expect(useNotificationStore.getState().isOpen).toBe(true);
      useNotificationStore.getState().setOpen(false);
      expect(useNotificationStore.getState().isOpen).toBe(false);
    });

    it('setPanelOpen changes isPanelOpen state', () => {
      useNotificationStore.getState().setPanelOpen(true);
      expect(useNotificationStore.getState().isPanelOpen).toBe(true);
      useNotificationStore.getState().setPanelOpen(false);
      expect(useNotificationStore.getState().isPanelOpen).toBe(false);
    });
  });

  describe('hydrate', () => {
    it('loads notifications from localStorage', () => {
      const stored = [
        {
          id: 's1',
          title: 'Stored',
          message: 'm',
          type: 'info',
          read: true,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 's2',
          title: 'Stored2',
          message: 'm',
          type: 'success',
          read: false,
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

      useNotificationStore.getState().hydrate();
      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(2);
      expect(state.notifications[0].title).toBe('Stored');
      expect(state.hasHydrated).toBe(true);
      expect(state.unreadCount).toBe(1);
    });

    it('parses createdAt strings back to Date objects', () => {
      const stored = [
        {
          id: 's1',
          title: 'Stored',
          message: 'm',
          type: 'info',
          read: false,
          createdAt: '2024-06-15T12:00:00.000Z',
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

      useNotificationStore.getState().hydrate();
      expect(useNotificationStore.getState().notifications[0].createdAt).toBeInstanceOf(Date);
    });

    it('handles empty localStorage gracefully', () => {
      // localStorage is cleared in beforeEach, so it should be empty
      useNotificationStore.getState().hydrate();
      expect(useNotificationStore.getState().notifications).toHaveLength(0);
      expect(useNotificationStore.getState().hasHydrated).toBe(true);
    });

    it('handles corrupt JSON gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json{{{');
      useNotificationStore.getState().hydrate();
      expect(useNotificationStore.getState().notifications).toHaveLength(0);
      expect(useNotificationStore.getState().hasHydrated).toBe(true);
    });
  });
});
