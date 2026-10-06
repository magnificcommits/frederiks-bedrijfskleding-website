import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type CookieRow = { name: string; value: string; options: CookieOptions };

/**
 * Portaal en KMS hebben elk een eigen sessie, in een eigen cookie. Zo blijft Jessi in
 * het KMS ingelogd terwijl ze in hetzelfde browservenster het portaal (of de demo)
 * laat zien. Het KMS houdt de standaardnaam, het portaal krijgt een eigen naam.
 */
export type SessieGebied = 'portaal' | 'dashboard';
export const PORTAAL_COOKIE = 'sb-fb-portaal';
export function cookieNaamVoor(gebied: SessieGebied): { name: string } | undefined {
  return gebied === 'portaal' ? { name: PORTAAL_COOKIE } : undefined;
}

/** Server-client met de sessie-cookies van het gekozen gebied. RLS bepaalt wat de gebruiker ziet. */
export async function getServerSupabase(gebied: SessieGebied = 'portaal') {
  if (!url || !key) return null;
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookieOptions: cookieNaamVoor(gebied),
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
