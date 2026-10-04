import { z } from 'zod';
import { MAX_PADEN, schoonPad, schoneReferrer, type Herkomst, type LeadRegelInvoer, type PadStap } from '@/lib/leadHerkomst';

/**
 * Validatie (zod) van de herkomst en productregels die de browser meestuurt met
 * een aanvraag. Alleen server-side gebruiken: zo blijft zod uit de publieke bundel.
 */

const kortTekst = (max: number) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      const s = String(v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
      return s || null;
    });

/** Validatie van wat de browser meestuurt. Ongeldige onderdelen worden null, nooit een fout. */
export const herkomstSchema = z
  .object({
    utm_source: kortTekst(120),
    utm_medium: kortTekst(120),
    utm_campaign: kortTekst(160),
    utm_term: kortTekst(160),
    utm_content: kortTekst(160),
    gclid: kortTekst(200),
    referrer: kortTekst(300),
    landingspagina: kortTekst(300),
    conversiepagina: kortTekst(300),
    paginas_bekeken: z.union([z.number(), z.string(), z.null()]).optional(),
    bezochte_paden: z.array(z.unknown()).max(200).optional().nullable(),
    eerste_bezoek_op: kortTekst(40),
    bezoeken: z.union([z.number(), z.string(), z.null()]).optional(),
  })
  .partial()
  .passthrough();

function heelGetal(v: unknown, max: number): number | null {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : null;
}

/** Maakt van de (gevalideerde) invoer een veilige Herkomst. */
export function schoneHerkomst(ruw: unknown): Herkomst {
  const p = herkomstSchema.safeParse(ruw ?? {});
  const d = (p.success ? p.data : {}) as Record<string, unknown>;
  const tekst = (k: string) => (typeof d[k] === 'string' && d[k] ? (d[k] as string) : null);

  const paden: PadStap[] = [];
  for (const stap of Array.isArray(d.bezochte_paden) ? (d.bezochte_paden as unknown[]) : []) {
    const o = (stap && typeof stap === 'object' ? stap : { p: stap }) as { p?: unknown; s?: unknown };
    const pad = schoonPad(o.p);
    if (!pad) continue;
    paden.push({ p: pad, s: heelGetal(o.s, 60 * 60 * 24 * 30) ?? 0 });
    if (paden.length >= MAX_PADEN) break;
  }

  let eerste: string | null = null;
  const ts = tekst('eerste_bezoek_op');
  if (ts) {
    const t = new Date(ts).getTime();
    // Niet in de toekomst en niet ouder dan een jaar.
    if (Number.isFinite(t) && t <= Date.now() + 60_000 && t >= Date.now() - 366 * 86_400_000) eerste = new Date(t).toISOString();
  }

  return {
    utm_source: tekst('utm_source'),
    utm_medium: tekst('utm_medium'),
    utm_campaign: tekst('utm_campaign'),
    utm_term: tekst('utm_term'),
    utm_content: tekst('utm_content'),
    gclid: tekst('gclid') && /^[\w-]{6,200}$/.test(tekst('gclid') as string) ? tekst('gclid') : null,
    referrer: schoneReferrer(d.referrer),
    landingspagina: schoonPad(d.landingspagina),
    conversiepagina: schoonPad(d.conversiepagina),
    paginas_bekeken: heelGetal(d.paginas_bekeken, 10000),
    bezochte_paden: paden.length ? paden : null,
    eerste_bezoek_op: eerste,
    bezoeken: heelGetal(d.bezoeken, 10000),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const leadRegelSchema = z.object({
  product_id: z.string().max(40).optional().nullable(),
  omschrijving: z.string().max(300).optional().nullable(),
  kleur: z.string().max(80).optional().nullable(),
  maat: z.string().max(80).optional().nullable(),
  aantal: z.union([z.number(), z.string()]).optional().nullable(),
  opmerking: z.string().max(300).optional().nullable(),
});

export const leadRegelsSchema = z.array(leadRegelSchema).max(60);

export function schoneRegels(ruw: unknown): LeadRegelInvoer[] {
  const p = leadRegelsSchema.safeParse(ruw ?? []);
  if (!p.success) return [];
  const uit: LeadRegelInvoer[] = [];
  for (const r of p.data) {
    const omschrijving = String(r.omschrijving ?? '').trim();
    if (!omschrijving) continue;
    const n = Math.round(Number(r.aantal));
    uit.push({
      product_id: r.product_id && UUID.test(r.product_id) ? r.product_id : null,
      omschrijving: omschrijving.slice(0, 300),
      kleur: String(r.kleur ?? '').trim().slice(0, 80) || null,
      maat: String(r.maat ?? '').trim().slice(0, 80) || null,
      aantal: Number.isFinite(n) && n > 0 ? Math.min(n, 100000) : null,
      opmerking: String(r.opmerking ?? '').trim().slice(0, 300) || null,
    });
  }
  return uit;
}

