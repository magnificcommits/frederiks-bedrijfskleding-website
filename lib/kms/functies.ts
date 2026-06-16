import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Data-access voor de module Functies.
 * Een functie is een functiegroep bij een klant (organisatie) met een vast
 * kledingpakket: een set producten met aantallen.
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side gebruiken,
 * altijd achter dashAuthed().
 */

export type OrganisatieKeuze = { id: string; naam: string };

export type ProductKeuze = { id: string; naam: string; merk: string | null };

export type Functie = {
  id: string;
  organisatie_id: string;
  naam: string;
};

export type FunctieProduct = {
  id: string;
  functie_id: string;
  product_id: string;
  aantal: number;
  product_naam: string;
  product_merk: string | null;
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

export async function listFuncties(orgId: string): Promise<Functie[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('functies').select('*').eq('organisatie_id', orgId).order('naam');
  return (data as Functie[]) ?? [];
}

export async function getFunctie(id: string): Promise<Functie | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data } = await sb.from('functies').select('*').eq('id', id).maybeSingle();
  return (data as Functie) ?? null;
}

export async function maakFunctie(orgId: string, naam: string): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data, error } = await sb.from('functies').insert({ organisatie_id: orgId, naam }).select('id').single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function verwijderFunctie(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('functies').delete().eq('id', id);
  return !error;
}

export async function listFunctieProducten(functieId: string): Promise<FunctieProduct[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('functie_producten')
    .select('id, functie_id, product_id, aantal, product:producten(naam, merk)')
    .eq('functie_id', functieId)
    .order('created_at');
  const rows = (data as unknown as {
    id: string;
    functie_id: string;
    product_id: string;
    aantal: number;
    product: { naam: string; merk: string | null } | null;
  }[]) ?? [];
  return rows.map((r) => ({
    id: r.id,
    functie_id: r.functie_id,
    product_id: r.product_id,
    aantal: r.aantal,
    product_naam: r.product?.naam ?? 'Onbekend product',
    product_merk: r.product?.merk ?? null,
  }));
}

export async function voegFunctieProduct(functieId: string, productId: string, aantal: number): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('functie_producten').insert({ functie_id: functieId, product_id: productId, aantal });
  return !error;
}

export async function verwijderFunctieProduct(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('functie_producten').delete().eq('id', id);
  return !error;
}
