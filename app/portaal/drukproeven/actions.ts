'use server';
import { logPortaal } from '@/lib/portaal/activiteit';
import { redirect } from 'next/navigation';
import { getPortaalUser } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';
import { verwerkDrukproefGoedkeuring } from '@/lib/kms/drukproeven';
import { eisRijen } from '@/lib/dbFout';
import { sendEmail } from '@/lib/email';
import { drukproefBesluitPortaalHtml } from '@/lib/mailSjablonen';
import { env } from '@/lib/env';

/**
 * Beslist een drukproef vanuit het portaal: goedkeuren of afkeuren met een opmerking.
 * Alleen een beheerder of leidinggevende mag dit. RLS borgt dat het de eigen org is.
 */
export async function beslisDrukproefPortaalActie(formData: FormData) {
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');

  const toegang = await getMijnToegang();
  if (toegang.rol !== 'beheerder' && toegang.rol !== 'leidinggevende') {
    redirect('/portaal/drukproeven');
  }

  const id = String(formData.get('id') ?? '').trim();
  const besluit = String(formData.get('besluit') ?? '').trim();
  const opmerking = String(formData.get('opmerking') ?? '').trim();
  if (!id || (besluit !== 'akkoord' && besluit !== 'afkeuren')) {
    redirect('/portaal/drukproeven');
  }

  const sb = await getServerSupabase();
  if (!sb) redirect('/portaal/drukproeven');

  // Alleen een proef die bij de klant ligt (verstuurd). Een concept is nog niet
  // af, en een proef die al beslist is (en misschien al op de machine ligt)
  // mag niet via een oud tabblad alsnog omgegooid worden.
  // .select(): weigert RLS stil (andere klant, geen rechten), dan niet "opgeslagen" melden.
  const { data, error } = await sb
    .from('drukproeven')
    .update({
      status: besluit === 'akkoord' ? 'goedgekeurd' : 'afgekeurd',
      opmerking: opmerking || null,
      behandeld_op: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'verstuurd')
    .select('naam');
  if (!eisRijen('portaal.drukproefBesluit', { data, error }).ok) redirect('/portaal/drukproeven?fout=opslaan');
  const bijgewerkt = (data ?? [])[0];

  // Hangt de drukproef aan een order, dan gaat de werkbon (en zo mogelijk de order) door naar productie.
  // Alleen als RLS de wijziging toeliet: verwerkDrukproefGoedkeuring werkt met de service-role.
  if (besluit === 'akkoord') await verwerkDrukproefGoedkeuring(id);

  // Jessi een seintje, net als bij beslissen via de link in de mail.
  const akkoord = besluit === 'akkoord';
  const naam = (bijgewerkt as { naam: string | null }).naam ?? 'Drukproef';
  const heading = akkoord ? 'Drukproef goedgekeurd' : 'Drukproef afgekeurd';
  await sendEmail({
    to: env.notifyEmail,
    subject: `${heading} in het portaal: ${naam}`,
    html: drukproefBesluitPortaalHtml({ akkoord, wie: toegang.email ?? null, naam, opmerking: opmerking || null }),
  }).catch(() => {});

  await logPortaal('drukproef_beoordeeld');
  redirect('/portaal/drukproeven?ok=opgeslagen');
}
