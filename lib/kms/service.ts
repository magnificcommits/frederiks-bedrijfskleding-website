import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Data-access voor de modules Retouren en Klachten/Vragen (beheerkant).
 * Medewerkers melden retouren en klachten later vanuit het portaal aan; hier
 * beheert het kantoor de status en legt het antwoord of de instructie vast.
 * Alleen server-side gebruiken, altijd achter dashAuthed().
 */

export const RETOUR_STATUSSEN = ['aangemeld', 'goedgekeurd', 'afgewezen', 'verwerkt'] as const;
export type RetourStatus = (typeof RETOUR_STATUSSEN)[number];

export const KLACHT_STATUSSEN = ['open', 'in_behandeling', 'afgehandeld'] as const;
export type KlachtStatus = (typeof KLACHT_STATUSSEN)[number];

export const KLACHT_SOORTEN = ['vraag', 'klacht'] as const;
export type KlachtSoort = (typeof KLACHT_SOORTEN)[number];

export type Retour = {
  id: string;
  organisatie_id: string | null;
  order_id: string | null;
  medewerker_id: string | null;
  reden: string | null;
  status: string;
  retouradres: string | null;
  instructie: string | null;
  created_at: string;
};

export type RetourMetLabels = Retour & {
  organisatie_naam: string | null;
  ordernummer: string | null;
};

export type Klacht = {
  id: string;
  organisatie_id: string | null;
  order_id: string | null;
  medewerker_id: string | null;
  soort: string;
  omschrijving: string;
  status: string;
  antwoord: string | null;
  created_at: string;
};

export type KlachtMetLabels = Klacht & {
  organisatie_naam: string | null;
  ordernummer: string | null;
};

export type OrganisatieKeuze = { id: string; naam: string };

/** Klanten voor de aanmaakformulieren, op naam gesorteerd. */
export async function listOrganisaties(): Promise<OrganisatieKeuze[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('organisaties').select('id, naam').order('naam');
  return (data as OrganisatieKeuze[]) ?? [];
}

/* ----------------------------- Retouren ----------------------------- */

export async function listRetouren(statusFilter?: string): Promise<RetourMetLabels[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  let q = sb
    .from('retouren')
    .select('*, organisaties(naam), orders(ordernummer)')
    .order('created_at', { ascending: false });
  if (statusFilter && statusFilter.trim()) q = q.eq('status', statusFilter.trim());
  const { data } = await q;
  const rows =
    (data as unknown as (Retour & {
      organisaties: { naam: string } | null;
      orders: { ordernummer: string } | null;
    })[]) ?? [];
  return rows.map((r) => {
    const { organisaties, orders, ...rest } = r;
    return {
      ...rest,
      organisatie_naam: organisaties?.naam ?? null,
      ordernummer: orders?.ordernummer ?? null,
    } as RetourMetLabels;
  });
}

export async function maakRetour(velden: {
  organisatie_id?: string | null;
  order_id?: string | null;
  medewerker_id?: string | null;
  reden?: string | null;
  retouradres?: string | null;
  instructie?: string | null;
}): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const rij: Record<string, unknown> = {
    organisatie_id: velden.organisatie_id ?? null,
    order_id: velden.order_id ?? null,
    medewerker_id: velden.medewerker_id ?? null,
    reden: velden.reden ?? null,
    retouradres: velden.retouradres ?? null,
    instructie: velden.instructie ?? null,
  };
  const { error } = await sb.from('retouren').insert(rij);
  return !error;
}

export async function zetRetourStatus(id: string, status: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('retouren').update({ status }).eq('id', id);
  return !error;
}

export async function zetRetourInstructie(
  id: string,
  retouradres: string | null,
  instructie: string | null,
): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('retouren').update({ retouradres, instructie }).eq('id', id);
  return !error;
}

/* ---------------------------- Klachten/Vragen ---------------------------- */

export async function listKlachten(statusFilter?: string): Promise<KlachtMetLabels[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  let q = sb
    .from('klachten')
    .select('*, organisaties(naam), orders(ordernummer)')
    .order('created_at', { ascending: false });
  if (statusFilter && statusFilter.trim()) q = q.eq('status', statusFilter.trim());
  const { data } = await q;
  const rows =
    (data as unknown as (Klacht & {
      organisaties: { naam: string } | null;
      orders: { ordernummer: string } | null;
    })[]) ?? [];
  return rows.map((r) => {
    const { organisaties, orders, ...rest } = r;
    return {
      ...rest,
      organisatie_naam: organisaties?.naam ?? null,
      ordernummer: orders?.ordernummer ?? null,
    } as KlachtMetLabels;
  });
}

export async function maakKlacht(velden: {
  organisatie_id?: string | null;
  order_id?: string | null;
  medewerker_id?: string | null;
  soort?: string | null;
  omschrijving: string;
}): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const rij: Record<string, unknown> = {
    organisatie_id: velden.organisatie_id ?? null,
    order_id: velden.order_id ?? null,
    medewerker_id: velden.medewerker_id ?? null,
    omschrijving: velden.omschrijving,
  };
  if (velden.soort) rij.soort = velden.soort;
  const { error } = await sb.from('klachten').insert(rij);
  return !error;
}

export async function zetKlachtStatus(id: string, status: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('klachten').update({ status }).eq('id', id);
  return !error;
}

export async function beantwoordKlacht(id: string, antwoord: string | null): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('klachten').update({ antwoord }).eq('id', id);
  return !error;
}
