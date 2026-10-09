import { randomBytes } from 'node:crypto';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { env } from '@/lib/env';
import { site } from '@/content/site';
import { emailLayout, escapeHtml, sendEmail } from '@/lib/email';
import { afmeldUrl } from '@/lib/kms/campagneAfmelden';
import { eisData } from '@/lib/dbFout';
import { NPS_ORDERSTATUSSEN } from '@/lib/reviews/npsStatussen';

/**
 * Reviews en NPS uit echte klanten.
 *
 * Flow:
 *  1. Een order krijgt een geleverde status; een trigger zet orders.geleverd_op.
 *  2. De dagelijkse cron stuurt X dagen later (instelbaar, standaard 7) één mail
 *     met de cijfers 0 t/m 10. Per order één keer, per klant hooguit eens per 90 dagen.
 *  3. Klik = score opslaan via het token (pagina /beoordeling/[token]).
 *     9-10: bedankt + vraag om een Google-review.
 *     0-6: automatisch een klacht (tabel klachten, bron 'nps') en een taak voor Jessi.
 *  4. Optioneel een toelichting met toestemming om te publiceren; Jessi zet hem
 *     in het KMS online (Reviews), alleen met die toestemming.
 *
 * Tabel `reviews`: RLS aan zonder policies, alles via kmsAdmin().
 */

export type Review = {
  id: string;
  created_at: string;
  score: number | null;
  tekst: string | null;
  naam: string | null;
  bedrijf: string | null;
  branche: string | null;
  toestemming_publiceren: boolean;
  gepubliceerd: boolean;
  gepubliceerd_op: string | null;
  uitgelicht: boolean;
  order_id: string | null;
  klant_id: string | null;
  email: string | null;
  token: string | null;
  bron: string;
  verstuurd_op: string | null;
  beantwoord_op: string | null;
  klacht_id: string | null;
  taak_id: string | null;
};

const KOLOMMEN =
  'id, created_at, score, tekst, naam, bedrijf, branche, toestemming_publiceren, gepubliceerd, gepubliceerd_op, uitgelicht, order_id, klant_id, email, token, bron, verstuurd_op, beantwoord_op, klacht_id, taak_id';

const TOKEN = /^[A-Za-z0-9_-]{20,80}$/;
const UUID = /^[0-9a-f-]{36}$/i;

/* ------------------------------------------------------------------ */
/* Instellingen                                                         */
/* ------------------------------------------------------------------ */

export type ReviewInstellingen = {
  /** NPS-mails automatisch versturen. */
  actief: boolean;
  /** Dagen na levering. */
  wachtdagen: number;
  /** Google-reviewlink; zelfde sleutel als de campagnes ({{reviewlink}}). */
  googleLink: string;
};

const SLEUTEL = 'reviews_instellingen';
const SLEUTEL_GOOGLE = 'campagnes_reviewlink';
export const STANDAARD_REVIEW_INSTELLINGEN: ReviewInstellingen = { actief: true, wachtdagen: 7, googleLink: '' };

/** Hooguit één verzoek per klant in deze periode, ook als ze vaker bestellen. */
const KLANT_RUST_DAGEN = 90;
/** Orders die langer dan dit na de wachttijd geleverd zijn, slaan we over (geen mail over iets van maanden geleden). */
const VENSTER_DAGEN = 21;

export async function getReviewInstellingen(): Promise<ReviewInstellingen> {
  const sb = kmsAdmin();
  if (!sb) return STANDAARD_REVIEW_INSTELLINGEN;
  const { data } = await sb.from('instellingen').select('sleutel, waarde').in('sleutel', [SLEUTEL, SLEUTEL_GOOGLE]);
  const map = new Map(((data as { sleutel: string; waarde: string | null }[]) ?? []).map((r) => [r.sleutel, r.waarde ?? '']));
  let ruw: Partial<ReviewInstellingen> = {};
  try {
    ruw = JSON.parse(map.get(SLEUTEL) || '{}') as Partial<ReviewInstellingen>;
  } catch {
    ruw = {};
  }
  const dagen = Math.round(Number(ruw.wachtdagen));
  return {
    actief: typeof ruw.actief === 'boolean' ? ruw.actief : STANDAARD_REVIEW_INSTELLINGEN.actief,
    wachtdagen: Number.isFinite(dagen) && dagen >= 1 && dagen <= 90 ? dagen : STANDAARD_REVIEW_INSTELLINGEN.wachtdagen,
    googleLink: (map.get(SLEUTEL_GOOGLE) ?? '').trim(),
  };
}

