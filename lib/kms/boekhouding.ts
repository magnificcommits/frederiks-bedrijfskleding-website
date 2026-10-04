import type { SupabaseClient } from '@supabase/supabase-js';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { huidigeActor } from '@/lib/kms/audit';
import { factuurEmailVoor } from '@/lib/kms/factuurEmail';
import { btwTarief, getFactuur, regelBedrag, zetFactuurStatus, type FactuurDetail } from '@/lib/kms/facturen';
import {
  isMoneybirdGeconfigureerd,
  mbBtwTarieven,
  mbContact,
  mbMaakContact,
  mbMaakVerkoopfactuur,
  mbVerkoopfactuur,
  mbVerstuurVerkoopfactuur,
  mbZoekContacten,
  type MbBtwTarief,
  type MbContact,
  type MbVerkoopfactuur,
} from '@/lib/kms/moneybird';

/**
 * Koppeling KMS -> boekhouding (Moneybird). Alleen server-side, achter dashAuthed()
 * of de cron met CRON_SECRET. Elke poging komt in boekhouding_sync_log.
 *
 * Werkwijze bij doorzetten:
 *  1. klant opzoeken in Moneybird (opgeslagen id, dan KvK, e-mail, bedrijfsnaam) of aanmaken;
 *  2. verkoopfactuur aanmaken met de regels (prijs excl. btw, btw-tarief, grootboek);
 *     het KMS-factuurnummer gaat mee als referentie;
 *  3. afhankelijk van de instelling: concept laten, definitief maken zonder mail, of
 *     laten mailen door Moneybird.
 */

// ---------------------------------------------------------------------------
// Instellingen (sleutel/waarde-tabel `instellingen`)
// ---------------------------------------------------------------------------

export const NA_AANMAKEN = ['concept', 'definitief', 'email'] as const;
export type NaAanmaken = (typeof NA_AANMAKEN)[number];

export type BoekhoudInstellingen = {
  /** Moneybird ledger_account_id; leeg = de standaard omzetrekening van Moneybird. */
  grootboekId: string;
  /** Zet een factuur automatisch door zodra hij uit concept gaat. */
  autoDoorzetten: boolean;
  /** Wat Moneybird met de nieuwe factuur doet. */
  naAanmaken: NaAanmaken;
};

export const STANDAARD_BOEKHOUD_INSTELLINGEN: BoekhoudInstellingen = {
  grootboekId: '',
  autoDoorzetten: false,
  naAanmaken: 'definitief',
};

const SLEUTELS = {
  grootboekId: 'boekhouding_grootboek_id',
  autoDoorzetten: 'boekhouding_auto_doorzetten',
  naAanmaken: 'boekhouding_na_aanmaken',
} as const;

export async function getBoekhoudInstellingen(): Promise<BoekhoudInstellingen> {
  const sb = kmsAdmin();
  if (!sb) return STANDAARD_BOEKHOUD_INSTELLINGEN;
  const { data } = await sb.from('instellingen').select('sleutel, waarde').in('sleutel', Object.values(SLEUTELS));
  const map = new Map(((data as { sleutel: string; waarde: string | null }[]) ?? []).map((r) => [r.sleutel, r.waarde ?? '']));
  const na = map.get(SLEUTELS.naAanmaken) ?? '';
  return {
    grootboekId: (map.get(SLEUTELS.grootboekId) ?? '').trim(),
    autoDoorzetten: map.get(SLEUTELS.autoDoorzetten) === 'true',
    naAanmaken: (NA_AANMAKEN as readonly string[]).includes(na) ? (na as NaAanmaken) : STANDAARD_BOEKHOUD_INSTELLINGEN.naAanmaken,
  };
}

