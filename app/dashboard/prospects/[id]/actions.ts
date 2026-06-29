'use server';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { werkProspect } from '@/lib/kms/prospecten';

/** Werkt alle velden van een prospect bij vanaf de bewerkpagina. */
export async function werkProspectActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/dashboard/prospects');
  const tekst = (naam: string) => String(formData.get(naam) ?? '');
  await werkProspect(id, {
    bedrijfsnaam: tekst('bedrijfsnaam'),
    contactpersoon: tekst('contactpersoon'),
    eigenaar: tekst('eigenaar'),
    email: tekst('email'),
    telefoon: tekst('telefoon'),
    branche: tekst('branche'),
    plaats: tekst('plaats'),
    website: tekst('website'),
    grootte: tekst('grootte'),
    status: tekst('status'),
    score: Number(formData.get('score') ?? 0),
    notitie: tekst('notitie'),
  });
  redirect(`/dashboard/prospects/${id}?ok=opgeslagen`);
}
