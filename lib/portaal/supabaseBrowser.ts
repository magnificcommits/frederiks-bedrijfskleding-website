'use client';
import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Browser-client voor het klantportaal. Null als het portaal nog niet is geconfigureerd. */
export function createPortalBrowserClient() {
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
