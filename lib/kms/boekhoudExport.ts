import { kmsAdmin } from '@/lib/kms/adminClient';
import { factuurEmailVoor } from '@/lib/kms/factuurEmail';
import { factuurTotalen, getFactuur, type Factuurregel } from '@/lib/kms/facturen';
import { factuurNaarUbl, ublBestandsnaam, type UblKlant } from '@/lib/kms/ubl';
import { DataLaadFout, eisData, logDbFout } from '@/lib/dbFout';

/**
 * Export voor andere boekhoudpakketten en de accountant: UBL per factuur en
 * CSV per periode. Alleen definitieve facturen (niet concept). Server-side,
 * achter dashAuthed() en magEigenaar().
 */

type OrgRij = {
  id: string;
  naam: string;
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
  land: string | null;
  kvk: string | null;
  btw_nummer: string | null;
  klantnummer: string | null;
  factuur_email: string | null;
  email_algemeen: string | null;
};
const ORG_KOLOMMEN = 'id, naam, adres, postcode, plaats, land, kvk, btw_nummer, klantnummer, factuur_email, email_algemeen';

type FactuurRij = {
  id: string;
  factuurnummer: string | null;
  organisatie_id: string;
  order_id: string | null;
  factuurdatum: string | null;
  vervaldatum: string | null;
  status: string;
  betaaldatum: string | null;
  factuur_email: string | null;
  moneybird_factuur_id: string | null;
};

// ---------------------------------------------------------------------------
// UBL per factuur
// ---------------------------------------------------------------------------

export async function ublVoorFactuur(factuurId: string): Promise<{ ok: true; naam: string; xml: string } | { ok: false; melding: string; status: number }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, melding: 'De database is niet gekoppeld.', status: 503 };
  const f = await getFactuur(factuurId).catch(() => undefined);
  if (f === undefined) return { ok: false, melding: 'De factuur kon niet uit de database worden gelezen. Probeer het opnieuw.', status: 503 };
  if (!f) return { ok: false, melding: 'Factuur niet gevonden.', status: 404 };
  if (f.status === 'concept' || !f.factuurnummer) {
    return { ok: false, melding: 'Een conceptfactuur kun je niet als UBL downloaden. Maak hem eerst definitief.', status: 400 };
  }
  const { data } = await sb.from('organisaties').select(ORG_KOLOMMEN).eq('id', f.organisatie_id).maybeSingle();
  const org = data as OrgRij | null;
  const email = f.factuur_email || (await factuurEmailVoor(f.organisatie_id))?.email || null;
  let orderRef: string | null = null;
  if (f.order_id) {
    const { data: o } = await sb.from('orders').select('ordernummer').eq('id', f.order_id).maybeSingle();
    const nr = (o as { ordernummer: number | null } | null)?.ordernummer;
    if (nr != null) orderRef = String(nr);
  }
  const xml = factuurNaarUbl({
    factuurnummer: f.factuurnummer,
    factuurdatum: f.factuurdatum,
    vervaldatum: f.vervaldatum,
    regels: f.regels,
    klant: klantVoorUbl(org, email),
    orderReferentie: orderRef,
  });
  return { ok: true, naam: ublBestandsnaam(f.factuurnummer), xml };
}

function klantVoorUbl(org: OrgRij | null, email: string | null): UblKlant {
  return {
    naam: org?.naam ?? 'Onbekende klant',
    adres: org?.adres ?? null,
    postcode: org?.postcode ?? null,
    plaats: org?.plaats ?? null,
    land: org?.land ?? null,
    kvk: org?.kvk ?? null,
    btw_nummer: org?.btw_nummer ?? null,
    klantnummer: org?.klantnummer ?? null,
    email,
  };
}

// ---------------------------------------------------------------------------
// Periode
// ---------------------------------------------------------------------------

export type ExportFactuur = FactuurRij & { org: OrgRij | null; regels: Factuurregel[] };

