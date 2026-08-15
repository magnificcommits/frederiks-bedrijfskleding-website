import { randomBytes } from 'node:crypto';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { sendEmail, emailLayout, escapeHtml } from '@/lib/email';
import { env } from '@/lib/env';
import { site } from '@/content/site';

/**
 * Retourportaal voor klanten zonder portaalaccount.
 *
 * De meeste mensen die iets terug willen sturen hebben nooit ingelogd: het is de
 * monteur die de broek kreeg, niet de kantoormanager met het account. Die moet
 * het zonder wachtwoord kunnen regelen, en wij moeten toch zeker weten dat hij
 * bij die bestelling hoort.
 *
 * Daarom ordernummer + e-mail, en dan een link per mail. Het e-mailadres is het
 * bewijs: we mailen de link alleen naar een adres dat al aan die bestelling hangt
 * (de besteller, de medewerker, de organisatie of een portaalgebruiker). De
 * publieke actie meldt altijd hetzelfde, ook als de combinatie niet klopt - anders
 * kun je met een ordernummer adressen zitten raden.
 */

export const RETOUR_REDENEN = [
  { code: 'maat-te-klein', label: 'Maat te klein' },
  { code: 'maat-te-groot', label: 'Maat te groot' },
  { code: 'zit-niet-lekker', label: 'Zit niet lekker' },
  { code: 'verkeerd-geleverd', label: 'Verkeerd artikel geleverd' },
  { code: 'beschadigd', label: 'Beschadigd of defect' },
  { code: 'logo-niet-goed', label: 'Logo niet goed aangebracht' },
  { code: 'te-veel-besteld', label: 'Te veel besteld' },
  { code: 'anders', label: 'Anders' },
] as const;

export const RETOUR_METHODES = [
  {
    code: 'ophalen',
    label: 'Wij halen het op',
    uitleg: 'We rijden toch door de Achterhoek. Je hoort van ons wanneer we langskomen.',
    kosten: 'Gratis in ons werkgebied',
  },
  {
    code: 'afgeven',
    label: 'Zelf afgeven in Hengelo Gld',
    uitleg: `${site.address.street}, ${site.address.postalCode} ${site.address.city}. Even bellen wanneer het uitkomt.`,
    kosten: 'Gratis',
  },
  {
    code: 'opsturen',
    label: 'Zelf opsturen',
    uitleg: 'Je krijgt het retouradres in de bevestiging. Stuur mee binnen 14 dagen na aanmelding.',
    kosten: 'Verzendkosten voor eigen rekening, behalve als het aan ons ligt',
  },
] as const;

export type RetourMethode = (typeof RETOUR_METHODES)[number]['code'];

const redenLabel = (code: string) => RETOUR_REDENEN.find((r) => r.code === code)?.label ?? code;
export const methodeVan = (code: string | null) => RETOUR_METHODES.find((m) => m.code === code) ?? null;

export type RetourRegelKeuze = { orderregel_id: string; aantal: number; reden: string };

export type RetourOrderRegel = {
  id: string;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  besteld: number;
  /** Al eerder in een retour opgevoerd; die kunnen niet nog een keer terug. */
  al_geretourneerd: number;
};

export type RetourSessie = {
  token: string;
  ordernummer: number | null;
  besteldatum: string | null;
  organisatie: string | null;
  email: string;
  regels: RetourOrderRegel[];
  /** Gevuld zodra de retour is aangemeld; dan is dit een statuspagina. */
  retour: {
    retournummer: string | null;
    status: string;
    methode: string | null;
    reden: string | null;
    retouradres: string | null;
    instructie: string | null;
    created_at: string;
    regels: { item_naam: string; aantal: number; maat?: string | null; kleur?: string | null; reden?: string | null }[];
  } | null;
};

const TOKEN_DAGEN = 14;

