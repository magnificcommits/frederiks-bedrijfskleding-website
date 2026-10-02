/**
 * Zet een nieuwsbrief-ontwerp om in een complete, e-mailbestendige HTML-pagina.
 *
 * PUUR: geen server-imports. De editor gebruikt dezelfde functie voor de
 * live-preview, de verzendmotor voor elke ontvanger, de webversie voor de
 * browser. Wat je in de editor ziet is dus precies wat er de deur uit gaat.
 *
 * Mailprogramma-regels die hier bewust gevolgd worden:
 *  - alleen tabellen voor de opmaak (geen flex/grid), alles inline gestyled;
 *  - een vaste maximale breedte met een "spooktabel" voor Outlook op Windows;
 *  - kolommen stapelen en elementen verbergen via een media query in <style>
 *    (wie die niet ondersteunt krijgt gewoon de desktopweergave);
 *  - afbeeldingen met een width-attribuut en display:block;
 *  - alle tekst-HTML door de allowlist-sanitizer, alle overige waarden ge-escaped.
 */
import { escapeHtml, sanitizeHtml, veiligeHref, veiligeKleur } from './sanitize';
import { normaliseerOntwerp } from './valideer';
import {
  LETTERTYPEN,
  SOCIAL_KANALEN,
  defaultBlok,
  type AfbeeldingBlok,
  type AfmeldBlok,
  type Blok,
  type BlokStijl,
  type Instellingen,
  type KnopBlok,
  type KopBlok,
  type Ontwerp,
  type ProductBlok,
  type ScheidingBlok,
  type Sectie,
  type SocialBlok,
  type SocialKanaal,
  type TekstBlok,
  type Uitlijning,
  type Verbergen,
  type WebversieBlok,
} from './types';

export type RenderModus = 'email' | 'web' | 'voorbeeld';

export type Ontvanger = { naam?: string | null; email?: string | null; bedrijf?: string | null };

export type RenderOpties = {
  onderwerp: string;
  preheader?: string | null;
  /**
   * email     : voor verzending, met persoonlijke merge-tags en afmeldlink.
   * web       : webversie in de browser, zonder persoonsgegevens.
   * voorbeeld : editor-preview; lege blokken krijgen een zichtbare plaatshouder.
   */
  modus: RenderModus;
  ontvanger?: Ontvanger | null;
  /** Persoonlijke afmeldlink. Verplicht in email-modus. */
  afmeldUrl?: string | null;
  /** Link naar de webversie. Verplicht in email-modus. */
  webUrl?: string | null;
  /** Basis-url van de site, om paden als /merken/x.jpg absoluut te maken. */
  siteUrl: string;
};

/* ------------------------------------------------------------------ */
/* Merge-tags                                                          */
/* ------------------------------------------------------------------ */

export type MergeWaarden = { naam: string; voornaam: string; bedrijf: string; email: string };

/**
 * Waarden voor de merge-tags, met nette terugval als iets ontbreekt. Zonder
 * naam wordt het "Beste relatie" in plaats van een losse "Beste ".
 */
export function mergeWaarden(ontvanger?: Ontvanger | null): MergeWaarden {
  const naam = (ontvanger?.naam ?? '').trim();
  const bedrijf = (ontvanger?.bedrijf ?? '').trim();
  return {
    naam: naam || 'relatie',
    voornaam: naam ? naam.split(/\s+/)[0] : 'relatie',
    bedrijf: bedrijf || 'uw bedrijf',
    email: (ontvanger?.email ?? '').trim(),
  };
}

const MERGE_RE = /\{\{\s*(naam|voornaam|bedrijf|email)\s*\}\}|%(FULLNAME|FIRSTNAME|EMAIL|COMPANY)%/gi;
const ALIAS: Record<string, keyof MergeWaarden> = { fullname: 'naam', firstname: 'voornaam', email: 'email', company: 'bedrijf' };

/** Vervang merge-tags. Met escape=true (standaard) voor gebruik in HTML. */
export function vulMergeTags(tekst: string, ontvanger?: Ontvanger | null, escape = true): string {
  const w = mergeWaarden(ontvanger);
  return String(tekst ?? '').replace(MERGE_RE, (_, tag?: string, alias?: string) => {
    const sleutel = tag ? (tag.toLowerCase() as keyof MergeWaarden) : ALIAS[(alias ?? '').toLowerCase()];
    const waarde = sleutel ? w[sleutel] : '';
    return escape ? escapeHtml(waarde) : waarde;
  });
}

