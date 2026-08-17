import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Data-access voor het CRM rond de klantkaart: contactpersonen, activiteiten/opvolging
 * en een verkoopoverzicht. Alle queries via kmsAdmin() (service-role, omzeilt RLS).
 * Alleen server-side gebruiken, altijd achter dashAuthed().
 */

export const ACTIVITEIT_SOORTEN = ['notitie', 'telefoon', 'bezoek', 'offerte', 'mail'] as const;
export type ActiviteitSoort = (typeof ACTIVITEIT_SOORTEN)[number];

export type Contactpersoon = {
  id: string;
  organisatie_id: string;
  naam: string;
  functie: string | null;
  email: string | null;
  telefoon: string | null;
  mobiel: string | null;
  hoofdcontact: boolean;
  opmerkingen: string | null;
  created_at: string;
};

export type ContactpersoonVelden = {
  naam: string;
  functie?: string | null;
  email?: string | null;
  telefoon?: string | null;
  mobiel?: string | null;
  hoofdcontact?: boolean;
  opmerkingen?: string | null;
};

export type Activiteit = {
  id: string;
  organisatie_id: string;
  soort: string;
  omschrijving: string;
  datum: string;
  opvolgdatum: string | null;
  door: string | null;
  created_at: string;
};

export type ActiviteitVelden = {
  soort?: string;
  omschrijving: string;
  datum?: string | null;
  opvolgdatum?: string | null;
  door?: string | null;
};

export type VerkoopOrder = { id: string; ordernummer: number | null; status: string; bedrag: number | null; besteldatum: string | null };
export type VerkoopFactuur = { id: string; factuurnummer: string | null; status: string; bedrag_incl: number | null; factuurdatum: string | null };
export type HerkomstLead = { id: string; name: string | null; bron: string | null; status: string | null };

export type KlantVerkoop = {
  orders: VerkoopOrder[];
  facturen: VerkoopFactuur[];
  omzetBetaald: number;
  herkomstLead: HerkomstLead | null;
};

// ---- Contactpersonen ----

export async function listContactpersonen(orgId: string): Promise<Contactpersoon[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('contactpersonen')
    .select('*')
    .eq('organisatie_id', orgId)
    .order('hoofdcontact', { ascending: false })
    .order('naam');
  return (data as Contactpersoon[]) ?? [];
}

export async function maakContactpersoon(orgId: string, v: ContactpersoonVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('contactpersonen').insert({
    organisatie_id: orgId,
    naam: v.naam,
    functie: v.functie || null,
    email: v.email || null,
    telefoon: v.telefoon || null,
    mobiel: v.mobiel || null,
    hoofdcontact: v.hoofdcontact ?? false,
    opmerkingen: v.opmerkingen || null,
  });
  return !error;
}

export async function werkContactpersoon(id: string, v: Partial<ContactpersoonVelden>): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const patch: Record<string, unknown> = {};
  if (v.naam !== undefined) patch.naam = v.naam;
  if (v.functie !== undefined) patch.functie = v.functie || null;
  if (v.email !== undefined) patch.email = v.email || null;
  if (v.telefoon !== undefined) patch.telefoon = v.telefoon || null;
  if (v.mobiel !== undefined) patch.mobiel = v.mobiel || null;
  if (v.hoofdcontact !== undefined) patch.hoofdcontact = v.hoofdcontact;
  if (v.opmerkingen !== undefined) patch.opmerkingen = v.opmerkingen || null;
  const { error } = await sb.from('contactpersonen').update(patch).eq('id', id);
  return !error;
}

export async function verwijderContactpersoon(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('contactpersonen').delete().eq('id', id);
  return !error;
}

export type Hoofdcontact = {
  organisatie_id: string;
  naam: string;
  email: string;
};

