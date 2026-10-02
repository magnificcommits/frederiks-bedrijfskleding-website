/**
 * Allowlist-sanitizer voor de opgemaakte tekst in een nieuwsbrief.
 *
 * Puur (geen DOM, geen server-imports), zodat dezelfde code in de editor-preview
 * en in de verzendmotor draait. Alles wat niet expliciet is toegestaan gaat eruit:
 *
 *   tags        b, strong, i, em, u, a, br, p, ul, ol, li, span, h1, h2, h3
 *   a           alleen href met http:, https: of mailto:
 *   span        alleen style met color en font-weight
 *   overig      alle attributen weg
 *
 * Een <div> (die contenteditable in Chrome maakt bij Enter) wordt een <p>.
 * De inhoud van script, style, iframe e.d. verdwijnt helemaal. Tekst wordt
 * ge-escaped; bestaande entiteiten (&amp; &nbsp; &#39;) blijven heel.
 */

export const TOEGESTANE_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'a', 'br', 'p', 'ul', 'ol', 'li', 'span', 'h1', 'h2', 'h3']);
const LEGE_TAGS = new Set(['br']);
const BLOK_TAGS = new Set(['p', 'ul', 'ol', 'h1', 'h2', 'h3']);
/** Tags waarvan ook de inhoud weg moet. */
const WEG_MET_INHOUD = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'title', 'head', 'svg', 'math', 'textarea', 'select']);
/** Tags die we omzetten naar een toegestane tegenhanger. */
const OMZETTEN: Record<string, string> = { div: 'p', strike: 'span', s: 'span', font: 'span', h4: 'h3', h5: 'h3', h6: 'h3' };

export type SanitizeOpties = {
  /** Extra inline style per tag, bv. { p: 'margin:0 0 12px;', a: 'color:#ec6726;' }. */
  inlineStijl?: Partial<Record<string, string>>;
};

export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape tekst maar laat geldige entiteiten (&amp; &#39; &#x27; &nbsp;) intact. */
function escapeTekst(s: string): string {
  return s
    .replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#x[0-9a-fA-F]{1,6});)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Decodeer de paar entiteiten die in een attribuutwaarde gebruikt worden om filters te omzeilen. */
function decodeerAttribuut(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16) || 32))
    .replace(/&#(\d+);?/g, (_, d: string) => String.fromCodePoint(Number(d) || 32))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

/** Veilige link: alleen http(s) en mailto. Merge-tags in de url zijn toegestaan. */
export function veiligeHref(ruw: string): string | null {
  const v = decodeerAttribuut(ruw)
    // Onzichtbare tekens en witruimte waarmee "java\nscript:" verstopt wordt.
    .replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, '')
    .trim();
  if (!v) return null;
  if (/^(https?:\/\/|mailto:)/i.test(v)) return v;
  return null;
}

/** Een kleurwaarde die we in een style-attribuut durven te zetten. */
export function veiligeKleur(v: unknown): string | null {
  const s = String(v ?? '').trim().toLowerCase();
  if (/^#[0-9a-f]{3,8}$/.test(s)) return s;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/.test(s)) return s.replace(/\s+/g, '');
  if (/^[a-z]{3,20}$/.test(s) && s !== 'expression') return s;
  return null;
}

function veiligeStijlSpan(ruw: string): string {
  const delen: string[] = [];
  for (const declaratie of decodeerAttribuut(ruw).split(';')) {
    const [prop, ...rest] = declaratie.split(':');
    const naam = (prop ?? '').trim().toLowerCase();
    const waarde = rest.join(':').trim();
    if (naam === 'color') {
      const k = veiligeKleur(waarde);
      if (k) delen.push(`color:${k}`);
    } else if (naam === 'font-weight') {
      const w = waarde.toLowerCase();
      if (/^(normal|bold|bolder|lighter|[1-9]00)$/.test(w)) delen.push(`font-weight:${w}`);
    }
  }
  return delen.join(';');
}

/** Attributen uit de ruwe tag-tekst lezen: naam="waarde", naam='waarde', naam=waarde of naam. */
function leesAttributen(ruw: string): Map<string, string> {
  const uit = new Map<string, string>();
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ruw))) {
    const naam = m[1].toLowerCase();
    if (!uit.has(naam)) uit.set(naam, m[2] ?? m[3] ?? m[4] ?? '');
  }
  return uit;
}

