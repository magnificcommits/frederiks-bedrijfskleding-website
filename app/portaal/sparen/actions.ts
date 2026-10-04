'use server';
import { redirect } from 'next/navigation';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getSpaarInstellingenUitgebreid } from '@/lib/kms/sparenData';
import { vraagInwisselingAan } from '@/lib/kms/sparenInwisselen';

/**
 * Een beheerder van de klant vraagt een beloning aan. De organisatie komt nooit
 * uit het formulier: die halen we via de ingelogde gebruiker (RLS), zodat
 * niemand punten van een ander bedrijf kan aanvragen.
 */
export async function vraagBeloningAanActie(formData: FormData) {
  const fout = (tekst: string) => redirect(`/portaal/sparen?fout=${encodeURIComponent(tekst)}#beloningen`);
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const [toegang, org, inst] = await Promise.all([getMijnToegang(), getMijnOrganisatie(), getSpaarInstellingenUitgebreid()]);
  if (!org) fout('Je account is nog niet aan een bedrijf gekoppeld.');
  if (toegang.rol !== 'beheerder') fout('Alleen een beheerder van jullie bedrijf kan beloningen aanvragen.');
  if (toegang.organisatieId && toegang.organisatieId !== org!.id) fout('Er ging iets mis met je account. Neem contact met ons op.');
  if (!inst.actief || !inst.portaalAanvragen) fout('Beloningen aanvragen kan op dit moment niet via het portaal. Bel of mail ons gerust.');

  const beloningId = String(formData.get('beloning_id') ?? '').trim();
  if (!beloningId) fout('Kies een beloning.');
  const notitie = String(formData.get('notitie') ?? '').trim().slice(0, 500);
  const r = await vraagInwisselingAan({
    orgId: org!.id,
    beloningId,
    bron: 'portaal',
    door: toegang.email ?? user.email ?? 'portaal',
    notitie: notitie || null,
  });
  if (!r.ok) fout(r.fout ?? 'Aanvragen is niet gelukt.');
  redirect('/portaal/sparen?ok=aangevraagd#aanvragen');
}
