import { randomBytes } from 'node:crypto';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { env } from '@/lib/env';
import { site } from '@/content/site';
import { emailKnop, emailLayout, escapeHtml, sendEmail } from '@/lib/email';
import { afmeldUrl } from '@/lib/kms/campagneAfmelden';
import { NPS_ORDERSTATUSSEN } from '@/lib/reviews/npsStatussen';
import { getReviewInstellingen } from '@/lib/reviews/reviews';
import { isoWeek, kiesKandidaten, type KandidaatOrder, type KandidaatReview, type KandidaatUitnodiging } from '@/lib/reviews/uitnodigingRegels';

/**
 * Google-reviewuitnodigingen die Jessi wekelijks accordeert.
 *
 * Elke maandag (via de dagelijkse cron) maakt het systeem een voorstellijst en
 * een taak "Review-uitnodigingen accorderen". In het KMS (Reviews > Uitnodigingen)
 * vinkt Jessi aan wie de mail krijgt. De knop in de mail loopt via /r/<token>,
 * zodat we zien wie erop klikte, en gaat dan door naar de Google-reviewlink.
 * Er gaat nooit iets automatisch de deur uit.
 */

export type Uitnodiging = {
  id: string;
  created_at: string;
  week: string;
  organisatie_id: string;
  order_id: string | null;
  email: string | null;
  naam: string | null;
  bedrijf: string | null;
  reden: string | null;
  bron: 'voorstel' | 'handmatig';
  status: 'voorgesteld' | 'verstuurd' | 'overgeslagen' | 'mislukt';
  token: string | null;
  beslist_op: string | null;
  verstuurd_op: string | null;
  geklikt_op: string | null;
  fout: string | null;
};

const KOLOMMEN = 'id, created_at, week, organisatie_id, order_id, email, naam, bedrijf, reden, bron, status, token, beslist_op, verstuurd_op, geklikt_op, fout';
const SLEUTEL_WEEK = 'review_uitnodigingen_laatste_week';
const TOKEN = /^[A-Za-z0-9_-]{20,80}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const DAG = 86_400_000;

