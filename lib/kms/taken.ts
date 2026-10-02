import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Data-access voor de takenmodule (de "lopende bestellingen"-tabel zoals Jessi
 * die in Notion bijhield).
 *
 * De tabel `taken` heeft RLS aan met GEEN policies, dus alle lees-/schrijfacties
 * verlopen via kmsAdmin() (service-role). Alleen server-side gebruiken, altijd
 * achter dashAuthed().
 *
 * Twee soorten herkomst:
 * - bron 'handmatig': door Jessi zelf aangemaakt (taak of afspraak);
 * - bron 'order' / 'portaal': automatisch aangemaakt door synchroniseerAutoTaken()
 *   voor elke openstaande order of portaalbestelling.
 */

/**
 * Stappen in de werkstroom, in de volgorde die Jessi aanhoudt. Dit staat los van
 * status (open/klaar): een taak kan bij de borduurder liggen en nog gewoon open
 * zijn. 'Afgerond' zetten sluit de taak wel meteen af.
 */
export const TAAK_WERKSTATUSSEN = [
  'Niet gestart',
  'Benaderen',
  'Afspraak maken',
  'Afspraak staat',
  'Pasafspraak plannen',
  'Passerie bestellen',
  'Passerie afleveren',
  'Passerie bij klant',
  'Offerte sturen',
  'Offerte gestuurd',
  'Nog bestellen',
  'Al besteld nog niet geleverd',
  "Logo's bestellen",
  "Logo's ophalen",
  "Logo's printen",
  'Coupeuse',
  'Opsturen naar borduurder',
  'Bij borduurder',
  'Nog bedrukken',
  'In uitvoering',
  'Afleveren',
  'Naar herenzaak',
  'Factuur sturen',
  'Afgerond',
] as const;
export type TaakWerkstatus = (typeof TAAK_WERKSTATUSSEN)[number];

export const TAAK_SOORTEN = ['taak', 'afspraak'] as const;
export type TaakSoort = (typeof TAAK_SOORTEN)[number];

export const TAAK_BRONNEN = ['handmatig', 'order', 'portaal', 'inkoop', 'offerte', 'prospect'] as const;
export type TaakBron = (typeof TAAK_BRONNEN)[number];

/** Alleen waardes uit de lijst toelaten; al het andere wordt null. */
export function schoneWerkstatus(v: unknown): TaakWerkstatus | null {
  const s = String(v ?? '').trim();
  return (TAAK_WERKSTATUSSEN as readonly string[]).includes(s) ? (s as TaakWerkstatus) : null;
}

function schoneSoort(v: unknown): TaakSoort {
  return String(v ?? '').trim() === 'afspraak' ? 'afspraak' : 'taak';
}

