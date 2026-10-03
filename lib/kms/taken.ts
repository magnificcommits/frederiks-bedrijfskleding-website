import { kmsAdmin } from '@/lib/kms/adminClient';
import {
  listTaakStatussen,
  beginStatus,
  afgerondStatus,
  huidigeNaam,
  herstelHernoemdeStatussen,
  type TaakStatus,
} from '@/lib/kms/taakStatussen';
import { koppelLossePersonen } from '@/lib/kms/taakPersonen';
import {
  berekenHerinnering,
  plusDagen,
  plusMaanden,
  plusMinuten,
  minutenVan,
  vandaagNl,
  nlNaarDate,
} from '@/app/dashboard/taken/tijd';

/**
 * Data-access voor de takenmodule (de "lopende bestellingen"-tabel zoals Jessi
 * die in Notion bijhield, plus afspraken).
 *
 * De tabel `taken` heeft RLS aan met GEEN policies, dus alle lees-/schrijfacties
 * verlopen via kmsAdmin() (service-role). Alleen server-side gebruiken, altijd
 * achter dashAuthed().
 *
 * Herkomst (bron):
 * - 'handmatig': door Jessi zelf aangemaakt (taak of afspraak);
 * - 'order' / 'portaal': automatisch door synchroniseerAutoTaken();
 * - 'prospect': door de prospect-scan (lib/prospect/prospect.ts).
 *
 * Levenscyclus (v2):
 * - open → afgerond (status 'klaar', via een status in de groep Klaar);
 * - afgeronde taken gaan na 14 dagen vanzelf naar het archief (gearchiveerd_op);
 * - verwijderen = naar de prullenbak (verwijderd_op); na 30 dagen definitief weg.
 *   Automatische taken worden niet echt verwijderd maar gearchiveerd, anders
 *   maakt de order of prospect ze opnieuw aan.
 */

/**
 * De oorspronkelijke 24 stappen. Sinds v2 staan de statussen in de tabel
 * taak_statussen (zelf te beheren); deze lijst blijft voor de koppeling van
 * orderstatussen en als terugval. Gebruik listTaakStatussen() voor de actuele lijst.
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

export const TAAK_HERHALINGEN = ['geen', 'dagelijks', 'wekelijks', 'maandelijks'] as const;
export type TaakHerhaling = (typeof TAAK_HERHALINGEN)[number];

export const TAAK_PRIORITEITEN = ['laag', 'normaal', 'hoog'] as const;

/** Alleen waardes uit de oorspronkelijke lijst; al het andere wordt null. (Compatibiliteit.) */
export function schoneWerkstatus(v: unknown): TaakWerkstatus | null {
  const s = String(v ?? '').trim();
  return (TAAK_WERKSTATUSSEN as readonly string[]).includes(s) ? (s as TaakWerkstatus) : null;
}

function schoneSoort(v: unknown): TaakSoort {
  return String(v ?? '').trim() === 'afspraak' ? 'afspraak' : 'taak';
}

function schoneHerhaling(v: unknown): TaakHerhaling {
  const s = String(v ?? '').trim();
  return (TAAK_HERHALINGEN as readonly string[]).includes(s) ? (s as TaakHerhaling) : 'geen';
}

function schonePrioriteit(v: unknown): string {
  const s = String(v ?? '').trim();
  return (TAAK_PRIORITEITEN as readonly string[]).includes(s) ? s : 'normaal';
}