export async function zetBoekhoudInstellingen(v: Partial<BoekhoudInstellingen>): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;
  const rijen: { sleutel: string; waarde: string }[] = [];
  if (v.grootboekId !== undefined) rijen.push({ sleutel: SLEUTELS.grootboekId, waarde: v.grootboekId.replace(/\D/g, '') });
  if (v.autoDoorzetten !== undefined) rijen.push({ sleutel: SLEUTELS.autoDoorzetten, waarde: v.autoDoorzetten ? 'true' : 'false' });
  if (v.naAanmaken !== undefined) rijen.push({ sleutel: SLEUTELS.naAanmaken, waarde: v.naAanmaken });
  if (!rijen.length) return true;
  const nu = new Date().toISOString();
  const { error } = await sb.from('instellingen').upsert(rijen.map((r) => ({ ...r, bijgewerkt_op: nu })), { onConflict: 'sleutel' });
  return !error;
}

// ---------------------------------------------------------------------------
// Logboek
// ---------------------------------------------------------------------------

export type SyncLogRegel = {
  id: string;
  factuur_id: string | null;
  organisatie_id: string | null;
  actie: string;
  gelukt: boolean;
  melding: string | null;
  actor: string | null;
  created_at: string;
};

export const SYNC_ACTIE_LABEL: Record<string, string> = {
  contact: 'Klant',
  factuur: 'Factuur doorzetten',
  versturen: 'Definitief maken',
  status: 'Status ophalen',
  test: 'Verbinding testen',
};

async function log(
  sb: SupabaseClient,
  regel: { factuurId?: string | null; organisatieId?: string | null; actie: string; gelukt: boolean; melding?: string | null; details?: Record<string, unknown>; actor?: string },
): Promise<void> {
  try {
    await sb.from('boekhouding_sync_log').insert({
      factuur_id: regel.factuurId ?? null,
      organisatie_id: regel.organisatieId ?? null,
      pakket: 'moneybird',
      actie: regel.actie,
      gelukt: regel.gelukt,
      melding: regel.melding ?? null,
      details: regel.details ?? null,
      actor: regel.actor ?? (await huidigeActor()),
    });
  } catch {
    // Loggen mag de eigenlijke actie nooit laten mislukken.
  }
}

/** Openbare variant voor bv. de verbindingstest. */
export async function logBoekhoudPoging(regel: { actie: string; gelukt: boolean; melding?: string | null; details?: Record<string, unknown> }): Promise<void> {
  const sb = kmsAdmin();
  if (sb) await log(sb, regel);
}

export async function getSyncLog(opties: { factuurId?: string; limiet?: number } = {}): Promise<SyncLogRegel[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  let q = sb
    .from('boekhouding_sync_log')
    .select('id, factuur_id, organisatie_id, actie, gelukt, melding, actor, created_at')
    .order('created_at', { ascending: false })
    .limit(opties.limiet ?? 20);
  if (opties.factuurId) q = q.eq('factuur_id', opties.factuurId);
  const { data, error } = await q;
  if (error) return [];
  return (data as SyncLogRegel[]) ?? [];
}

// ---------------------------------------------------------------------------
// Boekhoudstatus van een factuur
// ---------------------------------------------------------------------------

export type BoekhoudVelden = {
  moneybird_factuur_id?: string | null;
  moneybird_status?: string | null;
  moneybird_gesynct_op?: string | null;
  moneybird_totaal?: number | string | null;
  boekhouding_fout?: string | null;
  boekhouding_status?: string | null;
};

export type BoekhoudWeergave = 'doorgezet' | 'niet' | 'fout' | 'bezig';

export function boekhoudWeergave(f: BoekhoudVelden): BoekhoudWeergave {
  if (f.moneybird_factuur_id && f.boekhouding_status !== 'fout') return 'doorgezet';
  if (f.boekhouding_status === 'fout') return 'fout';
  if (f.boekhouding_status === 'bezig') return 'bezig';
  return 'niet';
}

// ---------------------------------------------------------------------------
// Btw-tarieven
// ---------------------------------------------------------------------------

export type BtwKoppeling = Map<number, MbBtwTarief>;

/**
 * Koppelt de KMS-tarieven (21, 9, 0) aan de Moneybird-tarieven op percentage.
 * Bij 0% gaat een gewoon 0%-tarief voor "btw verlegd" of export buiten de EU.
 */
