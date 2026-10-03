import { kmsAdmin } from '@/lib/kms/adminClient';
import { metIdTerugval } from '@/lib/kms/kolomTerugval';

/**
 * Data-access voor de module Organisatie-inrichting: portaalinstellingen van de
 * organisatie, vestigingen, afdelingen en de scope van managers.
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS).
 * Alleen server-side gebruiken, altijd achter dashAuthed().
 */

export const ORGANISATIE_TYPES = ['bedrijf', 'school'] as const;
export type OrganisatieType = (typeof ORGANISATIE_TYPES)[number];

export type Instellingen = {
  id: string;
  naam: string | null;
  type: string | null;
  min_bestelbedrag: number | null;
  max_bestelbedrag: number | null;
  korting_pct: number | null;
  toon_kortingen: boolean | null;
  gebruik_referentienr: boolean | null;
  opmerking_bij_bestelling: boolean | null;
  toon_voorraad: boolean | null;
  voorwaarden_tekst: string | null;
  voorschriften_tekst: string | null;
  verzendkosten: number | null;
  bestelperiode_start: string | null;
  bestelperiode_eind: string | null;
  huisstijl_kleur: string | null;
  portaal_logo_url: string | null;
  sfeerafbeelding_url: string | null;
};

export type InstellingenVelden = {
  type?: string | null;
  min_bestelbedrag?: number | null;
  max_bestelbedrag?: number | null;
  korting_pct?: number | null;
  toon_kortingen?: boolean;
  gebruik_referentienr?: boolean;
  opmerking_bij_bestelling?: boolean;
  toon_voorraad?: boolean;
  voorwaarden_tekst?: string | null;
  voorschriften_tekst?: string | null;
  verzendkosten?: number | null;
  bestelperiode_start?: string | null;
  bestelperiode_eind?: string | null;
  huisstijl_kleur?: string | null;
  portaal_logo_url?: string | null;
  sfeerafbeelding_url?: string | null;
};

export type Vestiging = {
  id: string;
  organisatie_id: string;
  naam: string;
  leveradres: string | null;
  leverpostcode: string | null;
  leverplaats: string | null;
  factuuradres: string | null;
  factuurpostcode: string | null;
  factuurplaats: string | null;
};

export type VestigingVelden = {
  naam: string;
  leveradres?: string | null;
  leverpostcode?: string | null;
  leverplaats?: string | null;
  factuuradres?: string | null;
  factuurpostcode?: string | null;
  factuurplaats?: string | null;
};

export type Afdeling = {
  id: string;
  organisatie_id: string;
  naam: string;
  kostenplaats: string | null;
  leidinggevende: string | null;
  /** Werknemer achter `leidinggevende`; bestaat pas na migratie 20261004_persoon_verwijzingen. */
  leidinggevende_medewerker_id?: string | null;
  vestiging_id: string | null;
  vestiging_naam: string | null;
  leveradres: string | null;
  leverpostcode: string | null;
  leverplaats: string | null;
  factuuradres: string | null;
  factuurpostcode: string | null;
  factuurplaats: string | null;
};

export type AfdelingVelden = {
  naam: string;
  kostenplaats?: string | null;
  leidinggevende?: string | null;
  leidinggevende_medewerker_id?: string | null;
  vestiging_id?: string | null;
  leveradres?: string | null;
  leverpostcode?: string | null;
  leverplaats?: string | null;
  factuuradres?: string | null;
  factuurpostcode?: string | null;
  factuurplaats?: string | null;
};

export type Manager = {
  id: string;
  organisatie_id: string;
  email: string | null;
  naam: string | null;
  rol: string | null;
  scope_vestiging_id: string | null;
  scope_afdeling_id: string | null;
};

// ---- Instellingen ----

const INSTELLINGEN_KOLOMMEN =
  'id, naam, type, min_bestelbedrag, max_bestelbedrag, korting_pct, toon_kortingen, gebruik_referentienr, opmerking_bij_bestelling, toon_voorraad, voorwaarden_tekst, voorschriften_tekst, verzendkosten, bestelperiode_start, bestelperiode_eind, huisstijl_kleur, portaal_logo_url, sfeerafbeelding_url';

export async function getInstellingen(orgId: string): Promise<Instellingen | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data } = await sb
    .from('organisaties')
    .select(INSTELLINGEN_KOLOMMEN)
    .eq('id', orgId)
    .maybeSingle();
  return (data as Instellingen | null) ?? null;
}

