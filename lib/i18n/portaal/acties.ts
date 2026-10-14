'use server';
import { cookies } from 'next/headers';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { isTaal, TAAL_COOKIE, TAAL_COOKIE_MAXAGE, type Taal } from './kern';

/**
 * Slaat de taal op bij de ingelogde portaalgebruiker. De sessie bepaalt wie dat is
 * (getUser controleert het token bij Supabase); daarna schrijft de server met de
 * servicesleutel alleen de kolom taal van die ene rij. De klant zelf kan via de
 * API niets meer aanroepen (beveiligingscontrole 14 okt 2026). Niet ingelogd: stil overslaan.
 */
async function bewaarBijGebruiker(taal: Taal, alleenAlsLeeg: boolean) {
  try {
    const sb = await getServerSupabase();
    if (!sb) return;
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user?.email) return;
    const admin = kmsAdmin();
    if (!admin) return;
    let q = admin.from('portaal_gebruikers').update({ taal }).eq('email', auth.user.email.toLowerCase().trim());
    if (alleenAlsLeeg) q = q.is('taal', null);
    await q;
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
