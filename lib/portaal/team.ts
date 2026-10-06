import { getServerSupabase } from './supabaseServer';
import { eisRijen } from '@/lib/dbFout';

export type PortaalRol = 'beheerder' | 'leidinggevende' | 'medewerker';

export type MijnToegang = {
  rol: PortaalRol | null;
  medewerkerId: string | null;
  organisatieId: string | null;
  email: string | null;
};

export type TeamGebruiker = {
  id: string;
  organisatie_id: string;
  email: string;
  naam: string | null;
  rol: PortaalRol;
  medewerker_id: string | null;
};

export type TeamLid = {
  medewerkerId: string;
  naam: string;
  email: string | null;
  functie: string | null;
  budget: number | null;
  actief: boolean;
  /** De gekoppelde portaaltoegang, als de medewerker kan inloggen. */
  toegang: { email: string; rol: PortaalRol } | null;
};

/**
 * Haalt de eigen portaal_gebruikers-rij op via het auth-e-mailadres.
 * Geeft de rol, de eigen medewerker-id en de organisatie terug. RLS borgt de scope.
 */
export async function getMijnToegang(): Promise<MijnToegang> {
  const sb = await getServerSupabase();
  const leeg: MijnToegang = { rol: null, medewerkerId: null, organisatieId: null, email: null };
  if (!sb) return leeg;
  const { data: auth } = await sb.auth.getUser();
  const email = auth.user?.email ?? null;
  if (!email) return leeg;
  const { data } = await sb
    .from('portaal_gebruikers')
    .select('organisatie_id, rol, medewerker_id')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();
  const rij = data as { organisatie_id: string; rol: PortaalRol; medewerker_id: string | null } | null;
  if (!rij) return { ...leeg, email };
  return {
    rol: rij.rol,
    medewerkerId: rij.medewerker_id,
    organisatieId: rij.organisatie_id,
    email,
  };
}

/**
 * Lijst van medewerkers van de eigen organisatie, met of ze een portaalaccount hebben en welke rol.
 * Koppelt op medewerker_id, met e-mail als terugval.
 */
export async function listTeam(): Promise<TeamLid[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];

  const { data: medewerkers } = await sb
    .from('medewerkers')
    .select('id, naam, voornaam, achternaam, email, functie, budget, actief')
    .order('naam');
  const mws =
    (medewerkers as {
      id: string;
      naam: string | null;
      voornaam: string | null;
      achternaam: string | null;
      email: string | null;
      functie: string | null;
      budget: number | null;
      actief: boolean;
    }[]) ?? [];

  const { data: gebruikers } = await sb
    .from('portaal_gebruikers')
    .select('email, naam, rol, medewerker_id');
  const gbs =
    (gebruikers as { email: string; naam: string | null; rol: PortaalRol; medewerker_id: string | null }[]) ?? [];

  const perMedewerker = new Map<string, { email: string; rol: PortaalRol }>();
  const perEmail = new Map<string, { email: string; rol: PortaalRol }>();
  for (const g of gbs) {
    if (g.medewerker_id) perMedewerker.set(g.medewerker_id, { email: g.email, rol: g.rol });
    if (g.email) perEmail.set(g.email.toLowerCase(), { email: g.email, rol: g.rol });
  }

  return mws.map((m) => {
    const naam = m.naam ?? [m.voornaam, m.achternaam].filter(Boolean).join(' ') ?? '';
    const viaId = perMedewerker.get(m.id);
    const viaEmail = m.email ? perEmail.get(m.email.toLowerCase()) : undefined;
    return {
      medewerkerId: m.id,
      naam: naam || (m.email ?? 'Onbekend'),
      email: m.email,
      functie: m.functie,
      budget: m.budget != null ? Number(m.budget) : null,
      actief: m.actief,
      toegang: viaId ?? viaEmail ?? null,
    };
  });
}

/**
 * Maakt een medewerker aan en, als er een e-mail is, meteen een portaal_gebruikers-rij
 * met de gekozen rol en medewerker_id zodat de persoon kan inloggen. Alleen een beheerder
 * mag dit (RLS dwingt dit af).
 */
export async function maakMedewerkerMetToegang(input: {
  organisatieId: string;
  naam: string;
  email: string;
  functie: string;
  rol: PortaalRol;
  budget: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };

  const email = input.email.trim();
  const { data, error } = await sb
    .from('medewerkers')
    .insert({
      organisatie_id: input.organisatieId,
      naam: input.naam,
      email: email || null,
      functie: input.functie || null,
      budget: input.budget,
      actief: true,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Aanmaken mislukt' };
  const medewerkerId = (data as { id: string }).id;

  if (email) {
    const { error: e2 } = await sb.from('portaal_gebruikers').insert({
      organisatie_id: input.organisatieId,
      email,
      naam: input.naam,
      rol: input.rol,
      medewerker_id: medewerkerId,
    });
    if (e2) return { ok: false, error: e2.message };
    await naToegang(input.organisatieId, email, input.naam);
  }
  return { ok: true };
}

/** Wijzigt de rol van een bestaande portaaltoegang (match op e-mail). Alleen beheerder (RLS). */
export async function wijzigRol(email: string, rol: PortaalRol): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  // .select() laat zien of er echt een rij is aangepast: RLS weigert stil (0 rijen)
  // bij een ander bedrijf, zonder beheerdersrol of bij je eigen account.
  const { data, error } = await sb.from('portaal_gebruikers').update({ rol }).ilike('email', email).select('email');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: 'Geen rij aangepast' };
  return { ok: true };
}

