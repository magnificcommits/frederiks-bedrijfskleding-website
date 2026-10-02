import type { SupabaseClient } from '@supabase/supabase-js';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { listHoofdcontacten } from '@/lib/kms/crm';

/**
 * Data-access voor de nieuwsbrieflijst.
 *
 * De lijst wordt NIET als losse kopie bijgehouden, maar elke keer opgebouwd uit
 * twee bronnen:
 *   1. het algemene e-mailadres van elke klant (organisaties.email_algemeen),
 *      met bedrijfsnaam en branche er direct bij;
 *   2. de losse aanmeldingen via het formulier op de site
 *      (nieuwsbrief_inschrijvingen).
 *
 * Daarom staat een nieuwe klant er meteen in zodra het algemene adres is
 * ingevuld, en volgt de branche altijd de klantkaart. Een gekopieerde branche in
 * een tweede tabel zou stil scheeflopen zodra iemand de klantkaart aanpast, en
 * dat merk je pas als de verkeerde mensen een mail hebben gehad.
 *
 * `nieuwsbrief_inschrijvingen` houdt van een klant maar één ding bij: wie NIET
 * gemaild wil worden (kolom `afgemeld`). Zonder die kolom is er geen plek om een
 * afmelding vast te leggen en zou Jessi iemand blijven aanschrijven.
 *
 * RLS staat aan zonder policies, dus alles verloopt via kmsAdmin()
 * (service-role). Alleen server-side gebruiken, altijd achter dashAuthed().
 */

/**
 * Label én filterwaarde voor adressen waarvan de branche niet is ingevuld.
 * Bewust met haakjes, zodat het nooit botst met een echte branchenaam.
 */
export const ZONDER_BRANCHE = '(zonder branche)';

export const NIEUWSBRIEF_BRONNEN = ['klant', 'aanmelding'] as const;
export type NieuwsbriefBron = (typeof NIEUWSBRIEF_BRONNEN)[number];

export type NieuwsbriefAdres = {
  /** Altijd kleine letters; dit is ook de sleutel waarop de twee bronnen samenvallen. */
  email: string;
  bedrijf: string | null;
  branche: string | null;
  /** Naam van de persoon bij een losse aanmelding. Klanten hebben die hier niet. */
  naam: string | null;
  bron: NieuwsbriefBron;
  organisatie_id: string | null;
  /** Klant sinds, of de datum van aanmelding. Kan leeg zijn bij oudere klanten. */
  sinds: string | null;
  afgemeld: boolean;
};

export type KlantZonderAdres = {
  id: string;
  naam: string;
  branche: string | null;
  /** E-mailadres van de contactpersoon, puur als suggestie om over te nemen. */
  suggestie: string | null;
};

export type NieuwsbriefOverzicht = {
  adressen: NieuwsbriefAdres[];
  /** Klanten die nog geen algemeen e-mailadres hebben en dus nergens in de lijst staan. */
  zonderAdres: KlantZonderAdres[];
  /**
   * False zolang de migratie met `afgemeld` en `organisatie_id` nog niet gedraaid is.
   * De pagina verbergt dan de knoppen voor wel/niet mailen: een knop die het stil
   * niet doet laat Jessi eindeloos opnieuw klikken zonder dat er iets verandert.
   */
  afmeldenMogelijk: boolean;
};

export type BrancheTelling = { branche: string; aantal: number };

type OrgRij = {
  id: string;
  naam: string | null;
  branche: string | null;
  email_algemeen: string | null;
  datum_klant: string | null;
  actief?: boolean | null;
};

type InschrijvingRij = {
  id: string;
  email: string | null;
  naam: string | null;
  bron: string | null;
  organisatie_id: string | null;
  afgemeld: boolean | null;
  created_at: string;
};

/**
 * Adres opschonen en meteen controleren of het er als e-mailadres uitziet.
 * Een half ingevuld veld ("nog opvragen", een telefoonnummer) mag nooit in een
 * kopieerbare lijst belanden: dan bounced de hele verzending.
 */
function schoonEmail(v: unknown): string | null {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (!s || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(s)) return null;
  return s;
}

