import { kmsAdmin } from '@/lib/kms/adminClient';
import { sendEmail } from '@/lib/email';
import { isEmailConfigured } from '@/lib/env';
import { site } from '@/content/site';
import { normaliseerFlow, type MailKnoop } from '@/lib/campagnes/flow';
import { VOORBEELD_CONTEXT } from '@/lib/campagnes/mail';
import { bouwMail, mergeContextVoor } from '@/lib/kms/campagne-engine';
import { laadContacten } from '@/lib/kms/campagneContacten';
import { getCampagneInstellingen } from '@/lib/kms/campagneInstellingen';

/**
 * Testmail en voorbeeldweergave voor één mailstap, zoals die nu in de editor
 * staat (ook als hij nog niet is opgeslagen). Geen tracking, geen telling.
 */

function leesMailKnoop(invoer: unknown): MailKnoop | null {
  const k = normaliseerFlow({ stappen: [invoer] }).stappen[0];
  return k && k.type === 'mail' ? k : null;
}

/** Eerste echte ontvanger van de campagne, zodat de test met echte gegevens is gevuld. */
async function voorbeeldContext(campagneId: string | null) {
  const inst = await getCampagneInstellingen();
  const sb = kmsAdmin();
  if (sb && campagneId) {
    const { data } = await sb.from('campagne_inschrijvingen').select('*').eq('campagne_id', campagneId).limit(1);
    const r = ((data as Record<string, string | null>[]) ?? [])[0];
    if (r) {
      const m = await laadContacten({ prospectIds: r.prospect_id ? [r.prospect_id] : [], leadIds: r.lead_id ? [r.lead_id] : [], orgIds: r.organisatie_id ? [r.organisatie_id] : [] });
      const c = Array.from(m.values())[0];
      if (c) return { ctx: { ...mergeContextVoor(c, { reviewlink: inst.reviewlink, spaardrempel: 1000, spaar: null }), spaarsaldo: VOORBEELD_CONTEXT.spaarsaldo, volgendNiveau: VOORBEELD_CONTEXT.volgendNiveau }, contact: c, echt: true };
    }
  }
  return { ctx: { ...VOORBEELD_CONTEXT, reviewlink: inst.reviewlink || VOORBEELD_CONTEXT.reviewlink }, contact: null, echt: false };
}

export async function voorbeeldMailHtml(campagneId: string | null, invoer: unknown): Promise<{ ok: boolean; html?: string; onderwerp?: string; fout?: string }> {
  const k = leesMailKnoop(invoer);
  if (!k) return { ok: false, fout: 'Geen mailstap.' };
  const { ctx } = await voorbeeldContext(campagneId);
  const mail = await bouwMail({ ...k, ai: false }, { ...ctx, ai: ctx.ai ?? VOORBEELD_CONTEXT.ai }, 'voorbeeld@frederiksbedrijfskleding.nl', null, null);
  if (mail.fout) return { ok: false, fout: mail.fout };
  return { ok: true, html: mail.html, onderwerp: mail.onderwerp };
}

export async function verstuurTestmail(campagneId: string | null, invoer: unknown, naar: string): Promise<{ ok: boolean; melding: string }> {
  const k = leesMailKnoop(invoer);
  if (!k) return { ok: false, melding: 'Geen mailstap gevonden.' };
  const adres = naar.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adres)) return { ok: false, melding: 'Vul een geldig testadres in (Campagne-instellingen of je eigen account).' };
  if (!isEmailConfigured) return { ok: false, melding: 'Niet verstuurd: mail staat nog niet aan (RESEND_API_KEY ontbreekt). Bekijk de mail via "Voorbeeld".' };
  const { ctx, contact, echt } = await voorbeeldContext(campagneId);
  const mail = await bouwMail(k, ctx, adres, null, contact);
  if (mail.fout) return { ok: false, melding: mail.fout };
  const inst = await getCampagneInstellingen();
  const r = await sendEmail({ to: adres, from: undefined, replyTo: site.email, subject: `[Test] ${mail.onderwerp}`, html: mail.html }).catch((e: Error) => ({ sent: false, error: e.message }));
  if (!r.sent) return { ok: false, melding: `Niet verstuurd: ${r.error ?? 'onbekende fout'}` };
  return { ok: true, melding: `Testmail verstuurd naar ${adres}${echt ? ', gevuld met de gegevens van de eerste ontvanger' : ', gevuld met voorbeeldgegevens'}. Afzender in het echt: ${inst.afzenderNaam}.` };
}
