import crypto from 'crypto';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { sendEmail } from '@/lib/email';
import { env, isAiConfigured } from '@/lib/env';
import { aiTekst } from '@/lib/ai';

/**
 * Verzendmotor voor de outbound campagnes. Bewust server-side en achter een
 * cron-secret: deze verstuurt e-mail. Per cron-run wordt voor een beperkt aantal
 * openstaande inschrijvingen de volgende stap verstuurd, met afmeld-link en
 * respect voor de suppressielijst (afmeldingen).
 */

const AFMELD_GEHEIM = env.cronSecret || 'frederiks-afmeld-fallback';

/** Token om een afmeldlink te valideren, zodat niet zomaar iedereen adressen kan afmelden. */
export function afmeldToken(email: string): string {
  return crypto.createHmac('sha256', AFMELD_GEHEIM).update(email.toLowerCase()).digest('hex').slice(0, 16);
}

export function afmeldUrl(email: string): string {
  const base = env.siteUrl.replace(/\/$/, '');
  return `${base}/afmelden?e=${encodeURIComponent(email)}&t=${afmeldToken(email)}`;
}

function vulIn(tekst: string, p: { bedrijfsnaam: string | null; contactpersoon: string | null }): string {
  return tekst
    .replace(/\{\{\s*bedrijfsnaam\s*\}\}/gi, p.bedrijfsnaam || 'uw bedrijf')
    .replace(/\{\{\s*contactpersoon\s*\}\}/gi, p.contactpersoon || 'beste relatie');
}

/**
 * Verwerkt de wachtrij: stuurt voor elke openstaande inschrijving (actieve campagne,
 * volgende_verzending in het verleden) de volgende stap. Beperk het aantal per run
 * zodat verzending gespreid blijft (deliverability).
 */
export async function verwerkCampagneWachtrij(limiet = 40): Promise<{ verwerkt: number; verzonden: number }> {
  const sb = kmsAdmin();
  if (!sb) return { verwerkt: 0, verzonden: 0 };
  const nu = new Date();

  const { data: insData } = await sb
    .from('campagne_inschrijvingen')
    .select('id, campagne_id, prospect_id, huidige_stap, volgende_verzending, status')
    .eq('status', 'actief')
    .lte('volgende_verzending', nu.toISOString())
    .order('volgende_verzending', { ascending: true })
    .limit(limiet);
  const inschrijvingen =
    (insData as { id: string; campagne_id: string; prospect_id: string; huidige_stap: number; volgende_verzending: string | null; status: string }[]) ?? [];
  if (inschrijvingen.length === 0) return { verwerkt: 0, verzonden: 0 };

  const { data: afmData } = await sb.from('afmeldingen').select('email');
  const afgemeld = new Set(((afmData as { email: string }[]) ?? []).map((a) => a.email.toLowerCase()));

  let verzonden = 0;
  for (const ins of inschrijvingen) {
    const { data: campData } = await sb.from('campagnes').select('id, status, van_naam, van_email').eq('id', ins.campagne_id).maybeSingle();
    const camp = campData as { id: string; status: string; van_naam: string | null; van_email: string | null } | null;
    if (!camp || camp.status !== 'actief') continue;

    const { data: stapData } = await sb
      .from('campagne_stappen')
      .select('id, volgorde, wacht_dagen, onderwerp, body, ai_personaliseer')
      .eq('campagne_id', ins.campagne_id)
      .order('volgorde', { ascending: true });
    const stappen = (stapData as { id: string; volgorde: number; wacht_dagen: number; onderwerp: string; body: string; ai_personaliseer: boolean }[]) ?? [];
    if (ins.huidige_stap >= stappen.length) {
      await sb.from('campagne_inschrijvingen').update({ status: 'klaar', volgende_verzending: null }).eq('id', ins.id);
      continue;
    }
    const stap = stappen[ins.huidige_stap];

    const { data: prData } = await sb.from('prospecten').select('id, bedrijfsnaam, contactpersoon, email, status, branche, plaats').eq('id', ins.prospect_id).maybeSingle();
    const pr = prData as { id: string; bedrijfsnaam: string | null; contactpersoon: string | null; email: string | null; status: string; branche: string | null; plaats: string | null } | null;
    if (!pr || !pr.email) {
      await sb.from('campagne_inschrijvingen').update({ status: 'gestopt', volgende_verzending: null }).eq('id', ins.id);
      continue;
    }
    if (afgemeld.has(pr.email.toLowerCase()) || pr.status === 'afgemeld') {
      await sb.from('campagne_inschrijvingen').update({ status: 'afgemeld', volgende_verzending: null }).eq('id', ins.id);
      continue;
    }

    let aiZin = '';
    if (stap.ai_personaliseer && isAiConfigured) {
      try {
        const r = await aiTekst(
          `Schrijf één korte, persoonlijke openingszin (maximaal 25 woorden) voor een koude zakelijke e-mail aan ${pr.bedrijfsnaam || 'dit bedrijf'}${pr.branche ? `, actief in ${pr.branche}` : ''}${pr.plaats ? ` in ${pr.plaats}` : ''}, namens Frederiks Bedrijfskleding (werk- en bedrijfskleding). Concreet en relevant, geen clichés, geen aanhef of ondertekening, alleen die ene zin.`,
        );
        if (r.ok && r.tekst) aiZin = r.tekst.trim();
      } catch {
        aiZin = '';
      }
    }
    const metAi = (t: string) => t.replace(/\{\{\s*ai\s*\}\}/gi, aiZin);
    const onderwerp = metAi(vulIn(stap.onderwerp, pr));
    const bodyTekst = metAi(vulIn(stap.body, pr));
    const afmeld = afmeldUrl(pr.email);
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1c1c1c;">${bodyTekst.replace(/\n/g, '<br>')}<hr style="border:none;border-top:1px solid #eeeeee;margin:24px 0 12px;"><p style="font-size:12px;color:#999999;">Geen interesse? <a href="${afmeld}" style="color:#999999;">Afmelden</a>.</p></div>`;
    const van = camp.van_email
      ? camp.van_naam
        ? `${camp.van_naam} <${camp.van_email}>`
        : camp.van_email
      : env.campagneFrom || env.resendFrom;

    const res = await sendEmail({ to: pr.email, from: van, subject: onderwerp, html }).catch(() => ({ sent: false }));
    await sb.from('campagne_verzendingen').insert({
      campagne_id: ins.campagne_id,
      inschrijving_id: ins.id,
      prospect_id: pr.id,
      stap_id: stap.id,
      onderwerp,
      status: res.sent ? 'verzonden' : 'gefaald',
    });
    if (res.sent) verzonden++;

    const volgende = ins.huidige_stap + 1;
    if (volgende >= stappen.length) {
      await sb.from('campagne_inschrijvingen').update({ huidige_stap: volgende, status: 'klaar', volgende_verzending: null }).eq('id', ins.id);
    } else {
      const wacht = Math.max(0, Number(stappen[volgende].wacht_dagen) || 0);
      const volgendeDatum = new Date(nu.getTime() + wacht * 24 * 60 * 60 * 1000);
      await sb.from('campagne_inschrijvingen').update({ huidige_stap: volgende, volgende_verzending: volgendeDatum.toISOString() }).eq('id', ins.id);
    }

    const patch: Record<string, unknown> = { laatste_contact: nu.toISOString() };
    if (pr.status === 'nieuw') patch.status = 'benaderd';
    await sb.from('prospecten').update(patch).eq('id', pr.id);
  }

  return { verwerkt: inschrijvingen.length, verzonden };
}