export async function werkInstellingen(orgId: string, v: InstellingenVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const patch: Record<string, unknown> = {};
  if (v.type !== undefined) patch.type = v.type || null;
  if (v.min_bestelbedrag !== undefined) patch.min_bestelbedrag = v.min_bestelbedrag;
  if (v.max_bestelbedrag !== undefined) patch.max_bestelbedrag = v.max_bestelbedrag;
  if (v.korting_pct !== undefined) patch.korting_pct = v.korting_pct;
  if (v.toon_kortingen !== undefined) patch.toon_kortingen = v.toon_kortingen;
  if (v.gebruik_referentienr !== undefined) patch.gebruik_referentienr = v.gebruik_referentienr;
  if (v.opmerking_bij_bestelling !== undefined) patch.opmerking_bij_bestelling = v.opmerking_bij_bestelling;
  if (v.toon_voorraad !== undefined) patch.toon_voorraad = v.toon_voorraad;
  if (v.voorwaarden_tekst !== undefined) patch.voorwaarden_tekst = v.voorwaarden_tekst || null;
  if (v.voorschriften_tekst !== undefined) patch.voorschriften_tekst = v.voorschriften_tekst || null;
  if (v.verzendkosten !== undefined) patch.verzendkosten = v.verzendkosten;
  if (v.bestelperiode_start !== undefined) patch.bestelperiode_start = v.bestelperiode_start;
  if (v.bestelperiode_eind !== undefined) patch.bestelperiode_eind = v.bestelperiode_eind;
  if (v.huisstijl_kleur !== undefined) patch.huisstijl_kleur = v.huisstijl_kleur || null;
  if (v.portaal_logo_url !== undefined) patch.portaal_logo_url = v.portaal_logo_url || null;
  if (v.sfeerafbeelding_url !== undefined) patch.sfeerafbeelding_url = v.sfeerafbeelding_url || null;
  const { error } = await sb.from('organisaties').update(patch).eq('id', orgId);
  return !error;
}

// ---- Vestigingen ----

export async function listVestigingen(orgId: string): Promise<Vestiging[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('vestigingen')
    .select('*')
    .eq('organisatie_id', orgId)
    .order('naam');
  return (data as Vestiging[]) ?? [];
}

export async function maakVestiging(orgId: string, v: VestigingVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('vestigingen').insert({
    organisatie_id: orgId,
    naam: v.naam,
    leveradres: v.leveradres || null,
    leverpostcode: v.leverpostcode || null,
    leverplaats: v.leverplaats || null,
    factuuradres: v.factuuradres || null,
    factuurpostcode: v.factuurpostcode || null,
    factuurplaats: v.factuurplaats || null,
  });
  return !error;
}

export async function werkVestiging(id: string, v: Partial<VestigingVelden>): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const patch: Record<string, unknown> = {};
  if (v.naam !== undefined) patch.naam = v.naam;
  if (v.leveradres !== undefined) patch.leveradres = v.leveradres || null;
  if (v.leverpostcode !== undefined) patch.leverpostcode = v.leverpostcode || null;
  if (v.leverplaats !== undefined) patch.leverplaats = v.leverplaats || null;
  if (v.factuuradres !== undefined) patch.factuuradres = v.factuuradres || null;
  if (v.factuurpostcode !== undefined) patch.factuurpostcode = v.factuurpostcode || null;
  if (v.factuurplaats !== undefined) patch.factuurplaats = v.factuurplaats || null;
  const { error } = await sb.from('vestigingen').update(patch).eq('id', id);
  return !error;
}

export async function verwijderVestiging(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('vestigingen').delete().eq('id', id);
  return !error;
}

// ---- Afdelingen ----

export async function listAfdelingen(orgId: string): Promise<Afdeling[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('afdelingen')
    .select('*, vestigingen(naam)')
    .eq('organisatie_id', orgId)
    .order('naam');
  const rijen = (data as unknown as (Afdeling & { vestigingen: { naam: string } | null })[]) ?? [];
  return rijen.map((r) => ({ ...r, vestiging_naam: r.vestigingen?.naam ?? null }));
}

