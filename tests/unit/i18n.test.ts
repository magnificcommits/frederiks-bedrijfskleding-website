import { describe, expect, it } from 'vitest';
import { nl } from '@/lib/i18n/portaal/nl';
import { en } from '@/lib/i18n/portaal/en';
import { de } from '@/lib/i18n/portaal/de';
import { pl } from '@/lib/i18n/portaal/pl';
import { isTaal, maakVertaler, taalUitAcceptLanguage, TALEN } from '@/lib/i18n/portaal/kern';

type Boom = { [k: string]: string | Boom };

/** Alle bladeren als { pad: tekst } (meervoudsvormen als pad.one, pad.other, ...). */
function plat(o: Boom, pad = ''): Record<string, string> {
  const uit: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    const p = pad ? `${pad}.${k}` : k;
    if (typeof v === 'string') uit[p] = v;
    else Object.assign(uit, plat(v, p));
  }
  return uit;
}

const variabelen = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const bron = plat(nl as unknown as Boom);
const vertalingen = { en, de, pl } as const;

describe('portaal-woordenboeken', () => {
  for (const [taal, wb] of Object.entries(vertalingen)) {
    const doel = plat(wb as unknown as Boom);
    // Meervoud: Pools heeft extra vormen (few/many); die hoeven niet in nl te staan.
    const enkelBron = Object.keys(bron).filter((k) => !/\.(few|many)$/.test(k));

    it(`${taal}: elke Nederlandse sleutel is vertaald`, () => {
      const ontbreekt = enkelBron.filter((k) => !(k in doel));
      expect(ontbreekt).toEqual([]);
    });
    it(`${taal}: geen extra sleutels die nl niet kent`, () => {
      const extra = Object.keys(doel).filter((k) => !(k in bron) && !/\.(few|many)$/.test(k));
      expect(extra).toEqual([]);
    });
    it(`${taal}: geen lege teksten`, () => {
      expect(Object.entries(doel).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
    });
    it(`${taal}: dezelfde {variabelen} als het Nederlands`, () => {
      const verschil = enkelBron
        .filter((k) => k in doel)
        .filter((k) => {
          // Een meervoudsvorm mag {n} weglaten ("one" zonder getal: "1 item" vs "één item").
          const a = variabelen(bron[k]).filter((v) => v !== 'n');
          const b = variabelen(doel[k]).filter((v) => v !== 'n');
          return a.join(',') !== b.join(',');
        });
      expect(verschil).toEqual([]);
    });
  }

  it('Pools: elke meervoudsvorm heeft few en many', () => {
    const plWb = plat(pl as unknown as Boom);
    const meervouden = Object.keys(bron).filter((k) => k.endsWith('.other')).map((k) => k.slice(0, -'.other'.length));
    const zonder = meervouden.filter((k) => !(`${k}.few` in plWb) || !(`${k}.many` in plWb));
    expect(zonder).toEqual([]);
  });

  it('nl heeft geen lege teksten', () => {
    expect(Object.entries(bron).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
  });
});

describe('vertaler', () => {
  const t = maakVertaler('nl', nl);
  it('vult variabelen en laat onbekende staan', () => {
    expect(t.t('algemeen.nietGekoppeldTekst', { email: 'a@b.nl' })).toContain('a@b.nl');
    expect(t.t('algemeen.nietActiefConfig', { url: 'X' })).toContain('{key}');
  });
  it('onbekende sleutel geeft de sleutel zelf terug', () => {
    expect(t.t('bestaat.niet' as never)).toBe('bestaat.niet');
  });
  it('datum in Nederlandse tijd, ook als de server in UTC draait', () => {
    expect(t.datum('2026-10-04T23:30:00Z')).toBe('5 oktober 2026');
    expect(t.datum('kapot')).toBe('');
  });
  it('euro per taal', () => {
    expect(t.euro(1234.5)).toMatch(/1\.234,50/);
    expect(maakVertaler('en', en).euro(1234.5)).toMatch(/1,234\.50/);
  });
  it('status valt terug op de ruwe waarde zonder underscores', () => {
    expect(t.status('order', 'iets_nieuws')).toBe('iets nieuws');
  });
  it('Accept-Language: op gewicht, alleen ondersteunde talen', () => {
    expect(taalUitAcceptLanguage('fr-FR,de;q=0.8,en;q=0.9')).toBe('en');
    expect(taalUitAcceptLanguage('fr,es')).toBeNull();
    expect(taalUitAcceptLanguage('pl-PL')).toBe('pl');
    expect(taalUitAcceptLanguage(null)).toBeNull();
  });
  it('isTaal', () => {
    expect(TALEN.every(isTaal)).toBe(true);
    expect(isTaal('fr')).toBe(false);
  });
});
