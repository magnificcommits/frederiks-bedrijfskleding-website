import { kmsAdmin } from '@/lib/kms/adminClient';
import { kolomOntbreekt } from '@/lib/kms/kolomTerugval';
import type { Doelgroep } from '@/lib/campagnes/flow';

/**
 * Ontvangers voor campagnes: prospects, leads en klanten (organisaties) in één
 * vorm. Alleen server-side gebruiken, altijd achter dashAuthed() of de cron.
 */

export type Contact = {
  soort: Doelgroep;
  id: string;
  email: string | null;
  naam: string | null;
  bedrijfsnaam: string | null;
  plaats: string | null;
  branche: string | null;
  status: string | null;
  bron: string | null;
  /** Prospect: token voor de kennismakingspagina /k/<token>. */
  token: string | null;
  aantalScans: number;
  laatsteScanOp: string | null;
  /** Lead: gekoppelde klant. Klant: eigen id. */
  organisatieId: string | null;
};

export type ContactFilters = {
  status?: string;
  branche?: string;
  plaats?: string;
  bron?: string;
  q?: string;
};

export const contactSleutel = (soort: Doelgroep, id: string) => `${soort}:${id}`;

export function schoonEmail(e: string | null | undefined): string {
  return String(e ?? '').trim().toLowerCase();
}

function geldigEmail(e: string | null | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(schoonEmail(e));
}

function ilikePatroon(w: string): string {
  return `%${w.replace(/[\\%_,()]/g, (t) => `\\${t}`)}%`;
}

type ProspectRij = {
  id: string;
  bedrijfsnaam: string | null;
  contactpersoon: string | null;
  email: string | null;
  plaats: string | null;
  branche: string | null;
  status: string | null;
  bron: string | null;
  token: string | null;
  aantal_scans: number | null;
  laatste_scan_op: string | null;
};
type LeadRij = {
  id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  branche: string | null;
  bron: string | null;
  status: string | null;
  organisatie_id: string | null;
};
type OrgRij = {
  id: string;
  naam: string | null;
  plaats: string | null;
  branche: string | null;
  actief: boolean | null;
  contactpersoon: string | null;
  email_algemeen: string | null;
};

const PROSPECT_KOLOMMEN = 'id, bedrijfsnaam, contactpersoon, email, plaats, branche, status, bron, token, aantal_scans, laatste_scan_op';
const LEAD_KOLOMMEN = 'id, name, company, email, branche, bron, status, organisatie_id';
const ORG_KOLOMMEN = 'id, naam, plaats, branche, actief, contactpersoon, email_algemeen';

function vanProspect(p: ProspectRij): Contact {
  return {
    soort: 'prospect',
    id: p.id,
    email: p.email,
    naam: p.contactpersoon,
    bedrijfsnaam: p.bedrijfsnaam,
    plaats: p.plaats,
    branche: p.branche,
    status: p.status,
    bron: p.bron,
    token: p.token,
    aantalScans: Number(p.aantal_scans) || 0,
    laatsteScanOp: p.laatste_scan_op,
    organisatieId: null,
  };
}

function vanLead(l: LeadRij): Contact {
  return {
    soort: 'lead',
    id: l.id,
    email: l.email,
    naam: l.name,
    bedrijfsnaam: l.company,
    plaats: null,
    branche: l.branche,
    status: l.status,
    bron: l.bron,
    token: null,
    aantalScans: 0,
    laatsteScanOp: null,
    organisatieId: l.organisatie_id,
  };
}