type InschrijvingenResultaat = {
  rijen: InschrijvingRij[];
  /** True zodra de migratie met `organisatie_id` en `afgemeld` gedraaid heeft. */
  kolommenAanwezig: boolean;
};

/**
 * Inschrijvingen ophalen. De kolommen `organisatie_id` en `afgemeld` komen uit
 * een latere migratie; draait die nog niet, dan valt de query terug op de oude
 * kolommen. Zonder die terugval zou de hele pagina leeg blijven tussen het
 * uitrollen van de code en het draaien van de migratie.
 *
 * Of de terugval nodig was geven we door, want zonder die kolommen kan een
 * afmelding ook niet worden opgeslagen en moet de knop daarvoor weg blijven.
 */
async function haalInschrijvingen(sb: SupabaseClient): Promise<InschrijvingenResultaat> {
  const nieuw = await sb
    .from('nieuwsbrief_inschrijvingen')
    .select('id, email, naam, bron, organisatie_id, afgemeld, created_at')
    .order('created_at', { ascending: false });
  if (!nieuw.error && nieuw.data) {
    return { rijen: nieuw.data as unknown as InschrijvingRij[], kolommenAanwezig: true };
  }

  const oud = await sb
    .from('nieuwsbrief_inschrijvingen')
    .select('id, email, naam, bron, created_at')
    .order('created_at', { ascending: false });
  if (oud.error || !oud.data) return { rijen: [], kolommenAanwezig: false };
  const rijen = oud.data as unknown as Omit<InschrijvingRij, 'organisatie_id' | 'afgemeld'>[];
  return {
    rijen: rijen.map((r) => ({ ...r, organisatie_id: null, afgemeld: false })),
    kolommenAanwezig: false,
  };
}

type Adresbouw = {
  adressen: NieuwsbriefAdres[];
  orgs: OrgRij[];
  kolommenAanwezig: boolean;
};

/**
 * De kern van de lijst: klanten en losse aanmeldingen samengevoegd en
 * ontdubbeld op e-mailadres (kleine letters). Gedeeld door het overzicht en de
 * verzending, zodat "wie staat erin" op precies één plek wordt bepaald.
 */
async function bouwAdressen(sb: SupabaseClient): Promise<Adresbouw> {
  const [orgRes, inschrijvingenRes] = await Promise.all([
    sb.from('organisaties').select('id, naam, branche, email_algemeen, datum_klant, actief').order('naam'),
    haalInschrijvingen(sb),
  ]);

  const inschrijvingen = inschrijvingenRes.rijen;
  const orgs = (orgRes.data as OrgRij[]) ?? [];
  const orgVan = new Map(orgs.map((o) => [o.id, o]));
  const perEmail = new Map<string, NieuwsbriefAdres>();

  // Klanten eerst: die brengen bedrijf en branche mee. Staat hetzelfde adres
  // later ook als losse aanmelding in de tabel, dan wint deze regel.
  for (const o of orgs) {
    const email = schoonEmail(o.email_algemeen);
    if (!email || perEmail.has(email)) continue;
    perEmail.set(email, {
      email,
      bedrijf: o.naam?.trim() || null,
      branche: o.branche?.trim() || null,
      naam: null,
      bron: 'klant',
      organisatie_id: o.id,
      sinds: o.datum_klant,
      afgemeld: false,
    });
  }

  for (const i of inschrijvingen) {
    const email = schoonEmail(i.email);
    if (!email) continue;
    const afgemeld = i.afgemeld === true;
    const bestaand = perEmail.get(email);
    if (bestaand) {
      // Geen tweede regel voor hetzelfde adres. Een afmelding telt wél altijd
      // mee: bij twijfel liever niet mailen dan per ongeluk wel.
      if (afgemeld) bestaand.afgemeld = true;
      if (!bestaand.naam && i.naam?.trim()) bestaand.naam = i.naam.trim();
      continue;
    }
    const org = i.organisatie_id ? orgVan.get(i.organisatie_id) : undefined;
    perEmail.set(email, {
      email,
      bedrijf: org?.naam?.trim() || null,
      branche: org?.branche?.trim() || null,
      naam: i.naam?.trim() || null,
      bron: 'aanmelding',
      organisatie_id: org?.id ?? null,
      sinds: i.created_at,
      afgemeld,
    });
  }

  const adressen = [...perEmail.values()].sort(
    (a, b) =>
      Number(!a.bedrijf) - Number(!b.bedrijf) ||
      (a.bedrijf ?? '').localeCompare(b.bedrijf ?? '', 'nl') ||
      a.email.localeCompare(b.email, 'nl'),
  );

  return { adressen, orgs, kolommenAanwezig: inschrijvingenRes.kolommenAanwezig };
}

