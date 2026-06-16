'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { voegFactuurregelToe, werkFactuurregel, verwijderFactuurregel, zetFactuurStatus } from '@/lib/kms/facturen';

function getalOfNul(raw: string): number {
  const s = raw.replace(/[^0-9.,-]/g, '').replace(',', '.');
  return s === '' ? 0 : Number(s);
}

export async function voegRegel(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const factuurId = String(formData.get('factuurId') ?? '').trim();
  const omschrijving = String(formData.get('omschrijving') ?? '').trim();
  const aantal = getalOfNul(String(formData.get('aantal') ?? '1'));
  const stukprijs = getalOfNul(String(formData.get('stukprijs') ?? ''));
  const btwRuw = String(formData.get('btw_pct') ?? '').trim();
  const btw_pct = btwRuw === '' ? 21 : getalOfNul(btwRuw);
  if (factuurId && omschrijving) {
    await voegFactuurregelToe(factuurId, { omschrijving, aantal, stukprijs, btw_pct });
  }
  redirect('/dashboard/facturen/' + factuurId);
}

export async function werkRegel(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const factuurId = String(formData.get('factuurId') ?? '').trim();
  const regelId = String(formData.get('regelId') ?? '').trim();
  const omschrijving = String(formData.get('omschrijving') ?? '').trim();
  const aantal = getalOfNul(String(formData.get('aantal') ?? '1'));
  const stukprijs = getalOfNul(String(formData.get('stukprijs') ?? ''));
  const btwRuw = String(formData.get('btw_pct') ?? '').trim();
  const btw_pct = btwRuw === '' ? 21 : getalOfNul(btwRuw);
  if (regelId && omschrijving) {
    await werkFactuurregel(regelId, { omschrijving, aantal, stukprijs, btw_pct });
  }
  redirect('/dashboard/facturen/' + factuurId);
}

export async function verwijderRegel(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const factuurId = String(formData.get('factuurId') ?? '').trim();
  const regelId = String(formData.get('regelId') ?? '').trim();
  if (regelId) await verwijderFactuurregel(regelId);
  redirect('/dashboard/facturen/' + factuurId);
}

export async function wijzigStatus(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const factuurId = String(formData.get('factuurId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (factuurId && status) await zetFactuurStatus(factuurId, status);
  redirect('/dashboard/facturen/' + factuurId);
}
