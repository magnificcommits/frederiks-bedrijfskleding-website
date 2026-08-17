'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakTaak, zetTaakStatus, zetTaakWerkstatus, verwijderTaak } from '@/lib/kms/taken';
import { logAudit } from '@/lib/kms/audit';

export async function maakTaakActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const titel = String(formData.get('titel') ?? '').trim();
  if (!titel) redirect('/dashboard/taken?ok=geen_titel');

  await maakTaak({
    titel,
    omschrijving: String(formData.get('omschrijving') ?? ''),
    organisatie_id: String(formData.get('organisatie_id') ?? '') || null,
    prioriteit: String(formData.get('prioriteit') ?? 'normaal'),
    werkstatus: String(formData.get('werkstatus') ?? ''),
    vervaldatum: String(formData.get('vervaldatum') ?? '') || null,
    toegewezen_aan: String(formData.get('toegewezen_aan') ?? '') || null,
  });

  await logAudit('taak_aangemaakt', { entiteit: 'taak', details: { titel } });
  redirect('/dashboard/taken?ok=aangemaakt');
}

export async function zetTaakStatusActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('status') ?? '') === 'klaar' ? 'klaar' : 'open';

  await zetTaakStatus(id, status);
  await logAudit('taak_status_gewijzigd', {
    entiteit: 'taak',
    entiteitId: id,
    details: { status },
  });
  redirect(`/dashboard/taken?ok=${status === 'klaar' ? 'afgerond' : 'heropend'}`);
}

export async function zetTaakWerkstatusActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '').trim();
  const werkstatus = String(formData.get('werkstatus') ?? '');

  const gelukt = await zetTaakWerkstatus(id, werkstatus);
  if (gelukt) {
    await logAudit('taak_werkstatus_gewijzigd', {
      entiteit: 'taak',
      entiteitId: id,
      details: { werkstatus },
    });
  }
  redirect(`/dashboard/taken?ok=${gelukt ? 'stap' : 'geen_stap'}`);
}

export async function verwijderTaakActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '').trim();

  await verwijderTaak(id);
  await logAudit('taak_verwijderd', { entiteit: 'taak', entiteitId: id });
  redirect('/dashboard/taken?ok=verwijderd');
}
