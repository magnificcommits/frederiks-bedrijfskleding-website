import { getServerSupabase } from './supabaseServer';

export type KledingItem = {
  id: string; naam: string; merk: string | null; kleur: string | null;
  logopositie: string | null; techniek: string | null; richtprijs: number | null; actief: boolean;
};
export type Organisatie = { id: string; naam: string; plaats: string | null };
export type Bestelregel = { id: string; item_naam: string; maat: string | null; aantal: number };
export type Bestelling = { id: string; status: string; aangevraagd_door: string | null; notitie: string | null; created_at: string; portaal_bestelregels: Bestelregel[] };

export async function getPortaalUser() {
  const sb = await getServerSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

export async function getMijnOrganisatie(): Promise<Organisatie | null> {
  const sb = await getServerSupabase();
  if (!sb) return null;
  const { data } = await sb.from('organisaties').select('id, naam, plaats').limit(1).maybeSingle();
  return (data as Organisatie) ?? null;
}

export async function getKledinglijn(): Promise<KledingItem[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data } = await sb.from('kledinglijn_items').select('*').eq('actief', true).order('naam');
  return (data as KledingItem[]) ?? [];
}

export async function getBestellingen(): Promise<Bestelling[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('portaal_bestellingen')
    .select('id, status, aangevraagd_door, notitie, created_at, portaal_bestelregels(id, item_naam, maat, aantal)')
    .order('created_at', { ascending: false });
  return (data as Bestelling[]) ?? [];
}

/** Maakt een herbestelling/aanvraag aan voor de eigen organisatie. RLS borgt dat dit de juiste org is. */
export async function maakBestelling(
  organisatieId: string,
  door: string,
  notitie: string,
  regels: { item_naam: string; kledinglijn_item_id?: string | null; maat: string; aantal: number }[],
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const { data, error } = await sb
    .from('portaal_bestellingen')
    .insert({ organisatie_id: organisatieId, aangevraagd_door: door, notitie })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Aanmaken mislukt' };
  const rows = regels.map((r) => ({ bestelling_id: (data as { id: string }).id, item_naam: r.item_naam, kledinglijn_item_id: r.kledinglijn_item_id ?? null, maat: r.maat, aantal: r.aantal }));
  const { error: e2 } = await sb.from('portaal_bestelregels').insert(rows);
  if (e2) return { ok: false, error: e2.message };
  return { ok: true };
}
