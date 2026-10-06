'use client';
import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Zelfde cookienaam als in supabaseServer.ts (dat bestand is server-only). */
const PORTAAL_COOKIE = 'sb-fb-portaal';

/** Browser-client voor het klantportaal of het KMS. Null als Supabase nog niet is geconfigureerd. */
export function createPortalBrowserClient(gebied: 'portaal' | 'dashboard' = 'portaal') {
  if (!url || !key) return null;
  return createBrowserClient(url, key, gebied === 'portaal' ? { cookieOptions: { name: PORTAAL_COOKIE } } : undefined);
}
