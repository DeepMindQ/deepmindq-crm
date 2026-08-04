import { describe, it, expect } from 'vitest'

describe('Stress — Large Objects', () => {
  it('1000 records < 50MB', () => {
    const s = process.memoryUsage().heapUsed;
    const companies = Array.from({length:1000},(_,i) => ({id:'c-'+i,name:'Company '+i,signals:Array.from({length:5},(_,j)=>({id:'s-'+i+'-'+j}))}));
    const diff = (process.memoryUsage().heapUsed - s) / (1024*1024);
    expect(companies).toHaveLength(1000);
    expect(diff).toBeLessThan(50);
  });
});

describe('Stress — String Processing', () => {
  it('1M chars < 100ms', () => {
    const s = Date.now();
    'A'.repeat(1000000).split('A');
    expect(Date.now()-s).toBeLessThan(100);
  });
});

describe('Stress — Password Hashing Throughput', () => {
  it('hashes 5 passwords in <30s', async () => {
    const { hashPassword } = await import('@/lib/password');
    const s = Date.now();
    const h = await Promise.all([hashPassword('t1'),hashPassword('t2'),hashPassword('t3'),hashPassword('t4'),hashPassword('t5')]);
    expect(h).toHaveLength(5);
    expect(Date.now()-s).toBeLessThan(30000);
  });
});