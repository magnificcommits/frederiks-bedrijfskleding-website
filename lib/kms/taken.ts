import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Data-access voor de taken/to-do-module (CRM-opvolging op het dashboard).
 *
 * De tabel `taken` heeft RLS aan met GEEN policies, dus alle lees-/schrijfacties
 * verlopen via kmsAdmin() (service-role). Alleen server-side gebruiken, altijd
 * achter dashAuthed().
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

/** Alleen waardes uit de lijst toelaten; al het andere wordt null. */
export function schoneWerkstatus(v: unknown): TaakWerkstatus | null {
  const s = String(v ?? '').trim();
  return (TAAK_WERKSTATUSSEN as readonly string[]).includes(s) ? (s as TaakWerkstatus) : null;
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
  /** Naam van de gekoppelde organisatie (via join), indien aanwezig. */
  organisatie_naam?: string | null;
};

/** Rij zoals Supabase die teruggeeft met de geneste organisatie-join. */
type TaakRij = Omit<Taak, 'organisatie_naam'> & {
  organisaties: { naam: string | null } | null;
};

/**
 * Taken ophalen met de naam van de gekoppelde organisatie. Open taken eerst,
 * gesorteerd op vervaldatum (lege datums achteraan) en daarna op aanmaakdatum.
 */
export async function listTaken(filter: 'open' | 'klaar' | 'alle' = 'open'): Promise<Taak[]> {
  const sb = kmsAdmin();
  if (!sb) return [];

  let query = sb
    .from('taken')
    .select(
      'id, titel, omschrijving, organisatie_id, status, werkstatus, prioriteit, vervaldatum, toegewezen_aan, created_at, afgerond_op, organisaties(naam)',
    );
  if (filter === 'open' || filter === 'klaar') {
    query = query.eq('status', filter);
  }

  const { data } = await query;
  const rijen = (data as unknown as TaakRij[]) ?? [];

  const taken: Taak[] = rijen.map((r) => ({
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
    organisatie_naam: r.organisaties?.naam ?? null,
  }));

  // Sorteren: open taken eerst; binnen elke groep op vervaldatum (nulls laatst),
  // daarna op aanmaakdatum (oudste eerst).
  const rang = (t: Taak) => (t.status === 'open' ? 0 : 1);
  taken.sort((a, b) => {
    if (rang(a) !== rang(b)) return rang(a) - rang(b);
    if (a.vervaldatum !== b.vervaldatum) {
      if (!a.vervaldatum) return 1;
      if (!b.vervaldatum) return -1;
      return a.vervaldatum < b.vervaldatum ? -1 : 1;
    }
    return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
  });

  return taken;
}

/** Nieuwe taak aanmaken. Lege optionele velden worden null. */
export async function maakTaak(input: {
  titel: string;
  omschrijving?: string;
  organisatie_id?: string | null;
  prioriteit?: string;
  werkstatus?: string | null;
  vervaldatum?: string | null;
  toegewezen_aan?: string | null;
}): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;
  const titel = input.titel.trim();
  if (!titel) return false;

  const { error } = await sb.from('taken').insert({
    titel,
    omschrijving: input.omschrijving?.trim() || null,
    organisatie_id: input.organisatie_id?.trim() || null,
    prioriteit: input.prioriteit?.trim() || 'normaal',
    werkstatus: schoneWerkstatus(input.werkstatus) ?? 'Niet gestart',
    vervaldatum: input.vervaldatum?.trim() || null,
    toegewezen_aan: input.toegewezen_aan?.trim() || null,
  });
  return !error;
}

/**
 * Status van een taak zetten. Bij 'klaar' wordt afgerond_op op nu gezet,
 * bij 'open' weer leeggemaakt.
 */
export async function zetTaakStatus(id: string, status: 'open' | 'klaar'): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb || !id) return false;
  const { error } = await sb
    .from('taken')
    .update({
      status,
      afgerond_op: status === 'klaar' ? new Date().toISOString() : null,
    })
    .eq('id', id);
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
