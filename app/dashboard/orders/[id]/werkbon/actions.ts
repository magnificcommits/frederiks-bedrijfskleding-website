'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakDecoratie, verwijderDecoratie, type Techniek } from '@/lib/kms/logos';

export async function voegDecoratieToe(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  const orderregelId = String(formData.get('orderregelId') ?? '').trim();
  const logoId = String(formData.get('logoId') ?? '').trim() || null;
  const techniekRuw = String(formData.get('techniek') ?? '').trim();
  const techniek: Techniek = techniekRuw === 'borduren' ? 'borduren' : 'bedrukken';
  const positie = String(formData.get('positie') ?? '').trim() || null;
  const afmeting = String(formData.get('afmeting') ?? '').trim() || null;
  const opmerkingen = String(formData.get('opmerkingen') ?? '').trim() || null;
  if (orderregelId) {
    await maakDecoratie(orderregelId, { logo_id: logoId, techniek, positie, afmeting, opmerkingen });
  }
  revalidatePath('/dashboard/orders/' + orderId + '/werkbon');
  redirect('/dashboard/orders/' + orderId + '/werkbon');
}

export async function verwijderDecoratieActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  const decoratieId = String(formData.get('decoratieId') ?? '').trim();
  if (decoratieId) await verwijderDecoratie(decoratieId);
  revalidatePath('/dashboard/orders/' + orderId + '/werkbon');
  redirect('/dashboard/orders/' + orderId + '/werkbon');
}
