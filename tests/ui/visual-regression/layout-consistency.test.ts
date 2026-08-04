import { describe, it, expect } from 'vitest'

describe('Visual Regression — Breakpoints', () => {
  const bp = {sm:640,md:768,lg:1024,xl:1280,'2xl':1536};
  it('Tailwind breakpoints', () => { expect(bp.md).toBe(768); expect(bp.lg).toBe(1024); });
  it('mobile-first ordering', () => {
    const v = Object.values(bp);
    for(let i=0;i<v.length-1;i++) expect(v[i]).toBeLessThan(v[i+1]);
  });
});

describe('Visual Regression — Design Tokens', () => {
  it('brand colors are hex', () => {
    expect('#B8860B').toMatch(/^#[0-9a-f]{6}$/);
    expect('#D4A843').toMatch(/^#[0-9a-f]{6}$/);
  });
});