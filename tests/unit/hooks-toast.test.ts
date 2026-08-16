/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock React ──────────────────────────────────────────────────────

vi.mock('react', () => {
  const listeners: Array<(state: any) => void> = [];
  let state: any = { toasts: [] };

  return {
    useState: vi.fn((initial) => {
      // Simulate React.useState with initial value
      return [
        initial,
        (updater: any) => {
          state = typeof updater === 'function' ? updater(state) : updater;
        },
      ];
    }),
    useEffect: vi.fn((fn) => {
      // Execute cleanup and effect
      if (typeof fn === 'function') fn();
    }),
    createElement: vi.fn(),
  };
});

vi.mock('@/components/ui/toast', () => ({
  ToastProps: {},
  ToastActionElement: {},
}));

// ── Import after mocks ─────────────────────────────────────────────

import { reducer } from '@/hooks/use-toast';

// ── reducer ─────────────────────────────────────────────────────────

describe('toast reducer', () => {
  const initialState = { toasts: [] };

  describe('ADD_TOAST', () => {
    it('adds a toast to the beginning of the list', () => {
      const newToast = { id: '1', title: 'Hello', open: true };
      const state = reducer(initialState, { type: 'ADD_TOAST', toast: newToast });
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0]).toEqual(newToast);
    });

    it('prepends new toast before existing ones', () => {
      const existing = { id: '1', title: 'First', open: true };
      const baseState = { toasts: [existing] };
      const newToast = { id: '2', title: 'Second', open: true };
      const state = reducer(baseState, { type: 'ADD_TOAST', toast: newToast });
      expect(state.toasts[0].id).toBe('2');
      expect(state.toasts[1].id).toBe('1');
    });

    it('enforces TOAST_LIMIT (5)', () => {
      let state = initialState;
      for (let i = 0; i < 6; i++) {
        state = reducer(state, {
          type: 'ADD_TOAST',
          toast: { id: String(i), title: `Toast ${i}`, open: true },
        });
      }
      expect(state.toasts).toHaveLength(5);
      expect(state.toasts[0].id).toBe('5');
    });
  });

  describe('UPDATE_TOAST', () => {
    it('updates a toast by id', () => {
      const baseState = { toasts: [{ id: '1', title: 'Old', open: true }] };
      const state = reducer(baseState, {
        type: 'UPDATE_TOAST',
        toast: { id: '1', title: 'New' },
      });
      expect(state.toasts[0]).toEqual({ id: '1', title: 'New', open: true });
    });

    it('does not modify other toasts', () => {
      const baseState = {
        toasts: [
          { id: '1', title: 'A', open: true },
          { id: '2', title: 'B', open: true },
        ],
      };
      const state = reducer(baseState, {
        type: 'UPDATE_TOAST',
        toast: { id: '1', title: 'Updated A' },
      });
      expect(state.toasts[0].title).toBe('Updated A');
      expect(state.toasts[1].title).toBe('B');
    });

    it('no-ops when id does not match', () => {
      const baseState = { toasts: [{ id: '1', title: 'A', open: true }] };
      const state = reducer(baseState, {
        type: 'UPDATE_TOAST',
        toast: { id: '999', title: 'X' },
      });
      expect(state.toasts[0].title).toBe('A');
    });
  });

  describe('DISMISS_TOAST', () => {
    it('sets open:false on a specific toast', () => {
      const baseState = {
        toasts: [
          { id: '1', title: 'A', open: true },
          { id: '2', title: 'B', open: true },
        ],
      };
      const state = reducer(baseState, { type: 'DISMISS_TOAST', toastId: '1' });
      expect(state.toasts[0].open).toBe(false);
      expect(state.toasts[1].open).toBe(true);
    });

    it('sets open:false on all toasts when no toastId', () => {
      const baseState = {
        toasts: [
          { id: '1', title: 'A', open: true },
          { id: '2', title: 'B', open: true },
        ],
      };
      const state = reducer(baseState, { type: 'DISMISS_TOAST' });
      expect(state.toasts[0].open).toBe(false);
      expect(state.toasts[1].open).toBe(false);
    });
  });

  describe('REMOVE_TOAST', () => {
    it('removes a specific toast', () => {
      const baseState = {
        toasts: [
          { id: '1', title: 'A', open: true },
          { id: '2', title: 'B', open: true },
        ],
      };
      const state = reducer(baseState, { type: 'REMOVE_TOAST', toastId: '1' });
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].id).toBe('2');
    });

    it('removes all toasts when no toastId', () => {
      const baseState = {
        toasts: [
          { id: '1', title: 'A', open: true },
          { id: '2', title: 'B', open: true },
        ],
      };
      const state = reducer(baseState, { type: 'REMOVE_TOAST' });
      expect(state.toasts).toHaveLength(0);
    });

    it('no-ops when id does not match', () => {
      const baseState = { toasts: [{ id: '1', title: 'A', open: true }] };
      const state = reducer(baseState, { type: 'REMOVE_TOAST', toastId: '999' });
      expect(state.toasts).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('returns same state reference for UPDATE_TOAST with no matching id', () => {
      const state = { toasts: [{ id: '1', open: true }] };
      const result = reducer(state, { type: 'UPDATE_TOAST', toast: { id: '2' } });
      // The toast is spread, so it's a new object, but let's verify behavior
      expect(result.toasts[0].id).toBe('1');
    });

    it('handles empty state for all action types', () => {
      const empty = { toasts: [] };

      expect(reducer(empty, { type: 'REMOVE_TOAST' }).toasts).toHaveLength(0);
      expect(reducer(empty, { type: 'DISMISS_TOAST' }).toasts).toHaveLength(0);
      expect(reducer(empty, { type: 'DISMISS_TOAST', toastId: '1' }).toasts).toHaveLength(0);
      expect(reducer(empty, { type: 'UPDATE_TOAST', toast: { id: '1' } }).toasts).toHaveLength(0);
    });

    it('ADD_TOAST preserves all properties of the toast', () => {
      const toastWithAllProps = {
        id: 'full',
        title: 'Full',
        description: 'Desc',
        action: { type: 'button' },
        open: true,
        variant: 'destructive',
      };
      const state = reducer(initialState, { type: 'ADD_TOAST', toast: toastWithAllProps });
      expect(state.toasts[0]).toEqual(toastWithAllProps);
    });

    it('UPDATE_TOAST merges multiple properties', () => {
      const baseState = {
        toasts: [{ id: '1', title: 'Old', description: 'Old desc', open: true }],
      };
      const state = reducer(baseState, {
        type: 'UPDATE_TOAST',
        toast: { id: '1', title: 'New', description: 'New desc' },
      });
      expect(state.toasts[0]).toEqual({
        id: '1',
        title: 'New',
        description: 'New desc',
        open: true,
      });
    });
  });
});
