/** Opmaak voor Analyse en Rapportages. Puur, dus ook bruikbaar in client components. */

const euro0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const euro2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const getal = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });

export const euro = (n: number | null | undefined) => euro0.format(Number(n) || 0);
export const euroCent = (n: number | null | undefined) => euro2.format(Number(n) || 0);
export const aantal = (n: number | null | undefined) => getal.format(Number(n) || 0);

/** 0,237 → '24%'. Null wordt een streepje, geen verwarrende 0%. */
export function pct(n: number | null | undefined, decimalen = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  return `${(n * 100).toLocaleString('nl-NL', { maximumFractionDigits: decimalen, minimumFractionDigits: decimalen })}%`;
}

/** Dagen leesbaar: '0,5 dag', '3 dagen', '2,4 weken'. */
export function dagen(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  if (n < 1) return `${(Math.round(n * 10) / 10).toLocaleString('nl-NL')} dag`;
  if (n < 28) {
    const r = Math.round(n);
    return `${r} ${r === 1 ? 'dag' : 'dagen'}`;
  }
  return `${(Math.round((n / 7) * 10) / 10).toLocaleString('nl-NL')} weken`;
}

export const meervoud = (n: number, een: string, meer: string) => `${aantal(n)} ${n === 1 ? een : meer}`;
