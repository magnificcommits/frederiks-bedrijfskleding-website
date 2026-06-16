'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakProduct } from '@/lib/kms/producten';

function getalOfNull(raw: string): number | null {
  const s = raw.replace(/[^0-9.,-]/g, '').replace(',', '.');
  return s === '' ? null : Number(s);
}

export async function nieuwProduct(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const naam = String(formData.get('naam') ?? '').trim();
  const merk = String(formData.get('merk') ?? '').trim() || null;
  const categorie = String(formData.get('categorie') ?? '').trim() || null;
  const leverancier_id = String(formData.get('leverancier_id') ?? '').trim() || null;
  const btwRaw = String(formData.get('btw') ?? '').trim();
  const btw = getalOfNull(btwRaw);
  if (!naam) redirect('/dashboard/producten');
  const id = await maakProduct({ naam, merk, categorie, leverancier_id, btw: btw ?? 21 });
  redirect(id ? '/dashboard/producten/' + id : '/dashboard/producten');
}