/** Klanten: e-mail van het hoofdcontact, anders een ander contact, anders het algemene adres. */
async function vanOrganisaties(orgs: OrgRij[]): Promise<Contact[]> {
  const sb = kmsAdmin();
  if (!sb || !orgs.length) return [];
  const ids = orgs.map((o) => o.id);
  const contacten = new Map<string, { naam: string | null; email: string | null; hoofd: boolean }>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await sb
      .from('contactpersonen')
      .select('organisatie_id, naam, email, hoofdcontact')
      .in('organisatie_id', ids.slice(i, i + 300))
      .not('email', 'is', null);
    for (const c of (data as { organisatie_id: string; naam: string | null; email: string | null; hoofdcontact: boolean | null }[]) ?? []) {
      if (!geldigEmail(c.email)) continue;
      const bestaand = contacten.get(c.organisatie_id);
      if (!bestaand || (!bestaand.hoofd && c.hoofdcontact)) contacten.set(c.organisatie_id, { naam: c.naam, email: c.email, hoofd: Boolean(c.hoofdcontact) });
    }
  }
  return orgs.map((o) => {
    const c = contacten.get(o.id);
    return {
      soort: 'klant' as const,
      id: o.id,
      email: c?.email ?? o.email_algemeen,
      naam: c?.naam ?? o.contactpersoon,
      bedrijfsnaam: o.naam,
      plaats: o.plaats,
      branche: o.branche,
      status: o.actief === false ? 'inactief' : 'actief',
      bron: null,
      token: null,
      aantalScans: 0,
      laatsteScanOp: null,
      organisatieId: o.id,
    };
  });
}

/**
 * Kandidaten voor handmatig inschrijven, met filters. Alleen contacten met een
 * geldig e-mailadres. Afgemelde prospects en klant-prospects vallen eruit.
 */
export async function zoekKandidaten(doelgroep: Doelgroep, f: ContactFilters, limiet = 2000): Promise<Contact[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const q = (f.q ?? '').trim();

  if (doelgroep === 'prospect') {
    let query = sb.from('prospecten').select(PROSPECT_KOLOMMEN).not('email', 'is', null).neq('status', 'afgemeld').limit(limiet);
    if (f.status) query = query.eq('status', f.status);
    else query = query.neq('status', 'klant');
    if (f.branche) query = query.ilike('branche', ilikePatroon(f.branche));
    if (f.plaats) query = query.ilike('plaats', ilikePatroon(f.plaats));
    if (f.bron) query = query.ilike('bron', ilikePatroon(f.bron));
    if (q) query = query.or(`bedrijfsnaam.ilike.${ilikePatroon(q)},email.ilike.${ilikePatroon(q)},contactpersoon.ilike.${ilikePatroon(q)}`);
    const { data } = await query;
    return ((data as ProspectRij[]) ?? []).map(vanProspect).filter((c) => geldigEmail(c.email));
  }

  if (doelgroep === 'lead') {
    let query = sb.from('leads').select(LEAD_KOLOMMEN).order('created_at', { ascending: false }).limit(limiet);
    if (f.status) query = query.eq('status', f.status);
    if (f.branche) query = query.ilike('branche', ilikePatroon(f.branche));
    if (f.bron) query = query.ilike('bron', ilikePatroon(f.bron));
    if (q) query = query.or(`name.ilike.${ilikePatroon(q)},company.ilike.${ilikePatroon(q)},email.ilike.${ilikePatroon(q)}`);
    const { data } = await query;
    return ((data as LeadRij[]) ?? []).map(vanLead).filter((c) => geldigEmail(c.email));
  }

  let query = sb.from('organisaties').select(ORG_KOLOMMEN).order('naam').limit(limiet);
  if (f.status === 'inactief') query = query.eq('actief', false);
  else query = query.eq('actief', true);
  if (f.branche) query = query.ilike('branche', ilikePatroon(f.branche));
  if (f.plaats) query = query.ilike('plaats', ilikePatroon(f.plaats));
  if (q) query = query.ilike('naam', ilikePatroon(q));
  const { data } = await query;
  const klanten = await vanOrganisaties((data as OrgRij[]) ?? []);
  return klanten.filter((c) => geldigEmail(c.email));
}

