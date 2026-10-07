'use server';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { uploadMedia } from '@/lib/kms/storage';
import { zetKleurAfbeelding } from '@/lib/kms/afbeeldingen';
import { haalAllesOp } from '@/lib/kms/varianten';
import { logAudit } from '@/lib/kms/audit';
import type { KoppelArtikel } from '@/lib/kms/fotoKoppelen';
import { fhbPaginaUrl, fhbVoorkantUit } from '@/lib/kms/fhbFotos';

/** Alle artikelen met hun kleuren en of die kleur al een foto heeft. Voor het vooraf koppelen in de browser. */
export async function koppelArtikelenActie(): Promise<KoppelArtikel[]> {
  if (!(await dashAuthed())) return [];
  const sb = kmsAdmin();
  if (!sb) return [];
  type P = { id: string; naam: string | null; merk: string | null; art_nr_leverancier: string | null };
  type V = { product_id: string; kleur: string | null };
  type F = { product_id: string; kleur: string | null };
  const [producten, varianten, fotos] = await Promise.all([
    haalAllesOp<P>((van, tot) => sb.from('producten').select('id, naam, merk, art_nr_leverancier').order('id').range(van, tot)),
    haalAllesOp<V>((van, tot) => sb.from('product_varianten').select('product_id, kleur').not('kleur', 'is', null).order('id').range(van, tot)),
    haalAllesOp<F>((van, tot) => sb.from('product_kleur_afbeeldingen').select('product_id, kleur').order('id').range(van, tot)),
  ]);
  const metFoto = new Set(fotos.map((f) => `${f.product_id}|${(f.kleur ?? '').trim()}`));
  const kleuren = new Map<string, Set<string>>();
  for (const v of varianten) {
    const k = (v.kleur ?? '').trim();
    if (!k) continue;
    if (!kleuren.has(v.product_id)) kleuren.set(v.product_id, new Set());
    kleuren.get(v.product_id)!.add(k);
  }
  return producten.map((p) => ({
    id: p.id,
    naam: p.naam?.trim() || 'Naamloos',
    merk: p.merk,
    artNr: p.art_nr_leverancier,
    kleuren: [...(kleuren.get(p.id) ?? [])].sort((a, b) => a.localeCompare(b, 'nl')).map((k) => ({ kleur: k, heeftFoto: metFoto.has(`${p.id}|${k}`) })),
  }));
}

/** Eén foto uploaden en als foto van die kleur vastzetten. De browser heeft hem al verkleind. */
export async function koppelFotoActie(formData: FormData): Promise<{ ok: boolean; fout?: string }> {
  if (!(await dashAuthed())) return { ok: false, fout: 'Niet ingelogd.' };
  const productId = String(formData.get('productId') ?? '');
  const kleur = String(formData.get('kleur') ?? '').trim();
  const bestand = formData.get('bestand') as File | null;
  const naam = String(formData.get('naam') ?? '').slice(0, 200);
  if (!/^[0-9a-f-]{36}$/i.test(productId) || !kleur || !bestand) return { ok: false, fout: 'Gegevens ontbreken.' };
  const url = await uploadMedia(bestand, 'producten/kleuren');
  if (!url) return { ok: false, fout: 'Uploaden mislukt.' };
  const ok = await zetKleurAfbeelding(productId, kleur, url);
  if (!ok) return { ok: false, fout: 'Koppelen mislukt.' };
  await logAudit('kleurfoto_gekoppeld', { entiteit: 'product', entiteitId: productId, details: { kleur, bestand: naam } });
  return { ok: true };
}

export type FhbResultaat = { ok: boolean; status: 'gekoppeld' | 'geen-code' | 'geen-pagina' | 'geen-foto' | 'fout'; fout?: string };

/**
 * Haal de voorkant-foto van één kleur op bij fhb.de (met toestemming van FHB),
 * sla hem op in onze eigen opslag en zet hem vast als kleurfoto. De browser
 * roept dit per kleur aan, zodat geen aanroep tegen de tijdslimiet loopt.
 */
export async function haalFhbKleurfotoActie(productId: string, kleur: string): Promise<FhbResultaat> {
  if (!(await dashAuthed())) return { ok: false, status: 'fout', fout: 'Niet ingelogd.' };
  const sb = kmsAdmin();
  if (!sb || !/^[0-9a-f-]{36}$/i.test(productId) || !kleur.trim()) return { ok: false, status: 'fout', fout: 'Gegevens ontbreken.' };
  const { data: p } = await sb.from('producten').select('art_nr_leverancier, merk').eq('id', productId).maybeSingle();
  if (!p || !/^fhb$/i.test((p.merk ?? '').trim()) || !p.art_nr_leverancier) return { ok: false, status: 'fout', fout: 'Geen FHB-artikel.' };
  const pagina = fhbPaginaUrl(p.art_nr_leverancier, kleur);
  if (!pagina) return { ok: false, status: 'geen-code' };
  const kop = { 'User-Agent': 'Mozilla/5.0 (compatible; FrederiksKMS/1.0)' };
  try {
    const res = await fetch(pagina, { headers: kop, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!res.ok || !new URL(res.url).pathname.includes('/produkt/')) return { ok: false, status: 'geen-pagina' };
    const fotoUrl = fhbVoorkantUit(await res.text());
    if (!fotoUrl) return { ok: false, status: 'geen-foto' };
    const img = await fetch(fotoUrl, { headers: kop, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const type = img.headers.get('content-type') ?? '';
    if (!img.ok || !type.startsWith('image/')) return { ok: false, status: 'geen-foto' };
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    const bestand = new File([await img.arrayBuffer()], `fhb-${p.art_nr_leverancier}-${kleur}.${ext}`.replace(/[^a-z0-9.-]+/gi, '-'), { type });
    const url = await uploadMedia(bestand, 'producten/kleuren');
    if (!url) return { ok: false, status: 'fout', fout: 'Opslaan mislukt.' };
    if (!(await zetKleurAfbeelding(productId, kleur, url))) return { ok: false, status: 'fout', fout: 'Koppelen mislukt.' };
    await logAudit('kleurfoto_gekoppeld', { entiteit: 'product', entiteitId: productId, details: { kleur, bron: fotoUrl } });
    return { ok: true, status: 'gekoppeld' };
  } catch {
    return { ok: false, status: 'fout', fout: 'FHB niet bereikbaar.' };
  }
}
