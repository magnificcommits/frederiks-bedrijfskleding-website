/**
 * Mailtekst met lichte opmaak omzetten naar e-mailbestendige HTML.
 *
 * PUUR: geen server-imports, zodat de editor exact dezelfde voorbeeldweergave
 * toont als wat de verzendmotor verstuurt.
 *
 * Opmaak (bewust klein gehouden, zodat Jessi het zonder uitleg kan):
 *   **vet**   _cursief_   [tekst](https://…)   [knop: Plan een afspraak](https://…)
 *   regels die met "- " beginnen worden een opsomming
 *   een lege regel is een nieuwe alinea
 */
import { appUrl } from '@/lib/appUrl';
import { site } from '@/content/site';

export type MergeContext = {
  voornaam?: string | null;
  contactpersoon?: string | null;
  bedrijfsnaam?: string | null;
  plaats?: string | null;
  branche?: string | null;
  kennismakingslink?: string | null;
  portaallink?: string | null;
  reviewlink?: string | null;
  spaarsaldo?: number | null;
  spaardrempel?: number | null;
  volgendNiveau?: string | null;
  ai?: string | null;
};

export const MERGE_TAGS: { tag: string; uitleg: string }[] = [
  { tag: '{{voornaam}}', uitleg: 'Voornaam van de contactpersoon, anders "daar"' },
  { tag: '{{contactpersoon}}', uitleg: 'Volledige naam van de contactpersoon' },
  { tag: '{{bedrijfsnaam}}', uitleg: 'Naam van het bedrijf' },
  { tag: '{{plaats}}', uitleg: 'Plaats van het bedrijf' },
  { tag: '{{branche}}', uitleg: 'Branche, bijv. installatietechniek' },
  { tag: '{{kennismakingslink}}', uitleg: 'Persoonlijke pagina van de prospect (met logo-mockup)' },
  { tag: '{{portaallink}}', uitleg: 'Inloglink van het bestelportaal' },
  { tag: '{{reviewlink}}', uitleg: 'Link naar je Google-reviews (instellen bij Campagne-instellingen)' },
  { tag: '{{spaarsaldo}}', uitleg: 'Huidig spaarsaldo in punten (klanten)' },
  { tag: '{{punten_tekort}}', uitleg: 'Punten tot de puntengrens uit de trigger (klanten)' },
  { tag: '{{volgend_niveau}}', uitleg: 'Naam van het volgende spaarniveau (klanten)' },
  { tag: '{{ai}}', uitleg: 'Eén persoonlijke openingszin, door AI geschreven (zet AI aan bij de mail)' },
];

/** Voorbeeldwaarden voor de editor-preview en de testmail. */
export const VOORBEELD_CONTEXT: MergeContext = {
  voornaam: 'Mark',
  contactpersoon: 'Mark Wolters',
  bedrijfsnaam: 'Wolters Installatietechniek',
  plaats: 'Doetinchem',
  branche: 'installatietechniek',
  kennismakingslink: `${site.url}/k/voorbeeld`,
  portaallink: `${appUrl()}/portaal`,
  reviewlink: 'https://g.page/r/frederiks/review',
  spaarsaldo: 870,
  spaardrempel: 1000,
  volgendNiveau: 'Goud',
  ai: 'Ik zag dat jullie net een tweede bus de weg op hebben gestuurd, mooi om te zien.',
};

export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function voornaamVan(ctx: MergeContext): string {
  const v = (ctx.voornaam ?? '').trim();
  if (v) return v;
  const naam = (ctx.contactpersoon ?? '').trim();
  return naam ? naam.split(/\s+/)[0] : '';
}

/** Vervangt merge-tags in platte tekst (onderwerp, of vóór het escapen). */
export function vulMergeTags(tekst: string, ctx: MergeContext): string {
  const saldo = Number(ctx.spaarsaldo ?? 0);
  const drempel = Number(ctx.spaardrempel ?? 0);
  const waarden: Record<string, string> = {
    voornaam: voornaamVan(ctx) || 'daar',
    contactpersoon: (ctx.contactpersoon ?? '').trim() || 'daar',
    bedrijfsnaam: (ctx.bedrijfsnaam ?? '').trim() || 'jullie bedrijf',
    plaats: (ctx.plaats ?? '').trim() || 'de Achterhoek',
    branche: (ctx.branche ?? '').trim() || 'jullie vak',
    kennismakingslink: (ctx.kennismakingslink ?? '').trim() || site.url,
    portaallink: (ctx.portaallink ?? '').trim() || `${appUrl()}/portaal`,
    reviewlink: (ctx.reviewlink ?? '').trim() || site.url,
    spaarsaldo: String(Math.max(0, Math.round(saldo))),
    spaardrempel: String(Math.max(0, Math.round(drempel))),
    punten_tekort: String(Math.max(0, Math.round(drempel - saldo))),
    volgend_niveau: (ctx.volgendNiveau ?? '').trim() || 'het volgende niveau',
    ai: (ctx.ai ?? '').trim(),
  };
  return tekst
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (heel, naam: string) => {
      const k = naam.toLowerCase();
      return k in waarden ? waarden[k] : heel;
    })
    // Een lege {{ai}} laat anders een losse lege regel achter.
    .replace(/\n{3,}/g, '\n\n');
}

function veiligeUrl(ruw: string): string | null {
  const u = ruw.trim().replace(/&amp;/g, '&');
  if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
  return null;
}

