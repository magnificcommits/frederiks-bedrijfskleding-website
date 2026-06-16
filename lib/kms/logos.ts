import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Data-access voor de module Bedrukken/Borduren.
 * Logobibliotheek per klant plus de decoraties per orderregel (werkbon).
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side gebruiken,
 * altijd achter dashAuthed().
 */

export type Logo = {
  id: string;
  organisatie_id: string;
  naam: string;
  logo_bestand_url: string | null;
  vectorbestand_url: string | null;
  borduurbestand_url: string | null;
  opmerkingen: string | null;
  created_at: string;
};

export type LogoVelden = {
  naam: string;
  logo_bestand_url?: string | null;
  vectorbestand_url?: string | null;
  borduurbestand_url?: string | null;
  opmerkingen?: string | null;
};

export type Techniek = 'bedrukken' | 'borduren';

export type Decoratie = {
  id: string;
  orderregel_id: string;
  logo_id: string | null;
  techniek: Techniek;
  positie: string | null;
  afmeting: string | null;
  opmerkingen: string | null;
  created_at: string;
  logo: Logo | null;
};

export type DecoratieVelden = {
  logo_id?: string | null;
  techniek: Techniek;
  positie?: string | null;
  afmeting?: string | null;
  opmerkingen?: string | null;
};

export type OrganisatieKeuze = { id: string; naam: string };

export type WerkbonRegel = {
  id: string;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  aantal: number;
  decoraties: Decoratie[];
};

export type Werkbon = {
  id: string;
  ordernummer: string | null;
  organisatie_naam: string | null;
  organisatie_plaats: string | null;
  medewerker_naam: string | null;
  afdeling_naam: string | null;
  regels: WerkbonRegel[];
};

export async function listOrganisaties(): Promise<OrganisatieKeuze[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('organisaties').select('id, naam').order('naam');
  return (data as OrganisatieKeuze[]) ?? [];
}

export async function listLogos(orgId: string): Promise<Logo[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('logos').select('*').eq('organisatie_id', orgId).order('naam');
  return (data as Logo[]) ?? [];
}

export async function maakLogo(orgId: string, v: LogoVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('logos').insert({ organisatie_id: orgId, ...v });
  return !error;
}

export async function werkLogo(id: string, v: Partial<LogoVelden>): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('logos').update(v).eq('id', id);
  return !error;
}

export async function verwijderLogo(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('logos').delete().eq('id', id);
  return !error;
}

const DECORATIE_SELECT = '*, logo:logos(*)';

export async function listDecoraties(orderId: string): Promise<Record<string, Decoratie[]>> {
  const sb = kmsAdmin(); if (!sb) return {};
  const { data: regels } = await sb.from('orderregels').select('id').eq('order_id', orderId);
  const ids = ((regels as { id: string }[]) ?? []).map((r) => r.id);
  if (ids.length === 0) return {};
  const { data } = await sb.from('regel_decoraties').select(DECORATIE_SELECT).in('orderregel_id', ids).order('created_at');
  const rows = (data as Decoratie[]) ?? [];
  const map: Record<string, Decoratie[]> = {};
  for (const d of rows) {
    (map[d.orderregel_id] ??= []).push(d);
  }
  return map;
}

export async function maakDecoratie(orderregelId: string, v: DecoratieVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('regel_decoraties').insert({ orderregel_id: orderregelId, ...v });
  return !error;
}

export async function verwijderDecoratie(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('regel_decoraties').delete().eq('id', id);
  return !error;
}

export async function getOrderVoorWerkbon(orderId: string): Promise<Werkbon | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data: order } = await sb
    .from('orders')
    .select('id, ordernummer, organisatie:organisaties(naam, plaats), medewerker:medewerkers(naam), afdeling:afdelingen(naam)')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return null;
  const o = order as unknown as {
    id: string;
    ordernummer: string | null;
    organisatie: { naam: string | null; plaats: string | null } | null;
    medewerker: { naam: string | null } | null;
    afdeling: { naam: string | null } | null;
  };

  const { data: regelData } = await sb
    .from('orderregels')
    .select('id, item_naam, maat, kleur, aantal')
    .eq('order_id', orderId)
    .order('item_naam');
  const baseRegels = (regelData as Omit<WerkbonRegel, 'decoraties'>[]) ?? [];
  const decoratieMap = await listDecoraties(orderId);

  return {
    id: o.id,
    ordernummer: o.ordernummer,
    organisatie_naam: o.organisatie?.naam ?? null,
    organisatie_plaats: o.organisatie?.plaats ?? null,
    medewerker_naam: o.medewerker?.naam ?? null,
    afdeling_naam: o.afdeling?.naam ?? null,
    regels: baseRegels.map((r) => ({ ...r, decoraties: decoratieMap[r.id] ?? [] })),
  };
}