/** Definitieve facturen met factuurdatum van `van` tot en met `tot` (JJJJ-MM-DD), met klant en regels. */
export async function facturenInPeriode(van: string, tot: string): Promise<ExportFactuur[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const facturen: FactuurRij[] = [];
  for (let start = 0; start < 50_000; start += 1000) {
    const { data, error } = await sb
      .from('facturen')
      .select('id, factuurnummer, organisatie_id, order_id, factuurdatum, vervaldatum, status, betaaldatum, factuur_email, moneybird_factuur_id')
      .neq('status', 'concept')
      .gte('factuurdatum', van)
      .lte('factuurdatum', tot)
      .order('factuurnummer', { ascending: true })
      .order('id')
      .range(start, start + 999);
    // Een fout mag geen stil onvolledige export voor de accountant opleveren.
    if (error) {
      logDbFout('export.facturen', error);
      throw new DataLaadFout('export.facturen', error.code ?? null);
    }
    const rijen = (data as FactuurRij[]) ?? [];
    facturen.push(...rijen);
    if (rijen.length < 1000) break;
  }
  if (!facturen.length) return [];

  const orgIds = [...new Set(facturen.map((f) => f.organisatie_id))];
  const orgs = new Map<string, OrgRij>();
  for (let i = 0; i < orgIds.length; i += 200) {
    const data = eisData('export.klanten', await sb.from('organisaties').select(ORG_KOLOMMEN).in('id', orgIds.slice(i, i + 200)));
    for (const o of (data as OrgRij[]) ?? []) orgs.set(o.id, o);
  }

  const regels = new Map<string, Factuurregel[]>();
  const ids = facturen.map((f) => f.id);
  for (let i = 0; i < ids.length; i += 200) {
    const blok = ids.slice(i, i + 200);
    for (let start = 0; start < 100_000; start += 1000) {
      const { data, error } = await sb
        .from('factuurregels')
        .select('*')
        .in('factuur_id', blok)
        .order('factuur_id')
        .order('positie', { ascending: true, nullsFirst: false })
        .order('id')
        .range(start, start + 999);
      if (error) {
        logDbFout('export.factuurregels', error);
        throw new DataLaadFout('export.factuurregels', error.code ?? null);
      }
      const rijen = (data as Factuurregel[]) ?? [];
      for (const r of rijen) {
        const lijst = regels.get(r.factuur_id) ?? [];
        lijst.push(r);
        regels.set(r.factuur_id, lijst);
      }
      if (rijen.length < 1000) break;
    }
  }

  return facturen.map((f) => ({ ...f, org: orgs.get(f.organisatie_id) ?? null, regels: regels.get(f.id) ?? [] }));
}

// ---------------------------------------------------------------------------
// CSV (Nederlandse Excel: puntkomma, decimale komma, UTF-8 met BOM)
// ---------------------------------------------------------------------------

