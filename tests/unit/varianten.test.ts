import { describe, expect, it } from 'vitest';
import {
  alleMaten,
  combinatieNaam,
  kleurNaam,
  kleurSleutel,
  kleurZoektermen,
  maatNaam,
  maatSleutel,
  normaliseerKleur,
  normaliseerMaat,
  sorteerMaten,
  STANDAARD_KLEUREN,
  STANDAARD_LIJSTEN,
  vindKleur,
  type VariantLijsten,
} from '@/lib/kms/variantenStandaard';
import { meldOnbekend, normaliseerImportVariant } from '@/lib/kms/importNormaliseren';

describe('kleurSleutel', () => {
  it.each([
    ['0404 - Black\\Black', 'black/black'],
    ['Marine/Zwart 1620', 'marine/zwart'],
    ['Deep Blue\\Navy - 5395', 'deep blue/navy'],
    ['BlackGrey', 'black/grey'],
    ['  Grijs   gemêleerd ', 'grijs gemeleerd'],
    ['Rood (1)', 'rood'],
    ['Navy & White', 'navy/white'],
    ['', ''],
  ])('%s -> %s', (ruw, sleutel) => {
    expect(kleurSleutel(ruw)).toBe(sleutel);
  });
});

describe('normaliseerKleur', () => {
  it('alias wordt de standaardnaam (zeker)', () => {
    expect(normaliseerKleur('Navy')).toMatchObject({ naam: 'Marine', zeker: true, nieuw: false });
    expect(normaliseerKleur('hi-vis yellow').naam).toBe('Fluor geel');
  });
  it('accenten en hoofdletters tellen niet', () => {
    expect(normaliseerKleur('GRIJS GEMELEERD').naam).toBe('Grijs gemêleerd');
  });
  it('leverancierscode eraf: "0404 - Black\\Black" is gewoon zwart', () => {
    expect(normaliseerKleur('0404 - Black\\Black')).toMatchObject({ naam: 'Zwart', zeker: true });
  });
  it('tweekleur die nog niet bestaat wordt een voorstel', () => {
    const u = normaliseerKleur('9504 - Navy\\Black');
    expect(u).toMatchObject({ naam: 'Marine/zwart', zeker: false, nieuw: true });
    expect(u.delen.map((d) => d.naam)).toEqual(['Marine', 'Zwart']);
  });
  it('tweekleur die wel in de lijst staat is zeker', () => {
    const lijst: VariantLijsten = { ...STANDAARD_LIJSTEN, kleuren: [...STANDAARD_KLEUREN, { naam: 'Marine/zwart', hex: '#000', groep: 'blauw', volgorde: 9999, aliassen: [] }] };
    expect(normaliseerKleur('Navy/Black', lijst)).toMatchObject({ naam: 'Marine/zwart', zeker: true, nieuw: false });
  });
  it('aan elkaar geknipte meerwoordige kleur ("Dk KhakiGreen")', () => {
    expect(normaliseerKleur('Dk Khaki Green').naam).toBe('Donker kakigroen');
  });
  it('onbekend: geen naam', () => {
    expect(normaliseerKleur('Galactisch paars-oranje')).toMatchObject({ naam: null, zeker: false });
    expect(normaliseerKleur('')).toMatchObject({ naam: null });
  });
  it('alStandaard alleen als de ruwe waarde precies de standaardnaam is', () => {
    expect(normaliseerKleur('Zwart').alStandaard).toBe(true);
    expect(normaliseerKleur('zwart').alStandaard).toBe(false);
  });
  it('inactieve kleur in de lijst telt niet mee', () => {
    const lijst: VariantLijsten = { ...STANDAARD_LIJSTEN, kleuren: STANDAARD_KLEUREN.map((k) => (k.naam === 'Indigo' ? { ...k, actief: false } : k)) };
    expect(normaliseerKleur('Indigo', lijst).naam).toBeNull();
  });
  it('combinatieNaam: tweede kleur met kleine letter', () => {
    expect(combinatieNaam([{ naam: 'Marine' }, { naam: 'Fluor geel' }])).toBe('Marine/fluor geel');
  });
});

