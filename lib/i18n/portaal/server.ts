import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';
import { isTaal, maakVertaler, STANDAARD_TAAL, TAAL_COOKIE, taalUitAcceptLanguage, type Taal, type Vertaler } from './kern';
import { nl, type Woordenboek } from './nl';
import { en } from './en';
import { de } from './de';
import { pl } from './pl';

/** Server-side vertalingen voor het portaal (server components, server actions, route handlers). */

export const WOORDENBOEKEN: Record<Taal, Woordenboek> = { nl, en, de, pl };

/** Waar de taal vandaan komt. 'db' betekent: geen cookie op dit apparaat, wel een opgeslagen voorkeur. */
export type TaalBron = 'cookie' | 'db' | 'browser' | 'standaard';

/** Opgeslagen taalvoorkeur van de ingelogde portaalgebruiker, of null. Faalt stil (bijv. zonder migratie). */
async function opgeslagenTaal(): Promise<Taal | null> {
  try {
    const sb = await getServerSupabase();
    if (!sb) return null;
    const { data: auth } = await sb.auth.getUser();
    const email = auth.user?.email;
    if (!email) return null;
    const { data, error } = await sb.from('portaal_gebruikers').select('taal').ilike('email', email).limit(1).maybeSingle();
    if (error || !data) return null;
    const taal = (data as { taal: string | null }).taal;
    return isTaal(taal) ? taal : null;
  } catch {
    return null;
  }
}

/**
 * De taal van dit verzoek: cookie `fb_taal`, anders de opgeslagen voorkeur van de
 * ingelogde gebruiker, anders Accept-Language, anders Nederlands. Eén keer per request.
 */
export const getTaalInfo = cache(async (): Promise<{ taal: Taal; bron: TaalBron }> => {
  const uitCookie = (await cookies()).get(TAAL_COOKIE)?.value;
  if (isTaal(uitCookie)) return { taal: uitCookie, bron: 'cookie' };
  const uitDb = await opgeslagenTaal();
  if (uitDb) return { taal: uitDb, bron: 'db' };
  const uitBrowser = taalUitAcceptLanguage((await headers()).get('accept-language'));
  if (uitBrowser) return { taal: uitBrowser, bron: 'browser' };
  return { taal: STANDAARD_TAAL, bron: 'standaard' };
});

export async function getTaal(): Promise<Taal> {
  return (await getTaalInfo()).taal;
}

/** Vertaler voor dit verzoek: { t, tn, rijk, status, euro, getal, datum, moment, taal, locale }. */
export const getVertaler = cache(async (): Promise<Vertaler> => {
  const taal = await getTaal();
  return maakVertaler(taal, WOORDENBOEKEN[taal]);
});