/** Contacten op id ophalen (voor de verzendmotor en de ontvangerslijst). */
export async function laadContacten(refs: { prospectIds?: string[]; leadIds?: string[]; orgIds?: string[] }): Promise<Map<string, Contact>> {
  const sb = kmsAdmin();
  const uit = new Map<string, Contact>();
  if (!sb) return uit;
  const blokken = (ids: string[] = []) => {
    const u = Array.from(new Set(ids.filter(Boolean)));
    const r: string[][] = [];
    for (let i = 0; i < u.length; i += 300) r.push(u.slice(i, i + 300));
    return r;
  };
  for (const deel of blokken(refs.prospectIds)) {
    const { data } = await sb.from('prospecten').select(PROSPECT_KOLOMMEN).in('id', deel);
    for (const p of (data as ProspectRij[]) ?? []) uit.set(contactSleutel('prospect', p.id), vanProspect(p));
  }
  for (const deel of blokken(refs.leadIds)) {
    const { data } = await sb.from('leads').select(LEAD_KOLOMMEN).in('id', deel);
    for (const l of (data as LeadRij[]) ?? []) uit.set(contactSleutel('lead', l.id), vanLead(l));
  }
  for (const deel of blokken(refs.orgIds)) {
    const { data } = await sb.from('organisaties').select(ORG_KOLOMMEN).in('id', deel);
    for (const k of await vanOrganisaties((data as OrgRij[]) ?? [])) uit.set(contactSleutel('klant', k.id), k);
  }
  return uit;
}

/** Welke van deze adressen staan op de afmeldlijst? */
export async function afgemeldeAdressen(emails: string[]): Promise<Set<string>> {
  const sb = kmsAdmin();
  const uit = new Set<string>();
  if (!sb) return uit;
  const lijst = Array.from(new Set(emails.map(schoonEmail).filter(Boolean)));
  for (let i = 0; i < lijst.length; i += 300) {
    const { data } = await sb.from('afmeldingen').select('email').in('email', lijst.slice(i, i + 300));
    for (const r of (data as { email: string }[]) ?? []) uit.add(schoonEmail(r.email));
  }
  // Oudere rijen kunnen hoofdletters hebben: vergelijk ook hoofdletterongevoelig.
  if (lijst.length && lijst.length <= 50) {
    for (const e of lijst) {
      if (uit.has(e)) continue;
      const { data } = await sb.from('afmeldingen').select('email').ilike('email', e.replace(/[\\%_]/g, (t) => `\\${t}`)).limit(1);
      if (data && data.length) uit.add(e);
    }
  }
  return uit;
}

export type InschrijfResultaat = { nieuw: number; alIngeschreven: number; afgemeld: number; heropend: number; fout?: string };

type BestaandeInschrijving = { id: string; prospect_id: string | null; lead_id?: string | null; organisatie_id?: string | null; status: string; created_at: string };

/**
 * Schrijft contacten in op een campagne. Afgemelde adressen worden overgeslagen,
 * net als contacten die er al in zitten. Met `herhaalNaDagen` gaat iemand die de
 * campagne al heeft doorlopen er opnieuw in, als de vorige keer lang genoeg
 * geleden is (jubileum, review na een volgende levering).
 */
