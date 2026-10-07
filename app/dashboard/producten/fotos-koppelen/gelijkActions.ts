'use server';
import sharp from 'sharp';
import { headers } from 'next/headers';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { uploadMedia } from '@/lib/kms/storage';
import { haalAllesOp } from '@/lib/kms/varianten';
import { logAudit } from '@/lib/kms/audit';
import { normaliseer, MARGE, ZIJDE, type Methode } from '@/lib/kms/fotoNormaliseren';

const MAX_INVOER = 1400; // langste zijde waarop we rekenen; groter levert niets op en kost tijd

/** Alle foto-URL's in het assortiment die nog niet zijn gelijkgetrokken. */
export async function teNormaliserenActie(): Promise<{ todo: string[]; klaar: number }> {
  if (!(await dashAuthed())) return { todo: [], klaar: 0 };
  const sb = kmsAdmin();
  if (!sb) return { todo: [], klaar: 0 };
  type P = { afbeeldingen: string[] | null };
  type K = { afbeelding_url: string | null };
  type N = { bron_url: string; url: string; methode: string; teruggezet: boolean };
  const [producten, kleuren, gedaan] = await Promise.all([
    haalAllesOp<P>((van, tot) => sb.from('producten').select('afbeeldingen').order('id').range(van, tot)),
    haalAllesOp<K>((van, tot) => sb.from('product_kleur_afbeeldingen').select('afbeelding_url').order('id').range(van, tot)),
    haalAllesOp<N>((van, tot) => sb.from('foto_normalisaties').select('bron_url, url, methode, teruggezet').order('bron_url').range(van, tot)),
  ]);
  const overslaan = new Set<string>();
  // Ongewijzigd gebleven foto's krijgen een herkansing vanaf het origineel.
  const herkansing: string[] = [];
  for (const g of gedaan) {
    overslaan.add(g.url);
    if (g.methode === 'ongewijzigd' && !g.teruggezet) herkansing.push(g.bron_url);
    else overslaan.add(g.bron_url);
  }
  const alle = new Set<string>();
  for (const p of producten) for (const u of p.afbeeldingen ?? []) if (u) alle.add(u.trim());
  for (const k of kleuren) if (k.afbeelding_url) alle.add(k.afbeelding_url.trim());
  const todo = [...[...alle].filter((u) => u && !u.includes('|') && !overslaan.has(u)), ...herkansing];
  return { todo, klaar: gedaan.length };
}

async function absoluut(url: string): Promise<string | null> {
  if (/^https:\/\//i.test(url)) return url;
  if (!url.startsWith('/')) return null;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!host) return null;
  return `https://${host}${url}`;
}

/** Vervang een foto-URL overal in het assortiment door een andere. */
async function vervangOveral(van: string, naar: string) {
  const sb = kmsAdmin();
  if (!sb) return;
  await sb.from('product_kleur_afbeeldingen').update({ afbeelding_url: naar }).eq('afbeelding_url', van);
  const { data } = await sb.from('producten').select('id, afbeeldingen').contains('afbeeldingen', [van]);
  for (const p of (data ?? []) as { id: string; afbeeldingen: string[] }[]) {
    await sb.from('producten').update({ afbeeldingen: p.afbeeldingen.map((u) => (u === van ? naar : u)) }).eq('id', p.id);
  }
}

export type GelijkResultaat = { ok: boolean; url?: string; methode?: Methode; fout?: string };

/** Trek één foto gelijk: vrijstaand op wit, bijgesneden, vierkant, en vervang hem overal. */
export async function normaliseerFotoActie(bron: string): Promise<GelijkResultaat> {
  if (!(await dashAuthed())) return { ok: false, fout: 'Niet ingelogd.' };
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const adres = await absoluut(bron);
  if (!adres) return { ok: false, fout: 'Onbekend adres.' };
  try {
    const res = await fetch(adres, { cache: 'no-store', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FrederiksKMS/1.0)' } });
    if (!res.ok) return { ok: false, fout: `Foto gaf ${res.status}.` };
    const invoer = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(invoer)
      .rotate()
      .resize(MAX_INVOER, MAX_INVOER, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const r = normaliseer(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height);
    const binnen = Math.round(ZIJDE * (1 - 2 * MARGE));
    const rand = Math.floor((ZIJDE - binnen) / 2);
    const uit = await sharp(Buffer.from(r.pixels.buffer, r.pixels.byteOffset, r.pixels.length), {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .extract({ left: r.x, top: r.y, width: r.w, height: r.h })
      .resize(binnen, binnen, { fit: 'contain', background: '#ffffff', kernel: 'lanczos3' })
      .flatten({ background: '#ffffff' })
      .extend({ top: rand, bottom: ZIJDE - binnen - rand, left: rand, right: ZIJDE - binnen - rand, background: '#ffffff' })
      .webp({ quality: 86 })
      .toBuffer();
    const url = await uploadMedia(new File([new Uint8Array(uit)], 'gelijk.webp', { type: 'image/webp' }), 'producten/gelijk');
    if (!url) return { ok: false, fout: 'Opslaan mislukt.' };
    const { data: eerder } = await sb.from('foto_normalisaties').select('url').eq('bron_url', bron).maybeSingle();
    const { error } = await sb.from('foto_normalisaties').upsert({ bron_url: bron, url, methode: r.methode === 'ongewijzigd' && eerder ? 'ongewijzigd_herkansing' : r.methode, teruggezet: false });
    if (error) return { ok: false, fout: 'Vastleggen mislukt.' };
    await vervangOveral(bron, url);
    if (eerder?.url && eerder.url !== url) await vervangOveral(eerder.url, url);
    return { ok: true, url, methode: r.methode };
  } catch (e) {
    return { ok: false, fout: e instanceof Error ? e.message.slice(0, 120) : 'Verwerken mislukt.' };
  }
}

/** Zet een gelijkgetrokken foto terug naar het origineel. */
export async function terugzettenActie(url: string): Promise<{ ok: boolean }> {
  if (!(await dashAuthed())) return { ok: false };
  const sb = kmsAdmin();
  if (!sb) return { ok: false };
  const { data } = await sb.from('foto_normalisaties').select('bron_url').eq('url', url).maybeSingle();
  if (!data) return { ok: false };
  await vervangOveral(url, data.bron_url);
  await sb.from('foto_normalisaties').update({ teruggezet: true }).eq('url', url);
  await logAudit('foto_teruggezet', { entiteit: 'foto', details: { url, bron: data.bron_url } });
  return { ok: true };
}
