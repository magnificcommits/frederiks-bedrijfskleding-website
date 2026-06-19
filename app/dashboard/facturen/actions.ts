'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakFactuurVanOrder, maakLegeFactuur, zetBoekhouderEmail, mailFacturenNaarBoekhouder } from '@/lib/kms/facturen';
import { logAudit } from '@/lib/kms/audit';

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

export async function zetBoekhouderEmailActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const email = String(formData.get('boekhouder_email') ?? '').trim();
  await zetBoekhouderEmail(email);
  await logAudit('boekhouder_email_gewijzigd', { entiteit: 'instellingen' });
  redirect('/dashboard/facturen?ok=boekhouder');
}

export async function mailFacturenActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const ids = formData.getAll('factuur_ids').map(String).filter(Boolean);
  const r = await mailFacturenNaarBoekhouder(ids);
  if (r.ok) {
    await logAudit('facturen_gemaild', { entiteit: 'facturen', details: { aantal: r.aantal } });
    redirect(`/dashboard/facturen?gemaild=${r.aantal}`);
  }
  redirect(`/dashboard/facturen?mailfout=${encodeURIComponent(r.error ?? 'Onbekende fout')}`);
}