export async function zetReviewInstellingen(v: ReviewInstellingen): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;
  const nu = new Date().toISOString();
  const dagen = Math.min(90, Math.max(1, Math.round(Number(v.wachtdagen) || 7)));
  const link = /^https?:\/\//i.test(v.googleLink.trim()) ? v.googleLink.trim() : '';
  const { error } = await sb.from('instellingen').upsert(
    [
      { sleutel: SLEUTEL, waarde: JSON.stringify({ actief: Boolean(v.actief), wachtdagen: dagen }), bijgewerkt_op: nu },
      { sleutel: SLEUTEL_GOOGLE, waarde: link, bijgewerkt_op: nu },
    ],
    { onConflict: 'sleutel' },
  );
  return !error;
}

/* ------------------------------------------------------------------ */
/* NPS-mail na levering (dagelijkse cron)                               */
/* ------------------------------------------------------------------ */

function basis(): string {
  return env.siteUrl.replace(/\/$/, '');
}

export function beoordelingUrl(token: string, score?: number): string {
  return `${basis()}/beoordeling/${encodeURIComponent(token)}${score !== undefined ? `?score=${score}` : ''}`;
}

function isEmail(v: string | null | undefined): v is string {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

type OrderRij = {
  id: string;
  ordernummer: number | null;
  organisatie_id: string;
  geleverd_op: string;
  aangevraagd_door_contact_id: string | null;
};

type Ontvanger = { email: string; naam: string | null };

/** Wie krijgt de vraag: de contactpersoon die bestelde, anders het hoofdcontact, anders het algemene adres. */
async function ontvangerVoorOrder(o: OrderRij): Promise<{ ontvanger: Ontvanger | null; bedrijf: string | null; branche: string | null }> {
  const sb = kmsAdmin();
  if (!sb) return { ontvanger: null, bedrijf: null, branche: null };
  const [{ data: org }, { data: contacten }] = await Promise.all([
    sb.from('organisaties').select('naam, branche, email_algemeen, contactpersoon').eq('id', o.organisatie_id).maybeSingle(),
    sb.from('contactpersonen').select('id, naam, email, hoofdcontact').eq('organisatie_id', o.organisatie_id),
  ]);
  const orgRij = org as { naam: string | null; branche: string | null; email_algemeen: string | null; contactpersoon: string | null } | null;
  const lijst = (contacten as { id: string; naam: string; email: string | null; hoofdcontact: boolean }[]) ?? [];
  const besteller = o.aangevraagd_door_contact_id ? lijst.find((c) => c.id === o.aangevraagd_door_contact_id) : undefined;
  const hoofd = lijst.find((c) => c.hoofdcontact && isEmail(c.email));
  let ontvanger: Ontvanger | null = null;
  if (besteller && isEmail(besteller.email)) ontvanger = { email: besteller.email.trim().toLowerCase(), naam: besteller.naam };
  else if (hoofd && hoofd.email) ontvanger = { email: hoofd.email.trim().toLowerCase(), naam: hoofd.naam };
  else if (isEmail(orgRij?.email_algemeen)) ontvanger = { email: orgRij!.email_algemeen!.trim().toLowerCase(), naam: orgRij?.contactpersoon ?? null };
  return { ontvanger, bedrijf: orgRij?.naam ?? null, branche: orgRij?.branche ?? null };
}

export function npsMailHtml(r: { token: string; naam: string | null; ordernummer: number | null; email: string }): string {
  const voornaam = (r.naam ?? '').trim().split(/\s+/)[0];
  const cel = (n: number) =>
    `<td align="center" width="9%" style="padding:2px;"><a href="${escapeHtml(beoordelingUrl(r.token, n))}" style="display:block;max-width:40px;line-height:38px;border:1px solid #e4e2e0;border-radius:6px;background-color:${
      n >= 9 ? '#fdf0e9' : '#ffffff'
    };color:#1c1c1c;font-weight:700;font-size:15px;text-decoration:none;text-align:center;">${n}</a></td>`;
  return emailLayout({
    heading: 'Hoe tevreden ben je?',
    preheader: 'Eén klik op een cijfer van 0 tot 10. Meer hoeft niet.',
    bodyHtml: `
      <p style="margin:0;">${voornaam ? `Hoi ${escapeHtml(voornaam)},` : 'Hoi,'}</p>
      <p style="margin:14px 0 0;">Je bestelling${r.ordernummer ? ` #${r.ordernummer}` : ''} is sinds kort binnen. Ik ben benieuwd hoe het bevalt: de kleding, het passen, de levering. Hoe tevreden ben je over Frederiks?</p>
      <p style="margin:14px 0 6px;font-weight:700;color:#1c1c1c;">Klik op een cijfer:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:484px;border-collapse:separate;table-layout:fixed;"><tr>${Array.from({ length: 11 }, (_, n) => cel(n)).join('')}</tr></table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:484px;margin-top:4px;"><tr>
        <td style="font-size:12px;color:#8a8785;">0 = helemaal niet</td>
        <td align="right" style="font-size:12px;color:#8a8785;">10 = heel tevreden</td>
      </tr></table>
      <p style="margin:18px 0 0;">Daarna mag je er iets bij schrijven, maar dat hoeft niet. Ging er iets mis? Zeg het gerust, dan los ik het op.</p>
      <p style="margin:22px 0 0;">Groet,<br/>Jessi Frederiks<br/>${escapeHtml(site.phone)}</p>
      <p style="margin:22px 0 0;font-size:12px;color:#8a8785;">Liever geen mails meer van ons? <a href="${escapeHtml(afmeldUrl(r.email))}" style="color:#8a8785;">Afmelden</a>.</p>
    `,
  });
}

async function afgemeld(email: string): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return true;
  const { data } = await sb.from('afmeldingen').select('email').ilike('email', email.replace(/[\\%_]/g, (t) => `\\${t}`)).limit(1);
  return ((data as unknown[]) ?? []).length > 0;
}

export type NpsRapport = { aangemaakt: number; verstuurd: number; overgeslagen: number; mislukt: number; uit?: boolean };

/**
 * NPS-verzoeken voor orders die precies lang genoeg geleverd zijn. Maakt eerst
 * de review-rij aan (uniek per order, dus nooit dubbel) en verstuurt dan; een
 * mislukte verzending wordt de volgende dagen nog twee keer geprobeerd.
 */
export async function verstuurNpsMails(opties: { nu?: Date; max?: number } = {}): Promise<NpsRapport> {
  const rapport: NpsRapport = { aangemaakt: 0, verstuurd: 0, overgeslagen: 0, mislukt: 0 };
  const sb = kmsAdmin();
  if (!sb) return rapport;
  const inst = await getReviewInstellingen();
  if (!inst.actief) return { ...rapport, uit: true };
  const nu = opties.nu ?? new Date();
  const max = opties.max ?? 40;
  const dag = 86_400_000;
  const tot = new Date(nu.getTime() - inst.wachtdagen * dag).toISOString();
  const van = new Date(nu.getTime() - (inst.wachtdagen + VENSTER_DAGEN) * dag).toISOString();

  const { data: orderData } = await sb
    .from('orders')
    .select('id, ordernummer, organisatie_id, geleverd_op, aangevraagd_door_contact_id')
    .in('status', [...NPS_ORDERSTATUSSEN])
    .gte('geleverd_op', van)
    .lte('geleverd_op', tot)
    .order('geleverd_op')
    .limit(200);
  const orders = (orderData as OrderRij[]) ?? [];

  if (orders.length) {
    const { data: bestaand } = await sb.from('reviews').select('order_id').in('order_id', orders.map((o) => o.id));
    const alGedaan = new Set(((bestaand as { order_id: string }[]) ?? []).map((r) => r.order_id));
    const rustGrens = new Date(nu.getTime() - KLANT_RUST_DAGEN * dag).toISOString();
    const orgIds = [...new Set(orders.map((o) => o.organisatie_id))];
    const { data: recent } = await sb.from('reviews').select('klant_id').in('klant_id', orgIds).gte('created_at', rustGrens);
    const rustend = new Set(((recent as { klant_id: string }[]) ?? []).map((r) => r.klant_id));

    for (const o of orders) {
      if (rapport.aangemaakt >= max) break;
      if (alGedaan.has(o.id)) continue;
      if (rustend.has(o.organisatie_id)) {
        rapport.overgeslagen += 1;
        continue;
      }
      const { ontvanger, bedrijf, branche } = await ontvangerVoorOrder(o);
      if (!ontvanger || (await afgemeld(ontvanger.email))) {
        rapport.overgeslagen += 1;
        continue;
      }
      const { error } = await sb.from('reviews').insert({
        order_id: o.id,
        klant_id: o.organisatie_id,
        email: ontvanger.email,
        naam: ontvanger.naam,
        bedrijf,
        branche,
        token: randomBytes(24).toString('base64url'),
        bron: 'nps-mail',
      });
      if (error) continue; // 23505: net door een andere ronde aangemaakt
      rustend.add(o.organisatie_id);
      rapport.aangemaakt += 1;
    }
  }

  // Versturen: nieuw aangemaakt of eerder mislukt (hooguit drie dagen oud).
  const { data: teVersturen } = await sb
    .from('reviews')
    .select('id, token, email, naam, order_id, created_at')
    .is('verstuurd_op', null)
    .is('score', null)
    .eq('bron', 'nps-mail')
    .gte('created_at', new Date(nu.getTime() - 3 * dag).toISOString())
    .limit(max);
  const rijen = (teVersturen as { id: string; token: string; email: string; naam: string | null; order_id: string | null }[]) ?? [];
  const nummers = new Map<string, number | null>();
  if (rijen.length) {
    const ids = rijen.map((r) => r.order_id).filter((x): x is string => Boolean(x));
    if (ids.length) {
      const { data } = await sb.from('orders').select('id, ordernummer').in('id', ids);
      for (const r of (data as { id: string; ordernummer: number | null }[]) ?? []) nummers.set(r.id, r.ordernummer);
    }
  }
  for (const r of rijen) {
    if (!r.token || !isEmail(r.email)) continue;
    const nummer = r.order_id ? nummers.get(r.order_id) ?? null : null;
    const res = await sendEmail({
      to: r.email,
      replyTo: site.email,
      subject: nummer ? `Hoe bevalt je bestelling #${nummer}?` : 'Hoe tevreden ben je over Frederiks?',
      html: npsMailHtml({ token: r.token, naam: r.naam, ordernummer: nummer, email: r.email }),
    }).catch(() => ({ sent: false }));
    if (res.sent) {
      rapport.verstuurd += 1;
      await sb.from('reviews').update({ verstuurd_op: new Date().toISOString() }).eq('id', r.id);
    } else rapport.mislukt += 1;
  }
  return rapport;
}

