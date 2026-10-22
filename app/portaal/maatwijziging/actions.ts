'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getAssortiment, getMijnMedewerker, getVoorkeursmaten } from '@/lib/portaal/webshop';
import { vraagMaatwijzigingAan } from '@/lib/portaal/maatwijziging';
import { logPortaal } from '@/lib/portaal/activiteit';
import { sendEmail, emailLayout, emailGegevens, emailKnop, escapeHtml } from '@/lib/email';
import { env } from '@/lib/env';

/**
 * Maatwijziging aanvragen (werkdocument portaal 21 okt, punt 2). De werknemer
 * wijzigt zijn maat niet zelf: het verzoek gaat naar Frederiks, die het in het
 * KMS beoordeelt. Alleen artikelen uit het eigen assortiment, alleen bestaande maten.
 */
export async function vraagMaatwijzigingActie(formData: FormData) {
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const [org, ik, toegang] = await Promise.all([getMijnOrganisatie(), getMijnMedewerker(), getMijnToegang()]);
  if (!org || !ik || !toegang.organisatieId) redirect('/portaal/maatwijziging?fout=geen');

  const productId = String(formData.get('product_id') ?? '').trim();
  const gewenst = String(formData.get('gewenste_maat') ?? '').trim();
  const toelichting = String(formData.get('toelichting') ?? '').trim() || null;
  const assortiment = await getAssortiment(ik);
  const product = assortiment.find((p) => p.id === productId);
  const maten = new Set((product?.varianten ?? []).map((v) => (v.maat ?? '').trim()).filter(Boolean));
  if (!product || !gewenst || (maten.size > 0 && !maten.has(gewenst))) redirect('/portaal/maatwijziging?fout=maat');

  const huidig = (await getVoorkeursmaten(ik.id))[productId]?.voorkeursmaat ?? null;
  if (huidig && huidig === gewenst) redirect('/portaal/maatwijziging?fout=zelfde');

  const res = await vraagMaatwijzigingAan({
    organisatieId: toegang.organisatieId,
    medewerkerId: ik.id,
    productId,
    huidigeMaat: huidig,
    gewensteMaat: gewenst,
    toelichting,
    door: user.email ?? null,
  });
  if (!res.ok) redirect('/portaal/maatwijziging?fout=opslaan');
  await logPortaal('maatwijziging_aangevraagd');

  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim();
  const naam = ik.naam ?? ([ik.voornaam, ik.achternaam].filter(Boolean).join(' ') || user.email || 'Onbekend');
  await sendEmail({
    to: env.notifyEmail,
    subject: `Maatwijziging aangevraagd: ${naam} (${org.naam})`,
    html: emailLayout({
      heading: 'Maatwijziging aangevraagd',
      preheader: `${naam} vraagt ${product.naam} in maat ${gewenst}.`,
      bodyHtml: `${emailGegevens([
        ['Klant', escapeHtml(org.naam)],
        ['Werknemer', escapeHtml(naam)],
        ['Artikel', escapeHtml(product.naam)],
        ['Huidige maat', escapeHtml(huidig ?? 'nog niet vastgelegd')],
        ['Gewenste maat', `<strong>${escapeHtml(gewenst)}</strong>`],
        ['Toelichting', toelichting ? escapeHtml(toelichting) : null],
      ])}
      ${emailKnop('Beoordelen', `${host ? `https://${host}` : env.siteUrl}/dashboard/medewerker-verzoeken#maatwijzigingen`)}`,
    }),
  }).catch(() => {});

  redirect('/portaal/maatwijziging?ok=1');
}