/** 'yyyy-mm-dd' of null. */
function schoneDatum(v: unknown): string | null {
  const s = String(v ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Datum gepland voor een automatische taak: nooit in het verleden, anders staat hij meteen op Verlopen. */
function nietInVerleden(datum: string | null): string {
  const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
  return datum && datum > vandaag ? datum : vandaag;
}

/** 'hh:mm' of null. Postgres geeft 'hh:mm:ss' terug; dat knippen we af. */
function schoneTijd(v: unknown): string | null {
  const s = String(v ?? '').trim().slice(0, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null;
}

function schoneTekst(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s ? s : null;
}

export type Taak = {
  id: string;
  titel: string;
  omschrijving: string | null;
  organisatie_id: string | null;
  status: string;
  werkstatus: string | null;
  prioriteit: string;
  vervaldatum: string | null;
  toegewezen_aan: string | null;
  created_at: string;
  afgerond_op: string | null;
  soort: TaakSoort;
  bron: string;
  order_id: string | null;
  portaal_bestelling_id: string | null;
  /** Prospect bij bron 'prospect' (brief gescand / pasdag-aanvraag). */
  prospect_id: string | null;
  /** 'hh:mm' bij een afspraak, anders null. */
  tijd: string | null;
  /** Naam van de gekoppelde organisatie (via join), indien aanwezig. */
  organisatie_naam?: string | null;
  /** Ordernummer bij bron 'order' (via join). */
  ordernummer?: number | null;
};

const TAAK_KOLOMMEN =
  'id, titel, omschrijving, organisatie_id, status, werkstatus, prioriteit, vervaldatum, toegewezen_aan, created_at, afgerond_op, soort, bron, order_id, portaal_bestelling_id, prospect_id, tijd, organisaties(naam), orders(ordernummer)';

const TAAK_KOLOMMEN_ZONDER_ORDER = TAAK_KOLOMMEN.replace(', orders(ordernummer)', '');

/** Rij zoals Supabase die teruggeeft met de geneste joins. */
type TaakRij = Omit<Taak, 'organisatie_naam' | 'ordernummer' | 'soort' | 'tijd'> & {
  soort: string | null;
  tijd: string | null;
  organisaties: { naam: string | null } | null;
  orders?: { ordernummer: number | null } | null;
};

function naarTaak(r: TaakRij): Taak {
  return {
    id: r.id,
    titel: r.titel,
    omschrijving: r.omschrijving,
    organisatie_id: r.organisatie_id,
    status: r.status,
    werkstatus: r.werkstatus ?? null,
    prioriteit: r.prioriteit,
    vervaldatum: r.vervaldatum,
    toegewezen_aan: r.toegewezen_aan,
    created_at: r.created_at,
    afgerond_op: r.afgerond_op,
    soort: schoneSoort(r.soort),
    bron: r.bron || 'handmatig',
    order_id: r.order_id ?? null,
    portaal_bestelling_id: r.portaal_bestelling_id ?? null,
    prospect_id: r.prospect_id ?? null,
    tijd: schoneTijd(r.tijd),
    organisatie_naam: r.organisaties?.naam ?? null,
    ordernummer: r.orders?.ordernummer ?? null,
  };
}

/** Sortering: op datum gepland (lege datums achteraan), dan tijd, dan aanmaakdatum. */
function vergelijkTaken(a: Taak, b: Taak): number {
  if (a.vervaldatum !== b.vervaldatum) {
    if (!a.vervaldatum) return 1;
    if (!b.vervaldatum) return -1;
    return a.vervaldatum < b.vervaldatum ? -1 : 1;
  }
  if (a.tijd !== b.tijd) {
    if (!a.tijd) return 1;
    if (!b.tijd) return -1;
    return a.tijd < b.tijd ? -1 : 1;
  }
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

/**
 * Taken ophalen met klantnaam en ordernummer. 'open' = alles wat nog niet is
 * afgerond, 'klaar' = afgerond, 'alle' = beide. Gesorteerd op datum gepland.
 */
export async function listTaken(filter: 'open' | 'klaar' | 'alle' = 'open'): Promise<Taak[]> {
  const sb = kmsAdmin();
  if (!sb) return [];

  const haal = (kolommen: string) => {
    let query = sb.from('taken').select(kolommen);
    if (filter === 'open' || filter === 'klaar') {
      query = query.eq('status', filter);
    }
    // Afgeronde taken stapelen zich op; de nieuwste 1000 is ruim genoeg voor de tabel.
    if (filter !== 'open') return query.order('created_at', { ascending: false }).limit(1000);
    return query;
  };

  // Open taken: alles ophalen, ook boven de 1000 (de database geeft er per keer
  // hoogstens 1000 terug, en met de automatische ordertaken kan het er meer worden).
  const haalOpen = (kolommen: string) =>
    alleRijen<TaakRij>((van, tot) =>
      sb.from('taken').select(kolommen).eq('status', 'open').order('created_at').order('id').range(van, tot),
    );

  let rijen: TaakRij[] | null;
  if (filter === 'open') {
    rijen = await haalOpen(TAAK_KOLOMMEN);
    // Kan de koppeling naar orders (nog) niet gelegd worden, dan zonder ordernummer.
    if (!rijen) rijen = await haalOpen(TAAK_KOLOMMEN_ZONDER_ORDER);
  } else {
    let { data, error } = await haal(TAAK_KOLOMMEN);
    if (error) ({ data, error } = await haal(TAAK_KOLOMMEN_ZONDER_ORDER));
    rijen = error ? null : (data as unknown as TaakRij[]);
  }
  const taken = (rijen ?? []).map(naarTaak);
  taken.sort(vergelijkTaken);
  return taken;
}

/** Eén taak met joins, bijvoorbeeld om na een wijziging terug te geven aan de tabel. */
export async function getTaak(id: string): Promise<Taak | null> {
  const sb = kmsAdmin();
  if (!sb || !id) return null;
  let { data, error } = await sb.from('taken').select(TAAK_KOLOMMEN).eq('id', id).maybeSingle();
  if (error) ({ data, error } = await sb.from('taken').select(TAAK_KOLOMMEN_ZONDER_ORDER).eq('id', id).maybeSingle());
  return data ? naarTaak(data as unknown as TaakRij) : null;
}

/**
 * Namen voor de kolom Persoon: actieve beheerders plus namen die al eerder
 * zijn ingevuld (zodat "Jessi" ook verschijnt als ze geen beheerdersaccount heeft).
 */
export async function listTaakPersonen(): Promise<string[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const [adminsR, takenR] = await Promise.all([
    sb.from('admin_gebruikers').select('naam, actief'),
    sb.from('taken').select('toegewezen_aan').not('toegewezen_aan', 'is', null).limit(1000),
  ]);
  const namen = new Map<string, string>();
  const voegToe = (n: string | null | undefined) => {
    const s = String(n ?? '').trim();
    if (s && !namen.has(s.toLowerCase())) namen.set(s.toLowerCase(), s);
  };
  ((adminsR.data as { naam: string | null; actief: boolean | null }[]) ?? [])
    .filter((a) => a.actief !== false)
    .forEach((a) => voegToe(a.naam));
  ((takenR.data as { toegewezen_aan: string | null }[]) ?? []).forEach((t) => voegToe(t.toegewezen_aan));
  return [...namen.values()].sort((a, b) => a.localeCompare(b, 'nl'));
}

/** Nieuwe taak of afspraak aanmaken. Geeft het id terug, of null bij een fout. */
export async function maakTaak(input: {
  titel: string;
  omschrijving?: string | null;
  organisatie_id?: string | null;
  prioriteit?: string;
  werkstatus?: string | null;
  vervaldatum?: string | null;
  toegewezen_aan?: string | null;
  soort?: string | null;
  tijd?: string | null;
}): Promise<string | null> {
  const sb = kmsAdmin();
  if (!sb) return null;
  const titel = input.titel.trim();
  if (!titel) return null;

  const soort = schoneSoort(input.soort);
  const werkstatus = schoneWerkstatus(input.werkstatus) ?? 'Niet gestart';
  const klaar = werkstatus === 'Afgerond';
  const rij: Record<string, unknown> = {
    titel,
    omschrijving: schoneTekst(input.omschrijving),
    organisatie_id: schoneTekst(input.organisatie_id),
    prioriteit: input.prioriteit?.trim() || 'normaal',
    werkstatus,
    status: klaar ? 'klaar' : 'open',
    vervaldatum: schoneDatum(input.vervaldatum),
    toegewezen_aan: schoneTekst(input.toegewezen_aan),
    soort,
    bron: 'handmatig',
  };
  if (klaar) rij.afgerond_op = new Date().toISOString();
  const tijd = soort === 'afspraak' ? schoneTijd(input.tijd) : null;
  if (tijd) rij.tijd = tijd;

  const { data, error } = await sb.from('taken').insert(rij).select('id').single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/** Velden die vanuit de tabel per cel te wijzigen zijn. */
export type TaakVelden = {
  titel?: string;
  organisatie_id?: string | null;
  omschrijving?: string | null;
  vervaldatum?: string | null;
  toegewezen_aan?: string | null;
  soort?: string;
  tijd?: string | null;
  werkstatus?: string;
};

/**
 * Losse velden van een taak bijwerken. Alleen meegegeven keys worden gewijzigd.
 * Geeft de gewijzigde velden terug als { voor, na } voor het auditlog.
 */
export async function werkTaakBij(
  id: string,
  velden: TaakVelden,
): Promise<{ ok: boolean; fout?: string; voor?: Record<string, unknown>; na?: Record<string, unknown> }> {
  const sb = kmsAdmin();
  if (!sb || !id) return { ok: false, fout: 'Taak niet gevonden.' };

  const { data: huidig } = await sb
    .from('taken')
    .select('titel, organisatie_id, omschrijving, vervaldatum, toegewezen_aan, soort, tijd, werkstatus, status')
    .eq('id', id)
    .maybeSingle();
  if (!huidig) return { ok: false, fout: 'Taak niet gevonden.' };
  const oud = huidig as Record<string, unknown>;

  const nieuw: Record<string, unknown> = {};
  if (velden.titel !== undefined) {
    const t = velden.titel.trim();
    if (!t) return { ok: false, fout: 'Vul een klant of onderwerp in.' };
    nieuw.titel = t;
  }
  if (velden.organisatie_id !== undefined) nieuw.organisatie_id = schoneTekst(velden.organisatie_id);
  if (velden.omschrijving !== undefined) nieuw.omschrijving = schoneTekst(velden.omschrijving);
  if (velden.vervaldatum !== undefined) nieuw.vervaldatum = schoneDatum(velden.vervaldatum);
  if (velden.toegewezen_aan !== undefined) nieuw.toegewezen_aan = schoneTekst(velden.toegewezen_aan);
  if (velden.soort !== undefined) {
    nieuw.soort = schoneSoort(velden.soort);
    if (nieuw.soort === 'taak') nieuw.tijd = null;
  }
  if (velden.tijd !== undefined && (nieuw.soort ?? oud.soort) === 'afspraak') nieuw.tijd = schoneTijd(velden.tijd);
  if (velden.werkstatus !== undefined) {
    const w = schoneWerkstatus(velden.werkstatus);
    if (!w) return { ok: false, fout: 'Die status ken ik niet.' };
    nieuw.werkstatus = w;
    const klaar = w === 'Afgerond';
    nieuw.status = klaar ? 'klaar' : 'open';
    if (klaar && oud.status !== 'klaar') nieuw.afgerond_op = new Date().toISOString();
    if (!klaar) nieuw.afgerond_op = null;
  }

  // Alleen echt gewijzigde velden opslaan en loggen.
  const vergelijkbaar = (k: string, v: unknown) =>
    k === 'tijd' ? schoneTijd(v) : k === 'vervaldatum' ? schoneDatum(v) : (v ?? null);
  const voor: Record<string, unknown> = {};
  const na: Record<string, unknown> = {};
  const opslaan: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(nieuw)) {
    if (k === 'afgerond_op') continue;
    if (vergelijkbaar(k, oud[k]) !== vergelijkbaar(k, v)) {
      voor[k] = oud[k] ?? null;
      na[k] = v;
      opslaan[k] = v;
    }
  }
  if (Object.keys(opslaan).length === 0) return { ok: true, voor, na };
  // afgerond_op hoort alleen bij een echte wissel tussen open en klaar.
  if ('status' in opslaan && 'afgerond_op' in nieuw) opslaan.afgerond_op = nieuw.afgerond_op;

  const { error } = await sb.from('taken').update(opslaan).eq('id', id);
  if (error) return { ok: false, fout: 'Opslaan is niet gelukt.' };
  return { ok: true, voor, na };
}

/**
 * Status van een taak zetten. Bij 'klaar' wordt afgerond_op op nu gezet,
 * bij 'open' weer leeggemaakt.
 */
export async function zetTaakStatus(id: string, status: 'open' | 'klaar'): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb || !id) return false;
  const update: Record<string, unknown> = {
    status,
    afgerond_op: status === 'klaar' ? new Date().toISOString() : null,
  };
  if (status === 'klaar') update.werkstatus = 'Afgerond';
  const { error } = await sb.from('taken').update(update).eq('id', id);
  return !error;
}

/**
 * Werkstap zetten. 'Afgerond' rondt de taak meteen af, zodat Jessi hem niet
 * twee keer hoeft aan te raken; elke andere stap zet hem juist weer open.
 */
export async function zetTaakWerkstatus(id: string, werkstatus: string): Promise<boolean> {
  const sb = kmsAdmin();
  const schoon = schoneWerkstatus(werkstatus);
  if (!sb || !id || !schoon) return false;
  const klaar = schoon === 'Afgerond';
  const { error } = await sb
    .from('taken')
    .update({
      werkstatus: schoon,
      status: klaar ? 'klaar' : 'open',
      afgerond_op: klaar ? new Date().toISOString() : null,
    })
    .eq('id', id);
  return !error;
}

/** Taak verwijderen. */
export async function verwijderTaak(id: string): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb || !id) return false;
  const { error } = await sb.from('taken').delete().eq('id', id);
  return !error;
}