export async function maakAfdeling(orgId: string, v: AfdelingVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const rij: Record<string, unknown> = {
    organisatie_id: orgId,
    naam: v.naam,
    kostenplaats: v.kostenplaats || null,
    leidinggevende: v.leidinggevende || null,
    vestiging_id: v.vestiging_id || null,
    leveradres: v.leveradres || null,
    leverpostcode: v.leverpostcode || null,
    leverplaats: v.leverplaats || null,
    factuuradres: v.factuuradres || null,
    factuurpostcode: v.factuurpostcode || null,
    factuurplaats: v.factuurplaats || null,
  };
  if (v.leidinggevende_medewerker_id) rij.leidinggevende_medewerker_id = v.leidinggevende_medewerker_id;
  const { error } = await metIdTerugval(rij, ['leidinggevende_medewerker_id'], (r) => sb.from('afdelingen').insert(r));
  return !error;
}

/** Zelfde als maakAfdeling, maar geeft het id van de nieuwe afdeling terug (of null). */
export async function maakAfdelingMetId(orgId: string, v: AfdelingVelden): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb || !v.naam.trim()) return null;
  const rij: Record<string, unknown> = { organisatie_id: orgId, naam: v.naam.trim() };
  if (v.kostenplaats) rij.kostenplaats = v.kostenplaats;
  if (v.leidinggevende) rij.leidinggevende = v.leidinggevende;
  if (v.vestiging_id) rij.vestiging_id = v.vestiging_id;
  const { data, error } = await sb.from('afdelingen').insert(rij).select('id').single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/**
 * Hoeveel werknemers en assortimentregels aan een afdeling hangen. Gebruikt om
 * te voorkomen dat de wizard een afdeling weggooit waar al iets aan vastzit.
 */
export async function afdelingInGebruik(afdelingId: string): Promise<{ werknemers: number; artikelen: number }> {
  const sb = kmsAdmin(); if (!sb) return { werknemers: 0, artikelen: 0 };
  const [w, a] = await Promise.all([
    sb.from('medewerkers').select('id', { count: 'exact', head: true }).eq('afdeling_id', afdelingId),
    sb.from('assortiment').select('id', { count: 'exact', head: true }).eq('afdeling_id', afdelingId),
  ]);
  return { werknemers: w.count ?? 0, artikelen: a.count ?? 0 };
}

export async function werkAfdeling(id: string, v: Partial<AfdelingVelden>): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const patch: Record<string, unknown> = {};
  if (v.naam !== undefined) patch.naam = v.naam;
  if (v.kostenplaats !== undefined) patch.kostenplaats = v.kostenplaats || null;
  if (v.leidinggevende !== undefined) patch.leidinggevende = v.leidinggevende || null;
  if (v.leidinggevende_medewerker_id !== undefined) patch.leidinggevende_medewerker_id = v.leidinggevende_medewerker_id || null;
  if (v.vestiging_id !== undefined) patch.vestiging_id = v.vestiging_id || null;
  if (v.leveradres !== undefined) patch.leveradres = v.leveradres || null;
  if (v.leverpostcode !== undefined) patch.leverpostcode = v.leverpostcode || null;
  if (v.leverplaats !== undefined) patch.leverplaats = v.leverplaats || null;
  if (v.factuuradres !== undefined) patch.factuuradres = v.factuuradres || null;
  if (v.factuurpostcode !== undefined) patch.factuurpostcode = v.factuurpostcode || null;
  if (v.factuurplaats !== undefined) patch.factuurplaats = v.factuurplaats || null;
  const { error } = await metIdTerugval(patch, ['leidinggevende_medewerker_id'], (r) =>
    sb.from('afdelingen').update(r).eq('id', id),
  );
  return !error;
}

export async function verwijderAfdeling(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('afdelingen').delete().eq('id', id);
  return !error;
}

// ---- Managers en scope ----

export async function listManagers(orgId: string): Promise<Manager[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('portaal_gebruikers')
    .select('id, organisatie_id, email, naam, rol, scope_vestiging_id, scope_afdeling_id')
    .eq('organisatie_id', orgId)
    .in('rol', ['leidinggevende', 'beheerder'])
    .order('naam');
  return (data as Manager[]) ?? [];
}

export async function zetManagerScope(
  gebruikerId: string,
  vestigingId: string | null,
  afdelingId: string | null,
): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb
    .from('portaal_gebruikers')
    .update({ scope_vestiging_id: vestigingId, scope_afdeling_id: afdelingId })
    .eq('id', gebruikerId);
  return !error;
}
