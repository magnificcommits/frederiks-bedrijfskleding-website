import { cookies } from 'next/headers';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isLeadsDbConfigured } from '@/lib/env';

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

export async function dashAuthed(): Promise<boolean> {
  return Boolean(env.dashboardPassword) && (await cookies()).get(DASH_COOKIE)?.value === env.dashboardPassword.trim();
}
