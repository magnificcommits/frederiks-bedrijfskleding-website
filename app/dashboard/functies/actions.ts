'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakFunctie, verwijderFunctie } from '@/lib/kms/functies';

export async function nieuweFunctie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orgId = String(formData.get('orgId') ?? '').trim();
  const naam = String(formData.get('naam') ?? '').trim();
  if (orgId && naam) {
    const id = await maakFunctie(orgId, naam);
    if (id) {
      revalidatePath('/dashboard/functies');
      redirect('/dashboard/functies/' + id);
    }
  }
  revalidatePath('/dashboard/functies');
  redirect('/dashboard/functies?org=' + encodeURIComponent(orgId));
}

export async function verwijderFunctieActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orgId = String(formData.get('orgId') ?? '').trim();
  const functieId = String(formData.get('functieId') ?? '').trim();
  if (functieId) await verwijderFunctie(functieId);
  revalidatePath('/dashboard/functies');
  redirect('/dashboard/functies?org=' + encodeURIComponent(orgId));
}
