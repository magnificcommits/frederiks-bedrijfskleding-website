'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { zetAfgemeld, type AfmeldResultaat } from '@/lib/kms/nieuwsbrief';
import { getNieuwsbrief, maakNieuwsbrief } from '@/lib/nieuwsbrief/opslag';

/**
 * De filters komen als losse velden mee en worden hier opnieuw opgebouwd, in
 * plaats van een meegestuurde URL te vertrouwen. Zo kan een formulier je nooit
 * ergens anders heen sturen dan naar deze pagina.
 */
function terugNaarLijst(zoek: string, branche: string, ok: string): string {
  const p = new URLSearchParams();
  p.set('tab', 'adressen');
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

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

/**
 * Nieuwe nieuwsbrief. Zonder bron een kopie van de basistemplate; met
 * `van` een kopie van die template of eerdere brief.
 */
export async function nieuweNieuwsbriefActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const van = String(formData.get('van') ?? '').trim();
  const naam = String(formData.get('naam') ?? '').trim();
  const id = await maakNieuwsbrief({ vanId: isUuid(van) ? van : null, naam: naam || null });
  if (!id) redirect('/dashboard/nieuwsbrief?fout=nieuwsbrief');
  await logAudit('nieuwsbrief_aangemaakt', { entiteit: 'nieuwsbrieven', entiteitId: id, details: { van: isUuid(van) ? van : 'basistemplate', naam: naam || null } });
  revalidatePath('/dashboard/nieuwsbrief');
  redirect(`/dashboard/nieuwsbrief/${id}?ok=aangemaakt`);
}

/** Kopie van een brief of template (een template blijft een template). */
export async function kopieerNieuwsbriefActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const van = String(formData.get('id') ?? '').trim();
  if (!isUuid(van)) redirect('/dashboard/nieuwsbrief');
  const bron = await getNieuwsbrief(van);
  if (!bron) redirect('/dashboard/nieuwsbrief');
  const id = await maakNieuwsbrief({ vanId: van, alsTemplate: bron.is_template });
  if (!id) redirect('/dashboard/nieuwsbrief?fout=nieuwsbrief');
  await logAudit('nieuwsbrief_gekopieerd', { entiteit: 'nieuwsbrieven', entiteitId: id, details: { van } });
  revalidatePath('/dashboard/nieuwsbrief');
  redirect(`/dashboard/nieuwsbrief/${id}?ok=aangemaakt`);
}

/**
 * Concept, mislukte brief of template verwijderen. Een verzonden of
 * ingeplande brief blijft staan: die hoort bij de geschiedenis en de webversie
 * moet blijven werken.
 */
export async function verwijderNieuwsbriefActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '').trim();
  const sb = kmsAdmin();
  if (!sb || !isUuid(id)) redirect('/dashboard/nieuwsbrief');
  const brief = await getNieuwsbrief(id);
  if (!brief) redirect('/dashboard/nieuwsbrief');
  if (!brief.is_template && brief.status !== 'concept' && brief.status !== 'mislukt') {
    redirect('/dashboard/nieuwsbrief?fout=niet-verwijderen');
  }
  await sb.from('nieuwsbrieven').delete().eq('id', id);
  await logAudit('nieuwsbrief_verwijderd', {
    entiteit: 'nieuwsbrieven',
    entiteitId: id,
    details: { naam: brief.naam, status: brief.status, template: brief.is_template },
  });
  revalidatePath('/dashboard/nieuwsbrief');
  redirect('/dashboard/nieuwsbrief?ok=verwijderd');
}
