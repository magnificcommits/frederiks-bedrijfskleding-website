'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakLeverancier } from '@/lib/kms/producten';

export async function nieuweLeverancier(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const naam = String(formData.get('naam') ?? '').trim();
  if (!naam) redirect('/dashboard/leveranciers');
  const levertijdRaw = String(formData.get('levertijd_dagen') ?? '').replace(/[^0-9]/g, '');
  const merken = String(formData.get('merken') ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  await maakLeverancier({
    naam,
    contactpersoon: String(formData.get('contactpersoon') ?? '').trim() || null,
    telefoon: String(formData.get('telefoon') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    levertijd_dagen: levertijdRaw === '' ? null : Number(levertijdRaw),
    betaalcondities: String(formData.get('betaalcondities') ?? '').trim() || null,
    merken: merken.length > 0 ? merken : null,
  });
  redirect('/dashboard/leveranciers');
}
