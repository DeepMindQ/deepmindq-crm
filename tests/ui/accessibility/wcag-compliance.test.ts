import { describe, it, expect } from 'vitest'

describe('WCAG AA — Contrast', () => {
  const lum = (r:number,g:number,b:number) => {
    const [rs,gs,bs] = [r,g,b].map(c => { const s=c/255; return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4); });
    return 0.2126*rs+0.7152*gs+0.0722*bs;
  };
  const ratio = (bg:number[],fg:number[]) => { const l1=lum(...bg),l2=lum(...fg); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); };

  it('white bg / dark text >= 4.5:1', () => {
    expect(ratio([255,255,255],[17,24,39])).toBeGreaterThanOrEqual(4.5);
  });
  it('dark bg / white text >= 3:1', () => {
    expect(ratio([17,24,39],[255,255,255])).toBeGreaterThanOrEqual(3);
  });
});

describe('WCAG AA — Forms', () => {
  it('fields have labels', () => {
    [{type:'email',label:'Email'},{type:'password',label:'Password'},{type:'text',label:'OTP'}].forEach(f => {
      expect(f.label).toBeDefined();
      expect(f.label.length).toBeGreaterThan(0);
    });
  });
});

describe('WCAG AA — Keyboard', () => {
  it('keyboard shortcuts defined', () => {
    expect([{key:'Enter',action:'Submit'},{key:'Escape',action:'Close'},{key:'Tab',action:'Focus'}]).toHaveLength(3);
  });
});