export function koppelBtwTarieven(tarieven: MbBtwTarief[]): BtwKoppeling {
  const uit: BtwKoppeling = new Map();
  const bijzonder = /verlegd|buiten|export|intra|icp|vrijgesteld/i;
  for (const t of tarieven) {
    const pct = Math.round(Number(t.percentage) * 100) / 100;
    if (!Number.isFinite(pct)) continue;
    const bestaand = uit.get(pct);
    if (!bestaand || (bijzonder.test(bestaand.name) && !bijzonder.test(t.name))) uit.set(pct, t);
  }
  return uit;
}

export async function btwKoppelingOphalen(): Promise<{ ok: true; koppeling: BtwKoppeling } | { ok: false; melding: string }> {
  const r = await mbBtwTarieven();
  if (!r.ok) return { ok: false, melding: r.melding };
  return { ok: true, koppeling: koppelBtwTarieven(r.data) };
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

type OrgVoorContact = {
  id: string;
  naam: string;
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
  land: string | null;
  telefoon: string | null;
  kvk: string | null;
  btw_nummer: string | null;
  klantnummer: string | null;
  email_algemeen: string | null;
  moneybird_contact_id: string | null;
};

const alleenCijfers = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');
const laag = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** Landnaam of -code naar ISO 3166-1 alpha-2, standaard NL. */
export function landCode(land: string | null | undefined): string {
  const l = laag(land);
  if (/^[a-z]{2}$/.test(l)) return l.toUpperCase();
  if (!l || l.includes('nederland') || l.includes('holland')) return 'NL';
  if (l.includes('belg')) return 'BE';
  if (l.includes('duits') || l.includes('germany') || l.includes('deutschland')) return 'DE';
  if (l.includes('luxem')) return 'LU';
  if (l.includes('frank') || l.includes('france')) return 'FR';
  return 'NL';
}

/**
 * Zoekt de klant op in Moneybird of maakt hem aan, en bewaart het id bij de klant.
 * Volgorde: opgeslagen id (als dat nog bestaat), KvK-nummer, e-mailadres, bedrijfsnaam.
 */
export async function synchroniseerContact(
  organisatieId: string,
  opties: { factuurId?: string | null; actor?: string } = {},
): Promise<{ ok: true; contactId: string; nieuw: boolean } | { ok: false; melding: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, melding: 'De database is niet gekoppeld.' };
  if (!isMoneybirdGeconfigureerd()) return { ok: false, melding: 'De koppeling met Moneybird staat nog niet aan.' };

  const { data, error } = await sb
    .from('organisaties')
    .select('id, naam, adres, postcode, plaats, land, telefoon, kvk, btw_nummer, klantnummer, email_algemeen, moneybird_contact_id')
    .eq('id', organisatieId)
    .maybeSingle();
  if (error || !data) return { ok: false, melding: 'Klant niet gevonden in het KMS.' };
  const org = data as OrgVoorContact;
  const factuurAdres = (await factuurEmailVoor(organisatieId))?.email ?? null;
  const logBasis = { factuurId: opties.factuurId ?? null, organisatieId, actie: 'contact', actor: opties.actor };

  const bewaar = async (contactId: string) => {
    if (org.moneybird_contact_id !== contactId) {
      await sb.from('organisaties').update({ moneybird_contact_id: contactId }).eq('id', organisatieId);
    }
  };

  // 1. Opgeslagen id: bestaat het contact nog?
  if (org.moneybird_contact_id) {
    const r = await mbContact(org.moneybird_contact_id);
    if (r.ok) return { ok: true, contactId: String(r.data.id), nieuw: false };
    if (r.status !== 404) {
      await log(sb, { ...logBasis, gelukt: false, melding: r.melding });
      return { ok: false, melding: r.melding };
    }
    // 404: contact is in Moneybird verwijderd; opnieuw zoeken.
  }

  // 2-4. Zoeken op KvK, e-mail en bedrijfsnaam.
  const kvk = alleenCijfers(org.kvk);
  const mails = [factuurAdres, org.email_algemeen].map(laag).filter(Boolean);
  const pogingen: { term: string; past: (c: MbContact) => boolean; hoe: string }[] = [];
  if (kvk.length >= 8) pogingen.push({ term: kvk, past: (c) => alleenCijfers(c.chamber_of_commerce) === kvk, hoe: 'KvK-nummer' });
  for (const m of mails) pogingen.push({ term: m, past: (c) => laag(c.email) === m || laag(c.send_invoices_to_email) === m, hoe: 'e-mailadres' });
  if (org.naam.trim()) pogingen.push({ term: org.naam.trim(), past: (c) => laag(c.company_name) === laag(org.naam), hoe: 'bedrijfsnaam' });

  for (const p of pogingen) {
    const r = await mbZoekContacten(p.term);
    if (!r.ok) {
      await log(sb, { ...logBasis, gelukt: false, melding: r.melding });
      return { ok: false, melding: r.melding };
    }
    const gevonden = (r.data ?? []).find(p.past);
    if (gevonden) {
      const id = String(gevonden.id);
      await bewaar(id);
      await log(sb, { ...logBasis, gelukt: true, melding: `Bestaande klant in Moneybird gevonden op ${p.hoe}.`, details: { contactId: id } });
      return { ok: true, contactId: id, nieuw: false };
    }
  }

  // 5. Aanmaken.
  const contact: Record<string, unknown> = {
    company_name: org.naam.trim(),
    address1: org.adres?.trim() || undefined,
    zipcode: org.postcode?.trim() || undefined,
    city: org.plaats?.trim() || undefined,
    country: landCode(org.land),
    phone: org.telefoon?.trim() || undefined,
    chamber_of_commerce: kvk || undefined,
    tax_number: org.btw_nummer?.replace(/\s/g, '') || undefined,
    email: org.email_algemeen?.trim() || undefined,
    send_invoices_to_email: factuurAdres || undefined,
    customer_id: org.klantnummer?.trim() || undefined,
  };
  let r = await mbMaakContact(contact);
  // Klantnummer is in Moneybird al in gebruik: dan zonder, Moneybird kiest er zelf een.
  if (!r.ok && r.status === 422 && contact.customer_id && /customer_id|klantnummer/i.test(r.melding)) {
    delete contact.customer_id;
    r = await mbMaakContact(contact);
  }
  if (!r.ok) {
    await log(sb, { ...logBasis, gelukt: false, melding: `Klant aanmaken in Moneybird mislukt. ${r.melding}` });
    return { ok: false, melding: `Klant aanmaken in Moneybird mislukt. ${r.melding}` };
  }
  const id = String(r.data.id);
  await bewaar(id);
  await log(sb, { ...logBasis, gelukt: true, melding: 'Nieuwe klant aangemaakt in Moneybird.', details: { contactId: id } });
  return { ok: true, contactId: id, nieuw: true };
}