/** Leest de ingestelde retourtermijn in dagen. */
export async function retourtermijnDagen(): Promise<number> {
  const sb = kmsAdmin();
  if (!sb) return 30;
  const { data } = await sb.from('instellingen').select('waarde').eq('sleutel', 'retourtermijn_dagen').maybeSingle();
  const n = Number((data as { waarde?: string } | null)?.waarde);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

/**
 * Stap 1. Zoekt de bestelling en controleert of het opgegeven e-mailadres eraan
 * hangt. Zo ja: token wegschrijven en de link mailen. Het resultaat verraadt nooit
 * of de combinatie klopte.
 */
export async function startRetour(ordernummerRuw: string, emailRuw: string): Promise<void> {
  const sb = kmsAdmin();
  const nummer = Number(String(ordernummerRuw).replace(/\D/g, ''));
  const email = String(emailRuw).trim().toLowerCase();
  if (!sb || !Number.isFinite(nummer) || nummer <= 0 || !email.includes('@')) return;

  const { data: order } = await sb
    .from('orders')
    .select('id, ordernummer, besteldatum, organisatie_id, medewerker_id, aangevraagd_door')
    .eq('ordernummer', nummer)
    .maybeSingle();
  if (!order) return;
  const o = order as {
    id: string; ordernummer: number; besteldatum: string | null;
    organisatie_id: string | null; medewerker_id: string | null; aangevraagd_door: string | null;
  };

  // Binnen de termijn?
  const termijn = await retourtermijnDagen();
  if (o.besteldatum) {
    const dagen = (Date.now() - new Date(o.besteldatum).getTime()) / 86_400_000;
    if (dagen > termijn) return;
  }

  const adressen = new Set<string>();
  const voegToe = (v: unknown) => {
    const s = String(v ?? '').trim().toLowerCase();
    if (s.includes('@')) adressen.add(s);
  };
  voegToe(o.aangevraagd_door);
  if (o.medewerker_id) {
    const { data } = await sb.from('medewerkers').select('email').eq('id', o.medewerker_id).maybeSingle();
    voegToe((data as { email?: string } | null)?.email);
  }
  if (o.organisatie_id) {
    const { data: org } = await sb
      .from('organisaties').select('email_algemeen, factuur_email').eq('id', o.organisatie_id).maybeSingle();
    voegToe((org as { email_algemeen?: string } | null)?.email_algemeen);
    voegToe((org as { factuur_email?: string } | null)?.factuur_email);
    const { data: gebruikers } = await sb
      .from('portaal_gebruikers').select('email').eq('organisatie_id', o.organisatie_id);
    for (const g of (gebruikers as { email: string }[] | null) ?? []) voegToe(g.email);
  }
  if (!adressen.has(email)) return;

  const token = randomBytes(24).toString('base64url');
  const { error } = await sb.from('retour_tokens').insert({
    token,
    order_id: o.id,
    email,
    verloopt_op: new Date(Date.now() + TOKEN_DAGEN * 86_400_000).toISOString(),
  });
  if (error) return;

  const link = `${env.siteUrl.replace(/\/$/, '')}/retour/${token}`;
  await sendEmail({
    to: email,
    subject: `Retour aanmelden voor bestelling ${o.ordernummer}`,
    html: emailLayout({
      heading: 'Je retourlink staat klaar',
      preheader: `Bestelling ${o.ordernummer} · geldig tot ${TOKEN_DAGEN} dagen`,
      bodyHtml: `
        <p>Via onderstaande knop kies je welke artikelen uit bestelling <strong>${escapeHtml(o.ordernummer)}</strong> je wilt terugsturen en hoe je dat wilt doen.</p>
        <p style="margin:26px 0;"><a href="${link}" style="display:inline-block;background:#ec6726;color:#1c1c1c;font-weight:700;text-decoration:none;padding:14px 26px;border-radius:6px;">Retour aanmelden</a></p>
        <p style="font-size:13px;">De link is ${TOKEN_DAGEN} dagen geldig en hoort alleen bij deze bestelling. Heb je hem niet aangevraagd, dan hoef je niets te doen.</p>
        <p style="font-size:13px;">Liever even bellen? ${escapeHtml(site.phone)}.</p>`,
    }),
  });
}

/** Haalt de sessie op bij een token: de bestelling, de regels en - als hij al gemeld is - de retour. */
export async function getRetourSessie(token: string): Promise<RetourSessie | null> {
  const sb = kmsAdmin();
  if (!sb || !token) return null;

  const { data: t } = await sb
    .from('retour_tokens')
    .select('token, order_id, email, verloopt_op, gebruikt_op, retour_id')
    .eq('token', token)
    .maybeSingle();
  if (!t) return null;
  const tok = t as { token: string; order_id: string; email: string; verloopt_op: string; gebruikt_op: string | null; retour_id: string | null };
  if (!tok.gebruikt_op && new Date(tok.verloopt_op).getTime() < Date.now()) return null;

  const { data: order } = await sb
    .from('orders')
    .select('ordernummer, besteldatum, organisaties(naam)')
    .eq('id', tok.order_id)
    .maybeSingle();
  const o = order as { ordernummer: number | null; besteldatum: string | null; organisaties?: { naam: string } | null } | null;

  const { data: regels } = await sb
    .from('orderregels')
    .select('id, item_naam, maat, kleur, aantal')
    .eq('order_id', tok.order_id)
    .order('item_naam');

  // Wat al eerder is aangemeld telt niet nog een keer mee.
  const { data: eerder } = await sb.from('retouren').select('regels').eq('order_id', tok.order_id);
  const alTerug = new Map<string, number>();
  for (const r of (eerder as { regels: unknown }[] | null) ?? []) {
    for (const rg of Array.isArray(r.regels) ? (r.regels as { orderregel_id?: string; aantal?: number }[]) : []) {
      if (!rg?.orderregel_id) continue;
      alTerug.set(rg.orderregel_id, (alTerug.get(rg.orderregel_id) ?? 0) + (Number(rg.aantal) || 0));
    }
  }

  let retour: RetourSessie['retour'] = null;
  if (tok.retour_id) {
    const { data } = await sb
      .from('retouren')
      .select('retournummer, status, methode, reden, retouradres, instructie, created_at, regels')
      .eq('id', tok.retour_id)
      .maybeSingle();
    if (data) {
      const r = data as Record<string, unknown>;
      retour = {
        retournummer: (r.retournummer as string) ?? null,
        status: (r.status as string) ?? 'aangemeld',
        methode: (r.methode as string) ?? null,
        reden: (r.reden as string) ?? null,
        retouradres: (r.retouradres as string) ?? null,
        instructie: (r.instructie as string) ?? null,
        created_at: (r.created_at as string) ?? new Date().toISOString(),
        regels: Array.isArray(r.regels) ? (r.regels as RetourSessie['retour'] extends null ? never : NonNullable<RetourSessie['retour']>['regels']) : [],
      };
    }
  }

  return {
    token: tok.token,
    ordernummer: o?.ordernummer ?? null,
    besteldatum: o?.besteldatum ?? null,
    organisatie: o?.organisaties?.naam ?? null,
    email: tok.email,
    regels: ((regels as { id: string; item_naam: string; maat: string | null; kleur: string | null; aantal: number }[] | null) ?? []).map((r) => ({
      id: r.id,
      item_naam: r.item_naam,
      maat: r.maat,
      kleur: r.kleur,
      besteld: r.aantal,
      al_geretourneerd: alTerug.get(r.id) ?? 0,
    })),
    retour,
  };
}

/** Stap 3. Schrijft de retour weg, markeert het token als gebruikt en mailt beide kanten. */
export async function verwerkRetour(
  token: string,
  keuzes: RetourRegelKeuze[],
  methode: string,
  opmerking: string,
): Promise<{ ok: boolean; retournummer?: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false };
  const sessie = await getRetourSessie(token);
  if (!sessie || sessie.retour) return { ok: false };

  const perRegel = new Map(sessie.regels.map((r) => [r.id, r]));
  type Opgeslagen = { orderregel_id: string; item_naam: string; maat: string | null; kleur: string | null; aantal: number; reden: string };
  const geldig: Opgeslagen[] = keuzes
    .map((k): Opgeslagen | null => {
      const bron = perRegel.get(k.orderregel_id);
      if (!bron) return null;
      const max = Math.max(0, bron.besteld - bron.al_geretourneerd);
      const aantal = Math.min(Math.max(1, Math.floor(k.aantal)), max);
      if (aantal < 1) return null;
      return {
        orderregel_id: bron.id,
        item_naam: bron.item_naam,
        maat: bron.maat,
        kleur: bron.kleur,
        aantal,
        reden: redenLabel(k.reden),
      };
    })
    .filter((r): r is Opgeslagen => r !== null);
  if (!geldig.length) return { ok: false };

  const gekozenMethode = methodeVan(methode) ?? RETOUR_METHODES[0];
  const { data: nummerRij } = await sb.rpc('volgend_retournummer');
  const retournummer = typeof nummerRij === 'string' ? nummerRij : null;

  const { data: tokenRij } = await sb.from('retour_tokens').select('order_id').eq('token', token).maybeSingle();
  const orderId = (tokenRij as { order_id: string } | null)?.order_id;
  if (!orderId) return { ok: false };
  const { data: orderRij } = await sb.from('orders').select('organisatie_id, medewerker_id').eq('id', orderId).maybeSingle();

  const samenvatting = [
    `Voorkeur: ${gekozenMethode.label}.`,
    opmerking.trim() ? `Toelichting: ${opmerking.trim()}` : '',
  ].filter(Boolean).join(' ');

  const { data: nieuw, error } = await sb
    .from('retouren')
    .insert({
      organisatie_id: (orderRij as { organisatie_id: string | null } | null)?.organisatie_id ?? null,
      medewerker_id: (orderRij as { medewerker_id: string | null } | null)?.medewerker_id ?? null,
      order_id: orderId,
      reden: samenvatting,
      status: 'aangemeld',
      regels: geldig,
      retournummer,
      methode: gekozenMethode.code,
      retouradres:
        gekozenMethode.code === 'opsturen'
          ? `${site.name}, ${site.address.street}, ${site.address.postalCode} ${site.address.city}`
          : null,
      contact_email: sessie.email,
      bron: 'retourportaal',
    })
    .select('id')
    .maybeSingle();
  if (error || !nieuw) return { ok: false };

  await sb
    .from('retour_tokens')
    .update({ gebruikt_op: new Date().toISOString(), retour_id: (nieuw as { id: string }).id })
    .eq('token', token);

  const regelHtml = geldig
    .map((r) => `<li>${escapeHtml(r.aantal)}× ${escapeHtml(r.item_naam)}${r.maat || r.kleur ? ` (${escapeHtml([r.maat, r.kleur].filter(Boolean).join(' / '))})` : ''} — ${escapeHtml(r.reden)}</li>`)
    .join('');
  const volgLink = `${env.siteUrl.replace(/\/$/, '')}/retour/${token}`;

  await sendEmail({
    to: sessie.email,
    subject: `Retour ${retournummer ?? ''} aangemeld`,
    html: emailLayout({
      heading: 'We hebben je retour binnen',
      preheader: `Retournummer ${retournummer ?? ''}`,
      bodyHtml: `
        <p>Retournummer <strong>${escapeHtml(retournummer ?? '-')}</strong>, bij bestelling ${escapeHtml(sessie.ordernummer ?? '-')}.</p>
        <ul>${regelHtml}</ul>
        <p><strong>${escapeHtml(gekozenMethode.label)}</strong><br/>${escapeHtml(gekozenMethode.uitleg)}</p>
        <p>We kijken ernaar en laten binnen één werkdag weten hoe we het oppakken. De status volg je hier:</p>
        <p style="margin:22px 0;"><a href="${volgLink}" style="display:inline-block;background:#ec6726;color:#1c1c1c;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:6px;">Status bekijken</a></p>`,
    }),
  });

  if (env.notifyEmail) {
    await sendEmail({
      to: env.notifyEmail,
      replyTo: sessie.email,
      subject: `Nieuwe retour ${retournummer ?? ''} · order ${sessie.ordernummer ?? '-'}`,
      html: emailLayout({
        heading: `Retour ${retournummer ?? ''}`,
        bodyHtml: `
          <p><strong>${escapeHtml(sessie.organisatie ?? 'Onbekende organisatie')}</strong> · order ${escapeHtml(sessie.ordernummer ?? '-')} · ${escapeHtml(sessie.email)}</p>
          <ul>${regelHtml}</ul>
          <p>${escapeHtml(samenvatting)}</p>
          <p>Afhandelen in het dashboard onder Retouren.</p>`,
      }),
    });
  }

  return { ok: true, retournummer: retournummer ?? undefined };
}