/* ------------------------------------------------------------------ */
/* Automatische taken uit orders en portaalbestellingen                */
/* ------------------------------------------------------------------ */

/** Orderstatussen waarbij de order klaar is: de automatische taak gaat dan op Afgerond. */
const ORDER_GESLOTEN = ['afgerond', 'geannuleerd'];

/** Welke stap in Jessi's werkstroom past bij een orderstatus (uit lib/kms/orders.ts). */
const WERKSTATUS_BIJ_ORDERSTATUS: Record<string, TaakWerkstatus> = {
  concept: 'Niet gestart',
  offerte_verstuurd: 'Offerte gestuurd',
  offerte_goedgekeurd: 'Nog bestellen',
  nog_bestellen: 'Nog bestellen',
  besteld: 'Al besteld nog niet geleverd',
  deellevering: 'Al besteld nog niet geleverd',
  compleet_geleverd: 'In uitvoering',
  bedrukken: 'Nog bedrukken',
  borduren: 'Bij borduurder',
  verpakken: 'In uitvoering',
  bezorgen: 'Afleveren',
  verzonden: 'Afleveren',
  factureren: 'Factuur sturen',
  afgerond: 'Afgerond',
};

export function werkstatusVoorOrderstatus(status: string | null | undefined): TaakWerkstatus {
  return WERKSTATUS_BIJ_ORDERSTATUS[String(status ?? '')] ?? 'Niet gestart';
}

