import { cookies } from 'next/headers';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isLeadsDbConfigured } from '@/lib/env';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';

/**
 * Gedeelde basis voor de KMS/ERP-beheerpagina's onder /dashboard.
 * Service-role client (omzeilt RLS) plus de wachtwoordcheck van het dashboard.
 * Alleen server-side gebruiken, altijd achter dashAuthed().
 */
export const DASH_COOKIE = 'fb_dash';

export function kmsAdmin(): SupabaseClient | null {
  if (!isLeadsDbConfigured) return null;
  return createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false } });
}

/** Wachtwoord-cookie: ongewijzigd pad, blijft altijd werken. */
async function wachtwoordCookieGeldig(): Promise<boolean> {
  return Boolean(env.dashboardPassword) && (await cookies()).get(DASH_COOKIE)?.value === env.dashboardPassword.trim();
}

/** Geldige Supabase-sessie waarvan de e-mail in admin_gebruikers staat én actief is. */
async function sessieIsAdmin(): Promise<boolean> {
  try {
    const sb = await getServerSupabase();
    if (!sb) return false;
    const { data: { user } } = await sb.auth.getUser();
    const email = user?.email?.toLowerCase().trim();
    if (!email) return false;
    const admin = kmsAdmin();
    if (!admin) return false;
    const { data, error } = await admin
      .from('admin_gebruikers')
      .select('actief')
      .eq('email', email)
      .maybeSingle();
    if (error) return false;
    return Boolean(data?.actief);
  } catch {
    return false;
  }
}

/**
 * dashAuthed = (geldig wachtwoord-cookie) OF (geldige Supabase-sessie van een
 * actieve admin). Het wachtwoordpad blijft volledig intact: met alleen het
 * wachtwoord-cookie blijft toegang gegarandeerd, ook zonder Supabase-sessie.
 */
export async function dashAuthed(): Promise<boolean> {
  return (await wachtwoordCookieGeldig()) || (await sessieIsAdmin());
}

/**
 * De ingelogde admin op basis van de Supabase-sessie + admin_gebruikers-rij.
 * Null als er geen sessie/admin is (bv. wachtwoord-login zonder account).
 */
export async function getHuidigeAdmin(): Promise<{ email: string; naam: string | null; rol: string } | null> {
  try {
    const sb = await getServerSupabase();
    if (!sb) return null;
    const { data: { user } } = await sb.auth.getUser();
    const email = user?.email?.toLowerCase().trim();
    if (!email) return null;
    const admin = kmsAdmin();
    if (!admin) return null;
    const { data, error } = await admin
      .from('admin_gebruikers')
      .select('email, naam, rol, actief')
      .eq('email', email)
      .maybeSingle();
    if (error || !data || !data.actief) return null;
    return { email: data.email, naam: data.naam ?? null, rol: data.rol };
  } catch {
    return null;
  }
}