/* ------------------------------------------------------------------ */
/* Kleine helpers                                                      */
/* ------------------------------------------------------------------ */

const e = escapeHtml;

function px(n: number): string {
  return `${Math.round(n)}px`;
}

function pad(p: { boven: number; rechts: number; onder: number; links: number }): string {
  return `${px(p.boven)} ${px(p.rechts)} ${px(p.onder)} ${px(p.links)}`;
}

const ALIGN: Record<Uitlijning, 'left' | 'center' | 'right'> = { links: 'left', midden: 'center', rechts: 'right' };

/** Maak een pad onder /public absoluut; alleen http(s) toegestaan. */
function absUrl(src: string, siteUrl: string): string {
  const s = (src ?? '').trim();
  if (!s) return '';
  if (s.startsWith('/') && !s.startsWith('//')) return `${siteUrl.replace(/\/$/, '')}${s}`;
  if (/^https?:\/\//i.test(s)) return s;
  return '';
}

/** Link voor een href: pad op de site, http(s) of mailto. Leeg als ongeldig. */
function link(href: string, siteUrl: string): string {
  const s = (href ?? '').trim();
  if (!s) return '';
  if (s.startsWith('/') && !s.startsWith('//')) return `${siteUrl.replace(/\/$/, '')}${s}`;
  if (/^www\./i.test(s)) return `https://${s}`;
  return veiligeHref(s) ?? '';
}

function verbergKlasse(v: Verbergen): string {
  if (v === 'mobiel') return 'nb-verberg-mobiel';
  if (v === 'desktop') return 'nb-verberg-desktop';
  return '';
}

/** Omhul met een div die op desktop of mobiel verbergt. */
function verbergWrap(html: string, v: Verbergen): string {
  if (!html || v === 'geen') return html;
  if (v === 'mobiel') return `<div class="nb-verberg-mobiel">${html}</div>`;
  // Op desktop verborgen: standaard dicht, de media query zet hem op mobiel open.
  return `<!--[if !mso]><!--><div class="nb-verberg-desktop" style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${html}</div><!--<![endif]-->`;
}

function plaatshouder(tekst: string, hoogte = 120): string {
  return `<div style="border:2px dashed #d6d3d0;background-color:#faf9f8;color:#8a8784;font-size:13px;line-height:1.4;text-align:center;padding:${Math.max(16, Math.round((hoogte - 20) / 2))}px 12px;font-family:Arial,Helvetica,sans-serif;">${e(tekst)}</div>`;
}

type Ctx = {
  opties: RenderOpties;
  inst: Instellingen;
  font: string;
  siteUrl: string;
};

/* ------------------------------------------------------------------ */
/* Blokken                                                             */
/* ------------------------------------------------------------------ */

/** De cel om elk blok heen: padding, achtergrond, tekststijl en uitlijning. */
function blokCel(inhoud: string, stijl: BlokStijl, ctx: Ctx, over: { tekstkleur?: string; achtergrond?: string } = {}): string {
  const kleur = over.tekstkleur ?? (stijl.tekstkleur || ctx.inst.tekstkleur);
  const bg = over.achtergrond ?? stijl.achtergrond;
  const align = ALIGN[stijl.uitlijning];
  const css = [
    `padding:${pad(stijl.padding)}`,
    bg ? `background-color:${bg}` : '',
    `color:${kleur}`,
    `font-family:${ctx.font}`,
    `font-size:${px(stijl.lettergrootte)}`,
    `line-height:${stijl.regelafstand}`,
    `text-align:${align}`,
    'mso-line-height-rule:exactly',
  ]
    .filter(Boolean)
    .join(';');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr><td align="${align}"${bg ? ` bgcolor="${bg}"` : ''} style="${e(css)}">${inhoud}</td></tr></table>`;
}

function renderTekst(b: TekstBlok, ctx: Ctx): string {
  const fs = b.stijl.lettergrootte;
  const kop = ctx.inst.kopkleur;
  const html = sanitizeHtml(b.html, {
    inlineStijl: {
      p: `margin:0 0 ${Math.round(fs * 0.8)}px;`,
      a: `color:${ctx.inst.linkkleur};text-decoration:underline;`,
      h1: `margin:0 0 10px;font-size:${Math.round(fs * 1.8)}px;line-height:1.25;color:${kop};font-weight:700;`,
      h2: `margin:0 0 8px;font-size:${Math.round(fs * 1.45)}px;line-height:1.3;color:${kop};font-weight:700;`,
      h3: `margin:0 0 6px;font-size:${Math.round(fs * 1.2)}px;line-height:1.3;color:${kop};font-weight:700;`,
      ul: `margin:0 0 ${Math.round(fs * 0.8)}px;padding:0 0 0 22px;`,
      ol: `margin:0 0 ${Math.round(fs * 0.8)}px;padding:0 0 0 22px;`,
      li: 'margin:0 0 4px;',
    },
  });
  // De laatste alinea of lijst heeft geen marge onder nodig: die ruimte zit al
  // in de padding van het blok. We halen dus alleen de LAATSTE marge weg.
  const token = `margin:0 0 ${Math.round(fs * 0.8)}px;`;
  const laatste = html.lastIndexOf(token);
  const zonderStaart = laatste === -1 ? html : `${html.slice(0, laatste)}margin:0;${html.slice(laatste + token.length)}`;
  if (!zonderStaart.trim()) return ctx.opties.modus === 'voorbeeld' ? blokCel(plaatshouder('Leeg tekstblok', 40), b.stijl, ctx) : '';
  return blokCel(zonderStaart, b.stijl, ctx);
}

function renderKop(b: KopBlok, ctx: Ctx): string {
  const tekst = b.tekst.trim();
  if (!tekst) return ctx.opties.modus === 'voorbeeld' ? blokCel(plaatshouder('Lege kop', 30), b.stijl, ctx) : '';
  const bg = b.stijl.achtergrond || (b.balk ? '#1c1c1c' : '');
  const kleur = b.stijl.tekstkleur || (b.balk ? '#ffffff' : ctx.inst.kopkleur);
  const css = [
    'margin:0',
    `font-family:${ctx.font}`,
    `font-size:${px(b.stijl.lettergrootte)}`,
    `line-height:${b.stijl.regelafstand}`,
    `font-weight:${b.vet === false ? 400 : 700}`,
    `color:${kleur}`,
    b.letterafstand ? `letter-spacing:${b.letterafstand}em` : '',
    'mso-line-height-rule:exactly',
  ]
    .filter(Boolean)
    .join(';');
  const h = `h${b.niveau}`;
  return blokCel(`<${h} style="${e(css)}">${e(tekst)}</${h}>`, b.stijl, ctx, { tekstkleur: kleur, achtergrond: bg });
}

function renderAfbeelding(b: AfbeeldingBlok, ctx: Ctx, beschikbaar: number): string {
  const src = absUrl(b.src, ctx.siteUrl);
  const ruimte = Math.max(20, beschikbaar - b.stijl.padding.links - b.stijl.padding.rechts);
  if (!src) {
    return ctx.opties.modus === 'voorbeeld' ? blokCel(plaatshouder('Kies een afbeelding', 160), b.stijl, ctx) : '';
  }
  const vol = b.breedte === 'vol';
  const w = vol ? ruimte : Math.min(ruimte, b.breedte as number);
  const marge = b.stijl.uitlijning === 'midden' ? 'margin:0 auto;' : b.stijl.uitlijning === 'rechts' ? 'margin:0 0 0 auto;' : '';
  const css = `display:block;${marge}width:${vol ? '100%' : px(w)};max-width:${px(w)};height:auto;border:0;outline:none;text-decoration:none;${
    b.radius ? `border-radius:${px(b.radius)};` : ''
  }`;
  let img = `<img class="nb-img" src="${e(src)}" width="${Math.round(w)}" alt="${e(b.alt)}" style="${e(css)}">`;
  const href = link(b.link, ctx.siteUrl);
  if (href) img = `<a href="${e(href)}" target="_blank" style="text-decoration:none;">${img}</a>`;
  return blokCel(img, b.stijl, ctx);
}

function renderKnop(b: KnopBlok, ctx: Ctx): string {
  const href = link(b.link, ctx.siteUrl) || (ctx.opties.modus === 'voorbeeld' ? '#' : '');
  const tekst = b.tekst.trim() || 'Knop';
  const align = ALIGN[b.stijl.uitlijning];
  const vol = b.volleBreedte;
  const aCss = [
    `display:${vol ? 'block' : 'inline-block'}`,
    'padding:13px 28px',
    `font-family:${ctx.font}`,
    `font-size:${px(b.stijl.lettergrootte)}`,
    'font-weight:700',
    'line-height:1.2',
    `color:${b.tekstkleur}`,
    'text-decoration:none',
    'text-align:center',
    b.radius ? `border-radius:${px(b.radius)}` : '',
    'mso-padding-alt:0',
  ]
    .filter(Boolean)
    .join(';');
  const label = `<!--[if mso]><i style="mso-font-width:200%;mso-text-raise:20pt">&#8202;</i><![endif]--><span style="mso-text-raise:10pt;">${e(tekst)}</span><!--[if mso]><i style="mso-font-width:200%;">&#8202;</i><![endif]-->`;
  const a = href
    ? `<a href="${e(href)}" target="_blank" class="${vol ? 'nb-knop-vol' : ''}" style="${e(aCss)}">${label}</a>`
    : `<span style="${e(aCss)}">${label}</span>`;
  const tabelMarge = align === 'center' ? 'margin:0 auto;' : align === 'right' ? 'margin:0 0 0 auto;' : '';
  const knop = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align}" style="${tabelMarge}${vol ? 'width:100%;' : ''}border-collapse:separate;"><tr><td align="center" bgcolor="${b.achtergrond}" style="background-color:${b.achtergrond};${
    b.radius ? `border-radius:${px(b.radius)};` : ''
  }">${a}</td></tr></table>`;
  return blokCel(knop, b.stijl, ctx);
}

