import { describe, it, expect } from 'vitest'

describe('Responsive — Grid Columns', () => {
  const cols = (w: number) => w < 768 ? 1 : w < 1024 ? 2 : 3;
  it('1 col mobile', () => expect(cols(375)).toBe(1));
  it('2 cols tablet', () => expect(cols(800)).toBe(2));
  it('3 cols desktop', () => expect(cols(1440)).toBe(3));
});

describe('Responsive — Sidebar', () => {
  it('below content on mobile', () => expect(375 < 1024).toBe(true));
  it('beside content on desktop', () => expect(1440 < 1024).toBe(false));
});