import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type CookieRow = { name: string; value: string; options: CookieOptions };

/** Server-client met de sessie-cookies van de ingelogde portaalgebruiker. RLS bepaalt wat hij ziet. */
export async function getServerSupabase() {
  if (!url || !key) return null;
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list: CookieRow[]) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Aanroep vanuit een Server Component: cookies worden door de middleware ververst.
        }
      },
    },
  });
}
