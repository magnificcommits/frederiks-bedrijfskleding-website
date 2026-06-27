'use server';

import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { uploadMedia } from '@/lib/kms/storage';
import { maakDrukproef, verwijderDrukproef, markeerVerstuurd, getDrukproef } from '@/lib/kms/drukproeven';
import { sendEmail, emailLayout, escapeHtml } from '@/lib/email';
import { env } from '@/lib/env';

/**
 * Server-acties voor de module Drukproeven. Alles achter dashAuthed(): zonder geldige
 * dashboardsessie sturen we terug naar /dashboard. Een geüploade afbeelding gaat via
 * uploadMedia naar de map 'drukproeven' en wordt dan de definitieve proef.
 */
export async function maakDrukproefActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');

  const orgId = String(formData.get('org_id') ?? '').trim();
  const naam = String(formData.get('naam') ?? '').trim();
  const type = String(formData.get('type') ?? '').trim() || 'tshirt';
  const kleur = Number(formData.get('kleur') ?? 0) || 0;
  const positie = String(formData.get('positie') ?? '').trim() || 'borst-links';
  const techniek = String(formData.get('techniek') ?? '').trim() || 'borduren';
  const logoUrl = String(formData.get('logo_url') ?? '').trim() || null;
  const omschrijving = String(formData.get('omschrijving') ?? '').trim() || null;

  if (!orgId || !naam) redirect('/dashboard/drukproeven' + (orgId ? `?org=${orgId}` : ''));

  const afbeeldingUrl = await uploadMedia(formData.get('afbeelding') as File | null, 'drukproeven');

  await maakDrukproef(orgId, {
    naam,
    type,
    kleur,
    positie,
    techniek,
    logo_url: logoUrl,
    afbeelding_url: afbeeldingUrl,
    omschrijving,
  });

  redirect(`/dashboard/drukproeven?org=${orgId}&ok=aangemaakt`);
}

export async function verstuurDrukproefActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');

  const id = String(formData.get('id') ?? '').trim();
  const orgId = String(formData.get('org_id') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  if (!id || !email) redirect('/dashboard/drukproeven' + (orgId ? `?org=${orgId}&fout=mail` : ''));

  const dp = await getDrukproef(id);
  if (dp) {
    const link = `${env.siteUrl}/drukproef/${dp.token}`;
    await markeerVerstuurd(id);
    await sendEmail({
      to: email,
      subject: 'Je drukproef ter goedkeuring - Frederiks Bedrijfskleding',
      html: emailLayout({
        heading: 'Bekijk en keur je drukproef',
        preheader: 'We hebben een drukproef voor je klaargezet.',
        bodyHtml: `<p style="margin:0;">We hebben een drukproef voor <strong style="color:#1c1c1c;">${escapeHtml(dp.naam)}</strong> klaargezet. Bekijk hoe je logo op de kleding komt en keur de proef goed of geef je opmerkingen door.</p>
<p style="margin:18px 0;"><a href="${link}" style="display:inline-block;background:#ec6726;color:#ffffff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;">Drukproef bekijken</a></p>
<p style="margin:0;font-size:13px;color:#52504e;">Werkt de knop niet? Open dan deze link:<br/>${escapeHtml(link)}</p>`,
      }),
    }).catch(() => {});
  }

  redirect(`/dashboard/drukproeven?org=${orgId}&ok=gemaild`);
}

export async function verwijderDrukproefActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');

  const id = String(formData.get('id') ?? '').trim();
  const orgId = String(formData.get('org_id') ?? '').trim();
  if (id) await verwijderDrukproef(id);

  redirect('/dashboard/drukproeven' + (orgId ? `?org=${orgId}` : ''));
}