/** Portaalbestellingen: 'aangevraagd' en 'bevestigd' zijn nog te doen, de rest is klaar. */
const PORTAAL_GESLOTEN = ['geleverd', 'afgewezen', 'geannuleerd'];
const WERKSTATUS_BIJ_PORTAALSTATUS: Record<string, TaakWerkstatus> = {
  aangevraagd: 'Niet gestart',
  bevestigd: 'Nog bestellen',
};

type Regel = { item_naam: string | null; aantal: number | null; maat: string | null; kleur?: string | null };

/** Korte samenvatting van de regels: "5x Polo zwart (L), 2x Broek". */
function samenvattingRegels(regels: Regel[], max = 400): string {
  const delen = regels.map((r) => {
    const extra = [r.kleur, r.maat].filter((x) => x && String(x).trim()).join(' ');
    const naam = String(r.item_naam ?? '').trim() || 'Artikel';
    return `${Number(r.aantal) || 1}x ${naam}${extra ? ` (${extra})` : ''}`;
  });
  let tekst = delen.join(', ');
  if (tekst.length > max) tekst = `${tekst.slice(0, max - 1).trimEnd()}…`;
  return tekst;
}

function inBlokken<T>(lijst: T[], grootte = 100): T[][] {
  const uit: T[][] = [];
  for (let i = 0; i < lijst.length; i += grootte) uit.push(lijst.slice(i, i + grootte));
  return uit;
}

