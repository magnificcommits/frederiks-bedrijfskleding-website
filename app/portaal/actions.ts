'use server';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';
import { markeerMeldingenGelezen } from '@/lib/portaal/verzoeken';

export async function portaalLogout() {
  const sb = await getServerSupabase();
  if (sb) await sb.auth.signOut();
  redirect('/portaal/login');
}

export async function markeerMeldingenGelezenActie() {
  // Loopt via de sessie-client (RLS): zonder login wijzigt dit niets. Expliciete check:
  const sb = await getServerSupabase();
  const { data } = sb ? await sb.auth.getUser() : { data: { user: null } };
  if (!data.user) redirect('/portaal/login');
  await markeerMeldingenGelezen();
  redirect('/portaal');
}
