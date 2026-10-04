import { describe, expect, it } from 'vitest';
import { factuurTotalen, regelBedrag, vervaldatumVoor } from '@/lib/kms/facturen';
import { offerteTotalen } from '@/components/dashboard/OfferteDocument';

describe('regelBedrag (factuurregel excl. btw)', () => {
  it('aantal x stukprijs', () => {
    expect(regelBedrag({ aantal: 3, stukprijs: 12.5 })).toBe(37.5);
  });
  it('trekt de regelkorting af en rondt op centen', () => {
    expect(regelBedrag({ aantal: 1, stukprijs: 9.99, korting_pct: 15 })).toBe(8.49);
  });
  it('korting boven 100% telt als 100%', () => {
    expect(regelBedrag({ aantal: 2, stukprijs: 10, korting_pct: 150 })).toBe(0);
  });
  it('negatieve korting telt als 0% (geen stille opslag)', () => {
    expect(regelBedrag({ aantal: 2, stukprijs: 10, korting_pct: -10 })).toBe(20);
  });
  it('lege velden zijn 0', () => {
    expect(regelBedrag({ aantal: null, stukprijs: null })).toBe(0);
  });
  it('minregel (creditregel) blijft negatief', () => {
    expect(regelBedrag({ aantal: 1, stukprijs: -25 })).toBe(-25);
  });
});

describe('factuurTotalen', () => {
  it('btw per tarief over de som, niet per regel', () => {
    // Zeven regels van 0,10 met 21%: per regel 0,021 -> 0,02 (samen 0,14), over de som 0,147 -> 0,15.
    const regels = Array.from({ length: 7 }, () => ({ aantal: 1, stukprijs: 0.1, btw_pct: 21 }));
    const t = factuurTotalen(regels);
    expect(t.excl).toBe(0.7);
    expect(t.btw).toBe(0.15); // 0,7 x 21% = 0,147 -> 0,15 (per regel zou 7 x 0,02 = 0,14 geven)
    expect(t.incl).toBe(0.85);
  });
  it('splitst 21% en 9% en sorteert de tarieven oplopend', () => {
    const t = factuurTotalen([
      { aantal: 2, stukprijs: 50, btw_pct: 21 },
      { aantal: 1, stukprijs: 100, btw_pct: 9 },
    ]);
    expect(t.perTarief).toEqual([
      { pct: 9, grondslag: 100, btw: 9 },
      { pct: 21, grondslag: 100, btw: 21 },
    ]);
    expect(t.btw).toBe(30);
    expect(t.incl).toBe(230);
  });
  it('zonder tarief geldt 21%', () => {
    const t = factuurTotalen([{ aantal: 1, stukprijs: 100, btw_pct: null }]);
    expect(t.perTarief[0].pct).toBe(21);
    expect(t.btw).toBe(21);
  });
  it('0% (verlegd/export) geeft geen btw', () => {
    const t = factuurTotalen([{ aantal: 4, stukprijs: 25, btw_pct: 0 }]);
    expect(t.btw).toBe(0);
    expect(t.incl).toBe(100);
  });
  it('kortingsbedrag is bruto min netto', () => {
    const t = factuurTotalen([{ aantal: 10, stukprijs: 20, korting_pct: 10, btw_pct: 21 }]);
    expect(t.korting).toBe(20);
    expect(t.excl).toBe(180);
    expect(t.btw).toBe(37.8);
  });
  it('lege factuur is overal 0', () => {
    expect(factuurTotalen([])).toEqual({ excl: 0, korting: 0, btw: 0, incl: 0, perTarief: [] });
  });
  it('creditregel verlaagt het totaal', () => {
    const t = factuurTotalen([
      { aantal: 1, stukprijs: 100, btw_pct: 21 },
      { aantal: 1, stukprijs: -40, btw_pct: 21 },
    ]);
    expect(t.excl).toBe(60);
    expect(t.btw).toBe(12.6);
  });
});

describe('vervaldatumVoor', () => {
  it('factuurdatum plus 15 dagen betaaltermijn', () => {
    expect(vervaldatumVoor('2026-10-01')).toBe('2026-10-16');
  });
  it('over de maandgrens', () => {
    expect(vervaldatumVoor('2026-01-25')).toBe('2026-02-09');
  });
  it('rond de zomertijdwissel geen dag verschuiving', () => {
    expect(vervaldatumVoor('2026-10-20')).toBe('2026-11-04');
  });
});

describe('offerteTotalen (zelfde regels als de factuur)', () => {
  it('rekent als de factuur: regels op centen afgerond', () => {
    // 7 regels van 9,99 met 15% korting: per regel 8,49 (factuur), samen 59,43.
    // Voorheen rekende de offerte 7 x 8,4915 = 59,4405 -> 59,44: een cent verschil met de factuur.
    const regels = Array.from({ length: 7 }, () => ({ aantal: 1, stukprijs: 9.99, korting_pct: 15 }));
    const o = offerteTotalen(regels, 21);
    const f = factuurTotalen(regels.map((r) => ({ ...r, btw_pct: 21 })));
    expect(o.subtotaal).toBe(59.43);
    expect(o.subtotaal).toBe(f.excl);
    expect(o.totaal).toBe(f.incl);
  });
  it('zonder btw-percentage 21% (zoals het document toont), niet 0%', () => {
    const o = offerteTotalen([{ aantal: 1, stukprijs: 100 }], null);
    expect(o.btw).toBe(21);
    expect(o.totaal).toBe(121);
  });
  it('korting wordt begrensd tussen 0 en 100%', () => {
    expect(offerteTotalen([{ aantal: 1, stukprijs: 100, korting_pct: 120 }], 21).subtotaal).toBe(0);
    expect(offerteTotalen([{ aantal: 1, stukprijs: 100, korting_pct: -5 }], 21).subtotaal).toBe(100);
  });
  it('marge is subtotaal min inkoop', () => {
    const o = offerteTotalen([{ aantal: 10, stukprijs: 30, inkoop: 18 }], 21);
    expect(o.marge).toBe(120);
  });
  it('btw 9% en kortingsbedrag', () => {
    const o = offerteTotalen([{ aantal: 4, stukprijs: 25, korting_pct: 10 }], 9);
    expect(o).toMatchObject({ subtotaal: 90, korting: 10, btw: 8.1, totaal: 98.1 });
  });
});
