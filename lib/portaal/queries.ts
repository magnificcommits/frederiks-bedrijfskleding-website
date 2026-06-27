import { getServerSupabase } from './supabaseServer';

export type KledingItem = {
  id: string; naam: string; merk: string | null; kleur: string | null;
  logopositie: string | null; techniek: string | null; richtprijs: number | null; actief: boolean;
};
export type Organisatie = { id: string; naam: string; plaats: string | null };
export type Bestelregel = { id: string; item_naam: string; maat: string | null; aantal: number };
export type Bestelling = {
  id: string; status: string; aangevraagd_door: string | null; notitie: string | null; created_at: string;
  medewerker_naam: string | null; waarde: number | null; portaal_bestelregels: Bestelregel[];
};
export type Medewerker = { id: string; naam: string; functie: string | null; budget: number | null };

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

/** Of retouren via het portaal voor de eigen organisatie aan staan. Standaard aan. */
export async function getRetourenActief(): Promise<boolean> {
  const sb = await getServerSupabase();
  if (!sb) return true;
  const { data } = await sb.from('organisaties').select('retouren_actief').limit(1).maybeSingle();
  const v = (data as { retouren_actief: boolean | null } | null)?.retouren_actief;
  return v !== false;
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
    .select('id, status, aangevraagd_door, notitie, created_at, medewerker_naam, waarde, portaal_bestelregels(id, item_naam, maat, aantal)')
    .order('created_at', { ascending: false });
  return (data as Bestelling[]) ?? [];
}

type BestellingOpts = { medewerkerId?: string | null; medewerkerNaam?: string | null; waarde?: number | null };

/** Maakt een herbestelling/aanvraag aan voor de eigen organisatie. RLS borgt dat dit de juiste org is. */
export async function maakBestelling(
  organisatieId: string,
  door: string,
  notitie: string,
  regels: { item_naam: string; kledinglijn_item_id?: string | null; maat: string; aantal: number }[],
  opts: BestellingOpts = {},
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const { data, error } = await sb
    .from('portaal_bestellingen')
    .insert({
      organisatie_id: organisatieId,
      aangevraagd_door: door,
      notitie,
      medewerker_id: opts.medewerkerId ?? null,
      medewerker_naam: opts.medewerkerNaam ?? null,
      waarde: opts.waarde ?? null,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Aanmaken mislukt' };
  const rows = regels.map((r) => ({ bestelling_id: (data as { id: string }).id, item_naam: r.item_naam, kledinglijn_item_id: r.kledinglijn_item_id ?? null, maat: r.maat, aantal: r.aantal }));
  const { error: e2 } = await sb.from('portaal_bestelregels').insert(rows);
  if (e2) return { ok: false, error: e2.message };
  return { ok: true };
}

// --- Fase 2/3: medewerkers, maten, budget (klantkant, via RLS) ---
export async function getMedewerkers(): Promise<Medewerker[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data } = await sb.from('medewerkers').select('id, naam, functie, budget').order('naam');
  return (data as Medewerker[]) ?? [];
}

/** Maat per kledinglijn-item voor een medewerker, als map { itemId: maat }. */
export async function getMatenMap(medewerkerId: string): Promise<Record<string, string>> {
  const sb = await getServerSupabase();
  if (!sb) return {};
  const { data } = await sb.from('maten').select('kledinglijn_item_id, maat').eq('medewerker_id', medewerkerId);
  const map: Record<string, string> = {};
  ((data as { kledinglijn_item_id: string; maat: string | null }[]) ?? []).forEach((r) => {
    if (r.maat) map[r.kledinglijn_item_id] = r.maat;
  });
  return map;
}

/** Verbruik per medewerker: som van de waarde van hun bestellingen, als map { medewerkerId: bedrag }. */
export async function getVerbruik(): Promise<Record<string, number>> {
  const sb = await getServerSupabase();
  if (!sb) return {};
  const { data } = await sb.from('portaal_bestellingen').select('medewerker_id, waarde');
  const map: Record<string, number> = {};
  ((data as { medewerker_id: string | null; waarde: number | null }[]) ?? []).forEach((r) => {
    if (r.medewerker_id) map[r.medewerker_id] = (map[r.medewerker_id] ?? 0) + (Number(r.waarde) || 0);
  });
  return map;
}

export async function maakMedewerker(organisatieId: string, naam: string, functie: string): Promise<boolean> {
  const sb = await getServerSupabase();
  if (!sb) return false;
  const { error } = await sb.from('medewerkers').insert({ organisatie_id: organisatieId, naam, functie: functie || null });
  return !error;
}

export async function verwijderMedewerker(id: string): Promise<boolean> {
  const sb = await getServerSupabase();
  if (!sb) return false;
  const { error } = await sb.from('medewerkers').delete().eq('id', id);
  return !error;
}

export async function zetBudget(medewerkerId: string, budget: number | null): Promise<boolean> {
  const sb = await getServerSupabase();
  if (!sb) return false;
  const { error } = await sb.from('medewerkers').update({ budget }).eq('id', medewerkerId);
  return !error;
}

/** Slaat de maat voor een medewerker en kledinglijn-item op (upsert). */
export async function zetMaat(medewerkerId: string, kledinglijnItemId: string, maat: string): Promise<boolean> {
  const sb = await getServerSupabase();
  if (!sb) return false;
  const { error } = await sb
    .from('maten')
    .upsert({ medewerker_id: medewerkerId, kledinglijn_item_id: kledinglijnItemId, maat: maat || null }, { onConflict: 'medewerker_id,kledinglijn_item_id' });
  return !error;
}