/**
 * Taken invoegen. Bij een dubbele (unique-violation 23505, bijvoorbeeld als twee
 * tabbladen tegelijk synchroniseren) stap voor stap opnieuw, en die dubbele negeren.
 */
async function voegAutoTakenIn(rijen: Record<string, unknown>[]): Promise<number> {
  const sb = kmsAdmin();
  if (!sb || rijen.length === 0) return 0;
  let aantal = 0;
  for (const blok of inBlokken(rijen, 100)) {
    const { error } = await sb.from('taken').insert(blok);
    if (!error) {
      aantal += blok.length;
      continue;
    }
    for (const rij of blok) {
      const { error: e } = await sb.from('taken').insert(rij);
      if (!e) aantal += 1;
      else if (e.code !== '23505') console.error('[taken] automatische taak niet aangemaakt', e.message);
    }
  }
  return aantal;
}

async function rondAutoTakenAf(ids: string[]): Promise<number> {
  const sb = kmsAdmin();
  if (!sb || ids.length === 0) return 0;
  let aantal = 0;
  const nu = new Date().toISOString();
  for (const blok of inBlokken(ids, 100)) {
    const { error } = await sb
      .from('taken')
      .update({ werkstatus: 'Afgerond', status: 'klaar', afgerond_op: nu })
      .in('id', blok)
      .eq('status', 'open');
    if (!error) aantal += blok.length;
  }
  return aantal;
}