/** 'yyyy-mm-dd' of null. */
function schoneDatum(v: unknown): string | null {
  const s = String(v ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Datum gepland voor een automatische taak: nooit in het verleden, anders staat hij meteen op Verlopen. */
function nietInVerleden(datum: string | null): string {
  const vandaag = vandaagNl();
  return datum && datum > vandaag ? datum : vandaag;
}

/** 'hh:mm' of null. Postgres geeft 'hh:mm:ss' terug; dat knippen we af. */
function schoneTijd(v: unknown): string | null {
  const s = String(v ?? '').trim().slice(0, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null;
}

function schoneTekst(v: unknown, max = 8000): string | null {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
}

function schoneIso(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function schoneMinuten(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 60 * 24 * 60 ? n : null;
}

const UUID = /^[0-9a-f-]{36}$/i;

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
  persoon_id: string | null;
  created_at: string;
  afgerond_op: string | null;
  soort: TaakSoort;
  bron: string;
  order_id: string | null;
  portaal_bestelling_id: string | null;
  /** Prospect bij bron 'prospect' (brief gescand / pasdag-aanvraag). */
  prospect_id: string | null;
  /** 'hh:mm' of null. Taken mogen sinds v2 ook een tijd hebben. */
  tijd: string | null;
  /** 'hh:mm', eindtijd van een afspraak. */
  eind_tijd: string | null;
  locatie: string | null;
  herinnering_op: string | null;
  /** Minuten vóór het begin; null bij een zelf gekozen tijdstip of geen herinnering. */
  herinnering_minuten: number | null;
  herinnering_verstuurd_op: string | null;
  herhaling: TaakHerhaling;
  verwijderd_op: string | null;
  gearchiveerd_op: string | null;
  /** Naam en plaats van de gekoppelde organisatie (via join), indien aanwezig. */
  organisatie_naam?: string | null;
  organisatie_plaats?: string | null;
  /** Ordernummer bij bron 'order' (via join). */
  ordernummer?: number | null;
};

const BASIS_KOLOMMEN =
  'id, titel, omschrijving, organisatie_id, status, werkstatus, prioriteit, vervaldatum, toegewezen_aan, created_at, afgerond_op, soort, bron, order_id, portaal_bestelling_id, prospect_id, tijd';
const V2_KOLOMMEN =
  'persoon_id, eind_tijd, locatie, herinnering_op, herinnering_minuten, herinnering_verstuurd_op, herhaling, verwijderd_op, gearchiveerd_op';

function kolommen(v2: boolean, metOrders: boolean): string {
  return [
    BASIS_KOLOMMEN,
    v2 ? V2_KOLOMMEN : '',
    v2 ? 'organisaties(naam, plaats)' : 'organisaties(naam)',
    metOrders ? 'orders(ordernummer)' : '',
  ]
    .filter(Boolean)
    .join(', ');
}

/** Rij zoals Supabase die teruggeeft met de geneste joins. */
type TaakRij = Record<string, unknown> & {
  organisaties?: { naam: string | null; plaats?: string | null } | null;
  orders?: { ordernummer: number | null } | null;
};

function naarTaak(r: TaakRij): Taak {
  const s = (k: string) => (r[k] === undefined || r[k] === null ? null : String(r[k]));
  return {
    id: String(r.id),
    titel: String(r.titel ?? ''),
    omschrijving: s('omschrijving'),
    organisatie_id: s('organisatie_id'),
    status: String(r.status ?? 'open'),
    werkstatus: s('werkstatus'),
    prioriteit: String(r.prioriteit ?? 'normaal'),
    vervaldatum: schoneDatum(r.vervaldatum),
    toegewezen_aan: s('toegewezen_aan'),
    persoon_id: s('persoon_id'),
    created_at: String(r.created_at ?? ''),
    afgerond_op: s('afgerond_op'),
    soort: schoneSoort(r.soort),
    bron: String(r.bron || 'handmatig'),
    order_id: s('order_id'),
    portaal_bestelling_id: s('portaal_bestelling_id'),
    prospect_id: s('prospect_id'),
    tijd: schoneTijd(r.tijd),
    eind_tijd: schoneTijd(r.eind_tijd),
    locatie: s('locatie'),
    herinnering_op: s('herinnering_op'),
    herinnering_minuten: r.herinnering_minuten === null || r.herinnering_minuten === undefined ? null : Number(r.herinnering_minuten),
    herinnering_verstuurd_op: s('herinnering_verstuurd_op'),
    herhaling: schoneHerhaling(r.herhaling),
    verwijderd_op: s('verwijderd_op'),
    gearchiveerd_op: s('gearchiveerd_op'),
    organisatie_naam: r.organisaties?.naam ?? null,
    organisatie_plaats: r.organisaties?.plaats ?? null,
    ordernummer: r.orders?.ordernummer ?? null,
  };
}

/** Sortering: op datum gepland (lege datums achteraan), dan tijd, dan aanmaakdatum. */
export function vergelijkTaken(a: Taak, b: Taak): number {
  if (a.vervaldatum !== b.vervaldatum) {
    if (!a.vervaldatum) return 1;
    if (!b.vervaldatum) return -1;
    return a.vervaldatum < b.vervaldatum ? -1 : 1;
  }
  if (a.tijd !== b.tijd) {
    if (!a.tijd) return -1; // zonder tijd eerst (hele dag), zoals in een agenda
    if (!b.tijd) return 1;
    return a.tijd < b.tijd ? -1 : 1;
  }
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* Schema-detectie                                                     */
/* ------------------------------------------------------------------ */

let v2Cache: { waarde: boolean; tot: number } | null = null;

/**
 * Staan de v2-kolommen (migratie 20261003_taken_v2) al in de database? Zo niet,
 * dan werkt de lijst zoals vroeger, zodat de site niet leeg is als de code eerder
 * live staat dan de migratie. Een minuut gecachet.
 */
export async function takenV2Actief(): Promise<boolean> {
  if (v2Cache && v2Cache.tot > Date.now()) return v2Cache.waarde;
  const sb = kmsAdmin();
  if (!sb) return false;
  const { error } = await sb.from('taken').select('verwijderd_op, persoon_id').limit(1);
  const waarde = !error;
  v2Cache = { waarde, tot: Date.now() + (waarde ? 10 * 60_000 : 60_000) };
  return waarde;
}

/* ------------------------------------------------------------------ */
/* Lezen                                                               */
/* ------------------------------------------------------------------ */

/**
 * - open: alles wat nog niet is afgerond (niet in archief of prullenbak);
 * - actief: open + afgerond, niet in archief of prullenbak;
 * - archief / prullenbak: de nieuwste 1000;
 * - agenda: alles (ook afgerond) met een datum tussen van en tot.
 */
export type TakenWeergave = 'open' | 'actief' | 'archief' | 'prullenbak' | 'agenda';

/**
 * Alle rijen van een query ophalen, in pagina's van 1000 (de standaardgrens van
 * Supabase). Bij een fout: null, zodat de aanroeper kan terugvallen.
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

export async function listTaken(
  weergave: TakenWeergave = 'open',
  opties: { van?: string; tot?: string; persoonId?: string } = {},
): Promise<Taak[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const v2 = await takenV2Actief();
  if (!v2 && (weergave === 'archief' || weergave === 'prullenbak')) return [];

  const haal = async (metOrders: boolean): Promise<TaakRij[] | null> => {
    const filter = () => {
      let q = sb.from('taken').select(kolommen(v2, metOrders));
      if (weergave === 'open') q = q.eq('status', 'open');
      if (v2) {
        if (weergave === 'prullenbak') q = q.not('verwijderd_op', 'is', null);
        else q = q.is('verwijderd_op', null);
        if (weergave === 'archief') q = q.not('gearchiveerd_op', 'is', null);
        else if (weergave !== 'prullenbak') q = q.is('gearchiveerd_op', null);
      }
      if (weergave === 'agenda') {
        if (opties.van) q = q.gte('vervaldatum', opties.van);
        if (opties.tot) q = q.lte('vervaldatum', opties.tot);
      }
      if (opties.persoonId && v2) q = q.eq('persoon_id', opties.persoonId);
      return q;
    };
    if (weergave === 'archief' || weergave === 'prullenbak') {
      const kolom = !v2 ? 'created_at' : weergave === 'archief' ? 'gearchiveerd_op' : 'verwijderd_op';
      const { data, error } = await filter().order(kolom, { ascending: false }).limit(1000);
      return error ? null : ((data as unknown as TaakRij[]) ?? []);
    }
    if (weergave === 'actief' && !v2) {
      // Zonder archief stapelen afgeronde taken zich op: de nieuwste 1000 is genoeg.
      const { data, error } = await filter().order('created_at', { ascending: false }).limit(1000);
      if (error) return null;
      const open = await alleRijen<TaakRij>((van, tot) => filter().eq('status', 'open').order('created_at').order('id').range(van, tot));
      const kaart = new Map<string, TaakRij>();
      for (const r of [...((data as unknown as TaakRij[]) ?? []), ...(open ?? [])]) kaart.set(String(r.id), r);
      return [...kaart.values()];
    }
    return alleRijen<TaakRij>((van, tot) => filter().order('created_at').order('id').range(van, tot));
  };

  // Kan de koppeling naar orders (nog) niet gelegd worden, dan zonder ordernummer.
  const rijen = (await haal(true)) ?? (await haal(false)) ?? [];
  const taken = rijen.map(naarTaak);
  if (weergave !== 'archief' && weergave !== 'prullenbak') taken.sort(vergelijkTaken);
  return taken;
}

/** Eén taak met joins, bijvoorbeeld om na een wijziging terug te geven aan de tabel. */
export async function getTaak(id: string): Promise<Taak | null> {
  const sb = kmsAdmin();
  if (!sb || !id || !UUID.test(id)) return null;
  const v2 = await takenV2Actief();
  let { data, error } = await sb.from('taken').select(kolommen(v2, true)).eq('id', id).maybeSingle();
  if (error) ({ data, error } = await sb.from('taken').select(kolommen(v2, false)).eq('id', id).maybeSingle());
  return data ? naarTaak(data as unknown as TaakRij) : null;
}

/** Klanten voor de zoekbalk in het taakvenster: naam, plaats en adres (voor de afspraaklocatie). */
export type KlantKeuze = { id: string; naam: string; plaats: string | null; adres: string | null };

export async function listKlantKeuzes(): Promise<KlantKeuze[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  type Rij = { id: string; naam: string | null; plaats?: string | null; adres?: string | null; postcode?: string | null };
  let rijen = await alleRijen<Rij>((van, tot) =>
    sb.from('organisaties').select('id, naam, plaats, adres, postcode').order('naam').range(van, tot),
  );
  if (!rijen) rijen = await alleRijen<Rij>((van, tot) => sb.from('organisaties').select('id, naam').order('naam').range(van, tot));
  return (rijen ?? [])
    .filter((r) => r.naam)
    .map((r) => {
      const plaats = (r.plaats ?? '').trim() || null;
      const straat = (r.adres ?? '').trim();
      const pcPlaats = [(r.postcode ?? '').trim(), plaats ?? ''].filter(Boolean).join(' ');
      const adres = [straat, pcPlaats].filter(Boolean).join(', ') || null;
      return { id: r.id, naam: String(r.naam), plaats, adres };
    });
}

/** Open taken met een herinnering vandaag (Nederlandse tijd), voor de banner op de takenpagina. */
export async function listHerinneringenVandaag(): Promise<Taak[]> {
  const sb = kmsAdmin();
  if (!sb || !(await takenV2Actief())) return [];
  const vandaag = vandaagNl();
  const begin = nlNaarDate(vandaag, '00:00').toISOString();
  const eind = nlNaarDate(plusDagen(vandaag, 1), '00:00').toISOString();
  const { data, error } = await sb
    .from('taken')
    .select(kolommen(true, false))
    .eq('status', 'open')
    .is('verwijderd_op', null)
    .is('gearchiveerd_op', null)
    .gte('herinnering_op', begin)
    .lt('herinnering_op', eind)
    .order('herinnering_op')
    .limit(50);
  if (error) return [];
  return ((data as unknown as TaakRij[]) ?? []).map(naarTaak);
}

/* ------------------------------------------------------------------ */
/* Schrijven                                                           */
/* ------------------------------------------------------------------ */

/** Alles wat het taakvenster kan opslaan. Alleen meegegeven keys worden gewijzigd. */
export type TaakVelden = {
  titel?: string;
  organisatie_id?: string | null;
  omschrijving?: string | null;
  vervaldatum?: string | null;
  /** Verouderd (vrij getypte naam); gebruik persoon_id. */
  toegewezen_aan?: string | null;
  persoon_id?: string | null;
  soort?: string;
  tijd?: string | null;
  eind_tijd?: string | null;
  locatie?: string | null;
  werkstatus?: string;
  prioriteit?: string;
  /** Minuten vooraf (0 = op het tijdstip). null = geen herinnering, tenzij herinnering_op is meegegeven. */
  herinnering_minuten?: number | null;
  /** Zelf gekozen moment (ISO). Alleen gebruikt als herinnering_minuten null is. */
  herinnering_op?: string | null;
  herhaling?: string;
};

type Resultaat = {
  ok: boolean;
  fout?: string;
  voor?: Record<string, unknown>;
  na?: Record<string, unknown>;
  /** Id van de volgende taak als een herhalende taak is afgerond. */
  volgendeId?: string | null;
};

async function persoonNaam(id: string): Promise<string | null | 'onbekend'> {
  const sb = kmsAdmin();
  if (!sb) return 'onbekend';
  const { data } = await sb.from('taak_personen').select('naam').eq('id', id).maybeSingle();
  return data ? String((data as { naam: string }).naam) : 'onbekend';
}

/**
 * Herinnering bepalen uit wat er is meegegeven en wat er al stond.
 * Geeft undefined terug als er niets aan de herinnering verandert.
 */
function bepaalHerinnering(
  velden: TaakVelden,
  oud: { vervaldatum: string | null; tijd: string | null; herinnering_minuten: number | null; herinnering_op: string | null },
  nieuw: { vervaldatum: string | null; tijd: string | null },
): { herinnering_minuten: number | null; herinnering_op: string | null } | undefined {
  if ('herinnering_minuten' in velden || 'herinnering_op' in velden) {
    const min = schoneMinuten(velden.herinnering_minuten);
    if (min !== null) {
      const op = berekenHerinnering(nieuw.vervaldatum, nieuw.tijd, min);
      return { herinnering_minuten: op ? min : null, herinnering_op: op ? op.toISOString() : null };
    }
    const vast = velden.herinnering_op !== undefined ? schoneIso(velden.herinnering_op) : 'herinnering_minuten' in velden ? null : oud.herinnering_op;
    return { herinnering_minuten: null, herinnering_op: vast };
  }
  // Datum of tijd verschoven bij een relatieve herinnering: herinnering schuift mee.
  if (oud.herinnering_minuten !== null && (oud.vervaldatum !== nieuw.vervaldatum || oud.tijd !== nieuw.tijd)) {
    const op = berekenHerinnering(nieuw.vervaldatum, nieuw.tijd, oud.herinnering_minuten);
    return { herinnering_minuten: op ? oud.herinnering_minuten : null, herinnering_op: op ? op.toISOString() : null };
  }
  return undefined;
}

/** Nieuwe taak of afspraak aanmaken. Geeft het id terug, of een foutmelding. */
export async function maakTaak(input: TaakVelden & { titel: string }): Promise<{ id: string } | { fout: string }> {
  const sb = kmsAdmin();
  if (!sb) return { fout: 'Database niet bereikbaar.' };
  const titel = String(input.titel ?? '').trim().slice(0, 200);
  if (!titel) return { fout: 'Vul een klant of onderwerp in.' };
  const v2 = await takenV2Actief();
  const statussen = await listTaakStatussen();

  const soort = schoneSoort(input.soort);
  const gevraagd = String(input.werkstatus ?? '').trim();
  const status = statussen.find((s) => s.naam === gevraagd) ?? statussen.find((s) => s.naam === beginStatus(statussen));
  const werkstatus = status?.naam ?? beginStatus(statussen);
  const klaar = status?.is_afgerond ?? false;

  const vervaldatum = schoneDatum(input.vervaldatum);
  const tijd = schoneTijd(input.tijd);
  const rij: Record<string, unknown> = {
    titel,
    omschrijving: schoneTekst(input.omschrijving),
    organisatie_id: input.organisatie_id && UUID.test(input.organisatie_id) ? input.organisatie_id : null,
    prioriteit: schonePrioriteit(input.prioriteit),
    werkstatus,
    status: klaar ? 'klaar' : 'open',
    vervaldatum,
    soort,
    bron: 'handmatig',
  };
  if (klaar) rij.afgerond_op = new Date().toISOString();
  if (tijd && (soort === 'afspraak' || v2)) rij.tijd = tijd;

  if (v2) {
    if (input.persoon_id && UUID.test(input.persoon_id)) {
      const naam = await persoonNaam(input.persoon_id);
      if (naam === 'onbekend') return { fout: 'Die persoon bestaat niet (meer).' };
      rij.persoon_id = input.persoon_id;
      rij.toegewezen_aan = naam;
    }
    if (soort === 'afspraak') {
      let eind = schoneTijd(input.eind_tijd);
      if (tijd && !eind) eind = plusMinuten(tijd, 60);
      if (tijd && eind && minutenVan(eind) <= minutenVan(tijd)) return { fout: 'De eindtijd moet na de begintijd liggen.' };
      if (eind) rij.eind_tijd = eind;
    }
    const locatie = schoneTekst(input.locatie, 300);
    if (locatie) rij.locatie = locatie;
    const herhaling = schoneHerhaling(input.herhaling);
    if (herhaling !== 'geen' && vervaldatum) rij.herhaling = herhaling;
    const h = bepaalHerinnering(
      input,
      { vervaldatum: null, tijd: null, herinnering_minuten: null, herinnering_op: null },
      { vervaldatum, tijd },
    );
    if (h?.herinnering_op) {
      rij.herinnering_op = h.herinnering_op;
      if (h.herinnering_minuten !== null) rij.herinnering_minuten = h.herinnering_minuten;
    }
  } else if (input.toegewezen_aan) {
    rij.toegewezen_aan = schoneTekst(input.toegewezen_aan, 60);
  }

  const { data, error } = await sb.from('taken').insert(rij).select('id').single();
  if (error || !data) return { fout: 'Opslaan is niet gelukt. Probeer het nog eens.' };
  return { id: (data as { id: string }).id };
}

/** Datum van de volgende keer bij een herhalende taak. */
function volgendeDatum(datum: string, herhaling: TaakHerhaling): string {
  if (herhaling === 'dagelijks') return plusDagen(datum, 1);
  if (herhaling === 'wekelijks') return plusDagen(datum, 7);
  if (herhaling === 'maandelijks') return plusMaanden(datum, 1);
  return datum;
}

/**
 * Herhalende taak afgerond: maak de volgende aan (zoals Todoist). Ligt de nieuwe
 * datum in het verleden (taak ver na de datum afgevinkt), dan schuiven we door
 * tot vandaag of later. Maakt geen dubbele aan als hij al bestaat.
 */
async function maakVolgendeHerhaling(oud: Record<string, unknown>, statussen: TaakStatus[]): Promise<string | null> {
  const sb = kmsAdmin();
  const herhaling = schoneHerhaling(oud.herhaling);
  const datum = schoneDatum(oud.vervaldatum);
  if (!sb || herhaling === 'geen' || !datum) return null;
  const vandaag = vandaagNl();
  let volgende = volgendeDatum(datum, herhaling);
  for (let i = 0; i < 400 && volgende < vandaag; i++) volgende = volgendeDatum(volgende, herhaling);

  let dubbel = sb
    .from('taken')
    .select('id')
    .eq('titel', String(oud.titel ?? ''))
    .eq('vervaldatum', volgende)
    .eq('herhaling', herhaling)
    .is('verwijderd_op', null);
  dubbel = oud.organisatie_id ? dubbel.eq('organisatie_id', String(oud.organisatie_id)) : dubbel.is('organisatie_id', null);
  const { data: bestaand } = await dubbel.limit(1);
  if (bestaand && bestaand.length) return null;

  const tijd = schoneTijd(oud.tijd);
  const minuten = oud.herinnering_minuten === null || oud.herinnering_minuten === undefined ? null : Number(oud.herinnering_minuten);
  let herinneringOp: string | null = null;
  if (minuten !== null) herinneringOp = berekenHerinnering(volgende, tijd, minuten)?.toISOString() ?? null;
  else if (oud.herinnering_op) {
    // Vast tijdstip: zelfde afstand tot de datum aanhouden.
    const verschuiving = nlNaarDate(volgende).getTime() - nlNaarDate(datum).getTime();
    herinneringOp = new Date(new Date(String(oud.herinnering_op)).getTime() + verschuiving).toISOString();
  }

  const rij: Record<string, unknown> = {
    titel: oud.titel,
    omschrijving: oud.omschrijving ?? null,
    organisatie_id: oud.organisatie_id ?? null,
    prioriteit: oud.prioriteit ?? 'normaal',
    werkstatus: beginStatus(statussen),
    status: 'open',
    vervaldatum: volgende,
    soort: schoneSoort(oud.soort),
    bron: 'handmatig',
    herhaling,
  };
  for (const k of ['persoon_id', 'toegewezen_aan', 'tijd', 'eind_tijd', 'locatie']) {
    if (oud[k] !== null && oud[k] !== undefined) rij[k] = oud[k];
  }
  if (herinneringOp) {
    rij.herinnering_op = herinneringOp;
    if (minuten !== null) rij.herinnering_minuten = minuten;
  }
  const { data, error } = await sb.from('taken').insert(rij).select('id').single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/**
 * Velden van een taak bijwerken. Alleen meegegeven keys worden gewijzigd.
 * Geeft de gewijzigde velden terug als { voor, na } voor het auditlog.
 */
export async function werkTaakBij(id: string, velden: TaakVelden): Promise<Resultaat> {
  const sb = kmsAdmin();
  if (!sb || !id || !UUID.test(id)) return { ok: false, fout: 'Taak niet gevonden.' };
  const v2 = await takenV2Actief();
  const { data: huidig } = await sb.from('taken').select(v2 ? `${BASIS_KOLOMMEN}, ${V2_KOLOMMEN}` : BASIS_KOLOMMEN).eq('id', id).maybeSingle();
  if (!huidig) return { ok: false, fout: 'Taak niet gevonden.' };
  const oud = huidig as unknown as Record<string, unknown>;
  const statussen = await listTaakStatussen();

  const nieuw: Record<string, unknown> = {};
  if (velden.titel !== undefined) {
    const t = String(velden.titel).trim().slice(0, 200);
    if (!t) return { ok: false, fout: 'Vul een klant of onderwerp in.' };
    nieuw.titel = t;
  }
  if (velden.organisatie_id !== undefined)
    nieuw.organisatie_id = velden.organisatie_id && UUID.test(velden.organisatie_id) ? velden.organisatie_id : null;
  if (velden.omschrijving !== undefined) nieuw.omschrijving = schoneTekst(velden.omschrijving);
  if (velden.vervaldatum !== undefined) nieuw.vervaldatum = schoneDatum(velden.vervaldatum);
  if (velden.prioriteit !== undefined) nieuw.prioriteit = schonePrioriteit(velden.prioriteit);
  if (velden.soort !== undefined) {
    nieuw.soort = schoneSoort(velden.soort);
    if (nieuw.soort === 'taak' && !v2) nieuw.tijd = null;
  }
  const soort = (nieuw.soort ?? schoneSoort(oud.soort)) as TaakSoort;
  if (velden.tijd !== undefined && (soort === 'afspraak' || v2)) nieuw.tijd = schoneTijd(velden.tijd);

  if (v2) {
    if (velden.persoon_id !== undefined) {
      if (velden.persoon_id && UUID.test(velden.persoon_id)) {
        const naam = await persoonNaam(velden.persoon_id);
        if (naam === 'onbekend') return { ok: false, fout: 'Die persoon bestaat niet (meer).' };
        nieuw.persoon_id = velden.persoon_id;
        nieuw.toegewezen_aan = naam;
      } else {
        nieuw.persoon_id = null;
        nieuw.toegewezen_aan = null;
      }
    }
    if (velden.eind_tijd !== undefined) nieuw.eind_tijd = schoneTijd(velden.eind_tijd);
    if (velden.locatie !== undefined) nieuw.locatie = schoneTekst(velden.locatie, 300);
    if (velden.herhaling !== undefined) nieuw.herhaling = schoneHerhaling(velden.herhaling);

    const begin = (nieuw.tijd !== undefined ? nieuw.tijd : schoneTijd(oud.tijd)) as string | null;
    if (soort === 'afspraak') {
      let eind = (nieuw.eind_tijd !== undefined ? nieuw.eind_tijd : schoneTijd(oud.eind_tijd)) as string | null;
      if (begin && !eind) {
        eind = plusMinuten(begin, 60);
        nieuw.eind_tijd = eind;
      }
      if (begin && eind && minutenVan(eind) <= minutenVan(begin)) return { ok: false, fout: 'De eindtijd moet na de begintijd liggen.' };
    }
    const datumNieuw = (nieuw.vervaldatum !== undefined ? nieuw.vervaldatum : schoneDatum(oud.vervaldatum)) as string | null;
    if ((nieuw.herhaling ?? oud.herhaling) !== 'geen' && !datumNieuw) nieuw.herhaling = 'geen';
    const h = bepaalHerinnering(
      velden,
      {
        vervaldatum: schoneDatum(oud.vervaldatum),
        tijd: schoneTijd(oud.tijd),
        herinnering_minuten: oud.herinnering_minuten === null || oud.herinnering_minuten === undefined ? null : Number(oud.herinnering_minuten),
        herinnering_op: schoneIso(oud.herinnering_op),
      },
      { vervaldatum: datumNieuw, tijd: begin },
    );
    if (h) {
      nieuw.herinnering_minuten = h.herinnering_minuten;
      nieuw.herinnering_op = h.herinnering_op;
    }
  } else if (velden.toegewezen_aan !== undefined) {
    nieuw.toegewezen_aan = schoneTekst(velden.toegewezen_aan, 60);
  }

  let wordtKlaar = false;
  if (velden.werkstatus !== undefined) {
    const w = String(velden.werkstatus).trim();
    const s = statussen.find((x) => x.naam === w);
    if (!s) return { ok: false, fout: 'Die status ken ik niet. Ververs de pagina.' };
    nieuw.werkstatus = s.naam;
    nieuw.status = s.is_afgerond ? 'klaar' : 'open';
    if (s.is_afgerond && oud.status !== 'klaar') {
      nieuw.afgerond_op = new Date().toISOString();
      wordtKlaar = true;
    }
    if (!s.is_afgerond) nieuw.afgerond_op = null;
  }

  // Alleen echt gewijzigde velden opslaan en loggen.
  const vergelijkbaar = (k: string, v: unknown) =>
    k === 'tijd' || k === 'eind_tijd'
      ? schoneTijd(v)
      : k === 'vervaldatum'
        ? schoneDatum(v)
        : k === 'herinnering_op'
          ? schoneIso(v)
          : k === 'herinnering_minuten'
            ? v === null || v === undefined ? null : Number(v)
            : (v ?? null);
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
  // Nieuw moment voor de herinnering: opnieuw versturen.
  if ('herinnering_op' in opslaan) opslaan.herinnering_verstuurd_op = null;

  const { error } = await sb.from('taken').update(opslaan).eq('id', id);
  if (error) return { ok: false, fout: 'Opslaan is niet gelukt.' };

  let volgendeId: string | null = null;
  if (v2 && wordtKlaar && 'status' in opslaan) {
    volgendeId = await maakVolgendeHerhaling({ ...oud, ...opslaan }, statussen);
  }
  return { ok: true, voor, na, volgendeId };
}

/** Afvinken (eerste status in de groep Klaar) of weer openzetten (beginstatus). */
export async function vinkTaak(id: string, klaar: boolean): Promise<Resultaat> {
  const statussen = await listTaakStatussen();
  return werkTaakBij(id, { werkstatus: klaar ? afgerondStatus(statussen) : beginStatus(statussen) });
}

/** Status van een taak zetten (oude formulieren). */
export async function zetTaakStatus(id: string, status: 'open' | 'klaar'): Promise<boolean> {
  return (await vinkTaak(id, status === 'klaar')).ok;
}

/** Werkstap zetten (oude formulieren). */
export async function zetTaakWerkstatus(id: string, werkstatus: string): Promise<boolean> {
  return (await werkTaakBij(id, { werkstatus })).ok;
}

/** Naar de prullenbak. */
export async function verwijderTaak(id: string): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb || !UUID.test(id)) return false;
  if (!(await takenV2Actief())) return false;
  const { error } = await sb.from('taken').update({ verwijderd_op: new Date().toISOString() }).eq('id', id);
  return !error;
}

/** Uit de prullenbak terugzetten. */
export async function herstelTaak(id: string): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb || !UUID.test(id)) return false;
  const { error } = await sb.from('taken').update({ verwijderd_op: null }).eq('id', id);
  return !error;
}

export async function archiveerTaak(id: string, archiveren: boolean): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb || !UUID.test(id)) return false;
  const { error } = await sb
    .from('taken')
    .update({ gearchiveerd_op: archiveren ? new Date().toISOString() : null })
    .eq('id', id);
  return !error;
}

