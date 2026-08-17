'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { zetAfgemeld, type AfmeldResultaat } from '@/lib/kms/nieuwsbrief';

/**
 * De filters komen als losse velden mee en worden hier opnieuw opgebouwd, in
 * plaats van een meegestuurde URL te vertrouwen. Zo kan een formulier je nooit
 * ergens anders heen sturen dan naar deze pagina.
 */
function terugNaarLijst(zoek: string, branche: string, ok: string): string {
  const p = new URLSearchParams();
  if (zoek) p.set('zoek', zoek);
  if (branche) p.set('branche', branche);
  p.set('ok', ok);
  return `/dashboard/nieuwsbrief?${p.toString()}`;
}

/** Eén adres op wel of niet mailen zetten, met de filters intact. */
export async function zetAfgemeldActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');

  const email = String(formData.get('email') ?? '').trim();
  const afgemeld = String(formData.get('afgemeld') ?? '') === '1';
  const organisatieId = String(formData.get('organisatie_id') ?? '').trim();
  const zoek = String(formData.get('zoek') ?? '').trim();
  const branche = String(formData.get('branche') ?? '').trim();

  const uitkomst: AfmeldResultaat = email
    ? await zetAfgemeld(email, afgemeld, organisatieId || null)
    : 'mislukt';

  if (uitkomst === 'ok') {
    // entiteit_id blijft leeg: we wijzigen een inschrijving, geen organisatie.
    // De organisatie hoort in de details, anders wijst het auditspoor naar een
    // rij die helemaal niet is aangeraakt.
    await logAudit(afgemeld ? 'nieuwsbrief_afgemeld' : 'nieuwsbrief_heraangemeld', {
      entiteit: 'nieuwsbrief_inschrijvingen',
      details: { email, organisatie_id: organisatieId || null },
    });
  }

  let ok = uitkomst === 'nog-niet-klaar' ? 'nog-niet-klaar' : 'mislukt';
  if (uitkomst === 'ok') ok = afgemeld ? 'afgemeld' : 'aangemeld';

  revalidatePath('/dashboard/nieuwsbrief');
  redirect(terugNaarLijst(zoek, branche, ok));
}
