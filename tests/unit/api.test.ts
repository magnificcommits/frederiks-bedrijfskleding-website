import { describe, expect, it } from 'vitest';
import { inDienstSchema, lijstQuerySchema, pnrUitPad, uitDienstSchema, wijzigSchema } from '@/lib/api/medewerkers';
import { API_SCOPES, hashSleutel, heeftSleutelVorm, schoneScopes } from '@/lib/api/sleutels';
import { apiFout, leesJson, zodDetails } from '@/lib/api/v1';

describe('API v1: medewerker in dienst', () => {
  it('geldige invoer met personeelsnummer', () => {
    const r = inDienstSchema.safeParse({ naam: ' Jan Jansen ', personeelsnummer: 'P-1001', startdatum: '2026-11-01' });
    expect(r.success).toBe(true);
    expect(r.success && r.data.naam).toBe('Jan Jansen');
  });
  it('personeelsnummer of e-mail is verplicht', () => {
    const r = inDienstSchema.safeParse({ naam: 'Jan' });
    expect(r.success).toBe(false);
    expect(!r.success && zodDetails(r.error)[0]).toEqual({
      veld: 'personeelsnummer',
      bericht: 'Geef een personeelsnummer of e-mailadres mee, zodat we de medewerker later terugvinden.',
    });
  });
  it('onbekende velden worden geweigerd (strict)', () => {
    expect(inDienstSchema.safeParse({ naam: 'Jan', email: 'jan@x.nl', salaris: 5000 }).success).toBe(false);
  });
  it('datum moet bestaan', () => {
    const r = inDienstSchema.safeParse({ naam: 'Jan', email: 'jan@x.nl', startdatum: '2026-02-30' });
    expect(!r.success && r.error.issues[0].message).toBe('Deze datum bestaat niet.');
    expect(inDienstSchema.safeParse({ naam: 'Jan', email: 'jan@x.nl', startdatum: '01-11-2026' }).success).toBe(false);
  });
  it('ongeldig e-mailadres en personeelsnummer met spatie', () => {
    expect(inDienstSchema.safeParse({ naam: 'Jan', email: 'geen-mail' }).success).toBe(false);
    expect(inDienstSchema.safeParse({ naam: 'Jan', personeelsnummer: 'P 1' }).success).toBe(false);
  });
  it('naam te lang', () => {
    expect(inDienstSchema.safeParse({ naam: 'x'.repeat(161), email: 'a@b.nl' }).success).toBe(false);
  });
});

describe('API v1: wijzigen, uit dienst, lijst', () => {
  it('wijzigen zonder velden mag niet', () => {
    expect(wijzigSchema.safeParse({}).success).toBe(false);
    expect(wijzigSchema.safeParse({ functie: 'Monteur' }).success).toBe(true);
  });
  it('uit dienst: einddatum optioneel, geldig formaat', () => {
    expect(uitDienstSchema.safeParse({}).success).toBe(true);
    expect(uitDienstSchema.safeParse({ einddatum: '2026-12-31' }).success).toBe(true);
    expect(uitDienstSchema.safeParse({ einddatum: 'morgen' }).success).toBe(false);
  });
  it('lijstquery: standaardwaarden en grenzen', () => {
    expect(lijstQuerySchema.parse({})).toEqual({ status: 'alle', limit: 100, offset: 0 });
    expect(lijstQuerySchema.parse({ limit: '25', offset: '50' })).toMatchObject({ limit: 25, offset: 50 });
    expect(lijstQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
    expect(lijstQuerySchema.safeParse({ gewijzigd_sinds: 'gisteren' }).success).toBe(false);
  });
  it('pnrUitPad: %-codering, kapotte codering blijft ruw', () => {
    expect(pnrUitPad('P%2D1')).toBe('P-1');
    expect(pnrUitPad('%E0%A4%A')).toBe('%E0%A4%A');
  });
});

describe('API-sleutels', () => {
  it('sleutelvorm', () => {
    expect(heeftSleutelVorm('fb_live_' + 'a'.repeat(32))).toBe(true);
    expect(heeftSleutelVorm('fb_live_kort')).toBe(false);
    expect(heeftSleutelVorm('sk_live_' + 'a'.repeat(32))).toBe(false);
  });
  it('hash is sha256-hex en deterministisch', () => {
    expect(hashSleutel('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('scopes: geen lijst = standaard (alle), onbekende scopes vallen weg', () => {
    expect(schoneScopes(null)).toEqual([...API_SCOPES]);
    expect(schoneScopes(['medewerkers:lezen', 'admin:alles'])).toEqual(['medewerkers:lezen']);
  });
  it('scopes: een lege lijst geeft GEEN rechten (gaf voorheen alle rechten)', () => {
    expect(schoneScopes([])).toEqual([]);
    expect(schoneScopes(['onzin'])).toEqual([]);
  });
});

describe('API-antwoorden', () => {
  it('apiFout: vaste vorm, no-store en extra headers', async () => {
    const res = apiFout(429, 'te_veel_verzoeken', 'Wacht even.', undefined, { 'Retry-After': '60' });
    expect(res.status).toBe(429);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(await res.json()).toEqual({ fout: { code: 'te_veel_verzoeken', bericht: 'Wacht even.' } });
  });
  it('leesJson: geldig, leeg, kapot en te groot', async () => {
    const req = (body: string) => new Request('https://x.nl/api', { method: 'POST', body });
    expect(await leesJson(req('{"a":1}'))).toEqual({ a: 1 });
    expect(await leesJson(req('  '))).toBeNull();
    expect(await leesJson(req('{kapot'))).toBeNull();
    expect(await leesJson(req(JSON.stringify({ x: 'y'.repeat(70_000) })))).toBeNull();
  });
});
