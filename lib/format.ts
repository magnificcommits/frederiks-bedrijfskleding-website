// Gedeelde opmaak-helpers. Eén bron van waarheid voor euro's, datums en statussen.

const euroFmt = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

const euroFmt0 = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/** Bedrag als euro, bijv. € 1.234,50. Met afronding=0 zonder centen. */
export function formatEuro(n: number | null | undefined, afronding: 0 | 2 = 2): string {
  const v = Number(n ?? 0);
  return (afronding === 0 ? euroFmt0 : euroFmt).format(Number.isFinite(v) ? v : 0);
}

/** Datum als 17-06-2026. Accepteert Date of ISO-string. */
export function formatDatum(d: string | Date | null | undefined): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Status leesbaar maken: 'nog_bestellen' -> 'Nog bestellen'. */
export function formatStatus(s: string | null | undefined): string {
  if (!s) return '';
  const tekst = String(s).replace(/_/g, ' ').trim();
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

/** Getal met NL-duizendtallen, bijv. 1.234. */
export function formatGetal(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat('nl-NL').format(Number.isFinite(v) ? Math.round(v) : 0);
}
