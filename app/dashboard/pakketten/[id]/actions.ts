'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { werkPakket as werkPakketDb, voegPakketProduct, verwijderPakketProduct, type PakketSoort } from '@/lib/kms/pakketten';

function getalOfNull(raw: string): number | null {
  const s = raw.replace(/[^0-9.,-]/g, '').replace(',', '.');
  return s === '' ? null : Number(s);
}

function geheelGetal(raw: string, standaard: number): number {
  const n = parseInt(raw.replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : standaard;
}

export async function werkPakket(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const pakketId = String(formData.get('pakketId') ?? '').trim();
  const naam = String(formData.get('naam') ?? '').trim();
  const soort: PakketSoort = String(formData.get('soort') ?? '') === 'start' ? 'start' : 'regulier';
  const pakketprijs = getalOfNull(String(formData.get('pakketprijs') ?? ''));
  const buiten_budget = String(formData.get('buiten_budget') ?? '') === 'true';
  const actief = String(formData.get('actief') ?? '') === 'true';
  if (pakketId && naam) {
    await werkPakketDb(pakketId, { naam, soort, pakketprijs, buiten_budget, actief });
  }
  revalidatePath('/dashboard/pakketten/' + pakketId);
  redirect('/dashboard/pakketten/' + pakketId);
}

export async function voegProductToe(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const pakketId = String(formData.get('pakketId') ?? '').trim();
  const productId = String(formData.get('productId') ?? '').trim();
  const aantal = geheelGetal(String(formData.get('aantal') ?? ''), 1);
  if (pakketId && productId) {
    await voegPakketProduct(pakketId, { productId, variantId: null, aantal });
  }
  revalidatePath('/dashboard/pakketten/' + pakketId);
  redirect('/dashboard/pakketten/' + pakketId);
}

export async function verwijderProductActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const pakketId = String(formData.get('pakketId') ?? '').trim();
  const regelId = String(formData.get('regelId') ?? '').trim();
  if (regelId) await verwijderPakketProduct(regelId);
  revalidatePath('/dashboard/pakketten/' + pakketId);
  redirect('/dashboard/pakketten/' + pakketId);
}
