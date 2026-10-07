import { describe, expect, it } from 'vitest';
import { leesMand, mandSleutel, naarLeadRegels, samenvatting, totaalStuks, voegToe, volledigeNaam, werkBij, type MandRegel } from '@/lib/offerteMand';

const regel = (o: Partial<MandRegel> = {}): MandRegel => ({
  sleutel: mandSleutel('p1', o.kleur ?? null),
  productId: 'p1',
  naam: 'FR AST Polo Jordan',
  merk: 'Hydrowear',
  categorieSlug: 't-shirts-en-polos',
  slug: 'polo',
  foto: null,
  kleuren: ['Navy', 'Zwart'],
  maten: ['S', 'M', 'L', 'XL'],
  kleur: null,
  aantallen: {},
  aantalZonderMaat: 0,
  logo: null,
  ...o,
});

describe('offertemandje', () => {
  it('voegt dezelfde kleur samen en telt maten op', () => {
    let m = voegToe([], regel({ kleur: 'Zwart', aantallen: { M: 3, L: 2 } }));
    m = voegToe(m, regel({ kleur: 'zwart', aantallen: { L: 1, XL: 4 }, logo: 'Rug' }));
    expect(m).toHaveLength(1);
    expect(m[0].aantallen).toEqual({ M: 3, L: 3, XL: 4 });
    expect(m[0].logo).toBe('Rug');
    expect(totaalStuks(m)).toBe(10);
  });
  it('houdt twee kleuren apart', () => {
    const m = voegToe(voegToe([], regel({ kleur: 'Zwart' })), regel({ kleur: 'Navy' }));
    expect(m).toHaveLength(2);
  });
  it('voegt samen als je de kleur wijzigt naar een kleur die er al is', () => {
    let m = voegToe(voegToe([], regel({ kleur: 'Zwart', aantallen: { M: 1 } })), regel({ kleur: 'Navy', aantallen: { M: 2 } }));
    m = werkBij(m, mandSleutel('p1', 'Navy'), { kleur: 'Zwart' });
    expect(m).toHaveLength(1);
    expect(m[0].aantallen).toEqual({ M: 3 });
  });
  it('maakt één leadregel per maat, in maatvolgorde', () => {
    const r = naarLeadRegels([regel({ kleur: 'Zwart', aantallen: { XL: 2, S: 1 }, logo: 'Borst links' })]);
    expect(r.map((x) => [x.maat, x.aantal])).toEqual([['S', 1], ['XL', 2]]);
    expect(r[0].omschrijving).toBe('Hydrowear FR AST Polo Jordan');
    expect(r[0].opmerking).toBe('Logo: borst links');
  });
  it('stuurt een artikel zonder aantallen toch mee', () => {
    const r = naarLeadRegels([regel()]);
    expect(r).toHaveLength(1);
    expect(r[0].aantal).toBeNull();
    expect(samenvatting([regel()])).toContain('aantal nog niet bekend');
  });
  it('zet geen merk dubbel voor de naam', () => {
    expect(volledigeNaam('Hydrowear', 'Hydrowear FR AST Polo Jordan')).toBe('Hydrowear FR AST Polo Jordan');
    expect(volledigeNaam('Snickers', 'Werkbroek')).toBe('Snickers Werkbroek');
  });
  it('leest oude selectie-items en kapotte waarden veilig in', () => {
    const m = leesMand([{ id: 'p2', naam: 'Polo', merk: null, slug: 'polo', foto: null }, null, { naam: 'zonder id' }, { productId: 'p3', naam: 'X', aantallen: { M: '-4', L: 'abc', S: 2 } }]);
    expect(m.map((x) => x.productId)).toEqual(['p2', 'p3']);
    expect(m[1].aantallen).toEqual({ M: 4, S: 2 });
  });
});
