'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { dupliceerCampagne, maakCampagne, verwijderCampagne } from '@/lib/kms/campagnes';
import { zetCampagneInstellingen } from '@/lib/kms/campagneInstellingen';
import { logAudit } from '@/lib/kms/audit';

async function eis() {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
}

export async function nieuweCampagneActie(formData: FormData) {
  await eis();
  const naam = String(formData.get('naam') ?? '').trim();
  const voorbeeld = String(formData.get('voorbeeld') ?? '').trim();
  const doelgroep = String(formData.get('doelgroep') ?? '').trim();
  const res = await maakCampagne({ naam, voorbeeld: voorbeeld || null, doelgroep: doelgroep || null });
  if ('fout' in res) redirect('/dashboard/campagnes?fout=aanmaken');
  await logAudit('campagne_aangemaakt', { entiteit: 'campagnes', entiteitId: res.id, details: { voorbeeld: voorbeeld || null } });
  redirect(`/dashboard/campagnes/${res.id}?ok=aangemaakt`);
}

export async function dupliceerCampagneActie(formData: FormData) {
  await eis();
  const id = String(formData.get('campagneId') ?? '');
  const nieuw = await dupliceerCampagne(id);
  if (!nieuw) redirect('/dashboard/campagnes?fout=aanmaken');
  await logAudit('campagne_gekopieerd', { entiteit: 'campagnes', entiteitId: nieuw, details: { van: id } });
  redirect(`/dashboard/campagnes/${nieuw}?ok=aangemaakt`);
}

export async function verwijderCampagneActie(formData: FormData) {
  await eis();
  const id = String(formData.get('campagneId') ?? '');
  if (id) {
    await verwijderCampagne(id);
    await logAudit('campagne_verwijderd', { entiteit: 'campagnes', entiteitId: id });
  }
  redirect('/dashboard/campagnes?ok=verwijderd');
}

/** Noodrem voor alle campagnes tegelijk. */
export async function pauzeerAllesActie(formData: FormData) {
  await eis();
  const aan = String(formData.get('aan') ?? '') === '1';
  await zetCampagneInstellingen({ allesGepauzeerd: aan });
  await logAudit(aan ? 'campagnes_alles_gepauzeerd' : 'campagnes_alles_hervat', { entiteit: 'campagnes' });
  revalidatePath('/dashboard/campagnes');
  const terug = String(formData.get('terug') ?? '/dashboard/campagnes');
  redirect(terug.startsWith('/dashboard/campagnes') ? terug : '/dashboard/campagnes');
}
