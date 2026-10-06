import { describe, expect, it } from 'vitest';
import { kledingImpact, logoCheck, oppervlakVan, standaardFormaatVoor, vrijeRuimte } from '@/lib/fiscaal';

describe('logo-check (70 cm²)', () => {
  it('standaard 10 x 7 is precies genoeg', () => {
    expect(oppervlakVan('standaard')).toBe(70);
    expect(logoCheck(70)).toEqual({ onbelast: true, tekort: 0 });
  });
  it('klein 8 x 5 is te klein en noemt het tekort', () => {
    expect(logoCheck(oppervlakVan('klein'))).toEqual({ onbelast: false, tekort: 30 });
  });
  it('onbekend formaat valt terug op standaard', () => {
    expect(oppervlakVan('xyz')).toBe(70);
  });
  it('rug krijgt het rugformaat', () => {
    expect(standaardFormaatVoor('rug')).toBe('rug');
    expect(standaardFormaatVoor('borst-links')).toBe('standaard');
  });
});

describe('vrije ruimte 2026', () => {
  it('2% tot 400.000', () => {
    expect(vrijeRuimte(300_000)).toBe(6_000);
  });
  it('1,18% boven 400.000', () => {
    expect(vrijeRuimte(500_000)).toBe(8_000 + 1_180);
  });
  it('negatief wordt nul', () => {
    expect(vrijeRuimte(-5)).toBe(0);
  });
});

describe('kledingImpact', () => {
  it('15 man, €400 kleding, €45.000 loon', () => {
    const r = kledingImpact({ medewerkers: 15, budgetPp: 400, jaarloon: 45_000 });
    expect(r.loonsom).toBe(675_000);
    expect(r.vrijeRuimte).toBe(8_000 + 3_245);
    expect(r.kleding).toBe(6_000);
    expect(r.heffingNu).toBe(0);
    expect(r.heffingAlsVol).toBe(4_800);
  });
  it('kleding boven de ruimte geeft direct heffing', () => {
    const r = kledingImpact({ medewerkers: 2, budgetPp: 1_000, jaarloon: 40_000 });
    // ruimte 1.600, kleding 2.000, over 400, heffing 320
    expect(r.heffingNu).toBe(320);
  });
});
