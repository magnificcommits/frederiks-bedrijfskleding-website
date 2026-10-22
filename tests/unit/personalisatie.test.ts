import { describe, expect, it } from 'vitest';
import { berekenPersonalisatie, formaatVoorPlek, stukprijsUitStaffel, type Formaat, type Kosten, type Tarief } from '@/lib/personalisatie';

const tarieven: Tarief[] = [
  { techniek: 'borduren', formaat: 'S', vanaf_aantal: 1, stukprijs: 8.45 },
  { techniek: 'borduren', formaat: 'S', vanaf_aantal: 5, stukprijs: 7.95 },
  { techniek: 'borduren', formaat: 'S', vanaf_aantal: 15, stukprijs: 7.45 },
  { techniek: 'bedrukken', formaat: 'M', vanaf_aantal: 1, stukprijs: 4.75 },
  { techniek: 'bedrukken', formaat: 'L', vanaf_aantal: 1, stukprijs: 8.5 },
];
const formaten: Formaat[] = [
  { techniek: 'borduren', formaat: 'XS', omschrijving: 'tot 75 cm²', max_oppervlakte_cm2: 75, volgorde: 1 },
  { techniek: 'borduren', formaat: 'S', omschrijving: 'tot 150 cm²', max_oppervlakte_cm2: 150, volgorde: 2 },
  { techniek: 'bedrukken', formaat: 'M', omschrijving: 'Borst, mouw of rug', max_oppervlakte_cm2: null, volgorde: 1 },
  { techniek: 'bedrukken', formaat: 'L', omschrijving: 'Full backprint', max_oppervlakte_cm2: null, volgorde: 2 },
];
const kosten: Kosten[] = [
  { techniek: 'borduren', soort: 'instelkosten', omschrijving: 'Instelkosten per order', bedrag: 20, eenheid: 'order' },
  { techniek: 'borduren', soort: 'borduurkaart', omschrijving: 'Borduurkaart per logo', bedrag: 65, eenheid: 'logo' },
];
const borst = { logo_url: 'https://x/logo.png', label: 'Linker borst', breedte_cm: 12 };

describe('personalisatie', () => {
  it('staffel: hoogste vanaf die past', () => {
    expect(stukprijsUitStaffel(tarieven, 'borduren', 'S', 4)).toBe(8.45);
    expect(stukprijsUitStaffel(tarieven, 'borduren', 'S', 5)).toBe(7.95);
    expect(stukprijsUitStaffel(tarieven, 'borduren', 'S', 40)).toBe(7.45);
  });

  it('formaat: handmatig gaat voor, borduren uit de breedte, bedrukken rug = groot', () => {
    expect(formaatVoorPlek({ ...borst, formaat: 'XS' }, 'borduren', formaten)).toBe('XS');
    expect(formaatVoorPlek({ ...borst, breedte_cm: 10 }, 'borduren', formaten)).toBe('XS'); // 50 cm²
    expect(formaatVoorPlek({ ...borst, breedte_cm: 15 }, 'borduren', formaten)).toBe('S'); // 112 cm²
    expect(formaatVoorPlek({ logo_url: 'a', label: 'Rug' }, 'bedrukken', formaten)).toBe('L');
    expect(formaatVoorPlek({ logo_url: 'a', label: 'Linker borst' }, 'bedrukken', formaten)).toBe('M');
  });

  it('staffel telt over trui en overhemd samen; borst + rug = twee prijzen; instelkosten één keer', () => {
    const proef = { techniek: 'borduren', plekken: [{ ...borst, breedte_cm: 15 }] };
    const uit = berekenPersonalisatie({
      regels: [
        { product_id: 'trui', kleur: null, aantal: 3 },
        { product_id: 'overhemd', kleur: null, aantal: 3 },
        { product_id: 'zonder', kleur: null, aantal: 10 },
      ],
      proefVoor: (r) => (r.product_id === 'zonder' ? null : proef),
      tarieven, klantTarieven: [], formaten, kosten,
    });
    const logo = uit.regels.find((r) => r.formaat === 'S')!;
    expect(logo.aantal).toBe(6);
    expect(logo.stukprijs).toBe(7.95); // staffel vanaf 5, niet 2x 3 stuks los
    expect(uit.regels.filter((r) => r.sleutel.startsWith('kosten')).map((r) => r.stukprijs)).toEqual([20]); // per logo niet automatisch
  });

  it('afwijkende klantstaffel gaat voor de centrale', () => {
    const uit = berekenPersonalisatie({
      regels: [{ product_id: 'p', kleur: null, aantal: 2 }],
      proefVoor: () => ({ techniek: 'bedrukken', plekken: [{ logo_url: 'a', label: 'Linker borst' }, { logo_url: 'a', label: 'Rug' }] }),
      tarieven, klantTarieven: [{ techniek: 'bedrukken', formaat: 'M', vanaf_aantal: 1, stukprijs: 3 }], formaten, kosten: [],
    });
    expect(uit.regels.map((r) => [r.formaat, r.stukprijs, r.klantprijs])).toEqual([
      ['M', 3, true],
      ['L', 8.5, false],
    ]);
  });
});
