'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { updateLead } from '@/lib/supabase';

const DASH_COOKIE = 'fb_dash';

async function isAuthed() {
  const auth = (await cookies()).get(DASH_COOKIE)?.value;
  return Boolean(env.dashboardPassword) && auth === env.dashboardPassword.trim();
}

export async function login(formData: FormData) {
  const pw = String(formData.get('password') ?? '').trim();
  const expected = env.dashboardPassword.trim();
  if (expected && pw === expected) {
    (await cookies()).set(DASH_COOKIE, expected, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    redirect('/dashboard');
  }
  redirect('/dashboard?fout=1');
}

export async function logout() {
  (await cookies()).delete(DASH_COOKIE);
  redirect('/dashboard');
}

export async function saveLeadEdit(formData: FormData) {
  if (!(await isAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  const ruw = String(formData.get('offertewaarde') ?? '').replace(/[^0-9.,]/g, '').replace(',', '.');
  const offertewaarde = ruw === '' ? null : Number(ruw);
  const notitie = String(formData.get('notitie') ?? '').slice(0, 1000) || null;
  const terug = String(formData.get('terug') ?? '/dashboard');
  if (id) await updateLead(id, { status, offertewaarde, notitie });
  redirect(terug || '/dashboard');
}