function renderScheiding(b: ScheidingBlok, ctx: Ctx): string {
  const align = ALIGN[b.stijl.uitlijning];
  const lijn = `<table role="presentation" width="${b.breedte}%" cellpadding="0" cellspacing="0" border="0" align="${align}" style="width:${b.breedte}%;${
    align === 'center' ? 'margin:0 auto;' : align === 'right' ? 'margin:0 0 0 auto;' : ''
  }border-collapse:collapse;"><tr><td style="border-top:${px(b.dikte)} ${b.lijnstijl ?? 'solid'} ${b.kleur};font-size:0;line-height:0;height:0;">&nbsp;</td></tr></table>`;
  return blokCel(lijn, { ...b.stijl, lettergrootte: 1, regelafstand: 1 }, ctx);
}

function renderRuimte(b: { hoogte: number; stijl: BlokStijl }, ctx: Ctx): string {
  const h = Math.max(0, b.hoogte);
  if (!h) return '';
  const div = `<div style="height:${px(h)};line-height:${px(h)};font-size:1px;mso-line-height-rule:exactly;">&nbsp;</div>`;
  return blokCel(div, { ...b.stijl, lettergrootte: 1, regelafstand: 1 }, ctx);
}

const SOCIAL_NAAM: Record<SocialKanaal, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
};