// ---------------------------------------------------------------------------
// Factuur doorzetten
// ---------------------------------------------------------------------------

const r2 = (n: number) => Math.round(n * 100) / 100;
const bedragTekst = (n: number) => n.toFixed(2);
const aantalTekst = (n: number) => String(Math.round(n * 1000) / 1000);

/** Factuurregels in het formaat van Moneybird. Totalen blijven gelijk aan het KMS. */
export function moneybirdRegels(
  f: FactuurDetail,
  btw: BtwKoppeling,
  grootboekId: string,
): { ok: true; regels: Record<string, unknown>[] } | { ok: false; melding: string } {
  const ontbrekend = new Set<number>();
  const regels = f.regels.map((r, i) => {
    const pct = Math.round(btwTarief(r.btw_pct) * 100) / 100;
    const tarief = btw.get(pct);
    if (!tarief) ontbrekend.add(pct);
    const aantal = Number(r.aantal) || 0;
    const kort = Math.min(100, Math.max(0, Number(r.korting_pct) || 0));
    const netto = regelBedrag(r);
    let omschrijving = (r.omschrijving || 'Regel').trim();
    let prijs = r2((Number(r.stukprijs) || 0) * (1 - kort / 100));
    let hoeveel = aantal;
    if (kort > 0) omschrijving += ` (incl. ${String(kort).replace('.', ',')}% korting)`;
    // Moneybird kent geen regelkorting. Komt aantal x nettoprijs door afronding niet
    // precies uit op het regelbedrag, dan als één regel met het exacte bedrag.
    if (r2(prijs * aantal) !== netto) {
      omschrijving = `${aantalTekst(aantal).replace('.', ',')} x ${omschrijving}`;
      prijs = netto;
      hoeveel = 1;
    }
    const regel: Record<string, unknown> = {
      description: omschrijving,
      amount: aantalTekst(hoeveel),
      price: bedragTekst(prijs),
      row_order: i + 1,
    };
    if (tarief) regel.tax_rate_id = String(tarief.id);
    if (grootboekId) regel.ledger_account_id = grootboekId;
    return regel;
  });
  if (ontbrekend.size) {
    const lijst = [...ontbrekend].map((p) => `${String(p).replace('.', ',')}%`).join(', ');
    return { ok: false, melding: `Moneybird heeft geen actief btw-tarief voor ${lijst} bij verkoopfacturen. Zet dat tarief in Moneybird aan (Instellingen > Btw-tarieven).` };
  }
  return { ok: true, regels };
}

