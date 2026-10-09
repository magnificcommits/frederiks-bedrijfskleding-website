import { describe, expect, it } from 'vitest';
import { normaliseerBeschikbaarheid } from '@/lib/afspraken/soorten';
import { raster } from '@/lib/afspraken/planner';

describe('beschikbaarheid uit de weekplanner', () => {
  it('houdt geldige dichte tijden en extra dagen, gooit rommel weg', () => {
    const b = normaliseerBeschikbaarheid({
      geslotenTijden: { '2026-10-12': ['09:00', '9u', '13:30'], fout: ['10:00'] },
      extraDagen: ['2026-10-17', 'zaterdag'],
    });
    expect(b.geslotenTijden).toEqual({ '2026-10-12': ['09:00', '13:30'] });
    expect(b.extraDagen).toEqual(['2026-10-17']);
  });

  it('heeft lege standaardwaarden', () => {
    const b = normaliseerBeschikbaarheid({});
    expect(b.geslotenTijden).toEqual({});
    expect(b.extraDagen).toEqual([]);
  });

  it('raster loopt over de werktijd met pauze ertussen', () => {
    const b = normaliseerBeschikbaarheid({ tijdvakken: [{ van: '09:00', tot: '10:00' }, { van: '11:00', tot: '12:00' }], stapMin: 30 });
    const r = raster(b);
    expect(r.map((x) => x.tijd)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']);
    expect(r.filter((x) => !x.binnenWerktijd).map((x) => x.tijd)).toEqual(['10:00', '10:30']);
  });
});