function cel(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? (Math.round(v * 100) / 100).toFixed(2).replace('.', ',') : '';
  // Formule-injectie voorkomen: tekst die met = + - @ begint krijgt een apostrof.
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const nlDatum = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}` : '');
const pctTekst = (p: number) => String(p).replace('.', ',');
const STATUS: Record<string, string> = { concept: 'Concept', verzonden: 'Verzonden', betaald: 'Betaald' };

export function facturenNaarCsv(facturen: ExportFactuur[]): string {
  // Vaste kolommen voor 21%, 9% en 0%, plus eventuele andere tarieven die voorkomen.
  const tarieven = new Set<number>([21, 9, 0]);
  const totalen = new Map<string, ReturnType<typeof factuurTotalen>>();
  for (const f of facturen) {
    const t = factuurTotalen(f.regels);
    totalen.set(f.id, t);
    for (const p of t.perTarief) tarieven.add(p.pct);
  }
  const lijst = [...tarieven].sort((a, b) => b - a);

  const kop = [
    'Factuurnummer',
    'Factuurdatum',
    'Vervaldatum',
    'Klant',
    'Klantnummer',
    'KvK',
    'Btw-nummer',
    'Bedrag excl. btw',
    ...lijst.flatMap((p) => [`Omzet ${pctTekst(p)}%`, `Btw ${pctTekst(p)}%`]),
    'Btw totaal',
    'Totaal incl. btw',
    'Status',
    'Betaald op',
    'In Moneybird',
  ];
  const regels = [kop.map(cel).join(';')];
  const som = { excl: 0, btw: 0, incl: 0, per: new Map<number, { g: number; b: number }>() };

  for (const f of facturen) {
    const t = totalen.get(f.id)!;
    const per = new Map(t.perTarief.map((p) => [p.pct, p]));
    som.excl += t.excl;
    som.btw += t.btw;
    som.incl += t.incl;
    for (const p of t.perTarief) {
      const s = som.per.get(p.pct) ?? { g: 0, b: 0 };
      s.g += p.grondslag;
      s.b += p.btw;
      som.per.set(p.pct, s);
    }
    regels.push(
      [
        cel(f.factuurnummer ?? ''),
        cel(nlDatum(f.factuurdatum)),
        cel(nlDatum(f.vervaldatum)),
        cel(f.org?.naam ?? ''),
        cel(f.org?.klantnummer ?? ''),
        cel(f.org?.kvk ?? ''),
        cel(f.org?.btw_nummer ?? ''),
        cel(t.excl),
        ...lijst.flatMap((p) => {
          const x = per.get(p);
          return [cel(x ? x.grondslag : null), cel(x ? x.btw : null)];
        }),
        cel(t.btw),
        cel(t.incl),
        cel(STATUS[f.status] ?? f.status),
        cel(nlDatum(f.betaaldatum)),
        cel(f.moneybird_factuur_id ? 'ja' : 'nee'),
      ].join(';'),
    );
  }

  regels.push(
    [
      cel('Totaal'),
      '', '', cel(`${facturen.length} ${facturen.length === 1 ? "factuur" : "facturen"}`), '', '', '',
      cel(som.excl),
      ...lijst.flatMap((p) => {
        const s = som.per.get(p);
        return [cel(s ? s.g : null), cel(s ? s.b : null)];
      }),
      cel(som.btw),
      cel(som.incl),
      '', '', '',
    ].join(';'),
  );
  return '﻿' + regels.join('\r\n');
}

/** UBL-bestanden voor alle facturen in de lijst (voor de ZIP). */
export async function ublBestandenVoor(facturen: ExportFactuur[]): Promise<{ naam: string; inhoud: string }[]> {
  const uit: { naam: string; inhoud: string }[] = [];
  const sb = kmsAdmin();
  const orderIds = [...new Set(facturen.map((f) => f.order_id).filter((x): x is string => !!x))];
  const orderNrs = new Map<string, string>();
  if (sb && orderIds.length) {
    for (let i = 0; i < orderIds.length; i += 200) {
      const { data } = await sb.from('orders').select('id, ordernummer').in('id', orderIds.slice(i, i + 200));
      for (const o of (data as { id: string; ordernummer: number | null }[]) ?? []) {
        if (o.ordernummer != null) orderNrs.set(o.id, String(o.ordernummer));
      }
    }
  }
  const namen = new Set<string>();
  for (const f of facturen) {
    if (!f.factuurnummer) continue;
    let naam = ublBestandsnaam(f.factuurnummer);
    if (namen.has(naam)) naam = naam.replace(/\.xml$/, `-${f.id.slice(0, 8)}.xml`);
    namen.add(naam);
    uit.push({
      naam,
      inhoud: factuurNaarUbl({
        factuurnummer: f.factuurnummer,
        factuurdatum: f.factuurdatum,
        vervaldatum: f.vervaldatum,
        regels: f.regels,
        klant: klantVoorUbl(f.org, f.factuur_email || f.org?.factuur_email || f.org?.email_algemeen || null),
        orderReferentie: f.order_id ? orderNrs.get(f.order_id) ?? null : null,
      }),
    });
  }
  return uit;
}

/** Controleert een datum uit de URL (JJJJ-MM-DD). */
export function isIsoDatum(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}
