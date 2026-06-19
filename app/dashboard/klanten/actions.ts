'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { maakOrganisatie, addGebruiker } from '@/lib/portaalAdmin';
import { logAudit } from '@/lib/kms/audit';

const DASH_COOKIE = 'fb_dash';

async function authed() {
  return Boolean(env.dashboardPassword) && (await cookies()).get(DASH_COOKIE)?.value === env.dashboardPassword.trim();
}

export async function nieuweOrganisatie(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const naam = String(formData.get('naam') ?? '').trim();
  const plaats = String(formData.get('plaats') ?? '').trim();
  const adres = String(formData.get('adres') ?? '').trim();
  const postcode = String(formData.get('postcode') ?? '').trim();
  const telefoon = String(formData.get('telefoon') ?? '').trim();
  const contactpersoon = String(formData.get('contactpersoon') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  if (!naam) redirect('/dashboard/klanten');
  const id = await maakOrganisatie({ naam, plaats, adres, postcode, telefoon });
  if (id && email) await addGebruiker(id, email, contactpersoon);
  if (id) await logAudit('klant_aangemaakt', { entiteit: 'organisatie', entiteitId: id, details: { naam } });
  redirect(id ? '/dashboard/klanten/' + id : '/dashboard/klanten');
}