/** Trekt de portaaltoegang in door de portaal_gebruikers-rij te verwijderen. Alleen beheerder (RLS). */
export async function trekToegangIn(email: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  // .select(): RLS weigert stil (0 rijen) als je geen beheerder bent of het een ander bedrijf is.
  const r = eisRijen('portaal.trekToegangIn', await sb.from('portaal_gebruikers').delete().ilike('email', email).select('id'));
  return r.ok ? { ok: true } : { ok: false, error: r.fout };
}

/** Geeft een bestaande medewerker (zonder account) toegang met een rol. Alleen beheerder (RLS). */
export async function geefToegang(input: {
  organisatieId: string;
  medewerkerId: string;
  naam: string;
  email: string;
  rol: PortaalRol;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const email = input.email.trim();
  if (!email) return { ok: false, error: 'Geen e-mailadres bekend voor deze medewerker' };
  const { error } = await sb.from('portaal_gebruikers').insert({
    organisatie_id: input.organisatieId,
    email,
    naam: input.naam,
    rol: input.rol,
    medewerker_id: input.medewerkerId,
  });
  if (error) return { ok: false, error: error.message };
  await naToegang(input.organisatieId, email, input.naam);
  return { ok: true };
}

/**
 * Na toegang geven door de werkgever: account aanmaken (het inlogscherm doet dat niet
 * meer) en de uitnodiging mailen, met de werkgever als afzender in het logboek.
 */
async function naToegang(orgId: string, email: string, naam: string): Promise<void> {
  try {
    const [{ zorgAuthGebruiker, stuurPortaalUitnodiging }, mij] = await Promise.all([import('@/lib/kms/crm'), getMijnToegang()]);
    await zorgAuthGebruiker(email);
    await stuurPortaalUitnodiging(email, naam || null, orgId, mij.email ?? undefined);
  } catch {
    // Toegang staat; de mail is een extra. Het KMS toont of hij is aangekomen.
  }
}

/** Zet het kledingbudget van een medewerker. Alleen beheerder (RLS). */
export async function zetBudget(medewerkerId: string, budget: number | null): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const r = eisRijen('portaal.zetBudget', await sb.from('medewerkers').update({ budget }).eq('id', medewerkerId).select('id'));
  return r.ok ? { ok: true } : { ok: false, error: r.fout };
}

// --- Detailinstellingen per medewerker: budget + vestiging + voorkeursmaten ---

export type BudgetType = 'euro' | 'punten';
export type BudgetPeriode = 'geen' | 'maand' | 'kwartaal' | 'jaar';

export type MedewerkerDetail = {
  id: string;
  naam: string;
  functie: string | null;
  email: string | null;
  budget: number | null;
  budgetType: BudgetType;
  startbudget: number | null;
  periodiekBudget: number | null;
  budgetPeriode: BudgetPeriode;
  behoudRestbudget: boolean;
  productbudget: number | null;
  buitenBudgetToegestaan: boolean;
  vestigingId: string | null;
};

export type Vestiging = { id: string; naam: string };

export type ProductMetMaten = {
  id: string;
  naam: string;
  maten: string[];
};

export type Voorkeursmaat = {
  id: string;
  productId: string;
  voorkeursmaat: string | null;
  plusMinusToegestaan: boolean;
};

function leesBudgetType(waarde: unknown): BudgetType {
  return waarde === 'punten' ? 'punten' : 'euro';
}
function leesBudgetPeriode(waarde: unknown): BudgetPeriode {
  return waarde === 'maand' || waarde === 'kwartaal' || waarde === 'jaar' ? waarde : 'geen';
}

/** Haalt één medewerker op met alle budgetvelden en de vestiging. RLS borgt de scope. */
export async function getMedewerkerDetail(id: string): Promise<MedewerkerDetail | null> {
  const sb = await getServerSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from('medewerkers')
    .select(
      'id, naam, voornaam, achternaam, functie, email, budget, budget_type, startbudget, periodiek_budget, budget_periode, behoud_restbudget, productbudget, buiten_budget_toegestaan, vestiging_id',
    )
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const m = data as unknown as {
    id: string;
    naam: string | null;
    voornaam: string | null;
    achternaam: string | null;
    functie: string | null;
    email: string | null;
    budget: number | null;
    budget_type: string | null;
    startbudget: number | null;
    periodiek_budget: number | null;
    budget_periode: string | null;
    behoud_restbudget: boolean | null;
    productbudget: number | null;
    buiten_budget_toegestaan: boolean | null;
    vestiging_id: string | null;
  };
  const naam = m.naam ?? [m.voornaam, m.achternaam].filter(Boolean).join(' ') ?? '';
  return {
    id: m.id,
    naam: naam || (m.email ?? 'Onbekend'),
    functie: m.functie,
    email: m.email,
    budget: m.budget != null ? Number(m.budget) : null,
    budgetType: leesBudgetType(m.budget_type),
    startbudget: m.startbudget != null ? Number(m.startbudget) : null,
    periodiekBudget: m.periodiek_budget != null ? Number(m.periodiek_budget) : null,
    budgetPeriode: leesBudgetPeriode(m.budget_periode),
    behoudRestbudget: Boolean(m.behoud_restbudget),
    productbudget: m.productbudget != null ? Number(m.productbudget) : null,
    buitenBudgetToegestaan: Boolean(m.buiten_budget_toegestaan),
    vestigingId: m.vestiging_id,
  };
}

