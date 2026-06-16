'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { maakOrganisatie } from '@/lib/portaalAdmin';

const DASH_COOKIE = 'fb_dash';

async function authed() {
  return Boolean(env.dashboardPassword) && (await cookies()).get(DASH_COOKIE)?.value === env.dashboardPassword.trim();
}

export async function nieuweOrganisatie(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const naam = String(formData.get('naam') ?? '').trim();
  const plaats = String(formData.get('plaats') ?? '').trim();
  if (naam) await maakOrganisatie(naam, plaats);
  redirect('/dashboard/klanten');
}
