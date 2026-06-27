'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakCampagne } from '@/lib/kms/campagnes';
import { logAudit } from '@/lib/kms/audit';

export async function nieuweCampagneActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const naam = String(formData.get('naam') ?? '').trim();
  const type = String(formData.get('type') ?? '').trim();
  const van_naam = String(formData.get('van_naam') ?? '').trim();
  const van_email = String(formData.get('van_email') ?? '').trim();
  if (!naam) redirect('/dashboard/campagnes');
  const id = await maakCampagne({
    naam,
    type: type || 'cold',
    van_naam: van_naam || null,
    van_email: van_email || null,
  });
  if (!id) redirect('/dashboard/campagnes?fout=aanmaken');
  await logAudit('campagne_aangemaakt', { entiteit: 'campagnes', entiteitId: id });
  redirect('/dashboard/campagnes/' + id + '?ok=aangemaakt');
}