/**
 * Maak HTML veilig volgens de allowlist. Openstaande tags worden netjes
 * gesloten, losse sluit-tags vallen weg.
 */
export function sanitizeHtml(invoer: string, opties: SanitizeOpties = {}): string {
  const html = String(invoer ?? '')
    // Commentaar (incl. conditionele Outlook-commentaren) en CDATA weg.
    .replace(/<!--[\s\S]*?(-->|$)/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?(\]\]>|$)/g, '')
    .replace(/<![^>]*>/g, '')
    .replace(/<\?[\s\S]*?(\?>|$)/g, '');

  const stijl = opties.inlineStijl ?? {};
  const open: string[] = [];
  let uit = '';
  let wegTot: string | null = null;

  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^>]*?)?)(\/?)>/g;
  let laatste = 0;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(html))) {
    const tekst = html.slice(laatste, m.index);
    laatste = tagRe.lastIndex;
    if (!wegTot && tekst) uit += escapeTekst(tekst);

    const sluit = m[1] === '/';
    let tag = m[2].toLowerCase();
    const attrs = m[3] ?? '';

    if (wegTot) {
      if (sluit && tag === wegTot) wegTot = null;
      continue;
    }
    if (WEG_MET_INHOUD.has(tag)) {
      if (!sluit && m[4] !== '/') wegTot = tag;
      continue;
    }

    const omgezetVan = tag;
    tag = OMZETTEN[tag] ?? tag;
    if (!TOEGESTANE_TAGS.has(tag)) continue;

    if (sluit) {
      if (LEGE_TAGS.has(tag)) continue;
      const idx = open.lastIndexOf(tag);
      if (idx === -1) continue;
      // Alles wat daarbinnen nog open stond eerst sluiten.
      while (open.length > idx) uit += `</${open.pop()}>`;
      continue;
    }

    const extra = stijl[tag] ?? '';
    if (tag === 'br') {
      uit += '<br>';
      continue;
    }

    let attrTekst = '';
    if (tag === 'a') {
      const a = leesAttributen(attrs);
      const href = veiligeHref(a.get('href') ?? '');
      if (href) attrTekst += ` href="${escapeHtml(href)}" target="_blank" rel="noopener"`;
      if (extra) attrTekst += ` style="${escapeHtml(extra)}"`;
    } else if (tag === 'span') {
      const a = leesAttributen(attrs);
      let s = a.has('style') ? veiligeStijlSpan(a.get('style') ?? '') : '';
      // <font color="..."> en <b>-achtige omzettingen netjes meenemen.
      if (omgezetVan === 'font' && a.has('color')) {
        const k = veiligeKleur(a.get('color'));
        if (k) s = s ? `${s};color:${k}` : `color:${k}`;
      }
      if (omgezetVan === 'strike' || omgezetVan === 's') s = s ? `${s};text-decoration:line-through` : 'text-decoration:line-through';
      const samen = [extra.replace(/;$/, ''), s].filter(Boolean).join(';');
      if (samen) attrTekst += ` style="${escapeHtml(samen)}"`;
    } else if (extra) {
      attrTekst += ` style="${escapeHtml(extra)}"`;
    }

    // Blokken (p, lijst, kop) mogen niet binnen een <p>: die eerst sluiten,
    // net zoals een browser dat doet.
    if (BLOK_TAGS.has(tag) && open.includes('p')) {
      const idx = open.lastIndexOf('p');
      while (open.length > idx) uit += `</${open.pop()}>`;
    }
    // Een nieuwe <li> sluit de vorige in dezelfde lijst.
    if (tag === 'li') {
      const li = open.lastIndexOf('li');
      const lijst = Math.max(open.lastIndexOf('ul'), open.lastIndexOf('ol'));
      if (li > lijst && li !== -1) {
        while (open.length > li) uit += `</${open.pop()}>`;
      }
    }

    uit += `<${tag}${attrTekst}>`;
    if (m[4] === '/') {
      uit += `</${tag}>`;
    } else {
      open.push(tag);
    }
  }

  if (!wegTot) uit += escapeTekst(html.slice(laatste));
  while (open.length) uit += `</${open.pop()}>`;
  return uit;
}

/** Alle tags eruit, alleen tekst over (voor een samenvatting of alt-tekst). */
export function alleenTekst(html: string): string {
  return String(html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6]|div)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