/** Namen van organisaties in één query. */
async function organisatieNamen(ids: string[]): Promise<Map<string, string>> {
  const kaart = new Map<string, string>();
  const sb = kmsAdmin();
  const uniek = [...new Set(ids.filter(Boolean))];
  if (!sb || uniek.length === 0) return kaart;
  for (const blok of inBlokken(uniek, 100)) {
    const { data } = await sb.from('organisaties').select('id, naam').in('id', blok);
    ((data as { id: string; naam: string | null }[]) ?? []).forEach((o) => {
      if (o.naam) kaart.set(o.id, o.naam);
    });
  }
  return kaart;
}

/**
 * Alle rijen van een query ophalen, in pagina's van 1000 (de standaardgrens van
 * Supabase). Bij een fout: null, zodat de sync niets doet in plaats van half.
 */
async function alleRijen<T>(
  pagina: (van: number, tot: number) => PromiseLike<{ data: unknown; error: unknown }>,
  max = 10000,
): Promise<T[] | null> {
  const uit: T[] = [];
  for (let van = 0; van < max; van += 1000) {
    const { data, error } = await pagina(van, van + 999);
    if (error) return null;
    const rijen = (data as T[]) ?? [];
    uit.push(...rijen);
    if (rijen.length < 1000) break;
  }
  return uit;
}

/** Bestaande automatische taken voor een lijst order- of bestelling-ids, in blokken. */
async function bestaandeAutoTaken(
  kolom: 'order_id' | 'portaal_bestelling_id',
  bron: 'order' | 'portaal',
  ids: string[],
): Promise<Map<string, { id: string; status: string }> | null> {
  const sb = kmsAdmin();
  const kaart = new Map<string, { id: string; status: string }>();
  if (!sb) return null;
  for (const blok of inBlokken(ids, 100)) {
    const { data, error } = await sb.from('taken').select(`id, status, ${kolom}`).eq('bron', bron).in(kolom, blok);
    if (error) return null;
    ((data as unknown as Record<string, string>[]) ?? []).forEach((t) =>
      kaart.set(t[kolom], { id: t.id, status: t.status }),
    );
  }
  return kaart;
}