/* ------------------------------------------------------------------ */
/* Publieke kant: score en toelichting via het token                    */
/* ------------------------------------------------------------------ */

export async function getReviewOpToken(token: string): Promise<Review | null> {
  const sb = kmsAdmin();
  if (!sb || !TOKEN.test(String(token ?? ''))) return null;
  const { data } = await sb.from('reviews').select(KOLOMMEN).eq('token', token).maybeSingle();
  return (data as unknown as Review | null) ?? null;
}

/** Een lage score: klacht + taak voor Jessi, één keer per review. */
async function volgLageScoreOp(r: Review, score: number): Promise<void> {
  const sb = kmsAdmin();
  if (!sb || r.klacht_id || !r.klant_id) return;
  const { maakKlacht } = await import('@/lib/kms/service');
  const { maakTaak } = await import('@/lib/kms/taken');
  const { afspraakPersoon } = await import('@/lib/afspraken/beschikbaarheid');
  const { vandaagNl } = await import('@/app/dashboard/taken/tijd');
  const persoon = await afspraakPersoon().catch(() => null);

  let ordernummer: number | null = null;
  if (r.order_id) {
    const { data } = await sb.from('orders').select('ordernummer').eq('id', r.order_id).maybeSingle();
    ordernummer = (data as { ordernummer: number | null } | null)?.ordernummer ?? null;
  }
  const wie = [r.naam, r.bedrijf].filter(Boolean).join(', ') || r.email || 'Klant';
  const omschrijving = `${wie} gaf een ${score} uit 10 in de tevredenheidsmail${ordernummer ? ` over order #${ordernummer}` : ''}.${
    r.tekst ? `\n\nToelichting: ${r.tekst}` : '\n\nNog geen toelichting. Bel even om te horen wat er beter kan.'
  }`;
  const klachtId = await maakKlacht({
    organisatie_id: r.klant_id,
    order_id: r.order_id,
    soort: 'klacht',
    omschrijving,
    prioriteit: score <= 4 ? 'hoog' : 'normaal',
    toegewezen_aan: persoon?.id ?? null,
    contact_naam: r.naam,
    bron: 'nps',
  }).catch(() => null);
  const taak = await maakTaak({
    titel: `Bellen: ${r.bedrijf || r.naam || 'klant'} gaf een ${score}`,
    omschrijving: `${omschrijving}\n\nDe klacht staat onder Klachten en vragen.`,
    organisatie_id: r.klant_id,
    vervaldatum: vandaagNl(),
    prioriteit: 'hoog',
    persoon_id: persoon?.id ?? null,
  }).catch(() => ({ fout: 'mislukt' }));
  const taakId = 'id' in taak ? taak.id : null;
  await sb.from('reviews').update({ klacht_id: klachtId, taak_id: taakId }).eq('id', r.id);
}

/** Score opslaan (klik in de mail). Mag worden aangepast zolang de toelichting nog niet is verstuurd. */
export async function slaScoreOp(token: string, scoreIn: number): Promise<{ ok: boolean; review?: Review }> {
  const sb = kmsAdmin();
  const score = Math.round(Number(scoreIn));
  if (!sb || !Number.isInteger(score) || score < 0 || score > 10) return { ok: false };
  const r = await getReviewOpToken(token);
  if (!r) return { ok: false };
  if (r.score === score) return { ok: true, review: r };
  const { data, error } = await sb
    .from('reviews')
    .update({ score, beantwoord_op: new Date().toISOString() })
    .eq('id', r.id)
    .select(KOLOMMEN)
    .single();
  if (error || !data) return { ok: false };
  const nieuw = data as unknown as Review;
  if (score <= 6) await volgLageScoreOp(nieuw, score).catch(() => undefined);
  return { ok: true, review: nieuw };
}

export async function slaToelichtingOp(
  token: string,
  v: { tekst: string; toestemming: boolean; naam: string; bedrijf: string },
): Promise<boolean> {
  const sb = kmsAdmin();
  const r = await getReviewOpToken(token);
  if (!sb || !r || r.score === null) return false;
  const tekst = v.tekst.trim().slice(0, 2000) || null;
  const patch: Record<string, unknown> = {
    tekst,
    toestemming_publiceren: Boolean(v.toestemming && tekst),
    naam: v.naam.trim().slice(0, 120) || r.naam,
    bedrijf: v.bedrijf.trim().slice(0, 160) || r.bedrijf,
    beantwoord_op: new Date().toISOString(),
  };
  // Toestemming ingetrokken: dan ook meteen offline.
  if (!patch.toestemming_publiceren) {
    patch.gepubliceerd = false;
    patch.uitgelicht = false;
  }
  const { error } = await sb.from('reviews').update(patch).eq('id', r.id);
  if (error) return false;
  if (tekst && r.klacht_id) {
    const { voegKlachtBerichtToe } = await import('@/lib/kms/service');
    await voegKlachtBerichtToe(r.klacht_id, 'klant', `Toelichting bij score ${r.score}: ${tekst}`, r.naam).catch(() => null);
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* KMS                                                                  */
/* ------------------------------------------------------------------ */

export type ReviewFilter = 'beantwoord' | 'te-modereren' | 'gepubliceerd' | 'laag' | 'open';

export async function listReviews(filter: ReviewFilter = 'beantwoord'): Promise<Review[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  let q = sb.from('reviews').select(KOLOMMEN).limit(500);
  if (filter === 'open') q = q.is('score', null).order('created_at', { ascending: false });
  else {
    q = q.not('score', 'is', null);
    if (filter === 'te-modereren') q = q.eq('toestemming_publiceren', true).eq('gepubliceerd', false).not('tekst', 'is', null);
    if (filter === 'gepubliceerd') q = q.eq('gepubliceerd', true);
    if (filter === 'laag') q = q.lte('score', 6);
    q = q.order('beantwoord_op', { ascending: false, nullsFirst: false });
  }
  // KMS-lijst: een fout is geen lege lijst (anders lijkt het alsof er geen reviews zijn).
  const data = eisData('reviews.lijst', await q);
  return (data as unknown as Review[]) ?? [];
}

export async function zetReviewVlag(id: string, veld: 'gepubliceerd' | 'uitgelicht', aan: boolean): Promise<{ ok: boolean; fout?: string }> {
  const sb = kmsAdmin();
  if (!sb || !UUID.test(id)) return { ok: false, fout: 'Niet gevonden.' };
  const { data } = await sb.from('reviews').select('toestemming_publiceren, tekst, gepubliceerd').eq('id', id).maybeSingle();
  const r = data as { toestemming_publiceren: boolean; tekst: string | null; gepubliceerd: boolean } | null;
  if (!r) return { ok: false, fout: 'Niet gevonden.' };
  if (aan && (!r.toestemming_publiceren || !r.tekst)) return { ok: false, fout: 'Zonder toestemming van de klant en zonder tekst kan een review niet online.' };
  const patch: Record<string, unknown> = { [veld]: aan };
  if (veld === 'gepubliceerd') {
    patch.gepubliceerd_op = aan ? new Date().toISOString() : null;
    if (!aan) patch.uitgelicht = false;
  }
  if (veld === 'uitgelicht' && aan && !r.gepubliceerd) {
    patch.gepubliceerd = true;
    patch.gepubliceerd_op = new Date().toISOString();
  }
  const { error } = await sb.from('reviews').update(patch).eq('id', id);
  return error ? { ok: false, fout: 'Opslaan lukte niet.' } : { ok: true };
}

export type NpsStand = {
  aantal: number;
  promotors: number;
  passief: number;
  criticasters: number;
  /** -100 t/m 100; null zonder antwoorden. */
  nps: number | null;
  gemiddelde: number | null;
  verstuurd: number;
  /** Percentage verstuurde verzoeken dat een score opleverde. */
  respons: number | null;
};

export function berekenNps(scores: number[], verstuurd = 0): NpsStand {
  const aantal = scores.length;
  const promotors = scores.filter((s) => s >= 9).length;
  const criticasters = scores.filter((s) => s <= 6).length;
  return {
    aantal,
    promotors,
    passief: aantal - promotors - criticasters,
    criticasters,
    nps: aantal ? Math.round(((promotors - criticasters) / aantal) * 100) : null,
    gemiddelde: aantal ? Math.round((scores.reduce((a, b) => a + b, 0) / aantal) * 10) / 10 : null,
    verstuurd,
    respons: verstuurd ? Math.round((aantal / verstuurd) * 100) : null,
  };
}

/** NPS over een periode (op beantwoord_op), of over alles zonder grenzen. */
export async function npsStand(van?: string, tot?: string): Promise<NpsStand> {
  const sb = kmsAdmin();
  if (!sb) return berekenNps([]);
  let q = sb.from('reviews').select('score, verstuurd_op, beantwoord_op').limit(5000);
  if (van) q = q.gte('created_at', van);
  if (tot) q = q.lt('created_at', tot);
  const { data } = await q;
  const rijen = (data as { score: number | null; verstuurd_op: string | null }[]) ?? [];
  const scores = rijen.map((r) => r.score).filter((s): s is number => typeof s === 'number');
  return berekenNps(scores, rijen.filter((r) => r.verstuurd_op).length);
}
