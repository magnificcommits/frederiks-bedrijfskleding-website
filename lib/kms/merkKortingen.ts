import { kmsAdmin } from '@/lib/kms/adminClient';
import { merkSleutel, type MerkKortingen } from '@/lib/kortingPerMerk';

/** Merken die in het assortiment van de klant voorkomen, op naam gesorteerd. */
export async function merkenInAssortiment(orgId: string): Promise<string[]> {
  const sb = kmsAdmin(); if (!sb || !orgId) return [];
  const { data } = await sb.from('assortiment').select('product_id').eq('organisatie_id', orgId).limit(5000);
  const ids = [...new Set(((data as { product_id: string | null }[]) ?? []).map((r) => r.product_id).filter((v): v is string => Boolean(v)))];
  const merken = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: p } = await sb.from('producten').select('merk').in('id', ids.slice(i, i + 200));
    for (const r of (p as { merk: string | null }[]) ?? []) {
      const m = (r.merk ?? '').trim();
      if (m && !merken.has(merkSleutel(m))) merken.set(merkSleutel(m), m);
    }
  }
  return [...merken.values()].sort((a, b) => a.localeCompare(b, 'nl'));
}

/** Vastgelegde merkkortingen van een klant: { merk: pct } (merk zoals ingevoerd). */
export async function listMerkKortingen(orgId: string): Promise<{ merk: string; korting_pct: number }[]> {
  const sb = kmsAdmin(); if (!sb || !orgId) return [];
  const { data, error } = await sb.from('klant_merk_kortingen').select('merk, korting_pct').eq('organisatie_id', orgId).order('merk');
  if (error) return [];
  return ((data as { merk: string; korting_pct: number }[]) ?? []).map((r) => ({ merk: r.merk, korting_pct: Number(r.korting_pct) }));
}

export function alsKaart(lijst: { merk: string; korting_pct: number }[]): MerkKortingen {
  const uit: MerkKortingen = {};
  for (const r of lijst) uit[merkSleutel(r.merk)] = r.korting_pct;
  return uit;
}

/** Vervangt de merkkortingen van een klant. Leeg of ongeldig = geen merkkorting (dan geldt de klantkorting). */
export async function slaMerkKortingenOp(orgId: string, lijst: { merk: string; korting_pct: number | null }[]): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb || !orgId) return false;
  const rijen = lijst
    .map((r) => ({ merk: r.merk.trim().slice(0, 80), korting_pct: r.korting_pct }))
    .filter((r): r is { merk: string; korting_pct: number } => Boolean(r.merk) && r.korting_pct != null && Number.isFinite(r.korting_pct) && r.korting_pct >= 0 && r.korting_pct <= 100);
  const { error: weg } = await sb.from('klant_merk_kortingen').delete().eq('organisatie_id', orgId);
  if (weg) return false;
  if (rijen.length === 0) return true;
  const { error } = await sb.from('klant_merk_kortingen').insert(rijen.map((r) => ({ ...r, organisatie_id: orgId })));
  return !error;
}
