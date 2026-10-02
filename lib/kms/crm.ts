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
  /** Dit is het facturatiecontact: zijn e-mailadres gaat op de factuur. Hoogstens één per klant. */
  facturatie: boolean;
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
  facturatie?: boolean;
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

export async function maakContactpersoon(orgId: string, v: ContactpersoonVelden): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  // Er mag maar één facturatiecontact zijn: de vorige gaat eerst uit.
  if (v.facturatie) await sb.from('contactpersonen').update({ facturatie: false }).eq('organisatie_id', orgId).eq('facturatie', true);
  const rij: Record<string, unknown> = {
    organisatie_id: orgId,
    naam: v.naam,
    functie: v.functie || null,
    email: v.email || null,
    telefoon: v.telefoon || null,
    mobiel: v.mobiel || null,
    hoofdcontact: v.hoofdcontact ?? false,
    opmerkingen: v.opmerkingen || null,
  };
  if (v.facturatie) rij.facturatie = true;
  const { data, error } = await sb.from('contactpersonen').insert(rij).select('id').single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/**
 * Contactpersoon bijwerken. Wordt hij facturatiecontact, dan gaat het vinkje
 * bij de vorige facturatiecontact van dezelfde klant eerst uit (er mag er maar
 * één zijn). Geeft voor/na terug met alleen de gewijzigde velden.
 */
export async function werkContactpersoon(
  id: string,
  v: Partial<ContactpersoonVelden>,
): Promise<{ ok: boolean; voor: Record<string, unknown>; na: Record<string, unknown> }> {
  const sb = kmsAdmin(); if (!sb) return { ok: false, voor: {}, na: {} };
  const { data } = await sb.from('contactpersonen').select('*').eq('id', id).maybeSingle();
  const huidig = data as Record<string, unknown> | null;
  if (!huidig) return { ok: false, voor: {}, na: {} };

  const gewenst: Record<string, unknown> = {};
  if (v.naam !== undefined && v.naam.trim()) gewenst.naam = v.naam.trim();
  if (v.functie !== undefined) gewenst.functie = v.functie || null;
  if (v.email !== undefined) gewenst.email = v.email || null;
  if (v.telefoon !== undefined) gewenst.telefoon = v.telefoon || null;
  if (v.mobiel !== undefined) gewenst.mobiel = v.mobiel || null;
  if (v.hoofdcontact !== undefined) gewenst.hoofdcontact = v.hoofdcontact;
  if (v.facturatie !== undefined) gewenst.facturatie = v.facturatie;
  if (v.opmerkingen !== undefined) gewenst.opmerkingen = v.opmerkingen || null;

  const voor: Record<string, unknown> = {};
  const na: Record<string, unknown> = {};
  for (const [sleutel, waarde] of Object.entries(gewenst)) {
    const oud = huidig[sleutel] ?? null;
    if (oud !== (waarde ?? null)) {
      voor[sleutel] = oud;
      na[sleutel] = waarde;
    }
  }
  if (Object.keys(na).length === 0) return { ok: true, voor, na };

  if (na.facturatie === true) {
    await sb
      .from('contactpersonen')
      .update({ facturatie: false })
      .eq('organisatie_id', String(huidig.organisatie_id))
      .eq('facturatie', true)
      .neq('id', id);
  }
  const { error } = await sb.from('contactpersonen').update(na).eq('id', id);
  return { ok: !error, voor, na };
}

/**
 * Alle branches die al bij klanten voorkomen, voor de suggestielijst bij het
 * invullen. Zo blijft de schrijfwijze gelijk en werkt het filter op de
 * klantenlijst.
 */
export async function listBranches(): Promise<string[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('organisaties').select('branche').not('branche', 'is', null).limit(5000);
  const set = new Set<string>();
  for (const r of (data as { branche: string | null }[]) ?? []) {
    const b = r.branche?.trim();
    if (b) set.add(b);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'nl'));
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