function socialHref(kanaal: SocialKanaal, ruw: string, siteUrl: string): string {
  const v = ruw.trim();
  if (!v) return '';
  if (kanaal === 'email') {
    if (/^mailto:/i.test(v)) return veiligeHref(v) ?? '';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  }
  if (kanaal === 'whatsapp') {
    const cijfers = v.replace(/[^\d+]/g, '');
    if (!/^https?:/i.test(v) && cijfers.replace(/\D/g, '').length >= 9) {
      let n = cijfers.replace(/^\+/, '');
      if (n.startsWith('06')) n = `31${n.slice(1)}`;
      else if (n.startsWith('0')) n = `31${n.slice(1)}`;
      return `https://wa.me/${n}`;
    }
  }
  return link(v, siteUrl);
}

function renderSocial(b: SocialBlok, ctx: Ctx): string {
  const kleur = (veiligeKleur(b.iconKleur) ?? '#1c1c1c').replace('#', '');
  const g = b.grootte;
  const iconen = SOCIAL_KANALEN.map((k) => {
    const href = socialHref(k, b.links[k] ?? '', ctx.siteUrl);
    if (!href) return '';
    const src = `${ctx.siteUrl.replace(/\/$/, '')}/nieuwsbrief/icoon/${k}?kleur=${encodeURIComponent(kleur)}`;
    return `<td style="padding:0 6px;"><a href="${e(href)}" target="_blank" style="text-decoration:none;"><img src="${e(src)}" width="${g}" height="${g}" alt="${e(SOCIAL_NAAM[k])}" style="display:block;width:${px(g)};height:${px(g)};border:0;"></a></td>`;
  }).join('');
  if (!iconen) {
    return ctx.opties.modus === 'voorbeeld' ? blokCel(plaatshouder('Vul de links naar je social media in', 30), b.stijl, ctx) : '';
  }
  const align = ALIGN[b.stijl.uitlijning];
  const tabel = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align}" style="${
    align === 'center' ? 'margin:0 auto;' : align === 'right' ? 'margin:0 0 0 auto;' : ''
  }"><tr>${iconen}</tr></table>`;
  return blokCel(tabel, b.stijl, ctx);
}

