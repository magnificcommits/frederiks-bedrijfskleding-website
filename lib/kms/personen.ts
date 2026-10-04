import { getHuidigeAdmin, kmsAdmin } from '@/lib/kms/adminClient';
import { listContactpersonen } from '@/lib/kms/crm';
import { listTaakPersonen, standaardPersoon } from '@/lib/kms/taakPersonen';
import { normaleNaam, type PersoonOptie, type PersoonSoort } from '@/lib/personen';
import { kolomOntbreekt } from '@/lib/kms/kolomTerugval';

export { kolomOntbreekt, metIdTerugval } from '@/lib/kms/kolomTerugval';

/**
 * Server-kant van de persoonsvelden: keuzelijsten ophalen, een keuze uit een
 * formulier lezen en controleren, en terugvallen op alleen de naam als de
 * nieuwe id-kolommen nog niet bestaan (migratie 20261004_persoon_verwijzingen).
 *
 * Alleen server-side gebruiken, altijd achter dashAuthed().
 */

/** Contactpersonen en/of actieve werknemers van één klant. */
export async function personenVanKlant(
  orgId: string,
  soorten: PersoonSoort[] = ['contact', 'medewerker'],
): Promise<PersoonOptie[]> {
  const sb = kmsAdmin();
  const id = String(orgId ?? '').trim();
  if (!sb || !id) return [];

  const [contacten, werknemers] = await Promise.all([
    soorten.includes('contact') ? listContactpersonen(id) : Promise.resolve([]),
    soorten.includes('medewerker')
      ? sb
          .from('medewerkers')
          .select('id, naam, voornaam, tussenvoegsel, achternaam, email, functie, actief')
          .eq('organisatie_id', id)
          .limit(5000)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  type MedewerkerRij = {
    id: string;
    naam: string | null;
    voornaam: string | null;
    tussenvoegsel: string | null;
    achternaam: string | null;
    email: string | null;
    functie: string | null;
    actief: boolean | null;
  };

  const uit: PersoonOptie[] = contacten.map((c) => ({
    id: c.id,
    soort: 'contact' as const,
    naam: c.naam?.trim() || 'Naamloze contactpersoon',
    email: c.email ?? null,
    functie: c.functie ?? null,
    hoofdcontact: c.hoofdcontact === true,
  }));
  for (const m of werknemers as MedewerkerRij[]) {
    if (m.actief === false) continue;
    const uitDelen = [m.voornaam, m.tussenvoegsel, m.achternaam].map((d) => (d ?? '').trim()).filter(Boolean).join(' ');
    uit.push({
      id: m.id,
      soort: 'medewerker',
      naam: m.naam?.trim() || uitDelen || 'Naamloze werknemer',
      email: m.email ?? null,
      functie: m.functie ?? null,
    });
  }
  return uit.sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}

/**
 * De collega die bij de ingelogde beheerder hoort, als standaard voor velden
 * als "door" bij een klantactiviteit. Zelfde regel als bij nieuwe taken.
 */
export async function standaardInternePersoon(): Promise<{ id: string; naam: string } | null> {
  const [personen, admin] = await Promise.all([listTaakPersonen(), getHuidigeAdmin()]);
  const id = standaardPersoon(personen, admin?.email ?? null);
  const p = id ? personen.find((x) => x.id === id) : null;
  return p ? { id: p.id, naam: p.naam } : null;
}

/** Collega's van Frederiks (Taken → Instellingen → Personen), alleen actieve. */
export async function internePersonen(): Promise<PersoonOptie[]> {
  const personen = await listTaakPersonen();
  return personen
    .filter((p) => p.actief)
    .map((p) => ({ id: p.id, soort: 'intern' as const, naam: p.naam, email: p.email ?? p.admin_email ?? null, functie: null }));
}

/* ------------------------------------------------------------------ */
/* Formulier lezen en controleren                                     */
/* ------------------------------------------------------------------ */

export type PersoonKeuze = {
  /** Naam voor de tekstkolom. Leeg = veld leeggemaakt. */
  naam: string | null;
  soort: PersoonSoort | null;
  id: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Leest de drie velden die PersoonKiezer schrijft: `<veld>`, `<veld>_id` en
 * `<veld>_soort`. Ontbreekt het id, dan is het een oude losse naam die de
 * kiezer ongemoeid liet.
 */
export function leesPersoonKeuze(formData: FormData, veld: string): PersoonKeuze {
  const naam = String(formData.get(veld) ?? '').trim() || null;
  const ruweSoort = String(formData.get(`${veld}_soort`) ?? '').trim();
  const soort = (['contact', 'medewerker', 'intern'] as const).find((s) => s === ruweSoort) ?? null;
  const ruwId = String(formData.get(`${veld}_id`) ?? '').trim();
  const id = soort && UUID.test(ruwId) ? ruwId : null;
  return { naam, soort: id ? soort : null, id };
}

/**
 * Controleert een keuze tegen de database: bestaat de persoon, en hoort hij bij
 * deze klant? Zo ja, dan komt de naam uit de database (niet uit het formulier).
 * Klopt het id niet, dan blijft alleen de tekst over.
 */
export async function bevestigPersoon(keuze: PersoonKeuze, orgId: string | null): Promise<PersoonKeuze> {
  const sb = kmsAdmin();
  if (!sb || !keuze.id || !keuze.soort) return { naam: keuze.naam, soort: null, id: null };

  if (keuze.soort === 'intern') {
    const { data } = await sb.from('taak_personen').select('id, naam').eq('id', keuze.id).maybeSingle();
    const rij = data as { id: string; naam: string } | null;
    return rij ? { naam: rij.naam, soort: 'intern', id: rij.id } : { naam: keuze.naam, soort: null, id: null };
  }

  const tabel = keuze.soort === 'contact' ? 'contactpersonen' : 'medewerkers';
  const { data } = await sb.from(tabel).select('id, naam, organisatie_id').eq('id', keuze.id).maybeSingle();
  const rij = data as { id: string; naam: string | null; organisatie_id: string } | null;
  if (!rij || (orgId && rij.organisatie_id !== orgId)) return { naam: keuze.naam, soort: null, id: null };
  return { naam: rij.naam?.trim() || keuze.naam, soort: keuze.soort, id: rij.id };
}

/* ------------------------------------------------------------------ */
/* Orders: filter "Aangevraagd door"                                   */
/* ------------------------------------------------------------------ */

export type AanvragerOptie = {
  waarde: string;
  label: string;
  /** Klant, en of de naam aan een persoon gekoppeld is. */
  sub?: string | null;
  /** Aantal orders van deze aanvrager (binnen de begrenzing van 1000 orders). */
  aantal?: number;
};

/**
 * Aanvragers voor het filter "Aangevraagd door" op de orderlijst, met het
 * aantal orders per persoon. Bewust geen lijst van iedereen: bij 500 orders
 * leest niemand meer een keuzelijst van 300 namen.
 *
 * - Met `klantId`: alle aanvragers van die klant, ook zonder zoektekst.
 * - Zonder klant: pas vanaf 2 letters, en dan alleen orders waarvan de
 *   aanvrager (tekst, contactpersoon of werknemer) op de tekst past.
 *
 * Waarde: `c:<id>` (contactpersoon), `m:<id>` (werknemer) of `t:<naam>` (losse
 * tekst die niet aan een persoon te koppelen is). Oude tekst wordt waar mogelijk
 * op naam of e-mail binnen de klant gekoppeld, zodat één persoon één regel is.
 * Alleen wat echt niet te koppelen is, komt als "niet gekoppeld" terug.
 */
export async function aanvragersVoorOrderFilter(opts: { klantId?: string | null; zoek?: string; limiet?: number } = {}): Promise<AanvragerOptie[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const klantId = opts.klantId && UUID.test(opts.klantId) ? opts.klantId : null;
  const zoek = String(opts.zoek ?? '').replace(/[%*,()"'\\:]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!klantId && zoek.length < 2) return [];
  const woorden = zoek ? zoek.split(' ').slice(0, 4) : [];

  type P = { id: string; naam: string | null; email: string | null; organisatie_id: string };
  type OrderRij = {
    organisatie_id: string;
    aangevraagd_door: string | null;
    aangevraagd_door_contact_id?: string | null;
    aangevraagd_door_medewerker_id?: string | null;
  };

  // Zonder klant: eerst de personen die op de tekst passen, dan hun orders.
  let gezochtC: P[] = [];
  let gezochtM: P[] = [];
  if (!klantId) {
    const persQ = (tabel: 'contactpersonen' | 'medewerkers') => {
      let q = sb.from(tabel).select('id, naam, email, organisatie_id');
      for (const w of woorden) q = q.or(`naam.ilike.%${w}%,email.ilike.%${w}%`);
      return q.limit(100);
    };
    const [c, m] = await Promise.all([persQ('contactpersonen'), persQ('medewerkers')]);
    gezochtC = (c.data as P[] | null) ?? [];
    gezochtM = (m.data as P[] | null) ?? [];
  }

  const tekstFilter = woorden.map((w) => `aangevraagd_door.ilike.%${w}%`);
  const metIdDelen = [
    // Alle woorden in de tekst: één and() binnen de or().
    tekstFilter.length > 1 ? `and(${tekstFilter.join(',')})` : tekstFilter[0] ?? '',
    gezochtC.length ? `aangevraagd_door_contact_id.in.(${gezochtC.map((p) => p.id).join(',')})` : '',
    gezochtM.length ? `aangevraagd_door_medewerker_id.in.(${gezochtM.map((p) => p.id).join(',')})` : '',
  ].filter(Boolean);

  let q = sb
    .from('orders')
    .select('organisatie_id, aangevraagd_door, aangevraagd_door_contact_id, aangevraagd_door_medewerker_id');
  if (klantId) {
    q = q.eq('organisatie_id', klantId).or('aangevraagd_door.not.is.null,aangevraagd_door_contact_id.not.is.null,aangevraagd_door_medewerker_id.not.is.null');
  } else {
    q = q.or(metIdDelen.join(','));
  }
  let res = await q.order('besteldatum', { ascending: false }).limit(1000);
  if (kolomOntbreekt(res.error)) {
    let terug = sb.from('orders').select('organisatie_id, aangevraagd_door').not('aangevraagd_door', 'is', null);
    if (klantId) terug = terug.eq('organisatie_id', klantId);
    for (const w of woorden) if (!klantId) terug = terug.ilike('aangevraagd_door', `%${w}%`);
    res = (await terug.order('besteldatum', { ascending: false }).limit(1000)) as typeof res;
  }
  const orders = ((res.data as OrderRij[] | null) ?? []).filter((o) => o.organisatie_id);
  if (orders.length === 0) return [];

  const orgIds = [...new Set(orders.map((o) => o.organisatie_id))].slice(0, 300);
  const [orgRes, contactRes, medewRes] = await Promise.all([
    sb.from('organisaties').select('id, naam').in('id', orgIds),
    sb.from('contactpersonen').select('id, naam, email, organisatie_id').in('organisatie_id', orgIds).limit(5000),
    sb.from('medewerkers').select('id, naam, email, organisatie_id').in('organisatie_id', orgIds).limit(5000),
  ]);
  const orgNaam = new Map(((orgRes.data as { id: string; naam: string | null }[]) ?? []).map((o) => [o.id, o.naam ?? 'Onbekende klant']));
  const contacten = (contactRes.data as P[]) ?? [];
  const medewerkers = (medewRes.data as P[]) ?? [];
  const contactVan = new Map(contacten.map((c) => [c.id, c]));
  const medewerkerVan = new Map(medewerkers.map((m) => [m.id, m]));

  /** Losse tekst binnen dezelfde klant aan precies één persoon koppelen. */
  function koppel(org: string, tekst: string): { soort: 'c' | 'm'; p: P } | null {
    const t = normaleNaam(tekst);
    const isMail = t.includes('@');
    const past = (p: P) => p.organisatie_id === org && (isMail ? normaleNaam(p.email) === t : normaleNaam(p.naam) === t);
    const c = contacten.filter(past);
    if (c.length === 1) return { soort: 'c', p: c[0] };
    if (c.length > 1) return null;
    const m = medewerkers.filter(past);
    return m.length === 1 ? { soort: 'm', p: m[0] } : null;
  }

  const opties = new Map<string, AanvragerOptie>();
  const tel = (w: string, maak: () => AanvragerOptie) => {
    const huidig = opties.get(w);
    if (huidig) huidig.aantal = (huidig.aantal ?? 0) + 1;
    else opties.set(w, { ...maak(), aantal: 1 });
  };
  for (const o of orders) {
    const klant = orgNaam.get(o.organisatie_id) ?? 'Onbekende klant';
    const c = o.aangevraagd_door_contact_id ? contactVan.get(o.aangevraagd_door_contact_id) : undefined;
    const m = o.aangevraagd_door_medewerker_id ? medewerkerVan.get(o.aangevraagd_door_medewerker_id) : undefined;
    const tekst = (o.aangevraagd_door ?? '').trim();
    const gekoppeld = c ? { soort: 'c' as const, p: c } : m ? { soort: 'm' as const, p: m } : tekst ? koppel(o.organisatie_id, tekst) : null;
    if (gekoppeld) {
      const w = `${gekoppeld.soort}:${gekoppeld.p.id}`;
      tel(w, () => ({
        waarde: w,
        label: gekoppeld.p.naam?.trim() || gekoppeld.p.email || tekst || (gekoppeld.soort === 'c' ? 'Contactpersoon' : 'Werknemer'),
        sub: `${klant} · ${gekoppeld.soort === 'c' ? 'contactpersoon' : 'werknemer'}`,
      }));
    } else if (tekst) {
      const w = `t:${tekst}`;
      tel(w, () => ({ waarde: w, label: tekst, sub: `${klant} · niet gekoppeld aan een persoon` }));
    }
  }

  let lijst = [...opties.values()];
  // Met klant én tekst: alleen wie op de tekst past (naam of klant).
  if (klantId && woorden.length) {
    lijst = lijst.filter((o) => woorden.every((w) => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(w.toLowerCase())));
  }
  // Zonder klant kan een order via de klantnaam meekomen; toon alleen namen die passen.
  if (!klantId) {
    const gezochteIds = new Set([...gezochtC.map((p) => `c:${p.id}`), ...gezochtM.map((p) => `m:${p.id}`)]);
    lijst = lijst.filter((o) => gezochteIds.has(o.waarde) || woorden.every((w) => o.label.toLowerCase().includes(w.toLowerCase())));
  }
  return lijst
    .sort((a, b) => (b.aantal ?? 0) - (a.aantal ?? 0) || a.label.localeCompare(b.label, 'nl'))
    .slice(0, opts.limiet ?? 30);
}

/** Leesbaar label bij een aanvragerwaarde (c:, m: of t:), voor de filterchip. */
export async function aanvragerLabel(waarde: string): Promise<string | null> {
  const w = String(waarde ?? '').trim();
  if (!w) return null;
  if (w.startsWith('t:')) return `${w.slice(2)} (niet gekoppeld)`;
  const sb = kmsAdmin();
  const id = w.slice(2);
  if (!sb || !UUID.test(id) || (!w.startsWith('c:') && !w.startsWith('m:'))) return null;
  const tabel = w.startsWith('c:') ? 'contactpersonen' : 'medewerkers';
  const { data } = await sb.from(tabel).select('naam, email, organisaties(naam)').eq('id', id).maybeSingle();
  const p = data as { naam: string | null; email: string | null; organisaties: { naam: string | null } | null } | null;
  if (!p) return null;
  const naam = p.naam?.trim() || p.email || 'Onbekend';
  return p.organisaties?.naam ? `${naam} (${p.organisaties.naam})` : naam;
}

/** Waarde in een PostgREST or()-filter veilig quoten; ilike-jokers letterlijk nemen. */
function pgWaarde(s: string): string {
  const letterlijk = s.replace(/[\\%_]/g, (t) => `\\${t}`);
  return `"${letterlijk.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Order-ids voor het filter "aangevraagd door" op de orderlijst. Pakt ook oude
 * orders waar alleen de naam (of het e-mailadres uit het portaal) als tekst
 * staat, binnen dezelfde klant. Bestaan de id-kolommen nog niet, dan alleen op
 * de tekst. Waarde zoals uit aanvragersVoorOrderFilter: c:, m: of t:.
 */
export async function orderIdsVoorAanvrager(waarde: string): Promise<string[]> {
  const sb = kmsAdmin();
  const w = String(waarde ?? '').trim();
  if (!sb || !w) return [];

  const haal = async (filter: string) => {
    const { data, error } = await sb.from('orders').select('id').or(filter).limit(2000);
    return { ids: ((data as { id: string }[] | null) ?? []).map((r) => r.id), error };
  };

  if (w.startsWith('t:')) {
    const tekst = w.slice(2).trim();
    return tekst ? (await haal(`aangevraagd_door.ilike.${pgWaarde(tekst)}`)).ids : [];
  }

  const soort = w.slice(0, 2);
  const id = w.slice(2);
  if ((soort !== 'c:' && soort !== 'm:') || !UUID.test(id)) return [];
  const tabel = soort === 'c:' ? 'contactpersonen' : 'medewerkers';
  const kolom = soort === 'c:' ? 'aangevraagd_door_contact_id' : 'aangevraagd_door_medewerker_id';
  const { data } = await sb.from(tabel).select('naam, email, organisatie_id').eq('id', id).maybeSingle();
  const p = data as { naam: string | null; email: string | null; organisatie_id: string } | null;

  const tekstDelen: string[] = [];
  for (const t of [p?.naam, p?.email]) {
    const schoon = (t ?? '').trim();
    if (schoon && p) tekstDelen.push(`and(organisatie_id.eq.${p.organisatie_id},aangevraagd_door.ilike.${pgWaarde(schoon)})`);
  }
  const metId = await haal([`${kolom}.eq.${id}`, ...tekstDelen].join(','));
  if (!kolomOntbreekt(metId.error)) return metId.ids;
  return tekstDelen.length ? (await haal(tekstDelen.join(','))).ids : [];
}
