import { kmsAdmin } from '@/lib/kms/adminClient';
import { fotosVan } from '@/lib/kms/catalogus';
import { haalAllesOp } from '@/lib/kms/varianten';

/**
 * Data-access voor afbeelding per kleur (een voorkant-afbeelding per productkleur).
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side gebruiken,
 * altijd achter dashAuthed().
 */

export type KleurAfbeelding = {
  id: string;
  product_id: string;
  kleur: string;
  afbeelding_url: string;
};

/** De distinct, niet-lege kleuren van een product op basis van de varianten, gesorteerd. */
export async function getKleurenVanProduct(productId: string): Promise<string[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('product_varianten').select('kleur').eq('product_id', productId).not('kleur', 'is', null);
  const set = new Set<string>();
  for (const r of (data as { kleur: string | null }[]) ?? []) {
    const k = (r.kleur ?? '').trim();
    if (k) set.add(k);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'nl'));
}

/** Map van kleur naar afbeelding_url voor een product. */
export async function listKleurAfbeeldingen(productId: string): Promise<Record<string, string>> {
  const sb = kmsAdmin(); if (!sb) return {};
  const { data } = await sb.from('product_kleur_afbeeldingen').select('kleur, afbeelding_url').eq('product_id', productId);
  const map: Record<string, string> = {};
  for (const r of (data as { kleur: string; afbeelding_url: string }[]) ?? []) {
    if (r.kleur && r.afbeelding_url) map[r.kleur] = r.afbeelding_url;
  }
  return map;
}

/** Zet (upsert) de afbeelding voor een kleur van een product op (product_id, kleur). */
export async function zetKleurAfbeelding(productId: string, kleur: string, url: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const k = kleur.trim();
  const u = url.trim();
  if (!k || !u) return false;
  const { error } = await sb
    .from('product_kleur_afbeeldingen')
    .upsert({ product_id: productId, kleur: k, afbeelding_url: u }, { onConflict: 'product_id,kleur' });
  return !error;
}

/** Verwijder de afbeelding voor een kleur van een product. */
export async function verwijderKleurAfbeelding(productId: string, kleur: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb
    .from('product_kleur_afbeeldingen')
    .delete()
    .eq('product_id', productId)
    .eq('kleur', kleur.trim());
  return !error;
}

// ---------------------------------------------------------------------------
// Fotocontrole
// ---------------------------------------------------------------------------

/** Gemeten waarden zoals ze in product_foto_controle staan. */
export type OpgeslagenMeting = {
  breedte: number | null;
  hoogte: number | null;
  bytes: number | null;
  scherpte: number | null;
  witruimte: number | null;
  uit_midden: number | null;
  vulling: number | null;
  problemen: string[];
  gemeten_op: string;
};

export type ControleFoto = {
  productId: string;
  product: string;
  merk: string | null;
  actief: boolean;
  /** Null voor een algemene productfoto, anders de kleur waar de foto bij hoort. */
  kleur: string | null;
  url: string;
  meting: OpgeslagenMeting | null;
};

export type OntbrekendeFoto = { productId: string; product: string; merk: string | null; actief: boolean; kleur: string | null };

/**
 * Alles wat de fotocontrole nodig heeft: elke productfoto (algemeen en per kleur)
 * met de laatst bewaarde meting, en wat er ontbreekt (product zonder foto, of een
 * kleur zonder foto). Zonder de migratie zijn er geen bewaarde metingen; de
 * pagina meet dan alles opnieuw in de browser.
 */