const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n);

function renderProduct(b: ProductBlok, ctx: Ctx, beschikbaar: number): string {
  if (!b.naam.trim() && !b.foto) {
    return ctx.opties.modus === 'voorbeeld' ? blokCel(plaatshouder('Kies een product', 180), b.stijl, ctx) : '';
  }
  const ruimte = Math.max(40, beschikbaar - b.stijl.padding.links - b.stijl.padding.rechts);
  const href = link(b.link, ctx.siteUrl);
  const delen: string[] = [];
  const foto = absUrl(b.foto, ctx.siteUrl);
  const marge = b.stijl.uitlijning === 'midden' ? 'margin:0 auto;' : b.stijl.uitlijning === 'rechts' ? 'margin:0 0 0 auto;' : '';
  if (foto) {
    const img = `<img class="nb-img" src="${e(foto)}" width="${Math.round(ruimte)}" alt="${e(b.naam)}" style="display:block;${marge}width:100%;max-width:${px(ruimte)};height:auto;border:0;">`;
    delen.push(href ? `<a href="${e(href)}" target="_blank" style="text-decoration:none;">${img}</a>` : img);
  } else if (ctx.opties.modus === 'voorbeeld') {
    delen.push(plaatshouder('Geen foto', 120));
  }
  const kleur = b.stijl.tekstkleur || ctx.inst.kopkleur;
  if (b.naam.trim()) {
    const naam = e(b.naam.trim());
    delen.push(
      `<p style="margin:10px 0 0;font-weight:700;color:${kleur};">${
        href ? `<a href="${e(href)}" target="_blank" style="color:${kleur};text-decoration:none;">${naam}</a>` : naam
      }</p>`,
    );
  }
  if (b.merk.trim()) delen.push(`<p style="margin:2px 0 0;font-size:${px(Math.max(10, b.stijl.lettergrootte - 2))};color:#8a8784;">${e(b.merk.trim())}</p>`);
  if (b.toonPrijs && b.prijs !== null && b.prijs > 0) {
    delen.push(`<p style="margin:4px 0 0;font-weight:700;color:${kleur};">${e(euro(b.prijs))} <span style="font-weight:400;color:#8a8784;font-size:${px(Math.max(10, b.stijl.lettergrootte - 3))};">excl. btw</span></p>`);
  }
  if (href && b.knopTekst.trim()) {
    delen.push(`<p style="margin:6px 0 0;"><a href="${e(href)}" target="_blank" style="color:${ctx.inst.linkkleur};text-decoration:underline;font-weight:700;">${e(b.knopTekst.trim())}</a></p>`);
  }
  return blokCel(delen.join(''), b.stijl, ctx);
}

function renderWebversie(b: WebversieBlok, ctx: Ctx): string {
  if (ctx.opties.modus === 'web') return '';
  const href = ctx.opties.webUrl || '#';
  const kleur = b.stijl.tekstkleur || ctx.inst.tekstkleur;
  return blokCel(`<a href="${e(href)}" target="_blank" style="color:${kleur};text-decoration:underline;">${e(b.tekst)}</a>`, b.stijl, ctx);
}

function renderAfmelden(b: AfmeldBlok, ctx: Ctx): string {
  const kleur = b.stijl.tekstkleur || ctx.inst.tekstkleur;
  const tekst = b.tekst.trim() ? `${e(b.tekst.trim())} ` : '';
  if (ctx.opties.modus === 'web') {
    return blokCel(`${tekst}Afmelden kan via de link onderaan de e-mail die je van ons kreeg.`, b.stijl, ctx);
  }
  const href = ctx.opties.afmeldUrl || '#';
  return blokCel(`${tekst}<a href="${e(href)}" target="_blank" style="color:${kleur};text-decoration:underline;">${e(b.linkTekst)}</a>`, b.stijl, ctx);
}