export type DoorzetResultaat = { ok: true; moneybirdId: string; melding: string } | { ok: false; melding: string };

async function markeerFout(sb: SupabaseClient, factuurId: string, melding: string) {
  await sb
    .from('facturen')
    .update({ boekhouding_status: 'fout', boekhouding_fout: melding.slice(0, 1000), moneybird_gesynct_op: new Date().toISOString() })
    .eq('id', factuurId);
}

/**
 * Zet één definitieve KMS-factuur door naar Moneybird. Een factuur die al in
 * Moneybird staat wordt nooit nog een keer aangemaakt.
 */
export async function zetFactuurDoor(factuurId: string, opties: { actor?: string; btw?: BtwKoppeling; instellingen?: BoekhoudInstellingen } = {}): Promise<DoorzetResultaat> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, melding: 'De database is niet gekoppeld.' };
  if (!isMoneybirdGeconfigureerd()) {
    return { ok: false, melding: 'De koppeling met Moneybird staat nog niet aan. Zie Instellingen > Boekhouding.' };
  }
  const actor = opties.actor ?? (await huidigeActor());

  // getFactuur gooit bij een databasefout (liever dan een factuur zonder regels doorzetten);
  // hier vangen we dat af zodat een batch of de nachtelijke run doorloopt met de volgende.
  const f = await getFactuur(factuurId).catch(() => undefined);
  if (f === undefined) return { ok: false, melding: 'De factuur kon niet uit de database worden gelezen. Probeer het opnieuw.' };
  if (!f) return { ok: false, melding: 'Factuur niet gevonden.' };
  if (f.moneybird_factuur_id) return { ok: false, melding: 'Deze factuur staat al in Moneybird.' };
  if (f.status === 'concept') return { ok: false, melding: 'Een conceptfactuur zet je niet door. Maak hem eerst definitief (Verzonden).' };
  if (!f.factuurnummer) return { ok: false, melding: 'Deze factuur heeft nog geen factuurnummer.' };
  if (f.regels.length === 0) return { ok: false, melding: 'Deze factuur heeft geen regels.' };

  // Slot: voorkomt dat twee klikken (of klik plus cron) dezelfde factuur twee keer aanmaken.
  // Een slot ouder dan 5 minuten telt niet meer (bv. na een time-out).
  const vijfMinGeleden = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: slot } = await sb
    .from('facturen')
    .update({ boekhouding_status: 'bezig', moneybird_gesynct_op: new Date().toISOString() })
    .eq('id', factuurId)
    .is('moneybird_factuur_id', null)
    .or(`boekhouding_status.is.null,boekhouding_status.eq.fout,moneybird_gesynct_op.lt."${vijfMinGeleden}"`)
    .select('id');
  if (!slot || (slot as unknown[]).length === 0) {
    return { ok: false, melding: 'Deze factuur wordt op dit moment al doorgezet. Wacht even en ververs de pagina.' };
  }

  const fout = async (melding: string, actie = 'factuur'): Promise<DoorzetResultaat> => {
    await markeerFout(sb, factuurId, melding);
    await log(sb, { factuurId, organisatieId: f.organisatie_id, actie, gelukt: false, melding, actor });
    return { ok: false, melding };
  };

  const instellingen = opties.instellingen ?? (await getBoekhoudInstellingen());
  let btw = opties.btw;
  if (!btw) {
    const b = await btwKoppelingOphalen();
    if (!b.ok) return fout(`Btw-tarieven ophalen mislukt. ${b.melding}`);
    btw = b.koppeling;
  }
  const regels = moneybirdRegels(f, btw, instellingen.grootboekId);
  if (!regels.ok) return fout(regels.melding);

  const contact = await synchroniseerContact(f.organisatie_id, { factuurId, actor });
  if (!contact.ok) {
    await markeerFout(sb, factuurId, contact.melding);
    return { ok: false, melding: contact.melding };
  }

  const r = await mbMaakVerkoopfactuur({
    contact_id: contact.contactId,
    reference: f.factuurnummer,
    invoice_date: f.factuurdatum ?? undefined,
    prices_are_incl_tax: false,
    details_attributes: regels.regels,
  });
  if (!r.ok) return fout(`Factuur aanmaken in Moneybird mislukt. ${r.melding}`);
  const mb = r.data;
  const mbId = String(mb.id);

  // Meteen het id bewaren, zodat een fout bij het definitief maken nooit tot een dubbele factuur leidt.
  const nu = new Date().toISOString();
  await sb
    .from('facturen')
    .update({
      moneybird_factuur_id: mbId,
      moneybird_status: mb.state ?? 'draft',
      moneybird_totaal: mb.total_price_incl_tax != null ? Number(mb.total_price_incl_tax) : null,
      moneybird_gesynct_op: nu,
      boekhouding_status: 'doorgezet',
      boekhouding_fout: null,
    })
    .eq('id', factuurId);
  await log(sb, {
    factuurId,
    organisatieId: f.organisatie_id,
    actie: 'factuur',
    gelukt: true,
    melding: `Aangemaakt in Moneybird als concept met referentie ${f.factuurnummer}.`,
    details: { moneybirdId: mbId, totaal: mb.total_price_incl_tax ?? null },
    actor,
  });

  let melding = 'Factuur staat als concept in Moneybird.';
  if (instellingen.naAanmaken !== 'concept') {
    const manier = instellingen.naAanmaken === 'email' ? 'Email' : 'Manual';
    const s = await mbVerstuurVerkoopfactuur(mbId, manier);
    if (!s.ok) {
      const m = `De factuur staat in Moneybird, maar definitief maken lukte niet: ${s.melding} Maak hem in Moneybird zelf definitief.`;
      await sb.from('facturen').update({ boekhouding_fout: m.slice(0, 1000) }).eq('id', factuurId);
      await log(sb, { factuurId, organisatieId: f.organisatie_id, actie: 'versturen', gelukt: false, melding: m, actor });
      return { ok: true, moneybirdId: mbId, melding: m };
    }
    await sb
      .from('facturen')
      .update({
        moneybird_status: s.data.state ?? 'open',
        moneybird_totaal: s.data.total_price_incl_tax != null ? Number(s.data.total_price_incl_tax) : null,
        moneybird_gesynct_op: new Date().toISOString(),
      })
      .eq('id', factuurId);
    melding = manier === 'Email'
      ? `Factuur staat in Moneybird en is door Moneybird gemaild${s.data.invoice_id ? ` (Moneybird-nummer ${s.data.invoice_id})` : ''}.`
      : `Factuur staat definitief in Moneybird${s.data.invoice_id ? ` als ${s.data.invoice_id}` : ''}, zonder mail aan de klant.`;
    await log(sb, { factuurId, organisatieId: f.organisatie_id, actie: 'versturen', gelukt: true, melding, details: { invoiceId: s.data.invoice_id ?? null, manier }, actor });
  }
  return { ok: true, moneybirdId: mbId, melding };
}

