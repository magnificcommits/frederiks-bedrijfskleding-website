import { getServerSupabase } from './supabaseServer';

export type WebshopVariant = {
  id: string;
  product_id: string;
  maat: string | null;
  kleur: string | null;
  verkoopprijs: number | null;
  meerprijs: number | null;
  actief: boolean;
};

export type WebshopProduct = {
  id: string;
  naam: string;
  omschrijving: string | null;
  merk: string | null;
  categorie: string | null;
  btw: number | null;
  afbeeldingen: string[] | null;
  varianten: WebshopVariant[];
};

export type WebshopMedewerker = {
  id: string;
  naam: string | null;
  voornaam: string | null;
  achternaam: string | null;
  email: string | null;
  functie: string | null;
  budget: number | null;
  actief: boolean;
};

export type WebshopOrg = {
  id: string;
  naam: string;
  budget_actief: boolean;
  goedkeuren_bestellingen: boolean;
};

export type WebshopOrder = {
  id: string;
  status: string | null;
  goedkeuring_status: string | null;
  bedrag: number | null;
  notitie: string | null;
  created_at: string;
  medewerker_id: string | null;
  aangevraagd_door: string | null;
};

export type BestelRegelInput = {
  product_id: string;
  variant_id: string;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  aantal: number;
  stukprijs: number;
};

/** De organisatie van de ingelogde gebruiker, met budget- en goedkeurinstellingen. RLS borgt de juiste org. */
export async function getMijnWebshopOrganisatie(): Promise<WebshopOrg | null> {
  const sb = await getServerSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from('organisaties')
    .select('id, naam, budget_actief, goedkeuren_bestellingen')
    .limit(1)
    .maybeSingle();
  return (data as WebshopOrg) ?? null;
}

/** Alle producten in het assortiment van de eigen organisatie, met hun actieve varianten. RLS filtert op assortiment. */
export async function getAssortiment(): Promise<WebshopProduct[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data: producten } = await sb
    .from('producten')
    .select('id, naam, omschrijving, merk, categorie, btw, afbeeldingen')
    .order('naam');
  const lijst = (producten as Omit<WebshopProduct, 'varianten'>[]) ?? [];
  if (lijst.length === 0) return [];

  const ids = lijst.map((p) => p.id);
  const { data: varianten } = await sb
    .from('product_varianten')
    .select('id, product_id, maat, kleur, verkoopprijs, meerprijs, actief')
    .in('product_id', ids)
    .eq('actief', true);
  const vlist = (varianten as WebshopVariant[]) ?? [];

  return lijst.map((p) => ({
    ...p,
    varianten: vlist.filter((v) => v.product_id === p.id),
  }));
}

/** Zoekt de medewerker waarvan het e-mailadres gelijk is aan dat van de ingelogde gebruiker. Kan null zijn. */
export async function getMijnMedewerker(): Promise<WebshopMedewerker | null> {
  const sb = await getServerSupabase();
  if (!sb) return null;
  const { data: auth } = await sb.auth.getUser();
  const email = auth.user?.email;
  if (!email) return null;
  const { data } = await sb
    .from('medewerkers')
    .select('id, naam, voornaam, achternaam, email, functie, budget, actief')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();
  return (data as WebshopMedewerker) ?? null;
}

/** Alle actieve medewerkers van de eigen organisatie. Voor de keuze als de gebruiker geen eigen match heeft. */
export async function getWebshopMedewerkers(): Promise<WebshopMedewerker[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('medewerkers')
    .select('id, naam, voornaam, achternaam, email, functie, budget, actief')
    .eq('actief', true)
    .order('naam');
  return (data as WebshopMedewerker[]) ?? [];
}

/** Som van order.bedrag voor een medewerker (al bestelde waarde). */
export async function getBudgetVerbruik(medewerkerId: string): Promise<number> {
  const sb = await getServerSupabase();
  if (!sb) return 0;
  const { data } = await sb
    .from('orders')
    .select('bedrag')
    .eq('medewerker_id', medewerkerId);
  return ((data as { bedrag: number | null }[]) ?? []).reduce((sum, r) => sum + (Number(r.bedrag) || 0), 0);
}

/** Bestelhistorie van de eigen organisatie, recent eerst. RLS borgt de juiste org. */
export async function getWebshopOrders(): Promise<WebshopOrder[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('orders')
    .select('id, status, goedkeuring_status, bedrag, notitie, created_at, medewerker_id, aangevraagd_door')
    .order('created_at', { ascending: false })
    .limit(50);
  return (data as WebshopOrder[]) ?? [];
}

/** Maakt een order plus orderregels aan. Goedkeuring en status volgen de instelling van de organisatie. */
export async function maakWebshopBestelling(
  org: WebshopOrg,
  aangevraagdDoor: string,
  medewerkerId: string | null,
  regels: BestelRegelInput[],
  notitie: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  if (regels.length === 0) return { ok: false, error: 'Geen regels' };

  const bedrag = regels.reduce((sum, r) => sum + r.aantal * r.stukprijs, 0);
  const goedkeuringStatus = org.goedkeuren_bestellingen ? 'wacht' : 'niet_nodig';
  const status = org.goedkeuren_bestellingen ? 'concept' : 'nog_bestellen';

  const { data, error } = await sb
    .from('orders')
    .insert({
      organisatie_id: org.id,
      medewerker_id: medewerkerId,
      aangevraagd_door: aangevraagdDoor,
      status,
      goedkeuring_status: goedkeuringStatus,
      bedrag,
      notitie: notitie || null,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Aanmaken mislukt' };

  const orderId = (data as { id: string }).id;
  const rows = regels.map((r) => ({
    order_id: orderId,
    product_id: r.product_id,
    variant_id: r.variant_id,
    item_naam: r.item_naam,
    maat: r.maat,
    kleur: r.kleur,
    aantal: r.aantal,
    stukprijs: r.stukprijs,
  }));
  const { error: e2 } = await sb.from('orderregels').insert(rows);
  if (e2) return { ok: false, error: e2.message };
  return { ok: true };
}