/**
 * De volledige nieuwsbrieflijst plus de klanten die er nog buiten vallen.
 * In één functie, zodat de organisaties maar één keer worden opgehaald.
 */
export async function getNieuwsbriefOverzicht(): Promise<NieuwsbriefOverzicht> {
  const sb = kmsAdmin();
  if (!sb) return { adressen: [], zonderAdres: [], afmeldenMogelijk: false };

  const { adressen, orgs, kolommenAanwezig } = await bouwAdressen(sb);

  const missend = orgs.filter((o) => !schoonEmail(o.email_algemeen));
  // De contactpersonen alleen ophalen als er ook echt klanten zonder adres zijn.
  const hoofdcontacten = missend.length > 0 ? await listHoofdcontacten() : [];
  const contactVan = new Map(hoofdcontacten.map((h) => [h.organisatie_id, h]));

  const zonderAdres: KlantZonderAdres[] = missend.map((o) => ({
    id: o.id,
    naam: o.naam?.trim() || 'Naamloze klant',
    branche: o.branche?.trim() || null,
    suggestie: schoonEmail(contactVan.get(o.id)?.email),
  }));

  return { adressen, zonderAdres, afmeldenMogelijk: kolommenAanwezig };
}

/** De adressen die daadwerkelijk gemaild mogen worden. */
export function teMailen(adressen: NieuwsbriefAdres[]): NieuwsbriefAdres[] {
  return adressen.filter((a) => !a.afgemeld);
}

/**
 * Aantal te mailen adressen per branche, grootste groep eerst. Afgemelde
 * adressen tellen niet mee, zodat de teller op de chip hetzelfde getal laat
 * zien als wat je straks kopieert.
 */