/** Meerdere facturen achter elkaar (rustig, vanwege de limiet van Moneybird). */
export async function zetFacturenDoor(ids: string[], opties: { actor?: string } = {}): Promise<{ gelukt: number; mislukt: number; meldingen: string[] }> {
  const uit = { gelukt: 0, mislukt: 0, meldingen: [] as string[] };
  if (!ids.length) return uit;
  const instellingen = await getBoekhoudInstellingen();
  const b = await btwKoppelingOphalen();
  if (!b.ok) return { gelukt: 0, mislukt: ids.length, meldingen: [`Btw-tarieven ophalen mislukt. ${b.melding}`] };
  for (const id of ids) {
    const r = await zetFactuurDoor(id, { actor: opties.actor, btw: b.koppeling, instellingen });
    if (r.ok) uit.gelukt++;
    else {
      uit.mislukt++;
      if (uit.meldingen.length < 3 && !uit.meldingen.includes(r.melding)) uit.meldingen.push(r.melding);
    }
  }
  return uit;
}

/**
 * Wordt aangeroepen nadat een factuur uit concept is gehaald. Doet alleen iets
 * als automatisch doorzetten aan staat en de koppeling werkt; faalt stil (de
 * fout staat dan bij de factuur en in het logboek).
 */
export async function naDefinitiefMaken(factuurId: string, statusVoor: string | null | undefined): Promise<void> {
  try {
    if (statusVoor !== 'concept' || !isMoneybirdGeconfigureerd()) return;
    const inst = await getBoekhoudInstellingen();
    if (!inst.autoDoorzetten) return;
    await zetFactuurDoor(factuurId, { instellingen: inst });
  } catch {
    // Bewust stil: de statuswijziging zelf is al gelukt.
  }
}