describe('maten', () => {
  it.each([
    ['XXL', '2XL'],
    ['xxxl', '3XL'],
    ['OneSize', 'One size'],
    ['56 NL (50 FR)', '56'],
    ['xl / xxl', 'XL/2XL'],
    ['M', 'M'],
  ])('normaliseerMaat(%s) = %s', (ruw, maat) => {
    expect(normaliseerMaat(ruw)).toMatchObject({ naam: maat, zeker: true });
  });
  it('onbekende maat', () => {
    expect(normaliseerMaat('Kindermaat 98')).toMatchObject({ naam: null, zeker: false, reeks: null });
  });
  it('maatSleutel', () => {
    expect(maatSleutel('  L / XL ')).toBe('l/xl');
    expect(maatSleutel('10/12 jaar (10/12 ans)')).toBe('10/12 jaar');
  });
  it('sorteerMaten volgens de vaste lijst, onbekend achteraan', () => {
    expect(sorteerMaten(['XL', 'S', 'L', 'XS', 'M', '2XL', 'Onbekend'])).toEqual(['XS', 'S', 'M', 'L', 'XL', '2XL', 'Onbekend']);
    expect(sorteerMaten(['52', '48', '50'])).toEqual(['48', '50', '52']);
  });
  it('kleurNaam/maatNaam: standaardnaam of de opgeschoonde ruwe waarde', () => {
    expect(kleurNaam(' Navy ')).toBe('Marine');
    expect(kleurNaam('Regenboog')).toBe('Regenboog');
    expect(kleurNaam('')).toBeNull();
    expect(maatNaam('XXL')).toBe('2XL');
    expect(maatNaam('Kindermaat')).toBe('Kindermaat');
  });
  it('alleMaten begint bij confectie XXS en bevat One size', () => {
    const lijst = alleMaten();
    expect(lijst[0]).toEqual({ maat: 'XXS', reeks: 'Confectie' });
    expect(lijst.some((m) => m.maat === 'One size')).toBe(true);
  });
  it('kleurZoektermen en vindKleur', () => {
    expect(kleurZoektermen('Marine')).toEqual(expect.arrayContaining(['marine', 'navy']));
    expect(vindKleur('anthracite')?.naam).toBe('Antraciet');
  });
});

describe('import: kleur en maat naar de vaste lijst', () => {
  it('herkende waarden worden de standaardnaam, de ruwe waarde gaat mee', () => {
    expect(normaliseerImportVariant('0404 - Black\\Black', 'XXL')).toEqual({
      kleur: 'Zwart',
      maat: '2XL',
      kleurLeverancier: '0404 - Black\\Black',
      maatLeverancier: 'XXL',
      onbekendeKleur: null,
      onbekendeMaat: null,
    });
  });
  it('onbekende waarden blijven staan en worden gemeld', () => {
    const n = normaliseerImportVariant('Regenboog', 'Kindermaat 98');
    expect(n).toMatchObject({ kleur: 'Regenboog', maat: 'Kindermaat 98', onbekendeKleur: 'Regenboog', onbekendeMaat: 'Kindermaat 98' });
  });
  it('een nieuwe tweekleur telt als onbekend (eerst in de lijst zetten)', () => {
    expect(normaliseerImportVariant('Navy/Black', null).onbekendeKleur).toBe('Navy/Black');
  });
  it('lege waarden blijven leeg', () => {
    expect(normaliseerImportVariant('  ', null)).toMatchObject({ kleur: null, maat: null, onbekendeKleur: null, onbekendeMaat: null });
  });
  it('melding met aantallen en een maximum aantal voorbeelden', () => {
    const m = new Map([['Regenboog', 3], ['Paarsig', 1]]);
    expect(meldOnbekend('kleuren', m)).toBe('2 kleuren niet in de vaste lijst, ongewijzigd overgenomen: Regenboog (3x), Paarsig. Koppel ze via Instellingen > Maten en kleuren.');
    expect(meldOnbekend('maten', new Map())).toBeNull();
    const veel = new Map(Array.from({ length: 10 }, (_, i) => [`k${i}`, 1] as [string, number]));
    expect(meldOnbekend('kleuren', veel, 2)).toContain('en nog 8');
  });
});