export function tellPerBranche(adressen: NieuwsbriefAdres[]): BrancheTelling[] {
  const map = new Map<string, number>();
  for (const a of teMailen(adressen)) {
    const branche = a.branche || ZONDER_BRANCHE;
    map.set(branche, (map.get(branche) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([branche, aantal]) => ({ branche, aantal }))
    .sort((a, b) => b.aantal - a.aantal || a.branche.localeCompare(b.branche, 'nl'));
}

/** Filteren op branche en op een vrije zoekterm (bedrijf, adres, naam, branche). */
export function filterAdressen(
  adressen: NieuwsbriefAdres[],
  opties: { branche?: string; zoek?: string },
): NieuwsbriefAdres[] {
  const branche = (opties.branche ?? '').trim();
  const zoek = (opties.zoek ?? '').trim().toLowerCase();
  return adressen.filter((a) => {
    if (branche && (a.branche || ZONDER_BRANCHE) !== branche) return false;
    if (!zoek) return true;
    const hooiberg = `${a.email} ${a.bedrijf ?? ''} ${a.naam ?? ''} ${a.branche ?? ''}`.toLowerCase();
    return hooiberg.includes(zoek);
  });
}

/**
 * De adressen op één regel, gescheiden door een puntkomma en een spatie.
 * Dat is het formaat dat Outlook en Gmail in het bcc-veld verwachten, dus dit
 * kan er in één keer in geplakt worden.
 */
export function alsMailregel(adressen: NieuwsbriefAdres[]): string {
  return teMailen(adressen)
    .map((a) => a.email)
    .join('; ');
}

/**
 * CSV met bedrijf en branche erbij, voor een mailtool die per kolom importeert.
 * Scheidingsteken is de puntkomma: Excel in het Nederlands verwacht die, en met
 * een komma staat de hele regel in kolom A.
 */
export function alsCsv(adressen: NieuwsbriefAdres[]): string {
  const cel = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`;
  const regels = [['E-mail', 'Bedrijf', 'Branche', 'Herkomst'].map(cel).join(';')];
  for (const a of teMailen(adressen)) {
    regels.push(
      [
        cel(a.email),
        cel(a.bedrijf),
        cel(a.branche),
        cel(a.bron === 'klant' ? 'Klant' : 'Aanmelding via de site'),
      ].join(';'),
    );
  }
  return regels.join('\r\n');
}

export type AfmeldResultaat = 'ok' | 'mislukt' | 'nog-niet-klaar';

/**
 * Herkent de fout die Postgres/PostgREST teruggeeft als `afgemeld` of
 * `organisatie_id` nog niet bestaat: 42703 bij een update, PGRST204 bij een
 * insert. Dat is iets anders dan een echte storing en verdient een ander
 * antwoord aan de gebruiker.
 */
function kolomOntbreekt(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  const tekst = (error.message ?? '').toLowerCase();
  return tekst.includes('afgemeld') || tekst.includes('organisatie_id');
}

/**
 * Een adres op wel/niet mailen zetten.
 *
 * Voor een klant bestaat er meestal nog helemaal geen rij in
 * nieuwsbrief_inschrijvingen; die maken we dan aan, puur om de afmelding vast te
 * leggen. Matchen gebeurt in JS op kleine letters, omdat oudere rijen met
 * hoofdletters zijn binnengekomen en `eq` daar overheen kijkt.
 */
export async function zetAfgemeld(
  email: string,
  afgemeld: boolean,
  organisatieId?: string | null,
): Promise<AfmeldResultaat> {
  const sb = kmsAdmin();
  const adres = schoonEmail(email);
  if (!sb || !adres) return 'mislukt';

  const { data } = await sb.from('nieuwsbrief_inschrijvingen').select('id, email');
  const rijen = (data as { id: string; email: string | null }[]) ?? [];
  const treffers = rijen.filter((r) => (r.email ?? '').trim().toLowerCase() === adres);

  if (treffers.length > 0) {
    const { error } = await sb
      .from('nieuwsbrief_inschrijvingen')
      .update({ afgemeld })
      .in(
        'id',
        treffers.map((r) => r.id),
      );
    if (!error) return 'ok';
    return kolomOntbreekt(error) ? 'nog-niet-klaar' : 'mislukt';
  }

  // Weer aanmelden zonder bestaande rij: er valt niets te doen, het adres komt
  // sowieso al uit de klantkaart.
  if (!afgemeld) return 'ok';

  const { error } = await sb.from('nieuwsbrief_inschrijvingen').insert({
    email: adres,
    bron: 'dashboard',
    afgemeld: true,
    // Alleen meesturen als we hem hebben; een lege organisatie_id zou de kolom
    // onnodig op null zetten.
    ...(organisatieId ? { organisatie_id: organisatieId } : {}),
  });
  if (!error) return 'ok';
  return kolomOntbreekt(error) ? 'nog-niet-klaar' : 'mislukt';
}

/* ------------------------------------------------------------------ */
/* Doelgroep en ontvangers voor de verzending vanuit het programma      */
/* ------------------------------------------------------------------ */

export const DOELGROEP_SOORTEN = ['alle', 'actieve-klanten', 'inschrijvingen', 'branches'] as const;
export type DoelgroepSoort = (typeof DOELGROEP_SOORTEN)[number];

/** Opgeslagen in nieuwsbrieven.doelgroep. */
export type Doelgroep = { soort: DoelgroepSoort; branches: string[] };

export const DOELGROEP_LABELS: Record<DoelgroepSoort, { label: string; uitleg: string }> = {
  alle: { label: 'Iedereen in de lijst', uitleg: 'Alle klanten met een algemeen e-mailadres en alle aanmeldingen via de site.' },
  'actieve-klanten': { label: 'Alleen actieve klanten', uitleg: 'Klanten die op actief staan. Losse aanmeldingen gaan niet mee.' },
  inschrijvingen: { label: 'Alleen aanmeldingen via de site', uitleg: 'Mensen die zich zelf hebben aangemeld en (nog) geen klant zijn.' },
  branches: { label: 'Alleen bepaalde branches', uitleg: 'Kies een of meer branches hieronder.' },
};

export function normaliseerDoelgroep(v: unknown): Doelgroep {
  const o = (typeof v === 'object' && v !== null ? v : {}) as { soort?: unknown; branches?: unknown };
  const soort = DOELGROEP_SOORTEN.includes(o.soort as DoelgroepSoort) ? (o.soort as DoelgroepSoort) : 'alle';
  const branches = Array.isArray(o.branches)
    ? [...new Set(o.branches.filter((b): b is string => typeof b === 'string' && b.trim() !== '').map((b) => b.trim()))].slice(0, 100)
    : [];
  return { soort, branches };
}

/** Eén ontvanger zoals die in de wachtrij komt. */
export type NieuwsbriefOntvanger = {
  email: string;
  naam: string | null;
  bedrijf: string | null;
  organisatie_id: string | null;
};

/** Alle adressen uit de afmeldingen-tabel (campagnes en afmeldlinks), in kleine letters. */
async function afgemeldeAdressen(sb: SupabaseClient): Promise<Set<string>> {
  // In blokken van 1000: de database geeft er standaard maximaal 1000 per keer terug,
  // en een gemist afgemeld adres mag nooit alsnog een nieuwsbrief krijgen.
  const uit = new Set<string>();
  for (let van = 0; van < 200_000; van += 1000) {
    const { data, error } = await sb.from('afmeldingen').select('email').order('email').range(van, van + 999);
    if (error) break;
    const rijen = (data as { email: string | null }[]) ?? [];
    for (const r of rijen) {
      const e = (r.email ?? '').trim().toLowerCase();
      if (e) uit.add(e);
    }
    if (rijen.length < 1000) break;
  }
  return uit;
}

/**
 * Namen van contactpersonen per e-mailadres. Is het algemene adres van een klant
 * toevallig ook het adres van een contactpersoon, dan krijgt die een
 * persoonlijke aanhef in plaats van "Beste relatie".
 */
async function contactNamen(sb: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await sb.from('contactpersonen').select('email, naam');
  const uit = new Map<string, string>();
  for (const r of (data as { email: string | null; naam: string | null }[]) ?? []) {
    const email = schoonEmail(r.email);
    const naam = r.naam?.trim();
    if (email && naam && !uit.has(email)) uit.set(email, naam);
  }
  return uit;
}

/**
 * De ontvangers voor een doelgroep: ontdubbeld, zonder afgemelde adressen
 * (afgemeld=true in de inschrijvingen én alles in de afmeldingen-tabel).
 */
export async function ontvangersVoorDoelgroep(doelgroepInvoer: Doelgroep | unknown): Promise<NieuwsbriefOntvanger[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const doelgroep = normaliseerDoelgroep(doelgroepInvoer);

  const [{ adressen, orgs }, afgemeld, namen] = await Promise.all([bouwAdressen(sb), afgemeldeAdressen(sb), contactNamen(sb)]);
  const actief = new Map(orgs.map((o) => [o.id, o.actief !== false]));
  const branches = new Set(doelgroep.branches);

  return teMailen(adressen)
    .filter((a) => !afgemeld.has(a.email))
    .filter((a) => {
      switch (doelgroep.soort) {
        case 'actieve-klanten':
          return a.bron === 'klant' && a.organisatie_id !== null && actief.get(a.organisatie_id) === true;
        case 'inschrijvingen':
          return a.bron === 'aanmelding';
        case 'branches':
          return branches.size > 0 && branches.has(a.branche || ZONDER_BRANCHE);
        default:
          return true;
      }
    })
    .map((a) => ({
      email: a.email,
      naam: a.naam || namen.get(a.email) || null,
      bedrijf: a.bedrijf,
      organisatie_id: a.organisatie_id,
    }));
}

/** Branches met het aantal mailbare adressen, voor de doelgroepkeuze. */
export async function nieuwsbriefBranches(): Promise<BrancheTelling[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const [{ adressen }, afgemeld] = await Promise.all([bouwAdressen(sb), afgemeldeAdressen(sb)]);
  return tellPerBranche(adressen.filter((a) => !afgemeld.has(a.email)));
}