// ---------------------------------------------------------------------------
// Betaalstatus terughalen
// ---------------------------------------------------------------------------

export type StatusResultaat = { ok: true; betaald: boolean; state: string; melding: string } | { ok: false; melding: string };

function verwerkState(mb: MbVerkoopfactuur): { betaald: boolean; betaaldOp: string | null } {
  const betaald = mb.state === 'paid';
  const betaaldOp = mb.paid_at && /^\d{4}-\d{2}-\d{2}/.test(mb.paid_at) ? mb.paid_at.slice(0, 10) : null;
  return { betaald, betaaldOp };
}

/** Haalt de status van één doorgezette factuur op en zet hem in het KMS op betaald als Moneybird dat zegt. */
export async function haalStatusOp(factuurId: string, opties: { actor?: string; stilBijGeenWijziging?: boolean } = {}): Promise<StatusResultaat> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, melding: 'De database is niet gekoppeld.' };
  if (!isMoneybirdGeconfigureerd()) return { ok: false, melding: 'De koppeling met Moneybird staat nog niet aan.' };
  const { data } = await sb
    .from('facturen')
    .select('id, organisatie_id, status, moneybird_factuur_id, moneybird_status')
    .eq('id', factuurId)
    .maybeSingle();
  const f = data as { id: string; organisatie_id: string; status: string; moneybird_factuur_id: string | null; moneybird_status: string | null } | null;
  if (!f) return { ok: false, melding: 'Factuur niet gevonden.' };
  if (!f.moneybird_factuur_id) return { ok: false, melding: 'Deze factuur staat nog niet in Moneybird.' };
  const actor = opties.actor ?? (await huidigeActor());

  const r = await mbVerkoopfactuur(f.moneybird_factuur_id);
  if (!r.ok) {
    const melding = r.status === 404
      ? 'Deze factuur bestaat niet meer in Moneybird. Is hij daar verwijderd?'
      : r.melding;
    await sb.from('facturen').update({ boekhouding_fout: melding.slice(0, 1000), moneybird_gesynct_op: new Date().toISOString() }).eq('id', factuurId);
    await log(sb, { factuurId, organisatieId: f.organisatie_id, actie: 'status', gelukt: false, melding, actor });
    return { ok: false, melding };
  }
  const mb = r.data;
  const { betaald, betaaldOp } = verwerkState(mb);
  await sb
    .from('facturen')
    .update({
      moneybird_status: mb.state,
      moneybird_totaal: mb.total_price_incl_tax != null ? Number(mb.total_price_incl_tax) : null,
      moneybird_gesynct_op: new Date().toISOString(),
      boekhouding_fout: null,
      boekhouding_status: 'doorgezet',
    })
    .eq('id', factuurId);

  let melding = `Status in Moneybird: ${mb.state}.`;
  let gewijzigd = mb.state !== f.moneybird_status;
  if (betaald && f.status !== 'betaald') {
    await zetFactuurStatus(factuurId, 'betaald', betaaldOp);
    melding = `Betaald volgens Moneybird${betaaldOp ? ` op ${betaaldOp.split('-').reverse().join('-')}` : ''}. In het KMS op Betaald gezet.`;
    gewijzigd = true;
  }
  if (gewijzigd || !opties.stilBijGeenWijziging) {
    await log(sb, { factuurId, organisatieId: f.organisatie_id, actie: 'status', gelukt: true, melding, details: { state: mb.state, paid_at: mb.paid_at ?? null }, actor });
  }
  return { ok: true, betaald, state: mb.state, melding };
}

