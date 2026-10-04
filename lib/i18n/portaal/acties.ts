'use server';
import { cookies } from 'next/headers';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';
import { isTaal, TAAL_COOKIE, TAAL_COOKIE_MAXAGE, type Taal } from './kern';

/**
 * Slaat de taal op bij de ingelogde portaalgebruiker, via de database-functie
 * zet_mijn_portaal_taal (security definer, wijzigt alleen de eigen rij en alleen
 * de kolom taal). Niet ingelogd of nog geen migratie: stil overslaan.
 */
async function bewaarBijGebruiker(taal: Taal, alleenAlsLeeg: boolean) {
  try {
    const sb = await getServerSupabase();
    if (!sb) return;
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user?.email) return;
    await sb.rpc('zet_mijn_portaal_taal', { p_taal: taal, p_alleen_als_leeg: alleenAlsLeeg });
  } catch {
    // De cookie is leidend; de database is een gemak voor andere apparaten.
  }
}

/** Taalkeuze uit de taalkiezer: cookie voor 1 jaar en, als iemand is ingelogd, ook in de database. */
export async function zetTaalActie(taal: string): Promise<void> {
  if (!isTaal(taal)) return;
  (await cookies()).set(TAAL_COOKIE, taal, {
    path: '/',
    maxAge: TAAL_COOKIE_MAXAGE,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  await bewaarBijGebruiker(taal, false);
}

/**
 * Na inloggen: een keuze die op de loginpagina (alleen als cookie) is gemaakt, ook
 * in de database zetten, maar alleen als daar nog niets staat. Zo komt de taal op
 * een nieuw apparaat terug zonder een eerder bewaarde keuze te overschrijven.
 */
export async function vulTaalAanActie(taal: string): Promise<void> {
  if (!isTaal(taal)) return;
  await bewaarBijGebruiker(taal, true);
}
