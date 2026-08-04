import { describe, it, expect } from 'vitest'

describe('Large Data — Cursor Pagination', () => {
  it('paginates 1000 items correctly', () => {
    const items = Array.from({length:1000}, (_,i) => ({id:'item-'+i, cursor:'cursor-'+i}));
    let cursor: string | null = null, fetched = 0, pages = 0;
    while (fetched < items.length) {
      const start = cursor ? items.findIndex(i => i.cursor === cursor) + 1 : 0;
      const page = items.slice(start, start + 50);
      pages++;
      if (page.length > 0) cursor = page[page.length - 1].cursor;
      fetched += page.length;
    }
    expect(pages).toBe(20);
    expect(fetched).toBe(1000);
  });
});

describe('Large Data — Dedup', () => {
  it('deduplicates 1000 items with 500 dupes', () => {
    const items = [...Array.from({length:500},(_,i)=>({id:'i-'+i})), ...Array.from({length:500},(_,i)=>({id:'i-'+i}))];
    expect(new Map(items.map(i=>[i.id,i])).size).toBe(500);
  });
});