/**
 * Voor de dagelijkse cron: werkt openstaande doorgezette facturen bij, en
 * probeert mislukte facturen opnieuw als automatisch doorzetten aan staat.
 */
export async function werkBoekhoudingBij(tijdBudgetMs = 50_000): Promise<{ bekeken: number; betaald: number; fouten: number; opnieuwGeprobeerd: number; opnieuwGelukt: number; overgeslagen?: string }> {
  const uit = { bekeken: 0, betaald: 0, fouten: 0, opnieuwGeprobeerd: 0, opnieuwGelukt: 0 };
  const sb = kmsAdmin();
  if (!sb) return { ...uit, overgeslagen: 'database niet gekoppeld' };
  if (!isMoneybirdGeconfigureerd()) return { ...uit, overgeslagen: 'Moneybird niet ingesteld' };
  const start = Date.now();
  const actor = 'cron';

  // Oudste controle eerst; maximaal 100 per keer (Moneybird staat 150 verzoeken per 5 minuten toe).
  const { data } = await sb
    .from('facturen')
    .select('id')
    .not('moneybird_factuur_id', 'is', null)
    .neq('status', 'betaald')
    .order('moneybird_gesynct_op', { ascending: true, nullsFirst: true })
    .limit(100);
  for (const f of (data as { id: string }[]) ?? []) {
    if (Date.now() - start > tijdBudgetMs) break;
    uit.bekeken++;
    const r = await haalStatusOp(f.id, { actor, stilBijGeenWijziging: true });
    if (!r.ok) uit.fouten++;
    else if (r.betaald) uit.betaald++;
  }

  const inst = await getBoekhoudInstellingen();
  if (inst.autoDoorzetten && Date.now() - start < tijdBudgetMs) {
    const { data: mislukt } = await sb
      .from('facturen')
      .select('id')
      .eq('boekhouding_status', 'fout')
      .is('moneybird_factuur_id', null)
      .neq('status', 'concept')
      .order('moneybird_gesynct_op', { ascending: true })
      .limit(20);
    const ids = ((mislukt as { id: string }[]) ?? []).map((m) => m.id);
    if (ids.length) {
      const b = await btwKoppelingOphalen();
      if (b.ok) {
        for (const id of ids) {
          if (Date.now() - start > tijdBudgetMs) break;
          uit.opnieuwGeprobeerd++;
          const r = await zetFactuurDoor(id, { actor, btw: b.koppeling, instellingen: inst });
          if (r.ok) uit.opnieuwGelukt++;
        }
      }
    }
  }
  return uit;
}
