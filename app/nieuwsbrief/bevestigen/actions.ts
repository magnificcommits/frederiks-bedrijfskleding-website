'use server';
import { redirect } from 'next/navigation';
import { bevestigInschrijving } from '@/lib/nieuwsbrief/optin';

/** Inschrijving bevestigen (knop of automatisch na het laden van de pagina). */
export async function bevestigActie(formData: FormData): Promise<void> {
  // auth: token (bevestigtoken uit de opt-in-mail); onbekend token doet niets.
  const token = String(formData.get('t') ?? '');
  const ok = await bevestigInschrijving(token);
  redirect(`/nieuwsbrief/bevestigen?t=${encodeURIComponent(token)}&${ok ? 'klaar=1' : 'fout=1'}`);
}
