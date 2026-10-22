import { getServerSupabase } from './supabaseServer';

/** Maatwijzigingsverzoeken, portaalkant (RLS: eigen verzoeken, of de hele organisatie voor beheer). */
export type MijnMaatwijziging = {
  id: string;
  product_id: string;
  huidige_maat: string | null;
  gewenste_maat: string;
  toelichting: string | null;
  status: 'wacht' | 'goedgekeurd' | 'afgewezen';
  notitie: string | null;
  created_at: string;
};

export async function listMijnMaatwijzigingen(medewerkerId: string): Promise<MijnMaatwijziging[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('maatwijzigingen')
    .select('id, product_id, huidige_maat, gewenste_maat, toelichting, status, notitie, created_at')
    .eq('medewerker_id', medewerkerId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return [];
  return (data as MijnMaatwijziging[]) ?? [];
}

export async function vraagMaatwijzigingAan(v: {
  organisatieId: string;
  medewerkerId: string;
  productId: string;
  huidigeMaat: string | null;
  gewensteMaat: string;
  toelichting: string | null;
  door: string | null;
}): Promise<{ ok: boolean }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false };
  const { error } = await sb.from('maatwijzigingen').insert({
    organisatie_id: v.organisatieId,
    medewerker_id: v.medewerkerId,
    product_id: v.productId,
    huidige_maat: v.huidigeMaat,
    gewenste_maat: v.gewensteMaat.trim().slice(0, 20),
    toelichting: v.toelichting?.trim().slice(0, 500) || null,
    aangevraagd_door: v.door,
  });
  return { ok: !error };
}