async function synchroniseerOrders(sinds: string): Promise<{ aangemaakt: number; afgerond: number }> {
  const sb = kmsAdmin();
  if (!sb) return { aangemaakt: 0, afgerond: 0 };

  type OrderRij = {
    id: string;
    ordernummer: number | null;
    organisatie_id: string | null;
    besteldatum: string | null;
    status: string | null;
    notitie: string | null;
  };
  const orders = await alleRijen<OrderRij>((van, tot) =>
    sb
      .from('orders')
      .select('id, ordernummer, organisatie_id, besteldatum, status, notitie')
      .gte('besteldatum', sinds)
      .order('besteldatum')
      .range(van, tot),
  );
  if (!orders || orders.length === 0) return { aangemaakt: 0, afgerond: 0 };
  const bestaand = await bestaandeAutoTaken(
    'order_id',
    'order',
    orders.map((o) => o.id),
  );
  if (!bestaand) return { aangemaakt: 0, afgerond: 0 };

  const ontbrekend = orders.filter(
    (o) => !bestaand.has(o.id) && !ORDER_GESLOTEN.includes(String(o.status ?? '')),
  );
  const teSluiten = orders
    .filter((o) => ORDER_GESLOTEN.includes(String(o.status ?? '')))
    .map((o) => bestaand.get(o.id))
    .filter((t): t is { id: string; status: string } => !!t && t.status === 'open')
    .map((t) => t.id);

  let aangemaakt = 0;
  if (ontbrekend.length) {
    const ids = ontbrekend.map((o) => o.id);
    const regelsPerOrder = new Map<string, Regel[]>();
    for (const blok of inBlokken(ids, 100)) {
      const { data } = await sb
        .from('orderregels')
        .select('order_id, item_naam, aantal, maat, kleur')
        .in('order_id', blok)
        .order('created_at');
      ((data as (Regel & { order_id: string })[]) ?? []).forEach((r) => {
        const lijst = regelsPerOrder.get(r.order_id) ?? [];
        lijst.push(r);
        regelsPerOrder.set(r.order_id, lijst);
      });
    }
    const namen = await organisatieNamen(ontbrekend.map((o) => o.organisatie_id ?? ''));

    const rijen = ontbrekend.map((o) => {
      const regels = regelsPerOrder.get(o.id) ?? [];
      const samenvatting = regels.length
        ? samenvattingRegels(regels)
        : (o.notitie ?? '').trim().slice(0, 400) || 'Nog geen artikelen op de order.';
      const rij: Record<string, unknown> = {
        titel: (o.organisatie_id && namen.get(o.organisatie_id)) || `Order #${o.ordernummer ?? ''}`.trim(),
        omschrijving: samenvatting,
        werkstatus: werkstatusVoorOrderstatus(o.status),
        status: 'open',
        prioriteit: 'normaal',
        soort: 'taak',
        bron: 'order',
        order_id: o.id,
      };
      if (o.organisatie_id) rij.organisatie_id = o.organisatie_id;
      rij.vervaldatum = nietInVerleden(schoneDatum(o.besteldatum));
      return rij;
    });
    aangemaakt = await voegAutoTakenIn(rijen);
  }

  const afgerond = await rondAutoTakenAf(teSluiten);
  return { aangemaakt, afgerond };
}

