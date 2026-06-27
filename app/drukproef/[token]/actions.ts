'use server';

import { redirect } from 'next/navigation';
import { beslisDrukproefViaToken } from '@/lib/kms/drukproeven';
import { sendEmail, emailLayout, escapeHtml } from '@/lib/email';
import { env } from '@/lib/env';

/**
 * Publieke server-actie voor de mail-goedkeurroute. GEEN auth: de geheime token in de link
 * is het enige bewijs. De klant keurt de drukproef goed of af, eventueel met een opmerking.
 * Bij succes krijgt Jessi een mailtje; een mailfout breekt de flow niet.
 */
export async function beslisActie(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '').trim();
  const besluit = String(formData.get('besluit') ?? '');
  const opmerking = String(formData.get('opmerking') ?? '').trim();
  const akkoord = besluit === 'akkoord';

  if (!token) redirect('/');

  const resultaat = await beslisDrukproefViaToken(token, akkoord, opmerking || null);

  if (resultaat) {
    const bedrijf = resultaat.organisatie_naam ?? 'Onbekende klant';
    const heading = akkoord ? 'Drukproef goedgekeurd' : 'Drukproef afgekeurd';
    const opmerkingHtml = opmerking
      ? `<p style="margin:12px 0 0;"><strong>Opmerking van de klant:</strong><br/>${escapeHtml(opmerking)}</p>`
      : '<p style="margin:12px 0 0;color:#8a8886;">Geen opmerking meegegeven.</p>';

    const bodyHtml = `
      <p style="margin:0;">${escapeHtml(bedrijf)} heeft een drukproef ${akkoord ? 'goedgekeurd' : 'afgekeurd'}.</p>
      <p style="margin:12px 0 0;"><strong>Drukproef:</strong> ${escapeHtml(resultaat.naam)}</p>
      ${opmerkingHtml}
    `;

    await sendEmail({
      to: env.notifyEmail,
      subject: `${heading}: ${resultaat.naam} (${bedrijf})`,
      html: emailLayout({ heading, bodyHtml, preheader: `${bedrijf} heeft gereageerd op een drukproef.` }),
    }).catch(() => {});
  }

  redirect(`/drukproef/${token}?ok=${akkoord ? 'akkoord' : 'afkeuren'}`);
}
