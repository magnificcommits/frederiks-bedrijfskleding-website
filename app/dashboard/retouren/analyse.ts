import type { RetourMetLabels } from '@/lib/kms/service';

/**
 * Rekenwerk voor Retouren: kengetallen en de analyse per reden, artikel, merk en maat.
 * Puur, zodat het met elke (gefilterde) lijst werkt.
 */

export const isKlein = (reden: string) => /klein/i.test(reden);
export const isGroot = (reden: string) => /groot/i.test(reden);

export function productSleutel(r: { product_id: string | null; item_naam: string }): string {
  return r.product_id ?? `naam:${r.item_naam.toLowerCase()}`;
}

type Teller = { stuks: number; klein: number; groot: number; overig: number; redenen: Map<string, number> };
function nieuweTeller(): Teller {
  return { stuks: 0, klein: 0, groot: 0, overig: 0, redenen: new Map() };
}
function tel(t: Teller, reden: string, aantal: number) {
  t.stuks += aantal;
  if (isKlein(reden)) t.klein += aantal;
  else if (isGroot(reden)) t.groot += aantal;
  else t.overig += aantal;
  t.redenen.set(reden, (t.redenen.get(reden) ?? 0) + aantal);
}
function topReden(t: Teller): string | null {
  let best: string | null = null;
  let n = 0;
  for (const [r, a] of t.redenen) if (a > n) { best = r; n = a; }
  return best;
}

/**
 * Maatadvies: pas vanaf 3 maat-retouren, en alleen als het duidelijk één kant op valt
 * (minstens twee derde te klein, of twee derde te groot).
 */
export function maatAdvies(t: { klein: number; groot: number }): 'valt klein' | 'valt groot' | null {
  const maat = t.klein + t.groot;
  if (maat < 3) return null;
  if (t.klein / maat >= 2 / 3) return 'valt klein';
  if (t.groot / maat >= 2 / 3) return 'valt groot';
  return null;
}

export function retourAnalyse(retouren: RetourMetLabels[], verkocht: Map<string, { naam: string; stuks: number }>) {
  const perReden = new Map<string, number>();
  const perProduct = new Map<string, Teller & { naam: string; merk: string | null }>();
  const perMerk = new Map<string, Teller>();
  const perMaat = new Map<string, Teller>();
  let stuks = 0;

  for (const r of retouren) {
    const regels = r.regels.length
      ? r.regels
      : [{ orderregel_id: '', item_naam: 'Zonder artikelregels', maat: null, kleur: null, aantal: 1, reden: null, product_id: null, merk: null, stukprijs: null }];
    for (const rg of regels) {
      const reden = rg.reden ?? r.redenLabel;
      stuks += rg.aantal;
      perReden.set(reden, (perReden.get(reden) ?? 0) + rg.aantal);
      if (!r.regels.length) continue;

      const ps = productSleutel(rg);
      const p = perProduct.get(ps) ?? { ...nieuweTeller(), naam: rg.item_naam, merk: rg.merk };
      tel(p, reden, rg.aantal);
      perProduct.set(ps, p);

      const merk = rg.merk ?? 'Onbekend merk';
      const m = perMerk.get(merk) ?? nieuweTeller();
      tel(m, reden, rg.aantal);
      perMerk.set(merk, m);

      if (rg.maat) {
        const mt = perMaat.get(rg.maat) ?? nieuweTeller();
        tel(mt, reden, rg.aantal);
        perMaat.set(rg.maat, mt);
      }
    }
  }

  const totaalVerkocht = [...verkocht.values()].reduce((n, v) => n + v.stuks, 0);

  const producten = [...perProduct.entries()]
    .map(([sleutel, t]) => {
      const v = verkocht.get(sleutel)?.stuks ?? 0;
      return {
        sleutel,
        naam: t.naam,
        merk: t.merk,
        stuks: t.stuks,
        verkocht: v,
        pct: v > 0 ? Math.round((t.stuks / v) * 1000) / 10 : null,
        klein: t.klein,
        groot: t.groot,
        overig: t.overig,
        topReden: topReden(t),
        advies: maatAdvies(t),
      };
    })
    .sort((a, b) => b.stuks - a.stuks || (b.pct ?? 0) - (a.pct ?? 0));

  const merken = [...perMerk.entries()]
    .map(([merk, t]) => ({ merk, stuks: t.stuks, klein: t.klein, groot: t.groot, overig: t.overig, advies: maatAdvies(t) }))
    .sort((a, b) => b.stuks - a.stuks);

  const maten = [...perMaat.entries()]
    .map(([maat, t]) => ({ maat, stuks: t.stuks, klein: t.klein, groot: t.groot, overig: t.overig }))
    .sort((a, b) => a.maat.localeCompare(b.maat, 'nl', { numeric: true }));

  return {
    stuks,
    totaalVerkocht,
    pct: totaalVerkocht > 0 ? Math.round((stuks / totaalVerkocht) * 1000) / 10 : null,
    perReden: [...perReden.entries()].map(([label, waarde]) => ({ label, waarde })).sort((a, b) => b.waarde - a.waarde),
    producten,
    merken,
    maten,
  };
}

/** Doorlooptijd in dagen van aanmelding tot afgehandeld (verwerkt of afgewezen). */
export function doorloopDagen(r: RetourMetLabels): number | null {
  if (!r.afgehandeld_op) return null;
  return (new Date(r.afgehandeld_op).getTime() - new Date(r.created_at).getTime()) / 86_400_000;
}