export async function listFotoControle(): Promise<{ fotos: ControleFoto[]; ontbrekend: OntbrekendeFoto[]; opslaan: boolean }> {
  const sb = kmsAdmin();
  if (!sb) return { fotos: [], ontbrekend: [], opslaan: false };

  type ProductRij = { id: string; naam: string; merk: string | null; actief: boolean | null; afbeeldingen: string[] | null };
  type KleurRij = { product_id: string; kleur: string; afbeelding_url: string | null };
  type MetingRij = OpgeslagenMeting & { product_id: string; url: string };

  const [productR, kleurRijen, metingR, variantKleuren] = await Promise.all([
    sb.from('producten').select('id, naam, merk, actief, afbeeldingen').order('naam').range(0, 4999),
    haalAllesOp<KleurRij>((van, tot) => sb.from('product_kleur_afbeeldingen').select('product_id, kleur, afbeelding_url').order('id').range(van, tot)),
    sb.from('product_foto_controle').select('product_id, url, breedte, hoogte, bytes, scherpte, witruimte, uit_midden, vulling, problemen, gemeten_op').range(0, 0),
    haalAllesOp<{ product_id: string; kleur: string | null }>((van, tot) =>
      sb.from('product_varianten').select('product_id, kleur').not('kleur', 'is', null).order('id').range(van, tot),
    ),
  ]);

  const opslaan = !metingR.error;
  const metingen = opslaan
    ? await haalAllesOp<MetingRij>((van, tot) =>
        sb.from('product_foto_controle').select('product_id, url, breedte, hoogte, bytes, scherpte, witruimte, uit_midden, vulling, problemen, gemeten_op').order('id').range(van, tot),
      )
    : [];
  const metingVan = new Map(metingen.map((m) => [`${m.product_id}\u0000${m.url}`, m]));

  const producten = (productR.data as ProductRij[] | null) ?? [];
  const productVan = new Map(producten.map((p) => [p.id, p]));
  const fotos: ControleFoto[] = [];
  const heeftFoto = new Set<string>();
  const kleurMetFoto = new Set<string>();

  const voegToe = (p: ProductRij, kleur: string | null, url: string) => {
    const m = metingVan.get(`${p.id}\u0000${url}`) ?? null;
    fotos.push({
      productId: p.id,
      product: p.naam,
      merk: p.merk,
      actief: p.actief !== false,
      kleur,
      url,
      meting: m
        ? { breedte: m.breedte, hoogte: m.hoogte, bytes: m.bytes, scherpte: m.scherpte == null ? null : Number(m.scherpte), witruimte: m.witruimte == null ? null : Number(m.witruimte), uit_midden: m.uit_midden == null ? null : Number(m.uit_midden), vulling: m.vulling == null ? null : Number(m.vulling), problemen: m.problemen ?? [], gemeten_op: m.gemeten_op }
        : null,
    });
    heeftFoto.add(p.id);
  };

  for (const p of producten) for (const url of fotosVan(p.afbeeldingen)) voegToe(p, null, url);
  for (const k of kleurRijen) {
    const p = productVan.get(k.product_id);
    const url = fotosVan(k.afbeelding_url ? [k.afbeelding_url] : [])[0];
    if (!p || !url) continue;
    voegToe(p, k.kleur, url);
    kleurMetFoto.add(`${k.product_id}\u0000${k.kleur}`);
  }

  const ontbrekend: OntbrekendeFoto[] = [];
  for (const p of producten) {
    if (!heeftFoto.has(p.id)) ontbrekend.push({ productId: p.id, product: p.naam, merk: p.merk, actief: p.actief !== false, kleur: null });
  }
  const gezien = new Set<string>();
  for (const v of variantKleuren) {
    const kleur = (v.kleur ?? '').trim();
    const sleutel = `${v.product_id}\u0000${kleur}`;
    if (!kleur || gezien.has(sleutel) || kleurMetFoto.has(sleutel)) continue;
    gezien.add(sleutel);
    const p = productVan.get(v.product_id);
    // Een product zonder enige foto staat al in de lijst; dan niet ook nog elke kleur apart.
    if (p && heeftFoto.has(p.id)) ontbrekend.push({ productId: p.id, product: p.naam, merk: p.merk, actief: p.actief !== false, kleur });
  }

  return { fotos, ontbrekend, opslaan };
}

export type NieuweMeting = {
  productId: string;
  kleur: string | null;
  url: string;
  breedte: number | null;
  hoogte: number | null;
  bytes: number | null;
  scherpte: number | null;
  witruimte: number | null;
  uitMidden: number | null;
  vulling: number | null;
  problemen: string[];
};

/** Bewaart metingen (upsert op product + url). Zonder migratie: { ok: false } en verder niets. */
export async function bewaarFotoMetingen(rijen: NieuweMeting[]): Promise<{ ok: boolean; aantal: number }> {
  const sb = kmsAdmin();
  if (!sb || rijen.length === 0) return { ok: false, aantal: 0 };
  const geldig = ['te_klein', 'niet_vierkant', 'wazig', 'witruimte', 'uit_midden', 'laadfout'];
  const getal = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : null);
  const data = rijen
    .filter((r) => r.productId && r.url)
    .map((r) => ({
      product_id: r.productId,
      kleur: r.kleur || null,
      url: String(r.url).slice(0, 2000),
      breedte: getal(r.breedte),
      hoogte: getal(r.hoogte),
      bytes: getal(r.bytes),
      scherpte: getal(r.scherpte),
      witruimte: getal(r.witruimte),
      uit_midden: getal(r.uitMidden),
      vulling: getal(r.vulling),
      problemen: (r.problemen ?? []).filter((p) => geldig.includes(p)),
      gemeten_op: new Date().toISOString(),
    }));
  const { error } = await sb.from('product_foto_controle').upsert(data, { onConflict: 'product_id,url' });
  return { ok: !error, aantal: error ? 0 : data.length };
}

/** Bewaarde metingen van één product, per URL. Leeg zonder migratie. */
export async function listFotoMetingenVanProduct(productId: string): Promise<Record<string, OpgeslagenMeting>> {
  const sb = kmsAdmin();
  if (!sb) return {};
  const { data, error } = await sb
    .from('product_foto_controle')
    .select('url, breedte, hoogte, bytes, scherpte, witruimte, uit_midden, vulling, problemen, gemeten_op')
    .eq('product_id', productId);
  if (error) return {};
  const uit: Record<string, OpgeslagenMeting> = {};
  for (const r of (data as (OpgeslagenMeting & { url: string })[] | null) ?? []) {
    const { url, ...m } = r;
    uit[url] = { ...m, problemen: m.problemen ?? [] };
  }
  return uit;
}
