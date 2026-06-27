'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { importeerProspecten, maakProspect, zetProspectStatus, werkProspectNotitie } from '@/lib/kms/prospecten';

/**
 * Importeert prospects uit een geplakte CSV (textarea 'csv').
 * Kolomvolgorde: bedrijfsnaam, contactpersoon, email, telefoon, branche, plaats, website, grootte.
 * Een eerste regel die 'bedrijfsnaam' bevat wordt als header gezien en overgeslagen.
 */
export async function importeerCsvActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const csv = String(formData.get('csv') ?? '');
  const regels = csv
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean);
  if (regels.length && /bedrijfsnaam/i.test(regels[0])) regels.shift();
  const rijen = regels.map((r) => {
    const v = r.split(',').map((c) => c.trim());
    return {
      bedrijfsnaam: v[0] ?? '',
      contactpersoon: v[1] ?? '',
      email: v[2] ?? '',
      telefoon: v[3] ?? '',
      branche: v[4] ?? '',
      plaats: v[5] ?? '',
      website: v[6] ?? '',
      grootte: v[7] ?? '',
    };
  });
  await importeerProspecten(rijen);
  redirect('/dashboard/prospects?ok=toegevoegd');
}

/** Maakt één prospect aan op basis van losse velden. */
export async function nieuweProspectActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const bedrijfsnaam = String(formData.get('bedrijfsnaam') ?? '').trim();
  if (!bedrijfsnaam) redirect('/dashboard/prospects');
  await maakProspect({
    bedrijfsnaam,
    contactpersoon: String(formData.get('contactpersoon') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    telefoon: String(formData.get('telefoon') ?? '').trim() || null,
    branche: String(formData.get('branche') ?? '').trim() || null,
    plaats: String(formData.get('plaats') ?? '').trim() || null,
    website: String(formData.get('website') ?? '').trim() || null,
    grootte: String(formData.get('grootte') ?? '').trim() || null,
  });
  redirect('/dashboard/prospects?ok=aangemaakt');
}

/**
 * Inline statuswijziging vanaf de prospectslijst. De huidige weergave (filter, zoek,
 * sortering, pagina) zit in 'terug', zodat de lijst na het opslaan op dezelfde plek blijft.
 */
export async function zetProspectStatusActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  const terug = String(formData.get('terug') ?? '').trim() || '/dashboard/prospects';
  if (id && status) await zetProspectStatus(id, status);
  redirect(`${terug}${terug.includes('?') ? '&' : '?'}ok=status`);
}

/** Werkt de notitie van een prospect bij. */
export async function werkNotitieActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '').trim();
  const notitie = String(formData.get('notitie') ?? '').trim();
  if (id) await werkProspectNotitie(id, notitie);
  redirect('/dashboard/prospects?ok=opgeslagen');
}
