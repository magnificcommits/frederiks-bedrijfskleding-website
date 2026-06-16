'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { voegFunctieProduct, verwijderFunctieProduct } from '@/lib/kms/functies';

function geheelGetal(raw: string, standaard: number): number {
  const n = parseInt(raw.replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : standaard;
}

export async function voegProductToe(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const functieId = String(formData.get('functieId') ?? '').trim();
  const productId = String(formData.get('productId') ?? '').trim();
  const aantal = geheelGetal(String(formData.get('aantal') ?? ''), 1);
  if (functieId && productId) {
    await voegFunctieProduct(functieId, productId, aantal);
  }
  revalidatePath('/dashboard/functies/' + functieId);
  redirect('/dashboard/functies/' + functieId);
}

export async function verwijderProductActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const functieId = String(formData.get('functieId') ?? '').trim();
  const regelId = String(formData.get('regelId') ?? '').trim();
  if (regelId) await verwijderFunctieProduct(regelId);
  revalidatePath('/dashboard/functies/' + functieId);
  redirect('/dashboard/functies/' + functieId);
}