const KNOP_STIJL =
  'display:inline-block;background-color:#ec6726;color:#1c1c1c;font-weight:700;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:15px;';
const LINK_STIJL = 'color:#c4501a;text-decoration:underline;';

/** Inline opmaak binnen één (al ge-escapete) regel. */
function inline(regel: string): string {
  return regel
    .replace(/\[knop:\s*([^\]]+)\]\(([^)\s]+)\)/gi, (heel, label: string, url: string) => {
      const href = veiligeUrl(url);
      return href ? `<a href="${escapeHtml(href)}" style="${KNOP_STIJL}">${label.trim()}</a>` : label;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (heel, label: string, url: string) => {
      const href = veiligeUrl(url);
      return href ? `<a href="${escapeHtml(href)}" style="${LINK_STIJL}">${label}</a>` : label;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_([^_]+)_(?=[\s.,!?)]|$)/g, '$1<em>$2</em>')
    // Losse url's klikbaar maken (niet binnen een al gemaakte link).
    .replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,!?)])/g, (heel, voor: string, url: string) => `${voor}<a href="${url}" style="${LINK_STIJL}">${url}</a>`);
}

/**
 * Tekst met opmaak naar HTML-alinea's. Merge-tags worden eerst ingevuld (met
 * ge-escapete waarden), zodat {{kennismakingslink}} ook als link-doel werkt.
 */
export function opmaakNaarHtml(invoer: string, ctx: MergeContext): string {
  const tekst = escapeHtml(vulMergeTags(invoer.replace(/\r\n/g, '\n'), ctx));
  const blokken = tekst.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blokken
    .map((blok) => {
      // Een blok kan tekst en een opsomming mengen ("Ik denk aan:\n- a\n- b"): groepeer per soort regel.
      const groepen: { lijst: boolean; regels: string[] }[] = [];
      for (const r of blok.split('\n')) {
        const lijst = /^\s*[-•]\s+/.test(r);
        const laatste = groepen[groepen.length - 1];
        if (laatste && laatste.lijst === lijst) laatste.regels.push(r);
        else groepen.push({ lijst, regels: [r] });
      }
      return groepen
        .map((g, i) => {
          const marge = i === groepen.length - 1 ? 16 : 6;
          if (g.lijst) {
            const items = g.regels.map((r) => `<li style="margin:0 0 4px;">${inline(r.replace(/^\s*[-•]\s+/, ''))}</li>`).join('');
            return `<ul style="margin:0 0 ${marge}px;padding-left:20px;">${items}</ul>`;
          }
          return `<p style="margin:0 0 ${marge}px;">${g.regels.map(inline).join('<br>')}</p>`;
        })
        .join('\n');
    })
    .join('\n');
}

export type MailOpties = {
  stijl: 'persoonlijk' | 'huisstijl';
  onderwerp: string;
  preheader?: string;
  inhoud: string;
  ctx: MergeContext;
  /** Persoonlijke afmeldlink. In de editor-preview een '#'. */
  afmeldUrl: string;
};

function voet(afmeldUrl: string, donker: boolean): string {
  const kleur = donker ? '#adadad' : '#8a8784';
  return `<p style="margin:0;font-size:12px;line-height:1.6;color:${kleur};">${escapeHtml(site.name)} &middot; ${escapeHtml(site.address.street)}, ${escapeHtml(site.address.postalCode)} ${escapeHtml(site.address.city)} &middot; ${escapeHtml(site.phone)}<br>Liever geen mail meer van ons? <a href="${escapeHtml(afmeldUrl)}" style="color:${kleur};text-decoration:underline;" data-afmelden="1">Afmelden</a>.</p>`;
}

/**
 * Complete HTML-mail. 'persoonlijk' oogt als een gewone mail van Jessi (beste
 * kans op de inbox en op een antwoord), 'huisstijl' als een nette merkmail.
 */
export function renderMail(o: MailOpties): string {
  const body = opmaakNaarHtml(o.inhoud, o.ctx);
  const pre = o.preheader ? vulMergeTags(o.preheader, o.ctx) : '';
  const verborgen = `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(pre)}</div>`;
  const kop = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(vulMergeTags(o.onderwerp, o.ctx))}</title></head>`;

  if (o.stijl === 'persoonlijk') {
    return `${kop}<body style="margin:0;padding:0;background:#ffffff;">${verborgen}<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 16px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;"><tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1c1c1c;">${body}</td></tr><tr><td style="padding-top:20px;border-top:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;">${voet(o.afmeldUrl, false)}</td></tr></table></td></tr></table></body></html>`;
  }

  return `${kop}<body style="margin:0;padding:0;background:#f6f5f4;">${verborgen}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f5f4;margin:0;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#ffffff;border:1px solid #e4e2e0;border-radius:14px;overflow:hidden;">
      <tr><td align="center" style="padding:28px 32px 12px;">
        <div style="font-size:24px;font-weight:800;color:#1c1c1c;letter-spacing:0.02em;line-height:1;">FREDERIKS</div>
        <div style="margin-top:5px;font-size:11px;font-weight:700;letter-spacing:0.32em;color:#ec6726;">BEDRIJFSKLEDING</div>
      </td></tr>
      <tr><td style="padding:8px 32px 0;"><div style="border-top:2px dashed #ec6726;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td style="padding:26px 32px 12px;color:#1c1c1c;font-size:15px;line-height:1.6;">${body}</td></tr>
      <tr><td style="background-color:#1c1c1c;padding:20px 32px;">${voet(o.afmeldUrl, true)}</td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}
