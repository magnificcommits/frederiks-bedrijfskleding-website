import type { SupabaseClient, User } from '@supabase/supabase-js';
import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Toegangscontrole direct na het inloggen (callback-routes van portaal en KMS).
 * Een geslaagde login bij Microsoft of Google zegt alleen wie iemand is, niet of hij
 * erin mag. Dat bepalen we hier, op dezelfde manier als de rest van de app:
 *  - portaal: een rij in portaal_gebruikers met dit e-mailadres (zoals current_org());
 *  - KMS: een actieve rij in admin_gebruikers (zoals adminSessieStatus()).
 * Alleen server-side gebruiken.
 */

/** E-mailadres van de gebruiker, alleen als Supabase het als bevestigd heeft gemarkeerd. */
export function bevestigdEmail(user: User | null | undefined): string | null {
  const email = user?.email?.toLowerCase().trim();
  if (!email || !email.includes('@')) return null;
  if (!user?.email_confirmed_at) return null;
  return email;
}

/** Escapet % en _ zodat ilike een exacte (hoofdletterongevoelige) vergelijking doet. */
function exact(email: string): string {
  return email.replace(/[\\%_]/g, (t) => `\\${t}`);
}

/**
 * Hoort dit e-mailadres bij een portaalgebruiker van een klantorganisatie?
 * Zonder service-role key valt dit terug op de sessie van de gebruiker zelf
 * (RLS laat hem zijn eigen rij zien, net als in getMijnToegang()).
 */
export async function heeftPortaalToegang(email: string, sessie?: SupabaseClient | null): Promise<boolean> {
  const sb = kmsAdmin() ?? sessie ?? null;
  if (!sb) return false;
  const { data, error } = await sb
    .from('portaal_gebruikers')
    .select('id')
    .ilike('email', exact(email))
    .limit(1)
    .maybeSingle();
  return !error && Boolean(data);
}

/** Is dit e-mailadres een actieve beheerder van het KMS? */
export async function isActieveAdmin(email: string): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;
  const { data, error } = await sb
    .from('admin_gebruikers')
    .select('actief')
    .eq('email', email)
    .maybeSingle();
  return !error && Boolean(data?.actief);
}

/**
 * Vertaalt een foutmelding die Supabase of de provider in de callback-URL meegeeft
 * (?error=...&error_description=...) naar een foutcode voor de loginpagina.
 * Staan nieuwe aanmeldingen in Supabase uit, dan komt een onbekend account hier binnen.
 */
export function foutUitCallback(searchParams: URLSearchParams): string | null {
  const fout = searchParams.get('error') ?? searchParams.get('error_code');
  if (!fout) return null;
  const tekst = `${fout} ${searchParams.get('error_description') ?? ''}`.toLowerCase();
  if (tekst.includes('signup') || tekst.includes('not allowed')) return 'geen-toegang';
  if (tekst.includes('access_denied') || tekst.includes('cancel')) return 'sso-geannuleerd';
  return 'sso';
}
