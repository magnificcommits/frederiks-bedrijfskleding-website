'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { maakFactuurVanOrder, maakLegeFactuur, zetBoekhouderEmail, mailFacturenNaarBoekhouder, listFactureerbareOrders, zetFactuurStatus } from '@/lib/kms/facturen';
import { logAudit } from '@/lib/kms/audit';

export async function factuurVanOrder(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const orderId = String(formData.get('order_id') ?? '').trim();
  if (!orderId) redirect('/dashboard/facturen');
  const id = await maakFactuurVanOrder(orderId);
  if (id) {
    await logAudit('factuur_aangemaakt', { entiteit: 'facturen', entiteitId: id, details: { orderId } });
    revalidatePath('/dashboard/facturen');
    redirect('/dashboard/facturen/' + id);
  }
  redirect('/dashboard/facturen?mailfout=' + encodeURIComponent('De factuur kon niet van deze order worden gemaakt.'));
}

export async function factureerAlleActie() {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const orders = await listFactureerbareOrders();
  let aantal = 0;
  for (const o of orders) {
    const id = await maakFactuurVanOrder(o.id);
    if (id) aantal++;
  }
  await logAudit('facturen_bulk_aangemaakt', { entiteit: 'facturen', details: { aantal } });
  revalidatePath('/dashboard/facturen');
  redirect(`/dashboard/facturen?ok=bulk&aantal=${aantal}`);
}

export async function legeFactuur(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const organisatieId = String(formData.get('organisatie_id') ?? '').trim();
  if (!organisatieId) redirect('/dashboard/facturen');
  const id = await maakLegeFactuur(organisatieId);
  if (id) {
    await logAudit('factuur_aangemaakt', { entiteit: 'facturen', entiteitId: id, details: { organisatieId } });
    revalidatePath('/dashboard/facturen');
    redirect('/dashboard/facturen/' + id);
  }
  redirect('/dashboard/facturen?mailfout=' + encodeURIComponent('De factuur kon niet worden aangemaakt.'));
}

export async function zetBoekhouderEmailActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const email = String(formData.get('boekhouder_email') ?? '').trim();
  await zetBoekhouderEmail(email);
  await logAudit('boekhouder_email_gewijzigd', { entiteit: 'instellingen' });
  redirect('/dashboard/facturen?ok=boekhouder');
}

export async function markeerBetaaldActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const ids = formData.getAll('factuur_ids').map(String).filter(Boolean);
  let aantal = 0;
  for (const id of ids) {
    const ok = await zetFactuurStatus(id, 'betaald');
    if (ok) aantal++;
  }
  if (aantal > 0) await logAudit('facturen_betaald_gemarkeerd', { entiteit: 'facturen', details: { aantal } });
  redirect(`/dashboard/facturen?ok=betaald&aantal=${aantal}`);
}

export async function mailFacturenActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const ids = formData.getAll('factuur_ids').map(String).filter(Boolean);
  const r = await mailFacturenNaarBoekhouder(ids);
  if (r.ok) {
    await logAudit('facturen_gemaild', { entiteit: 'facturen', details: { aantal: r.aantal } });
    redirect(`/dashboard/facturen?gemaild=${r.aantal}`);
  }
  redirect(`/dashboard/facturen?mailfout=${encodeURIComponent(r.error ?? 'Onbekende fout')}`);
}
