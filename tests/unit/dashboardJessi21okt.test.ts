import { describe, expect, it } from 'vitest';
import { kortingVoorMerk } from '@/lib/kortingPerMerk';
import { isNvtMaat } from '@/lib/maatNvt';
import { allePlaatsingen, lagenVan, metLagen, normaliseerOntwerp } from '@/app/dashboard/drukproeven/ontwerp';
import { orderstatusVoorTaakSleutel, TAAK_SLEUTEL_BIJ_ORDERSTATUS } from '@/lib/kms/taken';
import { drukproefVoorRegel, type Drukproef } from '@/lib/kms/drukproeven';

describe('korting per merk (1.4)', () => {
  it('merkkorting gaat voor klantkorting, hoofdletters maken niet uit', () => {
    expect(kortingVoorMerk({ fhb: 15 }, 'FHB', 10)).toBe(15);
    expect(kortingVoorMerk({ fhb: 15 }, 'Snickers', 10)).toBe(10);
    expect(kortingVoorMerk({ fhb: 0 }, 'fhb', 10)).toBe(0);
    expect(kortingVoorMerk({}, 'fhb', null)).toBe(0);
  });
});

describe('maat NVT (1.3)', () => {
  it('herkent NVT in elke schrijfwijze', () => {
    expect(isNvtMaat('NVT')).toBe(true);
    expect(isNvtMaat(' nvt ')).toBe(true);
    expect(isNvtMaat('M')).toBe(false);
    expect(isNvtMaat(null)).toBe(false);
  });
});

describe('extra aanzichten drukproef (2.1)', () => {
  const logo = { id: 'a', logo_url: 'https://x.nl/l.png', x: 50, y: 30, breedte: 10, rotatie: 0 };
  it('bewaart een zijaanzicht met eigen foto en logo', () => {
    const o = normaliseerOntwerp({ voor: [], achter: [], extra: [{ id: 'z1', naam: 'Linker mouw', afbeelding_url: 'https://x.nl/z.jpg', plaatsingen: [logo] }] });
    expect(o?.extra?.[0].naam).toBe('Linker mouw');
    expect(allePlaatsingen(o!)).toHaveLength(1);
    expect(lagenVan(o!, 'z1')).toHaveLength(1);
  });
  it('weigert een onveilige foto-url', () => {
    const o = normaliseerOntwerp({ voor: [], extra: [{ id: 'z1', naam: 'x', afbeelding_url: 'javascript:alert(1)', plaatsingen: [] }] });
    expect(o?.extra?.[0].afbeelding_url).toBeNull();
  });
  it('metLagen past alleen het gekozen aanzicht aan', () => {
    const o = normaliseerOntwerp({ voor: [logo], achter: [], extra: [{ id: 'z1', naam: 'Zij', afbeelding_url: null, plaatsingen: [] }] })!;
    const n = metLagen(o, 'z1', (l) => [...l, { ...logo, id: 'b' }]);
    expect(n.voor).toHaveLength(1);
    expect(lagenVan(n, 'z1')).toHaveLength(1);
  });
});

describe('order- en taakstatus gelijk (3.1)', () => {
  it('elke orderstatus heeft een taakstatus en terug', () => {
    for (const [order, sleutel] of Object.entries(TAAK_SLEUTEL_BIJ_ORDERSTATUS)) {
      if (order === 'geannuleerd' || order === 'concept') continue;
      expect(orderstatusVoorTaakSleutel(sleutel)).toBe(order);
    }
    expect(orderstatusVoorTaakSleutel('afgerond')).toBe('afgerond');
    expect(orderstatusVoorTaakSleutel('benaderen')).toBeNull();
  });
});

describe('drukproef per orderregel (2.4/2.5)', () => {
  const basis = { organisatie_id: 'o', order_id: null, naam: 'p', type: 't', kleur: 0, techniek: 'bedrukken', positie: '', logo_url: null, afbeelding_url: null, omschrijving: null, opmerking: null, token: 't', behandeld_op: null } as const;
  const p = (id: string, product_id: string, product_kleur: string | null, status: string, created_at: string): Drukproef => ({ ...basis, id, product_id, product_kleur, status, created_at });
  it('kiest zelfde artikel en kleur, goedgekeurd eerst', () => {
    const lijst = [p('1', 'A', 'Zwart 20', 'concept', '2026-10-20'), p('2', 'A', 'Zwart 20', 'goedgekeurd', '2026-10-01'), p('3', 'A', 'Rood', 'goedgekeurd', '2026-10-21')];
    expect(drukproefVoorRegel({ product_id: 'A', kleur: 'zwart 20' }, lijst)?.id).toBe('2');
    expect(drukproefVoorRegel({ product_id: 'B', kleur: null }, lijst)).toBeNull();
  });
});
