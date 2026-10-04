import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataLaadFout, eisData, eisRijen, logDbFout, maskeer } from '@/lib/dbFout';
import { alleRijen } from '@/lib/alleRijen';
import { normZoek, zoekScore } from '@/lib/zoekScore';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('dbFout: fouten niet meer stil als lege lijst', () => {
  it('eisData geeft data terug als er geen fout is', () => {
    expect(eisData('test', { data: [1, 2], error: null })).toEqual([1, 2]);
    expect(eisData('test', { data: null, error: null })).toBeNull();
  });
  it('eisData gooit een DataLaadFout met context en code (bv. PGRST201, dubbele join)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let fout: unknown;
    try {
      eisData('orders.lijst', { data: null, error: { code: 'PGRST201', message: 'Could not embed because more than one relationship was found' } });
    } catch (e) {
      fout = e;
    }
    expect(fout).toBeInstanceOf(DataLaadFout);
    expect((fout as DataLaadFout).context).toBe('orders.lijst');
    expect((fout as DataLaadFout).code).toBe('PGRST201');
    expect((fout as DataLaadFout).message).toBe('De gegevens konden niet worden geladen.');
  });
  it('logDbFout logt context en code, zonder persoonsgegevens', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logDbFout('klanten.lijst', { code: '23505', message: 'duplicate key: Key (email)=(jan@bedrijf.nl) already exists', details: 'Key (email)=(jan@bedrijf.nl)' });
    const regel = String(spy.mock.calls[0][0]);
    expect(regel).toContain('[db] klanten.lijst: 23505');
    expect(regel).not.toContain('jan@bedrijf.nl');
  });
  it('logDbFout doet niets zonder fout', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logDbFout('x', null);
    expect(spy).not.toHaveBeenCalled();
  });
  it('maskeer: e-mail, telefoon en waarden tussen haakjes', () => {
    expect(maskeer('mail piet@x.nl of bel 06-12345678')).toBe('mail [e-mail] of bel [nummer]');
    expect(maskeer('Key (naam)=(Jan Jansen) bestaat')).toBe('Key (naam)=([waarde]) bestaat');
    expect(maskeer('x'.repeat(500))).toHaveLength(300);
  });
  it('eisRijen: 0 geraakte rijen (RLS weigerde stil) is een fout', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(eisRijen('portaal.zetBudget', { data: [{ id: '1' }], error: null })).toEqual({ ok: true });
    const leeg = eisRijen('portaal.zetBudget', { data: [], error: null });
    expect(leeg.ok).toBe(false);
    expect(!leeg.ok && leeg.fout).toContain('geen rechten');
    expect(eisRijen('x', { data: null, error: null }).ok).toBe(false);
    const fout = eisRijen('x', { data: null, error: { code: '42501', message: 'permission denied' } });
    expect(!fout.ok && fout.fout).toContain('fout in de database');
  });
});

describe('alleRijen: voorbij de 1000-rijen-grens van Supabase', () => {
  const tabel = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
  const bron = (van: number, tot: number) => Promise.resolve({ data: tabel.slice(van, tot + 1), error: null });

  it('haalt alles op in blokken van 1000', async () => {
    const aanroepen: [number, number][] = [];
    const rijen = await alleRijen('t', (van, tot) => {
      aanroepen.push([van, tot]);
      return bron(van, tot);
    });
    expect(rijen).toHaveLength(2500);
    expect(aanroepen).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it('stopt meteen bij een kleine tabel', async () => {
    const maak = vi.fn((van: number, tot: number) => Promise.resolve({ data: tabel.slice(0, 10).slice(van, tot + 1), error: null }));
    expect(await alleRijen('t', maak)).toHaveLength(10);
    expect(maak).toHaveBeenCalledTimes(1);
  });
  it('precies 1000 rijen: één extra (leeg) verzoek, geen rij dubbel', async () => {
    const duizend = tabel.slice(0, 1000);
    const rijen = await alleRijen('t', (van, tot) => Promise.resolve({ data: duizend.slice(van, tot + 1), error: null }));
    expect(rijen).toHaveLength(1000);
  });
  it('respecteert max', async () => {
    expect(await alleRijen('t', bron, { max: 1500 })).toHaveLength(1500);
  });
  it('fout: standaard een DataLaadFout, met bijFout "leeg" wat er al was', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const kapot = (van: number, tot: number) =>
      van >= 1000 ? Promise.resolve({ data: null, error: { code: '57014', message: 'timeout' } }) : bron(van, tot);
    await expect(alleRijen('t', kapot)).rejects.toBeInstanceOf(DataLaadFout);
    expect(await alleRijen('t', kapot, { bijFout: 'leeg' })).toHaveLength(1000);
  });
});

describe('zoekScore (CommandPalette)', () => {
  const nieuweKlant = { label: 'Nieuwe klant', sub: 'Met afdelingen', woorden: 'klant toevoegen aanmaken bedrijf' };
  it('woordbegin in het label scoort hoog', () => {
    expect(zoekScore(nieuweKlant, 'nieuw kl')).toBe(3 + 3);
    // Begint het label met de hele zoekterm, dan 2 extra.
    expect(zoekScore(nieuweKlant, 'nieuwe k')).toBe(3 + 3 + 2);
  });
  it('elk woord moet ergens passen', () => {
    expect(zoekScore(nieuweKlant, 'nieuw factuur')).toBe(0);
    expect(zoekScore(nieuweKlant, '   ')).toBe(0);
  });
  it('zoekwoorden tellen mee, lager dan het label', () => {
    expect(zoekScore(nieuweKlant, 'toevoegen')).toBe(1);
  });
  it('accentloos: "categorieen" vindt "categorieën" en andersom', () => {
    expect(zoekScore({ label: 'Klachtcategorieën' }, 'categorieen')).toBeGreaterThan(0);
    expect(zoekScore({ label: 'Service', woorden: 'klachtcategorieen' }, 'klachtcategorieën')).toBeGreaterThan(0);
  });
  it('apostrof en hoofdletters tellen niet', () => {
    expect(zoekScore({ label: 'Werkbonnen en logo’s' }, "LOGO'S")).toBeGreaterThan(0);
  });
  it('streepjes en haakjes in de zoekterm (voorheen 0 resultaten)', () => {
    expect(zoekScore({ label: 'Nieuwsbrief', woorden: 'mail mailing email e-mail' }, 'e-mail')).toBeGreaterThan(0);
    expect(zoekScore({ label: 'Beveiliging (2FA)' }, '(2fa)')).toBeGreaterThan(0);
  });
  it('label dat met de hele term begint wint van een treffer midden in een woord', () => {
    expect(zoekScore({ label: 'Orders' }, 'ord')).toBeGreaterThan(zoekScore({ label: 'Inkooporders' }, 'ord'));
  });
  it('normZoek', () => {
    expect(normZoek('Crème Brûlée’s')).toBe('creme brulees');
  });
});
