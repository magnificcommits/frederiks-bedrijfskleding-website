'use server';

import { redirect } from 'next/navigation';
import { beslisDrukproefViaToken } from '@/lib/kms/drukproeven';
import { sendEmail } from '@/lib/email';
import { drukproefBesluitLinkHtml } from '@/lib/mailSjablonen';
import { env } from '@/lib/env';

/**
 * Publieke server-actie voor de mail-goedkeurroute. GEEN auth: de geheime token in de link
 * is het enige bewijs. De klant keurt de drukproef goed of af, eventueel met een opmerking.
 * Bij succes krijgt Jessi een mailtje; een mailfout breekt de flow niet.
 */
export async function beslisActie(formData: FormData): Promise<void> {
  // auth: token (beslisDrukproefViaToken zoekt het token op; alleen concept/verstuurd).
  const token = String(formData.get('token') ?? '').trim().slice(0, 100);
  const besluit = String(formData.get('besluit') ?? '');
  const opmerking = String(formData.get('opmerking') ?? '').trim().slice(0, 2000);
  const akkoord = besluit === 'akkoord';

  if (!token) redirect('/');

  const resultaat = await beslisDrukproefViaToken(token, akkoord, opmerking || null);

  if (resultaat) {
    const bedrijf = resultaat.organisatie_naam ?? 'Onbekende klant';
    const heading = akkoord ? 'Drukproef goedgekeurd' : 'Drukproef afgekeurd';
    await sendEmail({
      to: env.notifyEmail,
      subject: `${heading}: ${resultaat.naam} (${bedrijf})`,
      html: drukproefBesluitLinkHtml({ akkoord, bedrijf, naam: resultaat.naam, opmerking: opmerking || null }),
    }).catch(() => {});
  }

  redirect(`/drukproef/${token}?ok=${akkoord ? 'akkoord' : 'afkeuren'}`);
}
