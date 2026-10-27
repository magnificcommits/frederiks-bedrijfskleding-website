'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { registreerOfferteAkkoord } from '@/lib/kms/offerteAkkoord';
import { ipUitHeaders, loginGeblokkeerd, registreerMisluktePoging } from '@/lib/ratelimit';
import { emailLayout, escapeHtml, sendEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { formatEuro } from '@/lib/format';
import { voorwaardenPdfBase64, VOORWAARDEN_BESTANDSNAAM } from '@/lib/voorwaardenBijlage';
import { logAudit } from '@/lib/kms/audit';

/**
 * Publieke actie: de klant keurt de offerte online goed. Geen inlog; de
 * ondertekende token in de link is het bewijs. Na het akkoord krijgt Jessi een
 * mail en de klant een bevestiging met de voorwaarden als bijlage.
 */
export async function keurOfferteGoedActie(formData: FormData): Promise<void> {
  // auth: token (offerteIdUitToken controleert de handtekening; alleen een verstuurde, geldige offerte).
  const token = String(formData.get('token') ?? '').trim().slice(0, 200);
  if (!token) redirect('/');
  const terug = `/akkoord/${encodeURIComponent(token)}`;
  const naam = String(formData.get('naam') ?? '').trim().slice(0, 120);
  const functie = String(formData.get('functie') ?? '').trim().slice(0, 120) || null;
  const emailRuw = String(formData.get('email') ?? '').trim().toLowerCase().slice(0, 254);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRuw) ? emailRuw : null;
  const akkoord = formData.get('akkoord') === 'ja';
  if (naam.length < 2) redirect(`${terug}?fout=naam`);
  if (!akkoord) redirect(`${terug}?fout=vinkje`);
  if (emailRuw && !email) redirect(`${terug}?fout=email`);

  // Rem op herhaald proberen vanaf één adres (zelfde limiet als inloggen).
  const ip = await ipUitHeaders();
  const sleutels = ip ? [`akkoord-ip:${ip}`] : [];
  if (sleutels.length && (await loginGeblokkeerd(sleutels, 20, 15 * 60_000))) redirect(`${terug}?fout=te-vaak`);
  await registreerMisluktePoging(sleutels);

  const userAgent = ((await headers()).get('user-agent') ?? '').slice(0, 400) || null;
  const uitkomst = await registreerOfferteAkkoord(token, { naam, functie, email, ip, userAgent });
  if (!uitkomst.ok) redirect(`${terug}?fout=${uitkomst.reden}`);

  const { offerte, orderId, totaal } = uitkomst;
  const nummer = offerte.offertenummer != null ? `${offerte.offertenummer}` : '';
  const klant = offerte.organisatie_naam ?? offerte.contactpersoon ?? 'Onbekende klant';
  await logAudit('offerte_online_goedgekeurd', {
    entiteit: 'offertes',
    entiteitId: offerte.id,
    actor: `klant: ${naam}`,
    details: { naam, functie, email, totaal, orderId },
  }).catch(() => {});

  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim();
  const basis = host ? `https://${host}` : '';

  // Jessi: meteen weten dat er akkoord is, met de link naar de order.
  await sendEmail({
    to: env.notifyEmail,
    subject: `Offerte ${nummer} online goedgekeurd door ${klant}`.replace(/\s+/g, ' '),
    html: emailLayout({
      heading: 'Offerte online goedgekeurd',
      preheader: `${naam} keurde offerte ${nummer} goed (${formatEuro(totaal)} incl. btw).`,
      bodyHtml: `
        <p style="margin:14px 0 0;"><strong>${escapeHtml(naam)}</strong>${functie ? ` (${escapeHtml(functie)})` : ''} van <strong>${escapeHtml(klant)}</strong> heeft offerte <strong>${escapeHtml(nummer)}</strong> online goedgekeurd, inclusief de algemene voorwaarden.</p>
        <p style="margin:10px 0 0;">Totaal: <strong>${escapeHtml(formatEuro(totaal))}</strong> incl. btw.${email ? ` E-mail: ${escapeHtml(email)}.` : ''}</p>
        <p style="margin:10px 0 0;">${orderId ? 'De order is aangemaakt en staat op <strong>offerte goedgekeurd</strong>. Plan de passessie.' : 'Deze offerte hangt nog niet aan een klant. Maak de klant aan en zet de offerte om naar een order.'}</p>
        ${basis ? `<p style="margin:16px 0 0;"><a href="${basis}${orderId ? `/dashboard/orders/${orderId}` : `/dashboard/offertes/${offerte.id}`}" style="color:#b04318;font-weight:700;">${orderId ? 'Naar de order' : 'Naar de offerte'}</a></p>` : ''}`,
    }),
  }).catch(() => {});

  // De klant: bevestiging, met de voorwaarden nog een keer als bijlage.
  const naar = email ?? offerte.organisatie_email ?? null;
  if (naar) {
    const pdf = await voorwaardenPdfBase64();
    await sendEmail({
      to: naar,
      replyTo: env.notifyEmail,
      subject: `Bevestiging: offerte ${nummer} goedgekeurd`.replace(/\s+/g, ' '),
      html: emailLayout({
        heading: 'Bedankt voor je akkoord',
        preheader: `Je hebt offerte ${nummer} van Frederiks Bedrijfskleding goedgekeurd.`,
        bodyHtml: `
          <p style="margin:14px 0 0;">Beste ${escapeHtml(naam)},</p>
          <p style="margin:10px 0 0;">Bedankt! Je hebt offerte <strong>${escapeHtml(nummer)}</strong> goedgekeurd (${escapeHtml(formatEuro(totaal))} incl. btw). De algemene voorwaarden zitten nog een keer als bijlage bij deze mail.</p>
          <p style="margin:10px 0 0;">Zo gaat het verder: we nemen contact met je op om een passessie te plannen, bij jullie op locatie of in onze showroom. Daarna leggen we de definitieve maten en aantallen vast en gaan we aan de slag.</p>
          <p style="margin:16px 0 0;">Met vriendelijke groet,<br><strong>Frederiks Bedrijfskleding</strong></p>`,
      }),
      ...(pdf ? { attachments: [{ filename: VOORWAARDEN_BESTANDSNAAM, content: pdf }] } : {}),
    }).catch(() => {});
  }

  redirect(`${terug}?ok=1`);
}
