'use server';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getHuisstijl } from '@/lib/portaal/huisstijl';
import { sendEmail } from '@/lib/email';
import { ontwerpaanvraagMeldingHtml } from '@/lib/mailSjablonen';
import { env } from '@/lib/env';
import { getVertaler } from '@/lib/i18n/portaal/server';

type Regel = { item_naam: string; kleur: string | null; aantal: number };

/**
 * Maakt vanuit de pakketsamensteller een concept-order aan in het KMS (tabel orders).
 * Het is bewust een ontwerpaanvraag: Frederiks werkt de concept-order uit tot echte
 * producten, maten en een offerte. RLS borgt dat dit de eigen organisatie is; een
 * medewerker mag alleen voor zichzelf, een beheerder of leidinggevende voor de organisatie.
 */
export async function maakOntwerpAanvraag(
  payload: { regels: Regel[]; notitie: string },
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  const { t } = await getVertaler();
  if (!sb) return { ok: false, error: t('algemeen.nietGeconfigureerd') };

  const user = await getPortaalUser();
  if (!user) return { ok: false, error: t('ontwerpen.nietIngelogd') };
  const org = await getMijnOrganisatie();
  if (!org) return { ok: false, error: t('ontwerpen.nietGekoppeld') };
  const toegang = await getMijnToegang();

  const regels = (payload.regels ?? [])
    .filter((r) => r.item_naam && Number(r.aantal) > 0)
    .slice(0, 50)
    .map((r) => ({ item_naam: String(r.item_naam).slice(0, 300), kleur: r.kleur ? String(r.kleur).slice(0, 80) : null, aantal: Math.max(1, Math.round(Number(r.aantal))) }));
  if (regels.length === 0) return { ok: false, error: t('ontwerpen.geenRegels') };

  const door = user.email ?? toegang.email ?? 'onbekend';
  const notitie = `Ontwerpaanvraag via de pakketsamensteller. ${payload.notitie ?? ''}`.trim().slice(0, 4000);
  // RLS: een medewerker mag alleen een eigen order aanmaken, dus koppelen aan zichzelf.
  const medewerkerId = toegang.rol === 'medewerker' ? toegang.medewerkerId : null;

  const { data, error } = await sb
    .from('orders')
    .insert({
      organisatie_id: org.id,
      medewerker_id: medewerkerId,
      status: 'concept',
      goedkeuring_status: 'niet_nodig',
      aangevraagd_door: door,
      notitie,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? t('ontwerpen.aanmakenMislukt') };
  const orderId = (data as { id: string }).id;

  const rows = regels.map((r) => ({ order_id: orderId, item_naam: r.item_naam, kleur: r.kleur, aantal: r.aantal }));
  const { error: e2 } = await sb.from('orderregels').insert(rows);
  if (e2) return { ok: false, error: e2.message };

  // Notificatie naar Frederiks (best effort; faalt de aanvraag nooit).
  const huisstijl = await getHuisstijl().catch(() => null);
  await sendEmail({
    to: env.notifyEmail,
    subject: `Nieuwe ontwerpaanvraag via portaal: ${org.naam}`,
    html: ontwerpaanvraagMeldingHtml({ organisatie: org.naam, door, logoUrl: huisstijl?.logoUrl ?? null, regels }),
  }).catch(() => {});

  return { ok: true };
}