function renderBlok(b: Blok, ctx: Ctx, beschikbaar: number): string {
  let html = '';
  switch (b.type) {
    case 'tekst':
      html = renderTekst(b, ctx);
      break;
    case 'kop':
      html = renderKop(b, ctx);
      break;
    case 'afbeelding':
      html = renderAfbeelding(b, ctx, beschikbaar);
      break;
    case 'knop':
      html = renderKnop(b, ctx);
      break;
    case 'scheiding':
      html = renderScheiding(b, ctx);
      break;
    case 'ruimte':
      html = renderRuimte(b, ctx);
      break;
    case 'social':
      html = renderSocial(b, ctx);
      break;
    case 'product':
      html = renderProduct(b, ctx, beschikbaar);
      break;
    case 'webversie':
      html = renderWebversie(b, ctx);
      break;
    case 'afmelden':
      html = renderAfmelden(b, ctx);
      break;
  }
  return verbergWrap(html, b.stijl.verbergen);
}

/* ------------------------------------------------------------------ */
/* Secties                                                             */
/* ------------------------------------------------------------------ */

function renderSectie(s: Sectie, ctx: Ctx): string {
  const W = ctx.inst.breedte;
  const st = s.stijl;
  const rand = st.rand && st.rand.breedte > 0 ? st.rand : null;
  const binnen = Math.max(100, W - st.padding.links - st.padding.rechts - (rand ? rand.breedte * 2 : 0));
  const som = s.verhouding.reduce((a, b) => a + b, 0) || 100;
  const meer = s.kolommen.length > 1;

  const kolommen = s.kolommen
    .map((k, i) => {
      const pct = ((s.verhouding[i] ?? 100 / s.kolommen.length) / som) * 100;
      const kolPx = Math.floor((binnen * pct) / 100);
      let inhoud = k.blokken.map((b) => renderBlok(b, ctx, kolPx)).join('');
      if (!inhoud && ctx.opties.modus === 'voorbeeld') inhoud = `<div style="padding:10px;">${plaatshouder('Lege kolom', 60)}</div>`;
      return `<td class="nb-kol" width="${kolPx}" valign="top" style="width:${pct.toFixed(2)}%;vertical-align:top;">${inhoud}</td>`;
    })
    .join('');

  const binnenCss = [
    'width:100%',
    'border-collapse:separate',
    st.inhoudAchtergrond ? `background-color:${st.inhoudAchtergrond}` : '',
    rand ? `border:${px(rand.breedte)} ${rand.stijl} ${rand.kleur}` : '',
    st.radius ? `border-radius:${px(st.radius)}` : '',
  ]
    .filter(Boolean)
    .join(';');

  const bgAfb = st.achtergrondAfbeelding ? absUrl(st.achtergrondAfbeelding, ctx.siteUrl) : '';
  const buitenCss = [
    'width:100%',
    'border-collapse:collapse',
    st.achtergrond ? `background-color:${st.achtergrond}` : '',
    bgAfb ? `background-image:url('${bgAfb.replace(/['"()\\\s]/g, encodeURIComponent)}');background-size:cover;background-position:center` : '',
  ]
    .filter(Boolean)
    .join(';');

  const klassen = [meer && s.stapelenOpMobiel ? 'nb-stapel' : ''].filter(Boolean).join(' ');

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"${klassen ? ` class="${klassen}"` : ''}${
    st.achtergrond ? ` bgcolor="${st.achtergrond}"` : ''
  } style="${e(buitenCss)}"><tr><td style="padding:${pad(st.padding)};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"${
    st.inhoudAchtergrond ? ` bgcolor="${st.inhoudAchtergrond}"` : ''
  } style="${e(binnenCss)}"><tr>${kolommen}</tr></table></td></tr></table>`;

  return verbergWrap(html, s.verbergen);
}

/** Is er een blok van dit type dat op desktop én mobiel zichtbaar is? */
function heeftZichtbaar(o: Ontwerp, type: Blok['type']): boolean {
  return o.secties.some(
    (s) => s.verbergen === 'geen' && s.kolommen.some((k) => k.blokken.some((b) => b.type === type && b.stijl.verbergen === 'geen')),
  );
}

function losseSectie(blok: Blok, achtergrond: string): Sectie {
  return {
    id: `auto-${blok.type}`,
    kolommen: [{ id: `auto-${blok.type}-k`, blokken: [blok] }],
    verhouding: [100],
    stijl: { achtergrond, inhoudAchtergrond: '', rand: null, padding: { boven: 0, rechts: 0, onder: 0, links: 0 }, radius: 0 },
    stapelenOpMobiel: true,
    verbergen: 'geen',
  };
}

/* ------------------------------------------------------------------ */
/* De hele brief                                                       */
/* ------------------------------------------------------------------ */

function cssBlok(inst: Instellingen): string {
  const bp = inst.breedte + 20;
  return `
