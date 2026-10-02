import { kmsAdmin } from '@/lib/kms/adminClient';
import { fotosVan } from '@/lib/kms/catalogus';
import type { MockupArtikel } from '@/lib/prospect/types';
import { bouwMockups, kiesVoorBranche, laadKleuren, laadPool, leesMockupKeuzes, type Keuze } from '@/lib/prospect/artikelen';
import { PROSPECT_VELDEN, type ProspectRij } from '@/lib/prospect/prospect';

/**
 * Dashboard-kant van de kennismakingsflow. Alleen aanroepen achter dashAuthed().
 */

export async function getProspectRij(id: string): Promise<ProspectRij | null> {
  const sb = kmsAdmin();
  if (!sb || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await sb.from('prospecten').select(PROSPECT_VELDEN).eq('id', id).maybeSingle();
  return (data as ProspectRij | null) ?? null;
}

export type Bezoek = { id: string; soort: string; pad: string | null; created_at: string };

export async function listBezoeken(prospectId: string, limiet = 100): Promise<Bezoek[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from('prospect_bezoeken')
    .select('id, soort, pad, created_at')
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: false })
    .limit(limiet);
  return (data as Bezoek[] | null) ?? [];
}

export type MockupStand = {
  artikelen: MockupArtikel[];
  keuzes: Keuze[];
  /** True als Jessi de artikelen zelf koos, false bij automatische keuze op branche. */
  handmatig: boolean;
  /** Beschikbare kleuren per artikel (voor de kleurkeuze). */
  kleuren: Record<string, string[]>;
};

/** Huidige mockup-artikelen van een prospect, zoals de landingspagina ze toont. */
export async function mockupVoorProspect(p: Pick<ProspectRij, 'branche' | 'mockup_artikelen'>): Promise<MockupStand> {
  const sb = kmsAdmin();
  if (!sb) return { artikelen: [], keuzes: [], handmatig: false, kleuren: {} };
  const gekozen = leesMockupKeuzes(p.mockup_artikelen);
  let keuzes: Keuze[] = [];
  let artikelen: MockupArtikel[] = [];
  let handmatig = false;
  if (gekozen) {
    const pool = await laadPool(sb, { ids: gekozen.map((k) => k.productId) });
    [artikelen] = await bouwMockups(sb, pool, [gekozen]);
    keuzes = gekozen;
    handmatig = artikelen.length > 0;
  }
  if (!handmatig) {
    const pool = await laadPool(sb);
    keuzes = kiesVoorBranche(pool, p.branche);
    [artikelen] = await bouwMockups(sb, pool, [keuzes]);
  }
  const kleurMap = await laadKleuren(sb, artikelen.map((a) => a.productId));
  return { artikelen, keuzes, handmatig, kleuren: Object.fromEntries(kleurMap) };
}

/** De keuzes die nu gelden (handmatig of automatisch), om een plek in te wijzigen. */
export async function huidigeKeuzes(p: Pick<ProspectRij, 'branche' | 'mockup_artikelen'>): Promise<Keuze[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const gekozen = leesMockupKeuzes(p.mockup_artikelen);
  if (gekozen) return gekozen.slice(0, 4);
  const pool = await laadPool(sb);
  return kiesVoorBranche(pool, p.branche);
}

export type ZoekArtikel = {
  id: string;
  naam: string;
  merk: string | null;
  categorie: string | null;
  foto: string | null;
  kleuren: string[];
  /** Kleuren waarvoor een eigen foto bestaat. */
  kleurenMetFoto: string[];
};

/** Zoeken in de catalogus voor de artikelkiezer (naam, merk of artikelnummer). */
export async function zoekArtikelen(term: string, limiet = 24): Promise<ZoekArtikel[]> {
  const sb = kmsAdmin();
  const schoon = term.replace(/[%,()*]/g, ' ').trim();
  if (!sb || schoon.length < 2) return [];
  const p = `%${schoon}%`;
  const { data } = await sb
    .from('producten')
    .select('id, naam, merk, categorie, afbeeldingen')
    .eq('actief', true)
    .or(`naam.ilike.${p},merk.ilike.${p},sku.ilike.${p},categorie.ilike.${p}`)
    .order('naam')
    .limit(limiet);
  type Rij = { id: string; naam: string; merk: string | null; categorie: string | null; afbeeldingen: string[] | null };
  const rijen = (data as Rij[] | null) ?? [];
  if (!rijen.length) return [];
  const ids = rijen.map((r) => r.id);
  const [kleuren, { data: kf }] = await Promise.all([
    laadKleuren(sb, ids),
    sb.from('product_kleur_afbeeldingen').select('product_id, kleur, afbeelding_url').in('product_id', ids),
  ]);
  const metFoto = new Map<string, Map<string, string>>();
  for (const r of (kf as { product_id: string; kleur: string; afbeelding_url: string | null }[] | null) ?? []) {
    if (!r.afbeelding_url) continue;
    const m = metFoto.get(r.product_id) ?? new Map<string, string>();
    m.set(r.kleur, r.afbeelding_url);
    metFoto.set(r.product_id, m);
  }
  return rijen
    .map((r) => {
      const kfMap = metFoto.get(r.id);
      return {
        id: r.id,
        naam: r.naam,
        merk: r.merk,
        categorie: r.categorie,
        foto: fotosVan(r.afbeeldingen)[0] ?? (kfMap ? [...kfMap.values()][0] : null) ?? null,
        kleuren: kleuren.get(r.id) ?? [],
        kleurenMetFoto: kfMap ? [...kfMap.keys()].sort((a, b) => a.localeCompare(b, 'nl')) : [],
      };
    })
    // Zonder foto kun je er geen logo op laten zien.
    .filter((a) => a.foto);
}

/** Alle prospects voor de brievengenerator (310 rijen past ruim in één pagina). */
export async function listProspectenVoorBrieven(): Promise<ProspectRij[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const uit: ProspectRij[] = [];
  for (let van = 0; van < 10_000; van += 1000) {
    const { data, error } = await sb.from('prospecten').select(PROSPECT_VELDEN).order('bedrijfsnaam').range(van, van + 999);
    if (error || !data) break;
    uit.push(...(data as ProspectRij[]));
    if (data.length < 1000) break;
  }
  return uit;
}

/** Mockups voor een hele reeks prospects in één keer (één catalogus-lading). */
export async function mockupsVoorProspecten(lijst: Pick<ProspectRij, 'id' | 'branche' | 'mockup_artikelen'>[]): Promise<Map<string, MockupArtikel[]>> {
  const sb = kmsAdmin();
  const uit = new Map<string, MockupArtikel[]>();
  if (!sb || lijst.length === 0) return uit;
  const pool = await laadPool(sb);
  const sets = lijst.map((p) => leesMockupKeuzes(p.mockup_artikelen) ?? kiesVoorBranche(pool, p.branche));
  const mockups = await bouwMockups(sb, pool, sets);
  // Handmatige keuze met alleen inactieve artikelen: terugvallen op automatisch.
  const leeg = lijst.map((p, i) => (mockups[i].length === 0 ? i : -1)).filter((i) => i >= 0);
  if (leeg.length) {
    const opnieuw = await bouwMockups(sb, pool, leeg.map((i) => kiesVoorBranche(pool, lijst[i].branche)));
    leeg.forEach((i, j) => { mockups[i] = opnieuw[j]; });
  }
  lijst.forEach((p, i) => uit.set(p.id, mockups[i]));
  return uit;
}