/**
 * Definitief weg. Zelf gemaakte taken worden echt verwijderd; automatische
 * taken (order, portaal, prospect) gaan als afgerond naar het archief, anders
 * maakt de order of de prospect-scan ze opnieuw aan.
 */
async function ruimDefinitiefOp(ids: string[]): Promise<{ verwijderd: number; gearchiveerd: number }> {
  const sb = kmsAdmin();
  const uit = { verwijderd: 0, gearchiveerd: 0 };
  if (!sb || ids.length === 0) return uit;
  const statussen = await listTaakStatussen();
  const nu = new Date().toISOString();
  for (const blok of inBlokken(ids, 100)) {
    const { data } = await sb.from('taken').select('id, bron, afgerond_op').in('id', blok);
    const rijen = (data as { id: string; bron: string | null; afgerond_op: string | null }[]) ?? [];
    const handmatig = rijen.filter((r) => (r.bron || 'handmatig') === 'handmatig').map((r) => r.id);
    const auto = rijen.filter((r) => (r.bron || 'handmatig') !== 'handmatig');
    if (handmatig.length) {
      const { error } = await sb.from('taken').delete().in('id', handmatig);
      if (!error) uit.verwijderd += handmatig.length;
    }
    for (const r of auto) {
      const { error } = await sb
        .from('taken')
        .update({
          verwijderd_op: null,
          gearchiveerd_op: nu,
          status: 'klaar',
          werkstatus: afgerondStatus(statussen),
          afgerond_op: r.afgerond_op ?? nu,
        })
        .eq('id', r.id);
      if (!error) uit.gearchiveerd += 1;
    }
  }
  return uit;
}

