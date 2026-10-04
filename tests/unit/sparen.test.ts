import { describe, expect, it } from 'vitest';
import { berekenStanden, berekenSynchronisatie, type MutatieRij, type SpaarBundel } from '@/lib/kms/sparenGrootboek';
import {
  niveauStand,
  niveauVoor,
  niveauVoordelen,
  parseGetal,
  plusMaanden,
  ronde2,
  STANDAARD_NIVEAUS,
  vloerPunten,
  type SpaarRegel,
} from '@/lib/kms/sparenTypes';

const NU = new Date('2026-10-04T12:00:00Z');

function regel(over: Partial<SpaarRegel>): SpaarRegel {
  return {
    id: 'basis', naam: 'Per euro', soort: 'per_euro', actief: true, punten: 0, factor: 1, drempelEuro: null, maanden: null,
    startDatum: null, eindDatum: null, geldigVanaf: null, omschrijving: null, systeem: true, sortering: 0, ...over,
  };
}

function bundel(over: Partial<SpaarBundel> = {}): SpaarBundel {
  return {
    loyaliteit: true,
    instellingen: { actief: true, puntenPerEuro: 1, euroPerPunt: 0.01, vervalMaanden: 0, niveauBasis: 'omzet', portaalAanvragen: true, meldingEmail: '', voorwaarden: '' },
    regels: [regel({})],
    niveaus: [],
    niveausUitTabel: false,
    niveausSinds: null,
    orgs: [{ id: 'o1', naam: 'Klant', plaats: null, datum_klant: null }],
    orders: [],
    mutaties: [],
    inwisselingen: [],
    aanbrengingen: [],
    ...over,
  };
}

const order = (id: string, bedrag: number, besteldatum: string, status = 'besteld') => ({ id, ordernummer: 1000, organisatie_id: 'o1', bedrag, status, besteldatum });

function mutatie(over: Partial<MutatieRij>): MutatieRij {
  return {
    id: 'm1', organisatie_id: 'o1', punten: 0, soort: 'bij', regel_id: null, regel_soort: 'per_euro', order_id: null, sleutel: null,
    omschrijving: null, reden: null, door: 'systeem', datum: '2026-01-01T00:00:00Z', details: null, ...over,
  };
}

