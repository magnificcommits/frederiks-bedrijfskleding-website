import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bestaandeDatum,
  bewaarParams,
  getalParam,
  isUuid,
  lijstParam,
  lijstUrl,
  param,
  periodeParam,
  presetBereik,
  sleutelsVan,
  vandaagPlus,
} from '@/lib/filterBalk';
import { formatDatum, formatEuro, formatGetal, formatStatus } from '@/lib/format';
import { nlWeekdag, wachtTot, werkdagenVanaf } from '@/lib/kms/campagne-engine';

afterEach(() => {
  vi.useRealTimers();
});

describe('filterBalk: URL-parameters', () => {
  it('param: eerste waarde, getrimd', () => {
    expect(param({ q: ['  a ', 'b'] }, 'q')).toBe('a');
    expect(param({}, 'q')).toBe('');
  });
  it('lijstParam: komma-gescheiden, lege delen weg', () => {
    expect(lijstParam({ b: 'bouw, ,zorg,' }, 'b')).toEqual(['bouw', 'zorg']);
  });
  it('getalParam: komma als decimaalteken, ongeldig = null', () => {
    expect(getalParam({ m: '12,5' }, 'm')).toBe(12.5);
    expect(getalParam({ m: 'abc' }, 'm')).toBeNull();
    expect(getalParam({}, 'm')).toBeNull();
  });
  it('periodeParam: van/tot omgedraaid wordt rechtgezet, totExclusief is de dag erna', () => {
    expect(periodeParam({ d_van: '2026-03-31', d_tot: '2026-03-01' }, 'd')).toEqual({ van: '2026-03-01', tot: '2026-03-31', totExclusief: '2026-04-01' });
  });
  it('periodeParam: niet-bestaande datum wordt genegeerd (geen stille verschuiving naar maart)', () => {
    expect(periodeParam({ d_van: '2026-02-30', d_tot: '2026-13-01' }, 'd')).toEqual({ van: null, tot: null, totExclusief: null });
  });
  it('bestaandeDatum', () => {
    expect(bestaandeDatum('2028-02-29')).toBe(true);
    expect(bestaandeDatum('2026-02-29')).toBe(false);
    expect(bestaandeDatum('2026-1-1')).toBe(false);
  });
  it('lijstUrl: meldingen en pagina eraf, wijzigingen erbij, leeg wist', () => {
    expect(lijstUrl('/dashboard/orders', { status: 'besteld', ok: 'opgeslagen', pagina: '3' }, { klant: 'x', status: '' })).toBe('/dashboard/orders?klant=x');
    expect(lijstUrl('/d', {}, { pagina: 1 })).toBe('/d');
    expect(lijstUrl('/d', {}, { pagina: 2 })).toBe('/d?pagina=2');
  });
  it('bewaarParams en sleutelsVan', () => {
    expect(bewaarParams({ a: '1', fout: 'x', pagina: '2', b: ['3'] }, ['b'])).toEqual({ a: '1' });
    expect(sleutelsVan({ soort: 'datum', param: 'd' })).toEqual(['d', 'd_van', 'd_tot']);
    expect(sleutelsVan({ soort: 'bedrag', param: 'b' })).toEqual(['b_min', 'b_max']);
  });
  it('isUuid', () => {
    expect(isUuid('6f1c1c3e-1111-4a2b-9c3d-0123456789ab')).toBe(true);
    expect(isUuid("1' or 1=1")).toBe(false);
  });
});

describe('filterBalk: datumpresets (Nederlandse tijd)', () => {
  it('week begint op maandag', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T10:00:00Z')); // zondag
    expect(presetBereik('week')).toEqual({ van: '2026-09-28', tot: '2026-10-04' });
  });
  it('maand, vorige maand, kwartaal, jaar', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T10:00:00Z'));
    expect(presetBereik('maand')).toEqual({ van: '2026-03-01', tot: '2026-03-31' });
    expect(presetBereik('vorigemaand')).toEqual({ van: '2026-02-01', tot: '2026-02-28' });
    expect(presetBereik('kwartaal')).toEqual({ van: '2026-01-01', tot: '2026-03-31' });
    expect(presetBereik('jaar')).toEqual({ van: '2026-01-01', tot: '2026-12-31' });
    expect(presetBereik('onzin')).toBeNull();
  });
  it('vorige maand in januari is december van het jaar ervoor', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T10:00:00Z'));
    expect(presetBereik('vorigemaand')).toEqual({ van: '2025-12-01', tot: '2025-12-31' });
  });
  it('na 22:00 UTC in de zomer is het in Nederland al morgen', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-30T22:30:00Z'));
    expect(vandaagPlus(0)).toBe('2026-07-01');
    expect(presetBereik('30d')).toEqual({ van: '2026-06-02', tot: '2026-07-01' });
  });
});