const isEmail = (v: string | null | undefined): v is string => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** Wie van de klant krijgt de mail: de besteller van de order, anders het hoofdcontact, anders het algemene adres. */
async function ontvanger(orgId: string, orderId: string | null): Promise<{ email: string | null; naam: string | null; bedrijf: string | null }> {
  const sb = kmsAdmin();
  if (!sb) return { email: null, naam: null, bedrijf: null };
  const [{ data: org }, { data: contacten }, { data: order }] = await Promise.all([
    sb.from('organisaties').select('naam, email_algemeen, contactpersoon').eq('id', orgId).maybeSingle(),
    sb.from('contactpersonen').select('id, naam, email, hoofdcontact').eq('organisatie_id', orgId),
    orderId ? sb.from('orders').select('aangevraagd_door_contact_id').eq('id', orderId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const o = org as { naam: string | null; email_algemeen: string | null; contactpersoon: string | null } | null;
  const lijst = (contacten as { id: string; naam: string; email: string | null; hoofdcontact: boolean }[]) ?? [];
  const bestellerId = (order as { aangevraagd_door_contact_id: string | null } | null)?.aangevraagd_door_contact_id;
  const besteller = bestellerId ? lijst.find((c) => c.id === bestellerId && isEmail(c.email)) : undefined;
  const hoofd = lijst.find((c) => c.hoofdcontact && isEmail(c.email)) ?? lijst.find((c) => isEmail(c.email));
  const gekozen = besteller ?? hoofd;
  if (gekozen) return { email: gekozen.email!.trim().toLowerCase(), naam: gekozen.naam, bedrijf: o?.naam ?? null };
  if (isEmail(o?.email_algemeen)) return { email: o!.email_algemeen!.trim().toLowerCase(), naam: o?.contactpersoon ?? null, bedrijf: o?.naam ?? null };
  return { email: null, naam: null, bedrijf: o?.naam ?? null };
}

async function afgemeld(email: string): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return true;
  const { data } = await sb.from('afmeldingen').select('email').ilike('email', email.replace(/[\\%_]/g, (t) => `\\${t}`)).limit(1);
  return ((data as unknown[]) ?? []).length > 0;
}

export type VoorstelRapport = { week: string; voorgesteld: number; overgeslagen?: string };

/**
 * Wekelijkse voorstellijst. Draait dagelijks mee met de cron; de weekvlag zorgt
 * dat het maar één keer per week gebeurt, op de eerste cronrun van de week (maandag).
 */
export async function stelReviewUitnodigingenVoor(nu = new Date()): Promise<VoorstelRapport> {
  const week = isoWeek(nu);
  const sb = kmsAdmin();
  if (!sb) return { week, voorgesteld: 0, overgeslagen: 'geen database' };
  const { data: vlag } = await sb.from('instellingen').select('waarde').eq('sleutel', SLEUTEL_WEEK).maybeSingle();
  if ((vlag as { waarde: string | null } | null)?.waarde === week) return { week, voorgesteld: 0, overgeslagen: 'deze week al gedaan' };

  const van = new Date(nu.getTime() - 60 * DAG).toISOString();
  const [{ data: o }, { data: r }, { data: u }] = await Promise.all([
    sb.from('orders').select('id, organisatie_id, geleverd_op, ordernummer').in('status', [...NPS_ORDERSTATUSSEN]).gte('geleverd_op', van).limit(1000),
    sb.from('reviews').select('klant_id, score, beantwoord_op, created_at').gte('created_at', new Date(nu.getTime() - 180 * DAG).toISOString()).limit(2000),
    sb.from('review_uitnodigingen').select('organisatie_id, status, created_at, verstuurd_op').gte('created_at', new Date(nu.getTime() - 365 * DAG).toISOString()).limit(5000),
  ]);
  const voorstellen = kiesKandidaten(
    (o as KandidaatOrder[]) ?? [],
    (r as KandidaatReview[]) ?? [],
    (u as KandidaatUitnodiging[]) ?? [],
    nu,
  );

  let aantal = 0;
  for (const v of voorstellen) {
    const wie = await ontvanger(v.organisatie_id, v.order_id);
    if (!wie.email || (await afgemeld(wie.email))) continue;
    const { error } = await sb.from('review_uitnodigingen').insert({
      week,
      organisatie_id: v.organisatie_id,
      order_id: v.order_id,
      email: wie.email,
      naam: wie.naam,
      bedrijf: wie.bedrijf,
      reden: v.reden,
      bron: 'voorstel',
    });
    if (!error) aantal += 1;
  }

  await sb.from('instellingen').upsert({ sleutel: SLEUTEL_WEEK, waarde: week, bijgewerkt_op: new Date().toISOString() }, { onConflict: 'sleutel' });

  if (aantal > 0) {
    const { maakTaak } = await import('@/lib/kms/taken');
    const { afspraakPersoon } = await import('@/lib/afspraken/beschikbaarheid');
    const { vandaagNl } = await import('@/app/dashboard/taken/tijd');
    const persoon = await afspraakPersoon().catch(() => null);
    await maakTaak({
      titel: `Review-uitnodigingen accorderen (${aantal})`,
      omschrijving: `Deze week ${aantal === 1 ? 'is 1 klant' : `zijn ${aantal} klanten`} voorgesteld voor een Google-review. Vink aan wie de mail krijgt: /dashboard/reviews/uitnodigingen`,
      vervaldatum: vandaagNl(),
      persoon_id: persoon?.id ?? null,
      prioriteit: 'normaal',
    }).catch(() => null);
  }
  return { week, voorgesteld: aantal };
}

export async function listUitnodigingen(filter: 'open' | 'verstuurd' | 'overgeslagen' | 'alle' = 'open'): Promise<Uitnodiging[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  let q = sb.from('review_uitnodigingen').select(KOLOMMEN).order('created_at', { ascending: false }).limit(300);
  if (filter === 'open') q = q.in('status', ['voorgesteld', 'mislukt']);
  else if (filter !== 'alle') q = q.eq('status', filter);
  const { data } = await q;
  return (data as unknown as Uitnodiging[]) ?? [];
}

export async function uitnodigingCijfers(): Promise<{ open: number; verstuurd: number; geklikt: number }> {
  const sb = kmsAdmin();
  if (!sb) return { open: 0, verstuurd: 0, geklikt: 0 };
  const kop = { count: 'exact' as const, head: true };
  const [a, b, c] = await Promise.all([
    sb.from('review_uitnodigingen').select('id', kop).in('status', ['voorgesteld', 'mislukt']),
    sb.from('review_uitnodigingen').select('id', kop).eq('status', 'verstuurd'),
    sb.from('review_uitnodigingen').select('id', kop).not('geklikt_op', 'is', null),
  ]);
  return { open: a.count ?? 0, verstuurd: b.count ?? 0, geklikt: c.count ?? 0 };
}

function basis(): string {
  return env.siteUrl.replace(/\/$/, '');
}

export const klikUrl = (token: string) => `${basis()}/r/${encodeURIComponent(token)}`;

export function mailHtml(r: { token: string; naam: string | null; email: string }): string {
  const voornaam = (r.naam ?? '').trim().split(/\s+/)[0];
  return emailLayout({
    heading: 'Wil je iets over ons vertellen?',
    preheader: 'Twee minuten, en je helpt andere bedrijven in de Achterhoek kiezen.',
    bodyHtml: `
      <p style="margin:0;">${voornaam ? `Hoi ${escapeHtml(voornaam)},` : 'Hoi,'}</p>
      <p style="margin:14px 0 0;">Fijn dat we jullie bedrijfskleding mochten verzorgen. Andere ondernemers in de regio kiezen hun leverancier vaak op basis van reviews op Google. Zou je in een paar zinnen willen vertellen hoe het je beviel?</p>
      ${emailKnop('Schrijf een review op Google', klikUrl(r.token))}
      <p style="margin:22px 0 0;">Ging er iets niet goed? Laat het me dan liever direct weten, dan los ik het op.</p>
      <p style="margin:18px 0 0;">Dank je wel,<br/>Jessi Frederiks<br/>${escapeHtml(site.phone)}</p>
      <p style="margin:22px 0 0;font-size:12px;color:#8a8785;">Liever geen mails meer van ons? <a href="${escapeHtml(afmeldUrl(r.email))}" style="color:#8a8785;">Afmelden</a>.</p>
    `,
  });
}

export type VerstuurRapport = { verstuurd: number; mislukt: number; geenLink?: boolean };

/** Alleen wat Jessi heeft aangevinkt. Zonder Google-link wordt er niets verstuurd. */
export async function verstuurUitnodigingen(ids: string[]): Promise<VerstuurRapport> {
  const rapport: VerstuurRapport = { verstuurd: 0, mislukt: 0 };
  const sb = kmsAdmin();
  const geldig = ids.filter((i) => UUID.test(i)).slice(0, 50);
  if (!sb || !geldig.length) return rapport;
  const inst = await getReviewInstellingen();
  if (!/^https?:\/\//i.test(inst.googleLink)) return { ...rapport, geenLink: true };
  const { data } = await sb.from('review_uitnodigingen').select(KOLOMMEN).in('id', geldig).in('status', ['voorgesteld', 'mislukt']);
  for (const r of (data as unknown as Uitnodiging[]) ?? []) {
    if (!isEmail(r.email) || (await afgemeld(r.email))) {
      await sb.from('review_uitnodigingen').update({ status: 'overgeslagen', beslist_op: new Date().toISOString(), fout: 'geen geldig of afgemeld e-mailadres' }).eq('id', r.id);
      continue;
    }
    const token = r.token && TOKEN.test(r.token) ? r.token : randomBytes(24).toString('base64url');
    const res = await sendEmail({
      to: r.email,
      replyTo: site.email,
      subject: 'Wil je ons helpen met een korte review?',
      html: mailHtml({ token, naam: r.naam, email: r.email }),
    }).catch((e) => ({ sent: false, error: e instanceof Error ? e.message : 'onbekend' }));
    const nu = new Date().toISOString();
    if (res.sent) {
      rapport.verstuurd += 1;
      await sb.from('review_uitnodigingen').update({ status: 'verstuurd', token, beslist_op: nu, verstuurd_op: nu, fout: null }).eq('id', r.id);
    } else {
      rapport.mislukt += 1;
      await sb.from('review_uitnodigingen').update({ status: 'mislukt', token, beslist_op: nu, fout: ('error' in res && res.error ? String(res.error) : 'versturen mislukt').slice(0, 200) }).eq('id', r.id);
    }
  }
  return rapport;
}

export async function slaUitnodigingenOver(ids: string[]): Promise<number> {
  const sb = kmsAdmin();
  const geldig = ids.filter((i) => UUID.test(i)).slice(0, 100);
  if (!sb || !geldig.length) return 0;
  const { data } = await sb
    .from('review_uitnodigingen')
    .update({ status: 'overgeslagen', beslist_op: new Date().toISOString() })
    .in('id', geldig)
    .in('status', ['voorgesteld', 'mislukt'])
    .select('id');
  return ((data as unknown[]) ?? []).length;
}

/** Een klant zelf op de lijst zetten, bijvoorbeeld na een goed gesprek. */
export async function voegUitnodigingToe(orgId: string, nu = new Date()): Promise<{ ok: boolean; fout?: string }> {
  const sb = kmsAdmin();
  if (!sb || !UUID.test(orgId)) return { ok: false, fout: 'Onbekende klant.' };
  const { data: order } = await sb
    .from('orders')
    .select('id')
    .eq('organisatie_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const orderId = (order as { id: string } | null)?.id ?? null;
  const wie = await ontvanger(orgId, orderId);
  if (!wie.email) return { ok: false, fout: 'Deze klant heeft geen e-mailadres in het KMS.' };
  if (await afgemeld(wie.email)) return { ok: false, fout: 'Deze klant heeft zich afgemeld voor mail.' };
  const { error } = await sb.from('review_uitnodigingen').insert({
    week: isoWeek(nu),
    organisatie_id: orgId,
    order_id: orderId,
    email: wie.email,
    naam: wie.naam,
    bedrijf: wie.bedrijf,
    reden: 'Zelf toegevoegd',
    bron: 'handmatig',
  });
  if (error) return { ok: false, fout: error.code === '23505' ? 'Deze klant staat deze week al op de lijst.' : 'Opslaan mislukt.' };
  return { ok: true };
}

/** De klik in de mail: vastleggen en de Google-link teruggeven. */
export async function registreerKlik(token: string): Promise<string | null> {
  const sb = kmsAdmin();
  if (!sb || !TOKEN.test(String(token ?? ''))) return null;
  const { data } = await sb.from('review_uitnodigingen').select('id, geklikt_op').eq('token', token).maybeSingle();
  const rij = data as { id: string; geklikt_op: string | null } | null;
  if (!rij) return null;
  if (!rij.geklikt_op) await sb.from('review_uitnodigingen').update({ geklikt_op: new Date().toISOString() }).eq('id', rij.id);
  const inst = await getReviewInstellingen();
  return /^https?:\/\//i.test(inst.googleLink) ? inst.googleLink : null;
}