export async function schrijfContactenIn(
  campagneId: string,
  contacten: Contact[],
  opties: { bron: 'handmatig' | 'trigger'; herhaalNaDagen?: number | null } = { bron: 'handmatig' },
): Promise<InschrijfResultaat> {
  const sb = kmsAdmin();
  const res: InschrijfResultaat = { nieuw: 0, alIngeschreven: 0, afgemeld: 0, heropend: 0 };
  if (!sb || !contacten.length) return res;

  const afgemeld = await afgemeldeAdressen(contacten.map((c) => c.email ?? ''));
  const teDoen = contacten.filter((c) => {
    if (afgemeld.has(schoonEmail(c.email)) || (c.soort === 'prospect' && c.status === 'afgemeld')) {
      res.afgemeld++;
      return false;
    }
    return true;
  });
  if (!teDoen.length) return res;

  // Bestaande inschrijvingen ophalen (met terugval als lead_id/organisatie_id nog niet bestaan).
  let nieuwModel = true;
  let bestaande: BestaandeInschrijving[] = [];
  {
    const { data, error } = await sb.from('campagne_inschrijvingen').select('id, prospect_id, lead_id, organisatie_id, status, created_at').eq('campagne_id', campagneId);
    if (error && kolomOntbreekt(error)) {
      nieuwModel = false;
      const oud = await sb.from('campagne_inschrijvingen').select('id, prospect_id, status, created_at').eq('campagne_id', campagneId);
      bestaande = (oud.data as BestaandeInschrijving[]) ?? [];
    } else {
      bestaande = (data as BestaandeInschrijving[]) ?? [];
    }
  }
  const perSleutel = new Map<string, BestaandeInschrijving>();
  for (const b of bestaande) {
    if (b.prospect_id) perSleutel.set(contactSleutel('prospect', b.prospect_id), b);
    if (b.lead_id) perSleutel.set(contactSleutel('lead', b.lead_id), b);
    if (b.organisatie_id) perSleutel.set(contactSleutel('klant', b.organisatie_id), b);
  }

  if (!nieuwModel && teDoen.some((c) => c.soort !== 'prospect')) {
    res.fout = 'Leads en klanten inschrijven kan pas na de migratie 20261004_campagnes_flow.sql. Prospects gaan wel.';
  }

  const nu = new Date();
  const rijen: Record<string, unknown>[] = [];
  const heropenen: string[] = [];
  for (const c of teDoen) {
    if (!nieuwModel && c.soort !== 'prospect') continue;
    const b = perSleutel.get(contactSleutel(c.soort, c.id));
    if (b) {
      const lang = opties.herhaalNaDagen && nu.getTime() - new Date(b.created_at).getTime() > opties.herhaalNaDagen * 86_400_000;
      if (b.status !== 'actief' && b.status !== 'afgemeld' && lang) heropenen.push(b.id);
      else res.alIngeschreven++;
      continue;
    }
    const rij: Record<string, unknown> = {
      campagne_id: campagneId,
      prospect_id: c.soort === 'prospect' ? c.id : null,
      status: 'actief',
      huidige_stap: 0,
      volgende_verzending: nu.toISOString(),
    };
    if (nieuwModel) {
      rij.lead_id = c.soort === 'lead' ? c.id : null;
      rij.organisatie_id = c.soort === 'klant' ? c.id : null;
      rij.email = schoonEmail(c.email);
      rij.naam = c.naam;
      rij.huidige_knoop = null;
      rij.bron = opties.bron;
    }
    rijen.push(rij);
  }

  for (let i = 0; i < rijen.length; i += 200) {
    const deel = rijen.slice(i, i + 200);
    const { data, error } = await sb.from('campagne_inschrijvingen').insert(deel).select('id');
    if (!error) {
      res.nieuw += ((data as { id: string }[]) ?? []).length;
      if (nieuwModel) {
        await sb.from('campagne_events').insert(
          ((data as { id: string }[]) ?? []).map((r) => ({ campagne_id: campagneId, inschrijving_id: r.id, soort: 'ingeschreven', detail: { bron: opties.bron } })),
        );
      }
      continue;
    }
    // Eén dubbele rij laat de hele batch falen: dan per rij proberen.
    for (const rij of deel) {
      const enkel = await sb.from('campagne_inschrijvingen').insert(rij).select('id').maybeSingle();
      if (!enkel.error && enkel.data) {
        res.nieuw++;
        if (nieuwModel) await sb.from('campagne_events').insert({ campagne_id: campagneId, inschrijving_id: (enkel.data as { id: string }).id, soort: 'ingeschreven', detail: { bron: opties.bron } });
      } else res.alIngeschreven++;
    }
  }

  if (heropenen.length && nieuwModel) {
    const { error } = await sb
      .from('campagne_inschrijvingen')
      .update({ status: 'actief', huidige_knoop: null, huidige_stap: 0, volgende_verzending: nu.toISOString(), created_at: nu.toISOString(), doel_bereikt_op: null, afgerond_op: null, gereageerd_op: null, fouten: 0 })
      .in('id', heropenen);
    if (!error) {
      res.heropend = heropenen.length;
      await sb.from('campagne_events').insert(heropenen.map((id) => ({ campagne_id: campagneId, inschrijving_id: id, soort: 'ingeschreven', detail: { bron: opties.bron, opnieuw: true } })));
    }
  }
  return res;
}
