'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakOrder } from '@/lib/kms/orders';

export async function nieuweOrder(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const organisatie_id = String(formData.get('organisatie_id') ?? '').trim();
  const medewerker_id = String(formData.get('medewerker_id') ?? '').trim() || null;
  const aangevraagd_door = String(formData.get('aangevraagd_door') ?? '').trim() || null;
  if (!organisatie_id) redirect('/dashboard/orders');
  const id = await maakOrder({ organisatie_id, medewerker_id, aangevraagd_door });
  redirect(id ? '/dashboard/orders/' + id : '/dashboard/orders');
}
