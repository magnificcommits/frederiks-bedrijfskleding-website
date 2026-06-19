'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakOfferte } from '@/lib/kms/offertes';
import { logAudit } from '@/lib/kms/audit';

export async function maakOfferteActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const organisatie_id = String(formData.get('organisatie_id') ?? '').trim();
  const contactpersoon = String(formData.get('contactpersoon') ?? '').trim();
  const geldig_tot = String(formData.get('geldig_tot') ?? '').trim();
  const notitie = String(formData.get('notitie') ?? '').trim();
  const id = await maakOfferte({
    organisatie_id: organisatie_id || null,
    contactpersoon: contactpersoon || null,
    geldig_tot: geldig_tot || null,
    notitie: notitie || null,
  });
  if (id) {
    await logAudit('offerte_aangemaakt', { entiteit: 'offertes', entiteitId: id });
    redirect('/dashboard/offertes/' + id + '?ok=aangemaakt');
  }
  redirect('/dashboard/offertes');
}
