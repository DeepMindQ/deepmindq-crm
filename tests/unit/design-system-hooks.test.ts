/**
 * Design System Hooks Tests
 * @vitest-environment node
 *
 * Tests the exported hook functions exist and have correct signatures.
 * React hooks that depend on DOM (useEffect, useState) cannot be fully
 * tested in a node environment — these tests verify module structure.
 */
import { describe, it, expect } from 'vitest';

describe('Design System Hooks', () => {
  it('exports useClickOutside', async () => {
    const mod = await import('@/components/design-system/hooks');
    expect(typeof mod.useClickOutside).toBe('function');
  });

  it('exports useKeyboardShortcut', async () => {
    const mod = await import('@/components/design-system/hooks');
    expect(typeof mod.useKeyboardShortcut).toBe('function');
  });

  it('exports useMediaQuery', async () => {
    const mod = await import('@/components/design-system/hooks');
    expect(typeof mod.useMediaQuery).toBe('function');
  });

  it('exports useReducedMotion', async () => {
    const mod = await import('@/components/design-system/hooks');
    expect(typeof mod.useReducedMotion).toBe('function');
  });

  it('exports useFocusTrap', async () => {
    const mod = await import('@/components/design-system/hooks');
    expect(typeof mod.useFocusTrap).toBe('function');
  });

  it('exports useDebounce', async () => {
    const mod = await import('@/components/design-system/hooks');
    expect(typeof mod.useDebounce).toBe('function');
  });

  it('exports useIntersectionObserver', async () => {
    const mod = await import('@/components/design-system/hooks');
    expect(typeof mod.useIntersectionObserver).toBe('function');
  });

  it('useClickOutside is a generic function', async () => {
    const mod = await import('@/components/design-system/hooks');
    const fn = mod.useClickOutside as (...args: unknown[]) => unknown;
    expect(fn.length).toBeGreaterThanOrEqual(1);
  });

  it('useKeyboardShortcut accepts key, callback, and options', async () => {
    const mod = await import('@/components/design-system/hooks');
    const fn = mod.useKeyboardShortcut as (...args: unknown[]) => unknown;
    expect(fn.length).toBeGreaterThanOrEqual(2);
  });

  it('useFocusTrap accepts active boolean', async () => {
    const mod = await import('@/components/design-system/hooks');
    const fn = mod.useFocusTrap as (...args: unknown[]) => unknown;
    expect(fn.length).toBeGreaterThanOrEqual(1);
  });

  it('useDebounce accepts value and delay', async () => {
    const mod = await import('@/components/design-system/hooks');
    const fn = mod.useDebounce as (...args: unknown[]) => unknown;
    expect(fn.length).toBeGreaterThanOrEqual(2);
  });
});