/** Zet alle budgetinstellingen van een medewerker in één keer. Alleen beheerder (RLS). */
export async function zetBudgetInstellingen(
  id: string,
  velden: {
    budget_type: BudgetType;
    startbudget: number | null;
    budget: number | null;
    productbudget: number | null;
    buiten_budget_toegestaan: boolean;
    periodiek_budget: number | null;
    budget_periode: BudgetPeriode;
    behoud_restbudget: boolean;
  },
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const { data, error } = await sb
    .from('medewerkers')
    .update({
      budget_type: velden.budget_type,
      startbudget: velden.startbudget,
      budget: velden.budget,
      productbudget: velden.productbudget,
      buiten_budget_toegestaan: velden.buiten_budget_toegestaan,
      periodiek_budget: velden.periodiek_budget,
      budget_periode: velden.budget_periode,
      behoud_restbudget: velden.behoud_restbudget,
    })
    .eq('id', id)
    .select('id');
  if (error) return { ok: false, error: error.message };
  const r = eisRijen('portaal.zetBudgetInstellingen', { data, error });
  return r.ok ? { ok: true } : { ok: false, error: r.fout };
}

/** Koppelt een medewerker aan een vestiging (of maakt de koppeling leeg). Alleen beheerder (RLS). */
export async function zetVestiging(
  medewerkerId: string,
  vestigingId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const r = eisRijen('portaal.zetVestiging', await sb.from('medewerkers').update({ vestiging_id: vestigingId }).eq('id', medewerkerId).select('id'));
  return r.ok ? { ok: true } : { ok: false, error: r.fout };
}

/** Lijst van vestigingen van de eigen organisatie. RLS borgt de scope. */
export async function listVestigingen(): Promise<Vestiging[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data } = await sb.from('vestigingen').select('id, naam').order('naam');
  return ((data as { id: string; naam: string }[]) ?? []).map((v) => ({ id: v.id, naam: v.naam }));
}

/** Actieve producten met hun beschikbare maten, voor de keuzes bij voorkeursmaten. */
export async function listProductenVoorMaten(): Promise<ProductMetMaten[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('producten')
    .select('id, naam, product_varianten(maat, actief)')
    .eq('actief', true)
    .order('naam');
  const rows =
    (data as unknown as { id: string; naam: string | null; product_varianten: { maat: string | null; actief: boolean | null }[] }[]) ??
    [];
  return rows.map((p) => {
    const maten = Array.from(
      new Set(
        (p.product_varianten ?? [])
          .filter((v) => v.actief !== false && v.maat)
          .map((v) => v.maat as string),
      ),
    );
    return { id: p.id, naam: p.naam ?? 'Onbekend product', maten };
  });
}

/** Voorkeursmaten van een medewerker (alle producten waarvoor iets is vastgelegd). */
export async function getVoorkeursmaten(medewerkerId: string): Promise<Voorkeursmaat[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('medewerker_maten')
    .select('id, product_id, voorkeursmaat, plus_minus_toegestaan')
    .eq('medewerker_id', medewerkerId);
  const rows =
    (data as { id: string; product_id: string; voorkeursmaat: string | null; plus_minus_toegestaan: boolean | null }[]) ?? [];
  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    voorkeursmaat: r.voorkeursmaat,
    plusMinusToegestaan: Boolean(r.plus_minus_toegestaan),
  }));
}

/** Slaat de voorkeursmaat voor een product op (upsert op medewerker_id + product_id). Alleen beheerder (RLS). */
export async function zetVoorkeursmaat(
  medewerkerId: string,
  productId: string,
  voorkeursmaat: string | null,
  plusMinus: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const { error } = await sb.from('medewerker_maten').upsert(
    {
      medewerker_id: medewerkerId,
      product_id: productId,
      voorkeursmaat: voorkeursmaat || null,
      plus_minus_toegestaan: plusMinus,
    },
    { onConflict: 'medewerker_id,product_id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Verwijdert een vastgelegde voorkeursmaat. Alleen beheerder (RLS). */
export async function verwijderVoorkeursmaat(id: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const r = eisRijen('portaal.verwijderVoorkeursmaat', await sb.from('medewerker_maten').delete().eq('id', id).select('id'));
  return r.ok ? { ok: true } : { ok: false, error: r.fout };
}
