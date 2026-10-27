import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { headers } from 'next/headers';
import { VOORWAARDEN_PDF } from '@/content/algemeneVoorwaarden';

export const VOORWAARDEN_BESTANDSNAAM = 'Algemene voorwaarden Frederiks Bedrijfskleding.pdf';

let cache: string | null = null;

/**
 * De PDF met algemene voorwaarden als base64, voor de bijlage bij elke offerte
 * (Jessi, 27 okt, punt 1.4). Eerst van schijf (meegenomen via
 * outputFileTracingIncludes), anders van de eigen website. Null als het niet lukt.
 */
export async function voorwaardenPdfBase64(): Promise<string | null> {
  if (cache) return cache;
  try {
    const buf = await readFile(path.join(process.cwd(), 'public', VOORWAARDEN_PDF));
    if (buf.length > 1000) return (cache = buf.toString('base64'));
  } catch {
    // niet op schijf: via de website
  }
  try {
    const h = await headers();
    const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim();
    if (!host) return null;
    const res = await fetch(`https://${host}${VOORWAARDEN_PDF}`, { cache: 'force-cache' });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 1000 ? (cache = buf.toString('base64')) : null;
  } catch {
    return null;
  }
}
