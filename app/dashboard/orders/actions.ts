'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakOrder, zetOrderStatus } from '@/lib/kms/orders';

export async function nieuweOrder(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const organisatie_id = String(formData.get('organisatie_id') ?? '').trim();
  const medewerker_id = String(formData.get('medewerker_id') ?? '').trim() || null;
  const aangevraagd_door = String(formData.get('aangevraagd_door') ?? '').trim() || null;
  if (!organisatie_id) redirect('/dashboard/orders');
  const id = await maakOrder({ organisatie_id, medewerker_id, aangevraagd_door });
  redirect(id ? '/dashboard/orders/' + id : '/dashboard/orders');
}

/**
 * Inline statuswijziging vanaf de orderslijst. Hergebruikt dezelfde
 * `zetOrderStatus`-helper als de detailpagina (die ook de statusmail verstuurt),
 * maar blijft op de lijst staan via revalidatePath i.p.v. een redirect.
 * De huidige status- en paginafilter worden meegestuurd zodat de lijst na het
 * opslaan op dezelfde plek blijft.
 */
export async function wijzigOrderStatusInline(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (orderId && status) await zetOrderStatus(orderId, status);
  revalidatePath('/dashboard/orders');
  const terug = String(formData.get('terug') ?? '').trim();
  redirect(terug || '/dashboard/orders');
}
