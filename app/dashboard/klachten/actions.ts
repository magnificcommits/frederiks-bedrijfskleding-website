'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakKlacht, zetKlachtStatus, beantwoordKlacht } from '@/lib/kms/service';

function tekstOfNull(raw: FormDataEntryValue | null): string | null {
  const s = String(raw ?? '').trim();
  return s === '' ? null : s;
}

export async function nieuweKlacht(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const omschrijving = String(formData.get('omschrijving') ?? '').trim();
  if (omschrijving) {
    await maakKlacht({
      organisatie_id: tekstOfNull(formData.get('organisatie_id')),
      soort: tekstOfNull(formData.get('soort')),
      omschrijving,
    });
  }
  redirect('/dashboard/klachten');
}

export async function wijzigKlachtStatus(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('klachtId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (id && status) await zetKlachtStatus(id, status);
  redirect('/dashboard/klachten');
}

export async function klachtAntwoord(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('klachtId') ?? '').trim();
  if (id) await beantwoordKlacht(id, tekstOfNull(formData.get('antwoord')));
  redirect('/dashboard/klachten');
}
