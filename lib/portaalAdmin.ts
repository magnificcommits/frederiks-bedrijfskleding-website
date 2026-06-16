import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isLeadsDbConfigured } from '@/lib/env';

/** Admin-client met de service-role key. Alleen server-side gebruiken (dashboard, achter wachtwoord). */
function admin(): SupabaseClient | null {
  if (!isLeadsDbConfigured) return null;
  return createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false } });
}

export type Organisatie = { id: string; naam: string; plaats: string | null; telefoon: string | null; adres: string | null; postcode: string | null; created_at: string };
export type OrgVelden = { naam: string; plaats?: string | null; telefoon?: string | null; adres?: string | null; postcode?: string | null };
export type Gebruiker = { id: string; organisatie_id: string; email: string; naam: string | null; rol: string };
export type KledingItem = { id: string; organisatie_id: string; naam: string; merk: string | null; kleur: string | null; logopositie: string | null; techniek: string | null; richtprijs: number | null; actief: boolean };
export type Bestelregel = { id: string; item_naam: string; maat: string | null; aantal: number };
export type Bestelling = { id: string; status: string; aangevraagd_door: string | null; notitie: string | null; created_at: string; medewerker_naam: string | null; waarde: number | null; portaal_bestelregels: Bestelregel[] };

export async function listOrganisaties(): Promise<Organisatie[]> {
  const sb = admin(); if (!sb) return [];
  const { data } = await sb.from('organisaties').select('*').order('naam');
  return (data as Organisatie[]) ?? [];
}
export async function getOrganisatie(id: string): Promise<Organisatie | null> {
  const sb = admin(); if (!sb) return null;
  const { data } = await sb.from('organisaties').select('*').eq('id', id).maybeSingle();
  return (data as Organisatie) ?? null;
}
export async function maakOrganisatie(v: OrgVelden): Promise<string | null> {
  const sb = admin(); if (!sb) return null;
  const { data, error } = await sb.from('organisaties').insert({
    naam: v.naam,
    plaats: v.plaats || null,
    telefoon: v.telefoon || null,
    adres: v.adres || null,
    postcode: v.postcode || null,
  }).select('id').single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}
export async function werkOrganisatieBij(id: string, v: OrgVelden): Promise<boolean> {
  const sb = admin(); if (!sb) return false;
  const { error } = await sb.from('organisaties').update({
    naam: v.naam,
    plaats: v.plaats || null,
    telefoon: v.telefoon || null,
    adres: v.adres || null,
    postcode: v.postcode || null,
  }).eq('id', id);
  return !error;
}
export async function getGebruikers(orgId: string): Promise<Gebruiker[]> {
  const sb = admin(); if (!sb) return [];
  const { data } = await sb.from('portaal_gebruikers').select('*').eq('organisatie_id', orgId).order('email');
  return (data as Gebruiker[]) ?? [];
}
export async function addGebruiker(orgId: string, email: string, naam: string): Promise<boolean> {
  const sb = admin(); if (!sb) return false;
  const { error } = await sb.from('portaal_gebruikers').insert({ organisatie_id: orgId, email: email.toLowerCase(), naam: naam || null });
  return !error;
}
export async function listItems(orgId: string): Promise<KledingItem[]> {
  const sb = admin(); if (!sb) return [];
  const { data } = await sb.from('kledinglijn_items').select('*').eq('organisatie_id', orgId).order('naam');
  return (data as KledingItem[]) ?? [];
}
export async function maakItem(orgId: string, item: Omit<KledingItem, 'id' | 'organisatie_id' | 'actief'>): Promise<boolean> {
  const sb = admin(); if (!sb) return false;
  const { error } = await sb.from('kledinglijn_items').insert({ organisatie_id: orgId, ...item, actief: true });
  return !error;
}
export async function zetItemActief(id: string, actief: boolean): Promise<boolean> {
  const sb = admin(); if (!sb) return false;
  const { error } = await sb.from('kledinglijn_items').update({ actief }).eq('id', id);
  return !error;
}
export async function listBestellingen(orgId: string): Promise<Bestelling[]> {
  const sb = admin(); if (!sb) return [];
  const { data } = await sb
    .from('portaal_bestellingen')
    .select('id, status, aangevraagd_door, notitie, created_at, medewerker_naam, waarde, portaal_bestelregels(id, item_naam, maat, aantal)')
    .eq('organisatie_id', orgId)
    .order('created_at', { ascending: false });
  return (data as Bestelling[]) ?? [];
}
export async function zetBestellingStatus(id: string, status: string): Promise<boolean> {
  const sb = admin(); if (!sb) return false;
  const { error } = await sb.from('portaal_bestellingen').update({ status }).eq('id', id);
  return !error;
}
