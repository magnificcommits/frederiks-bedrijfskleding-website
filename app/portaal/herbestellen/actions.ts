'use server';
import { redirect } from 'next/navigation';
import { getPortaalUser, getMijnOrganisatie, getKledinglijn, getMedewerkers, maakBestelling } from '@/lib/portaal/queries';
import { sendEmail } from '@/lib/email';
import { herbestellingMeldingHtml } from '@/lib/mailSjablonen';
import { env } from '@/lib/env';

export async function vraagHerbestelling(formData: FormData) {
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const org = await getMijnOrganisatie();
  if (!org) redirect('/portaal');

  const items = await getKledinglijn();
  const notitie = String(formData.get('notitie') ?? '').trim();
  const voor = String(formData.get('voor') ?? '').trim();

  const regels: { item_naam: string; kledinglijn_item_id: string; maat: string; aantal: number }[] = [];
  let waarde = 0;
  for (const it of items) {
    const aantal = parseInt(String(formData.get(`aantal_${it.id}`) ?? '0'), 10);
    if (!Number.isFinite(aantal) || aantal <= 0) continue;
    const maat = String(formData.get(`maat_${it.id}`) ?? '').trim();
    regels.push({ item_naam: it.naam, kledinglijn_item_id: it.id, maat, aantal });
    waarde += (Number(it.richtprijs) || 0) * aantal;
  }
  if (regels.length === 0) redirect(`/portaal/herbestellen?leeg=1${voor ? `&voor=${voor}` : ''}`);

  let medewerkerNaam: string | null = null;
  if (voor) medewerkerNaam = (await getMedewerkers()).find((x) => x.id === voor)?.naam ?? null;

  const door = user.email ?? 'onbekend';
  const res = await maakBestelling(org.id, door, notitie, regels, { medewerkerId: voor || null, medewerkerNaam, waarde: waarde || null });
  if (!res.ok) redirect('/portaal/herbestellen?fout=1');

  await sendEmail({
    to: env.notifyEmail,
    subject: `Nieuwe herbestelling via portaal: ${org.naam}`,
    html: herbestellingMeldingHtml({ organisatie: org.naam, door, medewerkerNaam, waarde, regels, notitie }),
  }).catch(() => {});

  redirect('/portaal/bestellingen?ok=1');
}
