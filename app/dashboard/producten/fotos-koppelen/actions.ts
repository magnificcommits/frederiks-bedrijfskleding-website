'use server';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { uploadMedia } from '@/lib/kms/storage';
import { zetKleurAfbeelding } from '@/lib/kms/afbeeldingen';
import { haalAllesOp } from '@/lib/kms/varianten';
import { logAudit } from '@/lib/kms/audit';
import type { KoppelArtikel } from '@/lib/kms/fotoKoppelen';
import { fhbPaginaUrls, fhbVoorkantUit, isFhbKleurPagina } from '@/lib/kms/fhbFotos';
import { veiligeFotoUrl } from '@/lib/kms/fotoLinks';

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
  const paginas = fhbPaginaUrls(p.art_nr_leverancier, kleur);
  if (!paginas.length) return { ok: false, status: 'geen-code' };
  const kop = { 'User-Agent': 'Mozilla/5.0 (compatible; FrederiksKMS/1.0)' };
  try {
    let fotoUrl: string | null = null;
    let paginaGevonden = false;
    for (const pagina of paginas) {
      const res = await fetch(pagina, { headers: kop, cache: 'no-store', signal: AbortSignal.timeout(15000) });
      // FHB stuurt een onbekende kleur door naar een ander (dames)model; dat is nooit goed.
      if (!res.ok || !isFhbKleurPagina(res.url, kleur)) continue;
      paginaGevonden = true;
      fotoUrl = fhbVoorkantUit(await res.text());
      if (fotoUrl) break;
    }
    if (!paginaGevonden) return { ok: false, status: 'geen-pagina' };
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

const MAX_LINK_BYTES = 15 * 1024 * 1024;

/**
 * Foto via link: haal een afbeelding op van een openbare https-link (site of CDN
 * van de leverancier), sla hem op in onze eigen opslag en koppel hem. Met kleur
 * wordt het de foto van die kleur; zonder kleur de algemene productfoto, maar
 * alleen als het artikel nog geen foto heeft of de link nieuw is.
 */
export async function fotoVanLinkActie(productId: string, kleur: string, link: string): Promise<{ ok: boolean; fout?: string }> {
  if (!(await dashAuthed())) return { ok: false, fout: 'Niet ingelogd.' };
  const sb = kmsAdmin();
  const url = veiligeFotoUrl(link);
  if (!sb || !/^[0-9a-f-]{36}$/i.test(productId)) return { ok: false, fout: 'Gegevens ontbreken.' };
  if (!url) return { ok: false, fout: 'Geen geldige https-link.' };
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FrederiksKMS/1.0)', Accept: 'image/*' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    if (!veiligeFotoUrl(res.url)) return { ok: false, fout: 'Link verwijst door naar een ongeldig adres.' };
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!res.ok) return { ok: false, fout: `Link gaf ${res.status}.` };
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(type)) return { ok: false, fout: 'Link is geen foto.' };
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_LINK_BYTES) return { ok: false, fout: 'Foto is groter dan 15 MB.' };
    const ext = type.split('/')[1].replace('jpeg', 'jpg');
    const opslag = await uploadMedia(new File([buf], `link.${ext}`, { type }), kleur.trim() ? 'producten/kleuren' : 'producten');
    if (!opslag) return { ok: false, fout: 'Opslaan mislukt.' };
    if (kleur.trim()) {
      if (!(await zetKleurAfbeelding(productId, kleur, opslag))) return { ok: false, fout: 'Koppelen mislukt.' };
    } else {
      const { data: p } = await sb.from('producten').select('afbeeldingen').eq('id', productId).maybeSingle();
      const huidig = ((p?.afbeeldingen as string[] | null) ?? []).filter(Boolean);
      const { error } = await sb.from('producten').update({ afbeeldingen: [...huidig, opslag] }).eq('id', productId);
      if (error) return { ok: false, fout: 'Koppelen mislukt.' };
    }
    await logAudit('foto_via_link', { entiteit: 'product', entiteitId: productId, details: { kleur: kleur.trim() || null, bron: url } });
    return { ok: true };
  } catch {
    return { ok: false, fout: 'Link niet bereikbaar.' };
  }
}