export async function verwijderTaakDefinitief(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const sb = kmsAdmin();
  if (!sb) return false;
  // Alleen taken die al in de prullenbak liggen.
  const { data } = await sb.from('taken').select('id').eq('id', id).not('verwijderd_op', 'is', null).maybeSingle();
  if (!data) return false;
  const r = await ruimDefinitiefOp([id]);
  return r.verwijderd + r.gearchiveerd > 0;
}

/** Prullenbak leegmaken: alles, of alleen wat er langer dan `dagen` in ligt. */
export async function leegPrullenbak(dagen: number | null): Promise<{ verwijderd: number; gearchiveerd: number }> {
  const sb = kmsAdmin();
  if (!sb || !(await takenV2Actief())) return { verwijderd: 0, gearchiveerd: 0 };
  let q = sb.from('taken').select('id').not('verwijderd_op', 'is', null);
  if (dagen !== null) q = q.lt('verwijderd_op', new Date(Date.now() - dagen * 86_400_000).toISOString());
  const { data, error } = await q.limit(2000);
  if (error || !data) return { verwijderd: 0, gearchiveerd: 0 };
  return ruimDefinitiefOp((data as { id: string }[]).map((r) => r.id));
}

/** Afgeronde taken die langer dan `dagen` klaar zijn naar het archief (zoals het Logbook van Things). */
export async function archiveerAfgerondeTaken(dagen = 14): Promise<number> {
  const sb = kmsAdmin();
  if (!sb || !(await takenV2Actief())) return 0;
  const grens = new Date(Date.now() - dagen * 86_400_000).toISOString();
  const nu = new Date().toISOString();
  const { data, error } = await sb
    .from('taken')
    .update({ gearchiveerd_op: nu })
    .eq('status', 'klaar')
    .is('gearchiveerd_op', null)
    .is('verwijderd_op', null)
    .lt('afgerond_op', grens)
    .select('id');
  if (error) return 0;
  // Afgerond zonder datum (heel oude taken): ook opruimen, op aanmaakdatum.
  const { data: zonder } = await sb
    .from('taken')
    .update({ gearchiveerd_op: nu })
    .eq('status', 'klaar')
    .is('gearchiveerd_op', null)
    .is('verwijderd_op', null)
    .is('afgerond_op', null)
    .lt('created_at', grens)
    .select('id');
  return ((data as { id: string }[]) ?? []).length + ((zonder as { id: string }[]) ?? []).length;
}

