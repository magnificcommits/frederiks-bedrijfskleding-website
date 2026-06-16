'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakFactuurVanOrder, maakLegeFactuur } from '@/lib/kms/facturen';

export async function factuurVanOrder(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('order_id') ?? '').trim();
  if (!orderId) redirect('/dashboard/facturen');
  const id = await maakFactuurVanOrder(orderId);
  if (id) redirect('/dashboard/facturen/' + id);
  redirect('/dashboard/facturen');
}

export async function legeFactuur(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const organisatieId = String(formData.get('organisatie_id') ?? '').trim();
  if (!organisatieId) redirect('/dashboard/facturen');
  const id = await maakLegeFactuur(organisatieId);
  if (id) redirect('/dashboard/facturen/' + id);
  redirect('/dashboard/facturen');
}
