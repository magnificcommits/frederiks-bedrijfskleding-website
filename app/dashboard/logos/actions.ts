'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakLogo, verwijderLogo } from '@/lib/kms/logos';

export async function nieuwLogo(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orgId = String(formData.get('orgId') ?? '').trim();
  const naam = String(formData.get('naam') ?? '').trim();
  const logo_bestand_url = String(formData.get('logo_bestand_url') ?? '').trim() || null;
  const vectorbestand_url = String(formData.get('vectorbestand_url') ?? '').trim() || null;
  const borduurbestand_url = String(formData.get('borduurbestand_url') ?? '').trim() || null;
  const opmerkingen = String(formData.get('opmerkingen') ?? '').trim() || null;
  if (orgId && naam) {
    await maakLogo(orgId, { naam, logo_bestand_url, vectorbestand_url, borduurbestand_url, opmerkingen });
  }
  revalidatePath('/dashboard/logos');
  redirect('/dashboard/logos?org=' + encodeURIComponent(orgId));
}

export async function verwijderLogoActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orgId = String(formData.get('orgId') ?? '').trim();
  const logoId = String(formData.get('logoId') ?? '').trim();
  if (logoId) await verwijderLogo(logoId);
  revalidatePath('/dashboard/logos');
  redirect('/dashboard/logos?org=' + encodeURIComponent(orgId));
}
