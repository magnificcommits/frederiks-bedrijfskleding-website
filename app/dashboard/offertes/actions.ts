'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakOfferte, zetOfferteStatus, listContactenVoorOfferte, type OfferteContact } from '@/lib/kms/offertes';
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
    await logAudit('offerte_aangemaakt', { entiteit: 'offertes', entiteitId: id, details: { organisatie_id: organisatie_id || null } });
    redirect('/dashboard/offertes/' + id + '?ok=aangemaakt');
  }
  redirect('/dashboard/offertes/nieuw?fout=aanmaken');
}

/**
 * Contactpersonen van een klant, voor de kiezer op het offerteformulier.
 * Wordt vanuit de browser aangeroepen zodra er een klant gekozen is.
 */
export async function haalContactenActie(organisatieId: string): Promise<OfferteContact[]> {
  if (!(await dashAuthed())) return [];
  const id = String(organisatieId ?? '').trim();
  if (!id) return [];
  return listContactenVoorOfferte(id);
}

/** Bulk-statuswijziging voor alle aangevinkte offertes in een keer. */
export async function bulkOfferteStatusActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const ids = formData.getAll('offerte_ids').map((v) => String(v).trim()).filter(Boolean);
  const status = String(formData.get('bulk_status') ?? '').trim();
  const terug = String(formData.get('terug') ?? '').trim() || '/dashboard/offertes';
  if (ids.length && status) {
    for (const id of ids) await zetOfferteStatus(id, status);
  }
  revalidatePath('/dashboard/offertes');
  redirect(`${terug}${terug.includes('?') ? '&' : '?'}ok=status`);
}
