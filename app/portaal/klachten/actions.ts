'use server';
import { logPortaal } from '@/lib/portaal/activiteit';
import { redirect } from 'next/navigation';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { meldKlacht, reageerOpKlacht, type KlachtSoort } from '@/lib/portaal/service';
import { sendEmail, emailLayout, emailGegevens, emailKnop, escapeHtml } from '@/lib/email';
import { env } from '@/lib/env';
import { headers } from 'next/headers';

/**
 * Melding aan Frederiks bij een nieuw bericht uit het portaal (werkdocument portaal
 * 21 okt, punt 6). Best effort: lukt het mailen niet, dan staat het bericht toch in
 * het dashboard onder Klachten en vragen, en op het overzicht bij "Vraagt aandacht".
 */
async function meldAanFrederiks(d: { titel: string; organisatie: string; door: string; soort: string; categorie?: string | null; tekst: string }) {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim();
  const link = `${host ? `https://${host}` : env.siteUrl}/dashboard/klachten?status=open`;
  const html = emailLayout({
    heading: d.titel,
    preheader: `${d.organisatie}: ${d.tekst.slice(0, 80)}`,
    bodyHtml: `
      ${emailGegevens([
        ['Klant', escapeHtml(d.organisatie)],
        ['Van', escapeHtml(d.door)],
        ['Soort', escapeHtml(d.soort)],
        ['Onderwerp', d.categorie ? escapeHtml(d.categorie) : null],
      ])}
      <p style="margin:16px 0 0;white-space:pre-line;">${escapeHtml(d.tekst)}</p>
      ${emailKnop('Bekijken en beantwoorden', link)}`,
  });
  await sendEmail({ to: env.notifyEmail, subject: `${d.titel}: ${d.organisatie}`, html }).catch(() => {});
}

export async function vraagKlacht(formData: FormData) {
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const org = await getMijnOrganisatie();
  if (!org) redirect('/portaal');

  const orderId = String(formData.get('order_id') ?? '').trim() || null;
  const soortRuw = String(formData.get('soort') ?? '').trim();
  const soort: KlachtSoort = soortRuw === 'klacht' ? 'klacht' : 'vraag';
  const omschrijving = String(formData.get('omschrijving') ?? '').trim();
  const categorie = String(formData.get('categorie') ?? '').trim() || null;
  if (!omschrijving) redirect('/portaal/klachten?leeg=1');

  const res = await meldKlacht({ orderId, soort, omschrijving, categorie });
  if (!res.ok) redirect('/portaal/klachten?fout=1');
  await logPortaal('klacht_gemeld');
  await meldAanFrederiks({
    titel: soort === 'klacht' ? 'Nieuwe klacht via het portaal' : 'Nieuwe vraag via het portaal',
    organisatie: org.naam,
    door: user.email ?? 'onbekend',
    soort: soort === 'klacht' ? 'Klacht' : 'Vraag',
    categorie,
    tekst: omschrijving,
  });
  redirect('/portaal/klachten?ok=1');
}

export async function reageerKlacht(formData: FormData) {
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const org = await getMijnOrganisatie();
  if (!org) redirect('/portaal');

  const klachtId = String(formData.get('klacht_id') ?? '').trim();
  const tekst = String(formData.get('tekst') ?? '').trim();
  if (!klachtId || !tekst) redirect('/portaal/klachten?leeg=1');
  const res = await reageerOpKlacht(klachtId, tekst);
  if (!res.ok) redirect('/portaal/klachten?fout=1');
  await meldAanFrederiks({ titel: 'Reactie van de klant op een vraag of klacht', organisatie: org.naam, door: user.email ?? 'onbekend', soort: 'Reactie', tekst });
  redirect('/portaal/klachten?gereageerd=1');
}
