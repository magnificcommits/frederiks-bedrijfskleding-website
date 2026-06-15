'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { updateLeadStatus } from '@/lib/supabase';

const DASH_COOKIE = 'fb_dash';

export async function login(formData: FormData) {
  const pw = String(formData.get('password') ?? '');
  if (env.dashboardPassword && pw === env.dashboardPassword) {
    (await cookies()).set(DASH_COOKIE, pw, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  redirect('/dashboard');
}

export async function logout() {
  (await cookies()).delete(DASH_COOKIE);
  redirect('/dashboard');
}

export async function setStatus(formData: FormData) {
  const auth = (await cookies()).get(DASH_COOKIE)?.value;
  if (!env.dashboardPassword || auth !== env.dashboardPassword) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (id && status) await updateLeadStatus(id, status);
  redirect('/dashboard');
}
