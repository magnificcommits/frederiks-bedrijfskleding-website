'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakPakket, type PakketSoort } from '@/lib/kms/pakketten';

function getalOfNull(raw: string): number | null {
  const s = raw.replace(/[^0-9.,-]/g, '').replace(',', '.');
  return s === '' ? null : Number(s);
}

export async function nieuwPakket(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orgId = String(formData.get('orgId') ?? '').trim();
  const naam = String(formData.get('naam') ?? '').trim();
  const soort: PakketSoort = String(formData.get('soort') ?? '') === 'start' ? 'start' : 'regulier';
  const pakketprijs = getalOfNull(String(formData.get('pakketprijs') ?? ''));
  const buiten_budget = String(formData.get('buiten_budget') ?? '') === 'true';
  if (orgId && naam) {
    const id = await maakPakket(orgId, { naam, soort, pakketprijs, buiten_budget });
    if (id) {
      revalidatePath('/dashboard/pakketten');
      redirect('/dashboard/pakketten/' + id);
    }
  }
  revalidatePath('/dashboard/pakketten');
  redirect('/dashboard/pakketten?org=' + encodeURIComponent(orgId));
}
