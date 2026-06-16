'use server';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';

export async function portaalLogout() {
  const sb = await getServerSupabase();
  if (sb) await sb.auth.signOut();
  redirect('/portaal/login');
}