body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;}
@media only screen and (max-width:${bp}px){
  .nb-wrap{width:100%!important;max-width:100%!important;}
  .nb-stapel .nb-kol{display:block!important;width:100%!important;max-width:100%!important;}
  .nb-verberg-mobiel{display:none!important;max-height:0!important;overflow:hidden!important;mso-hide:all!important;}
  .nb-verberg-desktop{display:block!important;max-height:none!important;overflow:visible!important;}
  img.nb-img{width:100%!important;height:auto!important;}
  .nb-knop-vol{display:block!important;}
}`.trim();
}

/**
 * Render het ontwerp tot een volledig HTML-document.
 * Gooit nooit: een kapot ontwerp wordt eerst genormaliseerd.
 */
export function renderNieuwsbrief(ontwerpInvoer: Ontwerp | unknown, opties: RenderOpties): string {
  const o = normaliseerOntwerp(ontwerpInvoer);
  const inst = o.instellingen;
  const font = LETTERTYPEN[inst.lettertype]?.stack ?? LETTERTYPEN.arial.stack;
  const siteUrl = (opties.siteUrl || '').replace(/\/$/, '');
  const ctx: Ctx = { opties, inst, font, siteUrl };

  // Afmeld- en webversielink zijn verplicht in een verstuurde mail. Ontbreken
  // ze in het ontwerp, dan zetten we ze er zelf onder en boven.
  const secties = [...o.secties];
  if (opties.modus !== 'web') {
    if (!heeftZichtbaar(o, 'webversie')) secties.unshift(losseSectie(defaultBlok('webversie'), ''));
    if (!heeftZichtbaar(o, 'afmelden')) secties.push(losseSectie(defaultBlok('afmelden'), ''));
  }

  const inhoud = secties.map((s) => renderSectie(s, ctx)).join('\n');
  const W = inst.breedte;
  const preheader = (opties.preheader ?? '').trim();
  // Opvulling na de preheader, zodat het mailprogramma geen bodytekst achter de preheader plakt.
  const opvulling = '&#847;&zwnj;&nbsp;'.repeat(60);

  let html = `<!doctype html>
<html lang="nl" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
${opties.modus === 'web' ? '<meta name="robots" content="noindex,nofollow">\n' : ''}<title>${e(opties.onderwerp || 'Nieuwsbrief')}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
${cssBlok(inst)}
</style>
</head>
<body style="margin:0;padding:0;background-color:${inst.achtergrond};">
${preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${e(preheader)}${opvulling}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${inst.achtergrond}" style="width:100%;background-color:${inst.achtergrond};">
<tr><td align="center" style="padding:16px 0;">
<!--[if mso]><table role="presentation" width="${W}" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="nb-wrap" width="${W}" align="center" cellpadding="0" cellspacing="0" border="0" bgcolor="${inst.inhoudAchtergrond}" style="width:100%;max-width:${W}px;margin:0 auto;background-color:${inst.inhoudAchtergrond};">
<tr><td style="padding:0;">
${inhoud}
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;

  // Merge-tags pas aan het eind invullen, met escaping. In de webversie nooit
  // persoonsgegevens: dan altijd de terugvalwaarden.
  html = vulMergeTags(html, opties.modus === 'web' ? null : opties.ontvanger ?? null);
  return html;
}

/** Onderwerpregel met merge-tags ingevuld (platte tekst, geen HTML). */
export function renderOnderwerp(onderwerp: string, ontvanger?: Ontvanger | null): string {
  return vulMergeTags(onderwerp, ontvanger, false).replace(/[\r\n]+/g, ' ').trim();
}