/**
 * Per organisatie één contactpersoon mét e-mailadres, voor alle klanten tegelijk
 * in één query. Het hoofdcontact wint; heeft die geen adres (of is er geen
 * hoofdcontact aangevinkt), dan de eerste contactpersoon die er wel een heeft.
 *
 * Gebruikt door de nieuwsbrieflijst om te tonen dat er wél een adres bekend is
 * bij een klant zonder `email_algemeen`. Bewust alleen als suggestie: een
 * contactpersoon is een persoon die morgen weg kan zijn, `email_algemeen` is het
 * adres van het bedrijf. Die twee stilzwijgend gelijkstellen levert post op aan
 * mensen die er niet meer werken.
 */
export async function listHoofdcontacten(): Promise<Hoofdcontact[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('contactpersonen')
    .select('organisatie_id, naam, email, hoofdcontact')
    .order('naam');
  const rijen =
    (data as {
      organisatie_id: string | null;
      naam: string | null;
      email: string | null;
      hoofdcontact: boolean | null;
    }[]) ?? [];

  // Sorteren in JS: `order` op een boolean zet in Postgres de null-waarden vooraan
  // bij aflopend sorteren, en dan wint een rij zonder hoofdcontact-vinkje.
  const gesorteerd = [...rijen].sort(
    (a, b) => Number(b.hoofdcontact === true) - Number(a.hoofdcontact === true),
  );

  const perOrg = new Map<string, Hoofdcontact>();
  for (const r of gesorteerd) {
    const email = r.email?.trim();
    if (!r.organisatie_id || !email || perOrg.has(r.organisatie_id)) continue;
    perOrg.set(r.organisatie_id, {
      organisatie_id: r.organisatie_id,
      naam: r.naam?.trim() || 'Contactpersoon',
      email,
    });
  }
  return [...perOrg.values()];
}

// ---- Activiteiten / opvolging ----

export async function listActiviteiten(orgId: string): Promise<Activiteit[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('klant_activiteiten')
    .select('*')
    .eq('organisatie_id', orgId)
    .order('datum', { ascending: false })
    .order('created_at', { ascending: false });
  return (data as Activiteit[]) ?? [];
}

export async function maakActiviteit(orgId: string, v: ActiviteitVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const row: Record<string, unknown> = {
    organisatie_id: orgId,
    omschrijving: v.omschrijving,
  };
  if (v.soort) row.soort = v.soort;
  if (v.datum) row.datum = v.datum;
  if (v.opvolgdatum) row.opvolgdatum = v.opvolgdatum;
  if (v.door) row.door = v.door;
  const { error } = await sb.from('klant_activiteiten').insert(row);
  return !error;
}

export async function verwijderActiviteit(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('klant_activiteiten').delete().eq('id', id);
  return !error;
}

// ---- Verkoopoverzicht ----

export async function getKlantVerkoop(orgId: string): Promise<KlantVerkoop> {
  const sb = kmsAdmin();
  if (!sb) return { orders: [], facturen: [], omzetBetaald: 0, herkomstLead: null };

  const [ordersRes, facturenRes, leadRes] = await Promise.all([
    sb
      .from('orders')
      .select('id, ordernummer, status, bedrag, besteldatum')
      .eq('organisatie_id', orgId)
      .order('besteldatum', { ascending: false }),
    sb
      .from('facturen')
      .select('id, factuurnummer, status, bedrag_incl, factuurdatum')
      .eq('organisatie_id', orgId)
      .order('factuurdatum', { ascending: false }),
    sb
      .from('leads')
      .select('id, name, bron, status')
      .eq('organisatie_id', orgId)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const orders = (ordersRes.data as VerkoopOrder[]) ?? [];
  const facturen = (facturenRes.data as VerkoopFactuur[]) ?? [];
  const omzetBetaald = facturen
    .filter((f) => f.status === 'betaald')
    .reduce((t, f) => t + (Number(f.bedrag_incl) || 0), 0);
  const herkomstLead = (leadRes.data as HerkomstLead | null) ?? null;

  return { orders, facturen, omzetBetaald, herkomstLead };
}