describe('opmaak', () => {
  it('formatDatum in Nederlandse tijd (server in UTC)', () => {
    expect(formatDatum('2026-06-16T23:30:00Z')).toBe('17-06-2026');
    expect(formatDatum('2026-06-17')).toBe('17-06-2026');
    expect(formatDatum('kapot')).toBe('');
    expect(formatDatum(null)).toBe('');
  });
  it('formatEuro, formatGetal, formatStatus', () => {
    expect(formatEuro(1234.5)).toMatch(/1\.234,50/);
    expect(formatEuro(1234.5, 0)).toMatch(/1\.235|1\.234/);
    expect(formatEuro(Number.NaN)).toMatch(/0,00/);
    expect(formatGetal(1234.6)).toBe('1.235');
    expect(formatStatus('nog_bestellen')).toBe('Nog bestellen');
  });
});

describe('werkdagen en wachtstappen (campagnes)', () => {
  it('nlWeekdag: 1 = maandag ... 7 = zondag', () => {
    expect(nlWeekdag(new Date('2026-10-05T10:00:00Z'))).toBe(1);
    expect(nlWeekdag(new Date('2026-10-04T10:00:00Z'))).toBe(7);
    // zondag 23:30 UTC is in Nederland al maandag
    expect(nlWeekdag(new Date('2026-10-04T23:30:00Z'))).toBe(1);
  });
  it('werkdagenVanaf slaat het weekend over', () => {
    expect(werkdagenVanaf(new Date('2026-10-02T10:00:00Z'), 1)).toBe('2026-10-05'); // vrijdag + 1 = maandag
    expect(werkdagenVanaf(new Date('2026-10-05T10:00:00Z'), 5)).toBe('2026-10-12');
    expect(werkdagenVanaf(new Date('2026-10-05T10:00:00Z'), 0)).toBe('2026-10-05');
  });
  it('wachtTot uren en dagen', () => {
    const nu = new Date('2026-10-05T10:00:00Z');
    expect(wachtTot({ id: 'w', type: 'wacht', modus: 'uren', aantal: 3, weekdag: 1 }, nu)?.toISOString()).toBe('2026-10-05T13:00:00.000Z');
    expect(wachtTot({ id: 'w', type: 'wacht', modus: 'dagen', aantal: 2, weekdag: 1 }, nu)?.toISOString()).toBe('2026-10-07T10:00:00.000Z');
    expect(wachtTot({ id: 'w', type: 'wacht', modus: 'dagen', aantal: 0, weekdag: 1 }, nu)).toBeNull();
  });
  it('wachtTot weekdag: vandaag is het al die dag = meteen door', () => {
    expect(wachtTot({ id: 'w', type: 'wacht', modus: 'weekdag', aantal: 0, weekdag: 1 }, new Date('2026-10-05T10:00:00Z'))).toBeNull();
  });
  it('wachtTot weekdag: woensdag vanaf maandag, vroeg in de ochtend', () => {
    expect(wachtTot({ id: 'w', type: 'wacht', modus: 'weekdag', aantal: 0, weekdag: 3 }, new Date('2026-10-05T10:00:00Z'))?.toISOString()).toBe('2026-10-07T04:00:00.000Z');
  });
  it('wachtTot weekdag rond middernacht UTC: niet een dag te vroeg', () => {
    // Zondag 23:30 UTC = maandag 01:30 in Nederland. Woensdag is dan over 2 dagen: 7 oktober.
    // Voorheen kwam hier dinsdag 6 oktober 04:00 uit.
    expect(wachtTot({ id: 'w', type: 'wacht', modus: 'weekdag', aantal: 0, weekdag: 3 }, new Date('2026-10-04T23:30:00Z'))?.toISOString()).toBe('2026-10-07T04:00:00.000Z');
  });
});