describe('sparen: rekenhulpen', () => {
  it('plusMaanden: 31 januari + 1 maand is 28 februari, niet 3 maart', () => {
    expect(plusMaanden(new Date('2026-01-31T10:00:00Z'), 1).toISOString()).toBe('2026-02-28T10:00:00.000Z');
    expect(plusMaanden(new Date('2028-01-31T10:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2028-02-29');
  });
  it('plusMaanden: gewone dag en over de jaargrens', () => {
    expect(plusMaanden(new Date('2026-10-15T00:00:00Z'), 12).toISOString().slice(0, 10)).toBe('2027-10-15');
    expect(plusMaanden(new Date('2026-11-30T00:00:00Z'), 3).toISOString().slice(0, 10)).toBe('2027-02-28');
  });
  it('vloerPunten: geen punt kwijt door zwevendekommafouten', () => {
    expect(Math.floor(100 * (1.15 - 1))).toBe(14); // het probleem zelf: 14,999999999999991
    expect(vloerPunten(100 * (1.15 - 1))).toBe(15);
    expect(vloerPunten(0.57 * 100)).toBe(57);
    expect(vloerPunten(12.99)).toBe(12);
  });
  it('parseGetal met komma en terugval', () => {
    expect(parseGetal('1,5', 0)).toBe(1.5);
    expect(parseGetal('', 7)).toBe(7);
    expect(parseGetal('abc', 7)).toBe(7);
  });
  it('ronde2', () => {
    expect(ronde2(1.005 + 0.001)).toBe(1.01);
    expect(ronde2(Number.NaN)).toBe(0);
  });
});

describe('sparen: niveaus', () => {
  it('niveauVoor kiest het hoogste gehaalde niveau', () => {
    expect(niveauVoor(STANDAARD_NIVEAUS, 0)?.naam).toBe('Brons');
    expect(niveauVoor(STANDAARD_NIVEAUS, 2500)?.naam).toBe('Zilver');
    expect(niveauVoor(STANDAARD_NIVEAUS, 99999)?.naam).toBe('Goud');
  });
  it('niveauStand: voortgang en wat er nog nodig is', () => {
    const s = niveauStand(STANDAARD_NIVEAUS, 5000, 1000);
    expect(s.huidig?.naam).toBe('Zilver');
    expect(s.volgende?.naam).toBe('Goud');
    expect(s.voortgang).toBeCloseTo(0.5);
    expect(s.nogTeGaan).toBe(2500);
    expect(s.straks?.naam).toBe('Brons');
  });
  it('hoogste niveau: voortgang 1 en niets meer te gaan', () => {
    const s = niveauStand(STANDAARD_NIVEAUS, 10000, 10000);
    expect(s.volgende).toBeNull();
    expect(s.voortgang).toBe(1);
    expect(s.nogTeGaan).toBe(0);
  });
  it('voordelen in gewone taal', () => {
    expect(niveauVoordelen(STANDAARD_NIVEAUS[2])).toEqual([
      '5% korting op kleding',
      '25% meer punten per euro',
      'Gratis logo borduren of bedrukken',
      'Gratis passen op locatie',
      'Voorrang in de planning',
    ]);
  });
});

describe('sparen: automatische boekingen', () => {
  it('punten per euro, naar beneden afgerond', () => {
    const { nieuw } = berekenSynchronisatie(bundel({ orders: [order('a', 123.99, '2026-09-01T10:00:00Z')] }), NU);
    expect(nieuw).toHaveLength(1);
    expect(nieuw[0]).toMatchObject({ punten: 123, soort: 'bij', sleutel: 'order:a:basis:0', order_id: 'a' });
  });
  it('concept en geannuleerde orders tellen niet', () => {
    const { nieuw } = berekenSynchronisatie(bundel({ orders: [order('a', 100, '2026-09-01', 'concept'), order('b', 100, '2026-09-01', 'geannuleerd')] }), NU);
    expect(nieuw).toHaveLength(0);
  });
  it('idempotent: een al geboekte sleutel wordt niet nog eens geboekt', () => {
    const b = bundel({
      orders: [order('a', 100, '2026-09-01T00:00:00Z')],
      mutaties: [mutatie({ punten: 100, order_id: 'a', sleutel: 'order:a:basis:0', details: { bedrag: 100 } })],
    });
    expect(berekenSynchronisatie(b, NU).nieuw).toHaveLength(0);
  });
  it('bedrag gewijzigd: alleen het verschil bijboeken', () => {
    const b = bundel({
      orders: [order('a', 150, '2026-09-01T00:00:00Z')],
      mutaties: [mutatie({ punten: 100, order_id: 'a', sleutel: 'order:a:basis:0', details: { bedrag: 100 } })],
    });
    const { nieuw } = berekenSynchronisatie(b, NU);
    expect(nieuw).toHaveLength(1);
    expect(nieuw[0]).toMatchObject({ punten: 50, soort: 'bij', sleutel: 'order:a:basis:1' });
  });
  it('order geannuleerd na boeking: punten teruggeboekt', () => {
    const b = bundel({
      orders: [order('a', 100, '2026-09-01T00:00:00Z', 'geannuleerd')],
      mutaties: [mutatie({ punten: 100, order_id: 'a', sleutel: 'order:a:basis:0', details: { bedrag: 100 } })],
    });
    const { nieuw } = berekenSynchronisatie(b, NU);
    expect(nieuw[0]).toMatchObject({ punten: -100, soort: 'af' });
  });
  it('eerste-orderbonus alleen bij de eerste order', () => {
    const b = bundel({
      regels: [regel({}), regel({ id: 'eo', soort: 'eerste_order', punten: 250, systeem: false })],
      orders: [order('a', 10, '2026-08-01T00:00:00Z'), order('b', 10, '2026-09-01T00:00:00Z')],
    });
    const bonus = berekenSynchronisatie(b, NU).nieuw.filter((m) => m.regel_soort === 'eerste_order');
    expect(bonus).toHaveLength(1);
    expect(bonus[0].order_id).toBe('a');
  });
  it('drempelbonus vanaf het drempelbedrag', () => {
    const b = bundel({
      regels: [regel({}), regel({ id: 'dr', soort: 'drempel_bonus', punten: 50, drempelEuro: 500, systeem: false })],
      orders: [order('a', 499, '2026-08-01T00:00:00Z'), order('b', 500, '2026-09-01T00:00:00Z')],
    });
    const bonus = berekenSynchronisatie(b, NU).nieuw.filter((m) => m.regel_soort === 'drempel_bonus');
    expect(bonus.map((m) => m.order_id)).toEqual(['b']);
  });
  it('niveaubonus: zonder afrondingsverlies bij factor 1,15', () => {
    const niveau = { ...STANDAARD_NIVEAUS[1], drempel: 0, puntenFactor: 1.15 };
    const b = bundel({ niveaus: [niveau], niveausSinds: '2026-01-01', orders: [order('a', 100, '2026-09-01T00:00:00Z')] });
    const bonus = berekenSynchronisatie(b, NU).nieuw.find((m) => m.regel_soort === 'niveau_bonus');
    expect(bonus?.punten).toBe(15);
  });
  it('jubileum: één boeking per volledig jaar klant', () => {
    const b = bundel({
      regels: [regel({}), regel({ id: 'jb', soort: 'jubileum', punten: 100, systeem: false })],
      orgs: [{ id: 'o1', naam: 'Klant', plaats: null, datum_klant: '2024-06-01' }],
      orders: [order('a', 10, '2024-06-02T00:00:00Z')],
    });
    const jub = berekenSynchronisatie(b, NU).nieuw.filter((m) => m.regel_soort === 'jubileum');
    expect(jub.map((m) => m.sleutel)).toEqual(['jubileum:jb:o1:2025', 'jubileum:jb:o1:2026']);
  });
});

describe('sparen: verval (oudste punten eerst)', () => {
  const inst = { actief: true, puntenPerEuro: 1, euroPerPunt: 0.01, vervalMaanden: 12, niveauBasis: 'omzet' as const, portaalAanvragen: true, meldingEmail: '', voorwaarden: '' };

  it('punten ouder dan de termijn vervallen, min wat al is gebruikt', () => {
    const b = bundel({
      instellingen: inst,
      mutaties: [
        mutatie({ id: 'lot1', punten: 100, datum: '2025-08-01T00:00:00Z', sleutel: 'x1' }),
        mutatie({ id: 'lot2', punten: 50, datum: '2026-09-01T00:00:00Z', sleutel: 'x2' }),
      ],
      inwisselingen: [{ id: 'i1', organisatie_id: 'o1', punten: 30, korting_euro: 0.3, omschrijving: null, created_at: '2026-01-01T00:00:00Z', status: 'verwerkt' }],
    });
    const verval = berekenSynchronisatie(b, NU).nieuw.filter((m) => m.soort === 'vervallen');
    expect(verval).toHaveLength(1);
    expect(verval[0]).toMatchObject({ punten: -70, sleutel: 'verval:lot1:0' });
    expect(verval[0].datum.slice(0, 10)).toBe('2026-08-01');
  });
  it('afgewezen inwisselingen tellen niet als gebruik', () => {
    const b = bundel({
      instellingen: inst,
      mutaties: [mutatie({ id: 'lot1', punten: 100, datum: '2025-08-01T00:00:00Z', sleutel: 'x1' })],
      inwisselingen: [{ id: 'i1', organisatie_id: 'o1', punten: 100, korting_euro: 1, omschrijving: null, created_at: '2026-01-01T00:00:00Z', status: 'afgewezen' }],
    });
    expect(berekenSynchronisatie(b, NU).nieuw.find((m) => m.soort === 'vervallen')?.punten).toBe(-100);
  });
  it('standen: saldo, euro-waarde en wat binnenkort vervalt', () => {
    const b = bundel({
      instellingen: inst,
      orders: [order('a', 1000, '2026-09-01T00:00:00Z')],
      mutaties: [
        mutatie({ id: 'lot1', punten: 200, datum: '2025-11-01T00:00:00Z' }),
        mutatie({ id: 'lot2', punten: 1000, datum: '2026-09-01T00:00:00Z' }),
      ],
      inwisselingen: [{ id: 'i1', organisatie_id: 'o1', punten: 100, korting_euro: 1, omschrijving: null, created_at: '2026-02-01T00:00:00Z', status: 'aangevraagd' }],
    });
    const [s] = berekenStanden(b, NU);
    expect(s.saldo).toBe(1100);
    expect(s.gereserveerd).toBe(100);
    expect(s.euroWaarde).toBe(11);
    expect(s.vervaltBinnenkort).toBe(100); // lot1 (200) min de inwisseling (100), vervalt 1 november
    expect(s.vervaltOp?.slice(0, 10)).toBe('2026-11-01');
    expect(s.omzet12m).toBe(1000);
  });
});
