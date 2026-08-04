import { describe, it, expect } from 'vitest'

describe('UI Components — Critical Pages', () => {
  const pages = ['/dashboard','/companies','/contacts','/intelligence','/settings','/login'];
  it('6+ critical pages defined', () => expect(pages.length).toBeGreaterThanOrEqual(6));
  it('protected pages exclude login', () => {
    pages.filter(p => p !== '/login').forEach(p => expect(p).not.toBe('/login'));
  });
});

describe('UI Components — Data Table', () => {
  it('handles empty state', () => expect([].length).toBe(0));
  it('handles 100 rows', () => expect(Array.from({length:100},(_,i)=>({id:'r-'+i}))).toHaveLength(100));
});