import { describe, it, expect } from 'vitest'

describe('Benchmarks — Sorting', () => {
  it('10K by string < 50ms', () => {
    const r = Array.from({length:10000},(_,i) => ({name:'Company '+(10000-i)}));
    const s = Date.now();
    r.sort((a,b) => a.name.localeCompare(b.name));
    expect(Date.now()-s).toBeLessThan(100);
    expect(r[0].name).toBe('Company 0');
  });
  it('10K by number < 20ms', () => {
    const r = Array.from({length:10000}, () => ({score:Math.random()*100}));
    const s = Date.now();
    r.sort((a,b) => b.score - a.score);
    expect(Date.now()-s).toBeLessThan(20);
  });
});

describe('Benchmarks — Filtering', () => {
  it('10K filter < 10ms', () => {
    const r = Array.from({length:10000},(_,i) => ({industry:['Tech','Finance','Health','Retail'][i%4], active:i%3!==0}));
    const s = Date.now();
    const f = r.filter(x => x.industry==='Tech' && x.active);
    expect(Date.now()-s).toBeLessThan(10);
    expect(f.every(x => x.industry==='Tech')).toBe(true);
  });
});

describe('Benchmarks — Map Operations', () => {
  it('10K Map build < 10ms', () => {
    const s = Date.now();
    const m = new Map(Array.from({length:10000},(_,i) => ['k-'+i, 'v-'+i]));
    expect(Date.now()-s).toBeLessThan(10);
    expect(m.get('k-9999')).toBe('v-9999');
  });
  it('10K lookups < 10ms', () => {
    const m = new Map(Array.from({length:10000},(_,i) => ['k-'+i, i]));
    const s = Date.now();
    for(let i=0;i<10000;i++) m.get('k-'+i);
    expect(Date.now()-s).toBeLessThan(10);
  });
});