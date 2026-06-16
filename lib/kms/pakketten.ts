import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Data-access voor de module Pakketten.
 * Een pakket hoort bij een klant (organisatie) en bundelt producten met een
 * pakketprijs. Soort is 'start' (eenmalig basispakket) of 'regulier'.
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side gebruiken,
 * altijd achter dashAuthed().
 */

export type OrganisatieKeuze = { id: string; naam: string };

export type ProductKeuze = { id: string; naam: string; merk: string | null };

export type VariantKeuze = { id: string; product_id: string; maat: string | null; kleur: string | null };

export type PakketSoort = 'start' | 'regulier';

export type Pakket = {
  id: string;
  organisatie_id: string;
  naam: string;
  soort: PakketSoort;
  pakketprijs: number | null;
  buiten_budget: boolean;
  actief: boolean;
};

export type PakketVelden = {
  naam: string;
  soort?: PakketSoort;
  pakketprijs?: number | null;
  buiten_budget?: boolean;
  actief?: boolean;
};

export type PakketProduct = {
  id: string;
  pakket_id: string;
  product_id: string;
  variant_id: string | null;
  aantal: number;
  product_naam: string;
  product_merk: string | null;
  variant_label: string | null;
};

export async function listOrganisaties(): Promise<OrganisatieKeuze[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('organisaties').select('id, naam').order('naam');
  return (data as OrganisatieKeuze[]) ?? [];
}

export async function listProducten(): Promise<ProductKeuze[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('producten').select('id, naam, merk').order('naam');
  return (data as ProductKeuze[]) ?? [];
}

export async function listVarianten(productId: string): Promise<VariantKeuze[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('product_varianten').select('id, product_id, maat, kleur').eq('product_id', productId).order('created_at');
  return (data as VariantKeuze[]) ?? [];
}

export async function listPakketten(orgId: string): Promise<Pakket[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('pakketten').select('*').eq('organisatie_id', orgId).order('soort').order('naam');
  return (data as Pakket[]) ?? [];
}

export async function getPakket(id: string): Promise<Pakket | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data } = await sb.from('pakketten').select('*').eq('id', id).maybeSingle();
  return (data as Pakket) ?? null;
}

export async function maakPakket(orgId: string, v: PakketVelden): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data, error } = await sb.from('pakketten').insert({ organisatie_id: orgId, ...v }).select('id').single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function werkPakket(id: string, v: Partial<PakketVelden>): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('pakketten').update(v).eq('id', id);
  return !error;
}

export async function verwijderPakket(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('pakketten').delete().eq('id', id);
  return !error;
}

export async function listPakketProducten(pakketId: string): Promise<PakketProduct[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('pakket_producten')
    .select('id, pakket_id, product_id, variant_id, aantal, product:producten(naam, merk), variant:product_varianten(maat, kleur)')
    .eq('pakket_id', pakketId)
    .order('created_at');
  const rows = (data as unknown as {
    id: string;
    pakket_id: string;
    product_id: string;
    variant_id: string | null;
    aantal: number;
    product: { naam: string; merk: string | null } | null;
    variant: { maat: string | null; kleur: string | null } | null;
  }[]) ?? [];
  return rows.map((r) => {
    const v = r.variant;
    const label = v ? [v.maat, v.kleur].filter(Boolean).join(' / ') || null : null;
    return {
      id: r.id,
      pakket_id: r.pakket_id,
      product_id: r.product_id,
      variant_id: r.variant_id,
      aantal: r.aantal,
      product_naam: r.product?.naam ?? 'Onbekend product',
      product_merk: r.product?.merk ?? null,
      variant_label: label,
    };
  });
}

export async function voegPakketProduct(
  pakketId: string,
  v: { productId: string; variantId?: string | null; aantal: number },
): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('pakket_producten').insert({
    pakket_id: pakketId,
    product_id: v.productId,
    variant_id: v.variantId ?? null,
    aantal: v.aantal,
  });
  return !error;
}

export async function verwijderPakketProduct(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('pakket_producten').delete().eq('id', id);
  return !error;
}
