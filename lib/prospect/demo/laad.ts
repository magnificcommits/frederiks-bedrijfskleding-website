import { cache } from 'react';
import { notFound } from 'next/navigation';
import { haalKennismaking } from '@/lib/prospect/kennismaking';
import { maakDemo, type DemoData } from './maak-demo';

/**
 * Server-only: laadt de kennismaking en bouwt de demo. Per request gecachet,
 * zodat layout, pagina en metadata samen maar één keer de data ophalen.
 */
export const laadDemo = cache(async (token: string): Promise<DemoData | null> => {
  const t = (token ?? '').trim();
  if (!t || t.length > 200) return null;
  const k = await haalKennismaking(t);
  if (!k) return null;
  return maakDemo(k);
});

/** Als laadDemo, maar met notFound() bij een onbekend of afgemeld token. */
export async function vereisDemo(token: string): Promise<DemoData> {
  const demo = await laadDemo(token);
  if (!demo) notFound();
  return demo;
}

/** Basis-URL van het voorbeeldportaal en de kennismakingspagina voor een token. */
export function demoPaden(token: string) {
  const kennismaking = `/kennismaking/${encodeURIComponent(token)}`;
  return { kennismaking, pasdag: `${kennismaking}#pasdag`, portaal: `${kennismaking}/portaal` };
}