/* ------------------------------------------------------------------ */
/* Automatische taken uit orders en portaalbestellingen                */
/* ------------------------------------------------------------------ */

/** Orderstatussen waarbij de order klaar is: de automatische taak gaat dan op Afgerond. */
const ORDER_GESLOTEN = ['afgerond', 'geannuleerd'];

/** Welke stap in Jessi's werkstroom past bij een orderstatus (oorspronkelijke namen; zie huidigeNaam). */
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

async function rondAutoTakenAf(ids: string[], statussen: TaakStatus[], v2: boolean): Promise<number> {
  const sb = kmsAdmin();
  if (!sb || ids.length === 0) return 0;
  let aantal = 0;
  const nu = new Date().toISOString();
  for (const blok of inBlokken(ids, 100)) {
    let q = sb
      .from('taken')
      .update({ werkstatus: afgerondStatus(statussen), status: 'klaar', afgerond_op: nu })
      .in('id', blok)
      .eq('status', 'open');
    // Taken in de prullenbak laten we met rust.
    if (v2) q = q.is('verwijderd_op', null);
    const { error } = await q;
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
 * Bestaande automatische taken voor een lijst order- of bestelling-ids, in blokken.
 * Ook taken in de prullenbak of het archief tellen mee: die worden dus niet opnieuw aangemaakt.
 */
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

async function synchroniseerOrders(sinds: string, statussen: TaakStatus[], v2: boolean): Promise<{ aangemaakt: number; afgerond: number }> {
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
        werkstatus: huidigeNaam(statussen, werkstatusVoorOrderstatus(o.status)),
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

  const afgerond = await rondAutoTakenAf(teSluiten, statussen, v2);
  return { aangemaakt, afgerond };
}

async function synchroniseerPortaal(sinds: string, statussen: TaakStatus[], v2: boolean): Promise<{ aangemaakt: number; afgerond: number }> {
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
        werkstatus: huidigeNaam(statussen, WERKSTATUS_BIJ_PORTAALSTATUS[String(b.status ?? '')] ?? 'Niet gestart'),
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

  const afgerond = await rondAutoTakenAf(teSluiten, statussen, v2);
  return { aangemaakt, afgerond };
}

/**
 * Idempotente synchronisatie, draait bij het laden van de takenpagina en in de cron:
 * - elke openstaande order (laatste 12 maanden) zonder taak krijgt er een;
 * - idem voor portaalbestellingen die nog verwerkt moeten worden;
 * - is de order/bestelling klaar of geannuleerd, dan gaat de taak op Afgerond;
 * - taken in de prullenbak of het archief worden niet opnieuw aangemaakt;
 * - oude statusnamen en losse persoonsnamen worden rechtgezet.
 * Omschrijving, persoon en datum van bestaande taken worden nooit overschreven,
 * zodat Jessi's eigen aanpassingen blijven staan. Faalt stil.
 */
export async function synchroniseerAutoTaken(): Promise<{ aangemaakt: number; afgerond: number }> {
  try {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    const sinds = d.toISOString();
    const [statussen, v2] = await Promise.all([listTaakStatussen(), takenV2Actief()]);
    const [o, p] = await Promise.all([synchroniseerOrders(sinds, statussen, v2), synchroniseerPortaal(sinds, statussen, v2)]);
    if (v2) {
      await Promise.all([herstelHernoemdeStatussen(), koppelLossePersonen()]);
    }
    return { aangemaakt: o.aangemaakt + p.aangemaakt, afgerond: o.afgerond + p.afgerond };
  } catch (e) {
    console.error('[taken] synchronisatie mislukt', e);
    return { aangemaakt: 0, afgerond: 0 };
  }
}