async function synchroniseerPortaal(sinds: string): Promise<{ aangemaakt: number; afgerond: number }> {
  const sb = kmsAdmin();
  if (!sb) return { aangemaakt: 0, afgerond: 0 };

  type BestelRij = {
    id: string;
    organisatie_id: string | null;
    status: string | null;
    created_at: string;
    aangevraagd_door: string | null;
    medewerker_naam: string | null;
    notitie: string | null;
  };
  const bestellingen = await alleRijen<BestelRij>((van, tot) =>
    sb
      .from('portaal_bestellingen')
      .select('id, organisatie_id, status, created_at, aangevraagd_door, medewerker_naam, notitie')
      .gte('created_at', sinds)
      .order('created_at')
      .range(van, tot),
  );
  if (!bestellingen || bestellingen.length === 0) return { aangemaakt: 0, afgerond: 0 };
  const bestaand = await bestaandeAutoTaken(
    'portaal_bestelling_id',
    'portaal',
    bestellingen.map((b) => b.id),
  );
  if (!bestaand) return { aangemaakt: 0, afgerond: 0 };

  const isGesloten = (s: string | null) => PORTAAL_GESLOTEN.includes(String(s ?? ''));
  const ontbrekend = bestellingen.filter((b) => !bestaand.has(b.id) && !isGesloten(b.status));
  const teSluiten = bestellingen
    .filter((b) => isGesloten(b.status))
    .map((b) => bestaand.get(b.id))
    .filter((t): t is { id: string; status: string } => !!t && t.status === 'open')
    .map((t) => t.id);

  let aangemaakt = 0;
  if (ontbrekend.length) {
    const ids = ontbrekend.map((b) => b.id);
    const regelsPer = new Map<string, Regel[]>();
    for (const blok of inBlokken(ids, 100)) {
      const { data, error } = await sb
        .from('portaal_bestelregels')
        .select('bestelling_id, item_naam, aantal, maat')
        .in('bestelling_id', blok);
      if (error) break; // regels zijn een extraatje; zonder regels gaat het ook
      ((data as (Regel & { bestelling_id: string })[]) ?? []).forEach((r) => {
        const lijst = regelsPer.get(r.bestelling_id) ?? [];
        lijst.push(r);
        regelsPer.set(r.bestelling_id, lijst);
      });
    }
    const namen = await organisatieNamen(ontbrekend.map((b) => b.organisatie_id ?? ''));

    const rijen = ontbrekend.map((b) => {
      const regels = regelsPer.get(b.id) ?? [];
      const wie = (b.medewerker_naam || b.aangevraagd_door || '').trim();
      const kern = regels.length ? samenvattingRegels(regels, 340) : (b.notitie ?? '').trim().slice(0, 340);
      const omschrijving = [`Portaalbestelling${wie ? ` van ${wie}` : ''}`, kern].filter(Boolean).join(': ');
      const rij: Record<string, unknown> = {
        titel: (b.organisatie_id && namen.get(b.organisatie_id)) || 'Portaalbestelling',
        omschrijving,
        werkstatus: WERKSTATUS_BIJ_PORTAALSTATUS[String(b.status ?? '')] ?? 'Niet gestart',
        status: 'open',
        prioriteit: 'normaal',
        soort: 'taak',
        bron: 'portaal',
        portaal_bestelling_id: b.id,
      };
      if (b.organisatie_id) rij.organisatie_id = b.organisatie_id;
      rij.vervaldatum = nietInVerleden(schoneDatum(b.created_at));
      return rij;
    });
    aangemaakt = await voegAutoTakenIn(rijen);
  }

  const afgerond = await rondAutoTakenAf(teSluiten);
  return { aangemaakt, afgerond };
}

/**
 * Idempotente synchronisatie, draait bij het laden van de takenpagina:
 * - elke openstaande order (laatste 12 maanden) zonder taak krijgt er een;
 * - idem voor portaalbestellingen die nog verwerkt moeten worden;
 * - is de order/bestelling klaar of geannuleerd, dan gaat de taak op Afgerond.
 * Omschrijving, persoon en datum van bestaande taken worden nooit overschreven,
 * zodat Jessi's eigen aanpassingen blijven staan. Faalt stil.
 */
export async function synchroniseerAutoTaken(): Promise<{ aangemaakt: number; afgerond: number }> {
  try {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    const sinds = d.toISOString();
    const [o, p] = await Promise.all([synchroniseerOrders(sinds), synchroniseerPortaal(sinds)]);
    return { aangemaakt: o.aangemaakt + p.aangemaakt, afgerond: o.afgerond + p.afgerond };
  } catch (e) {
    console.error('[taken] synchronisatie mislukt', e);
    return { aangemaakt: 0, afgerond: 0 };
  }
}
