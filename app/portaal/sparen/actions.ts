'use server';
import { redirect } from 'next/navigation';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getSpaarInstellingenUitgebreid } from '@/lib/kms/sparenData';
import { vraagInwisselingAan } from '@/lib/kms/sparenInwisselen';
import { getVertaler } from '@/lib/i18n/portaal/server';

/**
 * Een beheerder van de klant vraagt een beloning aan. De organisatie komt nooit
 * uit het formulier: die halen we via de ingelogde gebruiker (RLS), zodat
 * niemand punten van een ander bedrijf kan aanvragen.
 */
export async function vraagBeloningAanActie(formData: FormData) {
  const fout = (tekst: string) => redirect(`/portaal/sparen?fout=${encodeURIComponent(tekst)}#beloningen`);
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const { t, taal } = await getVertaler();
  const [toegang, org, inst] = await Promise.all([getMijnToegang(), getMijnOrganisatie(), getSpaarInstellingenUitgebreid()]);
  if (!org) fout(t('sparen.fout.nietGekoppeld'));
  if (toegang.rol !== 'beheerder') fout(t('sparen.fout.alleenBeheerder'));
  if (toegang.organisatieId && toegang.organisatieId !== org!.id) fout(t('sparen.fout.account'));
  if (!inst.actief || !inst.portaalAanvragen) fout(t('sparen.fout.uit'));

  const beloningId = String(formData.get('beloning_id') ?? '').trim();
  if (!beloningId) fout(t('sparen.fout.kiesBeloning'));
  const notitie = String(formData.get('notitie') ?? '').trim().slice(0, 500);
  const r = await vraagInwisselingAan({
    orgId: org!.id,
    beloningId,
    bron: 'portaal',
    door: toegang.email ?? user.email ?? 'portaal',
    notitie: notitie || null,
  });
  // De reden uit het KMS is Nederlands; in een andere taal tonen we een algemene melding.
  if (!r.ok) fout(taal === 'nl' && r.fout ? r.fout : t('sparen.fout.mislukt'));
  redirect('/portaal/sparen?ok=aangevraagd#aanvragen');
}
