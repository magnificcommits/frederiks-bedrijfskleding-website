import { getServerSupabase } from './supabaseServer';

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
  }
  return { ok: true };
}

/** Wijzigt de rol van een bestaande portaaltoegang (match op e-mail). Alleen beheerder (RLS). */
export async function wijzigRol(email: string, rol: PortaalRol): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const { error } = await sb.from('portaal_gebruikers').update({ rol }).ilike('email', email);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Trekt de portaaltoegang in door de portaal_gebruikers-rij te verwijderen. Alleen beheerder (RLS). */
export async function trekToegangIn(email: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const { error } = await sb.from('portaal_gebruikers').delete().ilike('email', email);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
  return { ok: true };
}

/** Zet het kledingbudget van een medewerker. Alleen beheerder (RLS). */
export async function zetBudget(medewerkerId: string, budget: number | null): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const { error } = await sb.from('medewerkers').update({ budget }).eq('id', medewerkerId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
