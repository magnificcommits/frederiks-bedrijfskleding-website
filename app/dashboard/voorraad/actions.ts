'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';

/**
 * Werkt de voorraad van één variant direct vanuit de voorraadlijst bij.
 * Bewust geen redirect: zo blijft de zoek-, filter- en uitklap-staat in de
 * clientlijst behouden en verspringt de pagina niet na het opslaan.
 */
export async function zetVariantVoorraadActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const variantId = String(formData.get('variant_id') ?? '').trim();
  const ruw = String(formData.get('voorraad') ?? '').trim().replace(',', '.');
  const voorraad = Math.max(0, Math.round(Number(ruw) || 0));
  if (variantId) {
    const sb = kmsAdmin();
    if (sb) await sb.from('product_varianten').update({ voorraad }).eq('id', variantId);
  }
  revalidatePath('/dashboard/voorraad');
}
