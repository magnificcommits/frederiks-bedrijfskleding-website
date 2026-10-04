import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { kolomOntbreekt } from '@/lib/kms/kolomTerugval';
import { logDbFout } from '@/lib/dbFout';
import {
  STANDAARD_LIJSTEN,
  kleurSleutel,
  maatSleutel,
  normaliseerKleur,
  normaliseerMaat,
  type KleurGroep,
  type MaatReeks,
  type StandaardKleur,
  type VariantEigenschap,
  type VariantLijsten,
} from '@/lib/kms/variantenStandaard';

/**
 * Data-access voor de vaste lijsten (kleuren, maten, eigenschappen) en de
 * opschoontool. Alleen server-side, achter dashAuthed(). De pure helpers
 * (normaliseerKleur enz.) staan in `variantenStandaard.ts` en werken ook in de
 * browser en in importscripts.
 *
 * Alles werkt ook zonder de migratie 20261004_varianten_en_fotocontrole.sql:
 * dan komt de lijst uit de code (STANDAARD_LIJSTEN) en is beheren uitgeschakeld.
 */

type PgFout = { code?: string; message?: string } | null | undefined;

/** Tabel, view of functie bestaat (nog) niet: migratie niet gedraaid. */
export function tabelOntbreekt(fout: PgFout): boolean {
  if (!fout) return false;
  if (['42P01', 'PGRST205', 'PGRST202', '42883'].includes(fout.code ?? '')) return true;
  return kolomOntbreekt(fout);
}

// ---------------------------------------------------------------------------
// Lijsten laden
// ---------------------------------------------------------------------------

type KleurRij = {
  id: string;
  naam: string;
  hex: string | null;
  hex2: string | null;
  groep: string | null;
  volgorde: number | null;
  actief: boolean | null;
  variant_kleur_aliassen: { alias: string }[] | null;
};
type ReeksRij = { id: string; naam: string; volgorde: number | null; variant_maten: { id: string; maat: string; volgorde: number | null }[] | null };

async function laadUitDb(sb: SupabaseClient): Promise<VariantLijsten | null> {
  const [kleurenR, reeksenR, maatAliasR, eigenschapR] = await Promise.all([
    sb.from('variant_kleuren').select('id, naam, hex, hex2, groep, volgorde, actief, variant_kleur_aliassen(alias)').order('volgorde').order('naam'),
    sb.from('variant_maatreeksen').select('id, naam, volgorde, variant_maten(id, maat, volgorde)').order('volgorde'),
    sb.from('variant_maat_aliassen').select('alias, maat'),
    sb.from('variant_eigenschappen').select('id, soort, waarde, volgorde').order('soort').order('volgorde'),
  ]);
  if (kleurenR.error || reeksenR.error) return null;
  const kleurRijen = (kleurenR.data as KleurRij[] | null) ?? [];
  if (kleurRijen.length === 0) return null;

  const kleuren: StandaardKleur[] = kleurRijen.map((k) => ({
    id: k.id,
    naam: k.naam,
    hex: k.hex || '#999999',
    hex2: k.hex2,
    groep: (k.groep || 'meerkleurig') as KleurGroep,
    volgorde: k.volgorde ?? 0,
    actief: k.actief !== false,
    aliassen: (k.variant_kleur_aliassen ?? []).map((a) => a.alias),
  }));

  const maatAliassen = new Map<string, string[]>();
  for (const a of (maatAliasR.data as { alias: string; maat: string }[] | null) ?? []) {
    const lijst = maatAliassen.get(a.maat) ?? [];
    lijst.push(a.alias);
    maatAliassen.set(a.maat, lijst);
  }
  const reeksen: MaatReeks[] = ((reeksenR.data as ReeksRij[] | null) ?? []).map((r) => ({
    id: r.id,
    naam: r.naam,
    volgorde: r.volgorde ?? 0,
    maten: [...(r.variant_maten ?? [])]
      .sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0))
      .map((m) => ({ id: m.id, maat: m.maat, volgorde: m.volgorde ?? 0, aliassen: maatAliassen.get(m.maat) ?? [] })),
  }));

  const eigenschappen = eigenschapR.error
    ? STANDAARD_LIJSTEN.eigenschappen
    : ((eigenschapR.data as VariantEigenschap[] | null) ?? []);

  return { kleuren, reeksen: reeksen.length ? reeksen : STANDAARD_LIJSTEN.reeksen, eigenschappen, bron: 'database' };
}

/**
 * De vaste lijsten, één keer per request. Valt terug op de standaardlijst uit
 * de code als de tabellen er nog niet zijn of leeg zijn.
 */
export const laadVariantLijsten = cache(async (): Promise<VariantLijsten> => {
  const sb = kmsAdmin();
  if (!sb) return STANDAARD_LIJSTEN;
  try {
    return (await laadUitDb(sb)) ?? STANDAARD_LIJSTEN;
  } catch {
    return STANDAARD_LIJSTEN;
  }
});

/** Welke delen van de migratie zijn er al? Voor meldingen in het scherm. */
export async function variantMigratieStatus(): Promise<{ lijsten: boolean; omzetten: boolean; fotoControle: boolean; overzicht: boolean }> {
  const sb = kmsAdmin();
  if (!sb) return { lijsten: false, omzetten: false, fotoControle: false, overzicht: false };
  const [a, b, c, d] = await Promise.all([
    sb.from('variant_kleuren').select('id', { head: true, count: 'exact' }),
    sb.from('product_varianten').select('kleur_leverancier').limit(1),
    sb.from('product_foto_controle').select('id', { head: true, count: 'exact' }),
    sb.from('producten_overzicht').select('id').limit(1),
  ]);
  return { lijsten: !a.error, omzetten: !b.error, fotoControle: !c.error, overzicht: !d.error };
}

// ---------------------------------------------------------------------------
// Beheer: kleuren
// ---------------------------------------------------------------------------

type Uitkomst = { ok: true } | { ok: false; fout: string };

const HEX = /^#[0-9a-f]{6}$/i;
const schoonHex = (v: string | null | undefined, terugval: string | null) => {
  const t = String(v ?? '').trim();
  return HEX.test(t) ? t.toLowerCase() : terugval;
};

function dbFout(fout: PgFout): string {
  if (tabelOntbreekt(fout)) return 'De migratie voor vaste varianten is nog niet gedraaid.';
  if (fout?.code === '23505') return 'Die naam bestaat al.';
  return fout?.message ?? 'Opslaan is mislukt.';
}

export async function maakKleur(v: { naam: string; hex: string; hex2?: string | null; groep: string; volgorde?: number }): Promise<Uitkomst & { id?: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const naam = v.naam.trim();
  if (!naam) return { ok: false, fout: 'Vul een naam in.' };
  let volgorde = v.volgorde;
  if (volgorde == null) {
    const { data } = await sb.from('variant_kleuren').select('volgorde').order('volgorde', { ascending: false }).limit(1);
    volgorde = (((data as { volgorde: number }[] | null)?.[0]?.volgorde ?? 0) as number) + 10;
  }
  const { data, error } = await sb
    .from('variant_kleuren')
    .insert({ naam, hex: schoonHex(v.hex, '#999999'), hex2: schoonHex(v.hex2, null), groep: v.groep || 'meerkleurig', volgorde })
    .select('id')
    .single();
  if (error || !data) return { ok: false, fout: dbFout(error) };
  return { ok: true, id: (data as { id: string }).id };
}

export async function werkKleur(id: string, v: { naam?: string; hex?: string; hex2?: string | null; groep?: string; volgorde?: number; actief?: boolean }): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const rij: Record<string, unknown> = {};
  if (v.naam != null) {
    if (!v.naam.trim()) return { ok: false, fout: 'Vul een naam in.' };
    rij.naam = v.naam.trim();
  }
  if (v.hex != null) rij.hex = schoonHex(v.hex, '#999999');
  if (v.hex2 !== undefined) rij.hex2 = schoonHex(v.hex2, null);
  if (v.groep != null) rij.groep = v.groep;
  if (v.volgorde != null && Number.isFinite(v.volgorde)) rij.volgorde = Math.trunc(v.volgorde);
  if (v.actief != null) rij.actief = v.actief;
  const { error } = await sb.from('variant_kleuren').update(rij).eq('id', id);
  return error ? { ok: false, fout: dbFout(error) } : { ok: true };
}

/** Verwijdert een kleur, maar alleen als geen enkele variant hem gebruikt. Anders: op inactief zetten. */
export async function verwijderKleur(id: string): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const { data } = await sb.from('variant_kleuren').select('naam').eq('id', id).maybeSingle();
  const naam = (data as { naam: string } | null)?.naam;
  if (!naam) return { ok: false, fout: 'Kleur niet gevonden.' };
  const { count } = await sb.from('product_varianten').select('id', { count: 'exact', head: true }).eq('kleur', naam);
  if ((count ?? 0) > 0) return { ok: false, fout: `${naam} wordt nog door ${count} varianten gebruikt. Zet de kleur op inactief, of zet die varianten eerst om.` };
  const { error } = await sb.from('variant_kleuren').delete().eq('id', id);
  return error ? { ok: false, fout: dbFout(error) } : { ok: true };
}

export async function voegKleurAliasToe(kleurId: string, alias: string): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const sleutel = kleurSleutel(alias);
  if (!sleutel) return { ok: false, fout: 'Vul een alias in.' };
  const { error } = await sb.from('variant_kleur_aliassen').upsert({ sleutel, alias: alias.trim(), kleur_id: kleurId }, { onConflict: 'sleutel' });
  return error ? { ok: false, fout: dbFout(error) } : { ok: true };
}

export async function verwijderKleurAlias(sleutel: string): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const { error } = await sb.from('variant_kleur_aliassen').delete().eq('sleutel', sleutel);
  return error ? { ok: false, fout: dbFout(error) } : { ok: true };
}

// ---------------------------------------------------------------------------
// Beheer: maten en eigenschappen
// ---------------------------------------------------------------------------

export async function maakReeks(naam: string): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const t = naam.trim();
  if (!t) return { ok: false, fout: 'Vul een naam in.' };
  const { data } = await sb.from('variant_maatreeksen').select('volgorde').order('volgorde', { ascending: false }).limit(1);
  const volgorde = (((data as { volgorde: number }[] | null)?.[0]?.volgorde ?? 0) as number) + 10;
  const { error } = await sb.from('variant_maatreeksen').insert({ naam: t, volgorde });
  return error ? { ok: false, fout: dbFout(error) } : { ok: true };
}

export async function werkReeks(id: string, v: { naam?: string; volgorde?: number }): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const rij: Record<string, unknown> = {};
  if (v.naam?.trim()) rij.naam = v.naam.trim();
  if (v.volgorde != null && Number.isFinite(v.volgorde)) rij.volgorde = Math.trunc(v.volgorde);
  const { error } = await sb.from('variant_maatreeksen').update(rij).eq('id', id);
  return error ? { ok: false, fout: dbFout(error) } : { ok: true };
}

export async function verwijderReeks(id: string): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const { error } = await sb.from('variant_maatreeksen').delete().eq('id', id);
  return error ? { ok: false, fout: dbFout(error) } : { ok: true };
}

/** Voegt één of meer maten toe aan een reeks ("44, 46, 48" of "44-64" voor een even reeks). */
export async function voegMatenToe(reeksId: string, invoer: string): Promise<Uitkomst & { aantal?: number }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const maten = splitsMaten(invoer);
  if (maten.length === 0) return { ok: false, fout: 'Vul een of meer maten in.' };
  const { data, error: leesFout } = await sb.from('variant_maten').select('maat, volgorde').eq('reeks_id', reeksId);
  if (leesFout) return { ok: false, fout: dbFout(leesFout) };
  const bestaand = (data as { maat: string; volgorde: number }[] | null) ?? [];
  const al = new Set(bestaand.map((m) => m.maat.toLowerCase()));
  let volgorde = bestaand.reduce((m, r) => Math.max(m, r.volgorde ?? 0), 0);
  const rijen = maten.filter((m) => !al.has(m.toLowerCase())).map((maat) => ({ reeks_id: reeksId, maat, volgorde: (volgorde += 10) }));
  if (rijen.length === 0) return { ok: true, aantal: 0 };
  const { error } = await sb.from('variant_maten').insert(rijen);
  return error ? { ok: false, fout: dbFout(error) } : { ok: true, aantal: rijen.length };
}

/** "44-64" wordt 44, 46 … 64 (stap 2 bij even getallen), "S, M, L" wordt drie maten. */
export function splitsMaten(invoer: string): string[] {
  const uit: string[] = [];
  for (const deel of invoer.split(/[,;\n]+/)) {
    const t = deel.trim();
    if (!t) continue;
    const bereik = /^(\d{1,3})\s*-\s*(\d{1,3})(?:\s*\/\s*(\d))?$/.exec(t);
    if (bereik) {
      const van = Number(bereik[1]);
      const tot = Number(bereik[2]);
      const stap = bereik[3] ? Number(bereik[3]) : van % 2 === 0 && tot % 2 === 0 ? 2 : 1;
      if (tot >= van && (tot - van) / stap <= 200) {
        for (let n = van; n <= tot; n += stap) uit.push(String(n));
        continue;
      }
    }
    uit.push(t);
  }
  return [...new Set(uit)];
}

export async function werkMaat(id: string, v: { maat?: string; volgorde?: number }): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const rij: Record<string, unknown> = {};
  if (v.maat?.trim()) rij.maat = v.maat.trim();
  if (v.volgorde != null && Number.isFinite(v.volgorde)) rij.volgorde = Math.trunc(v.volgorde);
  const { error } = await sb.from('variant_maten').update(rij).eq('id', id);
  return error ? { ok: false, fout: dbFout(error) } : { ok: true };
}

export async function verwijderMaat(id: string): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const { error } = await sb.from('variant_maten').delete().eq('id', id);
  return error ? { ok: false, fout: dbFout(error) } : { ok: true };
}

export async function voegMaatAliasToe(alias: string, maat: string): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const sleutel = maatSleutel(alias);
  if (!sleutel || !maat.trim()) return { ok: false, fout: 'Vul alias en maat in.' };
  const { error } = await sb.from('variant_maat_aliassen').upsert({ sleutel, alias: alias.trim(), maat: maat.trim() }, { onConflict: 'sleutel' });
  return error ? { ok: false, fout: dbFout(error) } : { ok: true };
}

export async function verwijderMaatAlias(sleutel: string): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const { error } = await sb.from('variant_maat_aliassen').delete().eq('sleutel', sleutel);
  return error ? { ok: false, fout: dbFout(error) } : { ok: true };
}

export async function voegEigenschapToe(soort: 'lengte' | 'pasvorm', waarde: string): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const t = waarde.trim();
  if (!t) return { ok: false, fout: 'Vul een waarde in.' };
  const { data } = await sb.from('variant_eigenschappen').select('volgorde').eq('soort', soort).order('volgorde', { ascending: false }).limit(1);
  const volgorde = (((data as { volgorde: number }[] | null)?.[0]?.volgorde ?? 0) as number) + 10;
  const { error } = await sb.from('variant_eigenschappen').insert({ soort, waarde: t, volgorde });
  return error ? { ok: false, fout: dbFout(error) } : { ok: true };
}

export async function verwijderEigenschap(id: string): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const { error } = await sb.from('variant_eigenschappen').delete().eq('id', id);
  return error ? { ok: false, fout: dbFout(error) } : { ok: true };
}

// ---------------------------------------------------------------------------
// Opschoontool
// ---------------------------------------------------------------------------

export type VariantWaarde = { veld: 'kleur' | 'maat'; waarde: string; varianten: number; producten: number };

/**
 * Haalt een tabel in blokken van 1000 op. PostgREST geeft per verzoek hooguit
 * zoveel rijen terug als `max-rows` toestaat, en met 25.000 varianten zit je daar ver boven.
 */
export async function haalAllesOp<T>(
  maakQuery: (van: number, tot: number) => PromiseLike<{ data: unknown; error: PgFout }>,
  maxBlokken = 60,
): Promise<T[]> {
  const BLOK = 1000;
  const uit: T[] = [];
  for (let i = 0; i < maxBlokken; i += 6) {
    const blokken = await Promise.all(
      Array.from({ length: 6 }, (_, j) => maakQuery((i + j) * BLOK, (i + j + 1) * BLOK - 1)),
    );
    let klaar = false;
    for (const b of blokken) {
      if (b.error) {
        // Niet stil een halve lijst teruggeven zonder spoor: in de serverlog zetten.
        logDbFout('varianten.haalAllesOp', b.error);
        return uit;
      }
      const rijen = (b.data as T[] | null) ?? [];
      uit.push(...rijen);
      if (rijen.length < BLOK) klaar = true;
    }
    if (klaar) break;
  }
  return uit;
}

/** Alle unieke kleur- en maatwaarden met aantallen. Uit de view, of zonder migratie door alles op te halen. */
export async function variantWaarden(): Promise<VariantWaarde[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data, error } = await sb.from('variant_waarden').select('veld, waarde, varianten, producten').limit(5000);
  if (!error) return (data as VariantWaarde[] | null) ?? [];

  const rijen = await haalAllesOp<{ product_id: string; kleur: string | null; maat: string | null }>((van, tot) =>
    sb.from('product_varianten').select('product_id, kleur, maat').order('id').range(van, tot),
  );
  const tel = new Map<string, { v: number; p: Set<string> }>();
  for (const r of rijen) {
    for (const [veld, waarde] of [['kleur', r.kleur], ['maat', r.maat]] as const) {
      if (waarde == null) continue;
      const k = `${veld}\u0000${waarde}`;
      const t = tel.get(k) ?? { v: 0, p: new Set<string>() };
      t.v++;
      t.p.add(r.product_id);
      tel.set(k, t);
    }
  }
  return [...tel.entries()].map(([k, t]) => {
    const [veld, waarde] = k.split('\u0000');
    return { veld: veld as 'kleur' | 'maat', waarde, varianten: t.v, producten: t.p.size };
  });
}

export type OpschoonRij = VariantWaarde & {
  /** goed: staat al zo in de lijst. zeker: past op een standaardwaarde. nieuw: voorstel voor een nieuwe tweekleur. onbekend: zelf kiezen. */
  status: 'goed' | 'zeker' | 'nieuw' | 'onbekend';
  voorstel: string | null;
  /** Bij een nieuw kleurvoorstel: hoe die kleur aangemaakt wordt. */
  nieuweKleur?: { naam: string; hex: string; hex2: string | null; groep: KleurGroep } | null;
  reeks?: string | null;
};

/** Zet alle bestaande waarden naast de vaste lijst. */
export function beoordeelWaarden(waarden: VariantWaarde[], lijst: VariantLijsten): OpschoonRij[] {
  return waarden.map((w) => {
    if (w.veld === 'kleur') {
      const u = normaliseerKleur(w.waarde, lijst);
      if (u.zeker && u.naam) {
        return { ...w, status: u.alStandaard ? 'goed' : 'zeker', voorstel: u.naam };
      }
      if (u.nieuw && u.naam) {
        const [a, b] = u.delen;
        return {
          ...w,
          status: 'nieuw',
          voorstel: u.naam,
          nieuweKleur: { naam: u.naam, hex: a.hex, hex2: b?.hex ?? null, groep: a.groep },
        };
      }
      return { ...w, status: 'onbekend', voorstel: null };
    }
    const u = normaliseerMaat(w.waarde, lijst);
    if (u.zeker && u.naam) return { ...w, status: u.alStandaard ? 'goed' : 'zeker', voorstel: u.naam, reeks: u.reeks };
    return { ...w, status: 'onbekend', voorstel: null, reeks: null };
  });
}

export type OmzetPaar = { van: string; naar: string };
export type OmzetResultaat = { van: string; naar: string; omgezet: number; overgeslagen: number; fotos: number };

/**
 * Zet varianten om naar standaardwaarden (via de functie varianten_omzetten, in één transactie)
 * en leert de oude schrijfwijze als alias, zodat een volgende import hem herkent.
 * Nieuwe tweekleuren uit de voorstellen worden eerst aangemaakt.
 */
export async function zetVariantenOm(
  veld: 'kleur' | 'maat',
  paren: OmzetPaar[],
  opties: { leerAlias: boolean; nieuweKleuren?: { naam: string; hex: string; hex2: string | null; groep: string }[] },
): Promise<{ ok: true; resultaten: OmzetResultaat[]; nieuweKleuren: number; aliassen: number } | { ok: false; fout: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const schoon = paren
    .map((p) => ({ van: p.van, naar: p.naar.trim() }))
    .filter((p) => p.van && p.naar && p.van !== p.naar);
  if (schoon.length === 0) return { ok: false, fout: 'Niets om om te zetten.' };

  // 1. Nieuwe kleuren aanmaken (alleen die ook echt als doel gekozen zijn).
  let nieuw = 0;
  if (veld === 'kleur' && opties.nieuweKleuren?.length) {
    const doelen = new Set(schoon.map((p) => p.naar.toLowerCase()));
    const lijst = await laadVariantLijsten();
    const bestaand = new Set(lijst.bron === 'database' ? lijst.kleuren.map((k) => k.naam.toLowerCase()) : []);
    const teMaken = opties.nieuweKleuren.filter((k) => doelen.has(k.naam.toLowerCase()) && !bestaand.has(k.naam.toLowerCase()));
    const gezien = new Set<string>();
    for (const k of teMaken) {
      if (gezien.has(k.naam.toLowerCase())) continue;
      gezien.add(k.naam.toLowerCase());
      const r = await maakKleur(k);
      if (r.ok) nieuw++;
      else if (!r.fout.includes('bestaat al')) return { ok: false, fout: r.fout };
    }
  }

  // 2. Doelen moeten in de vaste lijst staan; anders vervuil je de data opnieuw.
  const lijst = await laadVariantLijsten();
  if (lijst.bron !== 'database') return { ok: false, fout: 'De migratie voor vaste varianten is nog niet gedraaid.' };
  const kleurOpNaam = new Map(lijst.kleuren.map((k) => [k.naam.toLowerCase(), k]));
  const matenSet = new Set(lijst.reeksen.flatMap((r) => r.maten.map((m) => m.maat)));
  const onbekend = schoon.filter((p) => (veld === 'kleur' ? !kleurOpNaam.has(p.naar.toLowerCase()) : !matenSet.has(p.naar)));
  if (onbekend.length) {
    return { ok: false, fout: `Deze doelwaarden staan niet in de vaste lijst: ${onbekend.slice(0, 5).map((p) => p.naar).join(', ')}. Voeg ze eerst toe.` };
  }
  // Exacte schrijfwijze uit de lijst gebruiken ("marine/zwart" wordt "Marine/zwart").
  const paarDefinitief = schoon.map((p) => (veld === 'kleur' ? { van: p.van, naar: kleurOpNaam.get(p.naar.toLowerCase())!.naam } : p));

  // 3. Aliassen leren.
  let aliassen = 0;
  if (opties.leerAlias) {
    if (veld === 'kleur') {
      const rijen = paarDefinitief
        .map((p) => ({ sleutel: kleurSleutel(p.van), alias: p.van.trim(), kleur_id: kleurOpNaam.get(p.naar.toLowerCase())!.id }))
        .filter((r) => r.sleutel && r.kleur_id && !kleurOpNaam.has(r.sleutel));
      const uniek = [...new Map(rijen.map((r) => [r.sleutel, r])).values()];
      if (uniek.length) {
        const { error } = await sb.from('variant_kleur_aliassen').upsert(uniek, { onConflict: 'sleutel' });
        if (!error) aliassen = uniek.length;
      }
    } else {
      const rijen = paarDefinitief
        .map((p) => ({ sleutel: maatSleutel(p.van), alias: p.van.trim(), maat: p.naar }))
        .filter((r) => r.sleutel && r.sleutel !== maatSleutel(r.maat));
      const uniek = [...new Map(rijen.map((r) => [r.sleutel, r])).values()];
      if (uniek.length) {
        const { error } = await sb.from('variant_maat_aliassen').upsert(uniek, { onConflict: 'sleutel' });
        if (!error) aliassen = uniek.length;
      }
    }
  }

  // 4. Omzetten in blokken van 50 paren (één transactie per blok).
  const resultaten: OmzetResultaat[] = [];
  for (let i = 0; i < paarDefinitief.length; i += 50) {
    const blok = paarDefinitief.slice(i, i + 50);
    const { data, error } = await sb.rpc('varianten_omzetten', { p_veld: veld, p_paren: blok });
    if (error) {
      if (tabelOntbreekt(error)) return { ok: false, fout: 'De functie varianten_omzetten ontbreekt: draai eerst de migratie.' };
      return { ok: false, fout: error.message };
    }
    resultaten.push(...((data as OmzetResultaat[] | null) ?? []));
  }
  return { ok: true, resultaten, nieuweKleuren: nieuw, aliassen };
}

/** Zet de volgorde van de maten in een reeks volgens de opgegeven lijst; niet genoemde maten komen achteraan. */
export async function zetMaatVolgorde(reeksId: string, maten: string[]): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const { data, error } = await sb.from('variant_maten').select('id, maat, volgorde').eq('reeks_id', reeksId);
  if (error) return { ok: false, fout: dbFout(error) };
  const rijen = (data as { id: string; maat: string; volgorde: number }[] | null) ?? [];
  const plek = new Map(maten.map((m, i) => [m.trim().toLowerCase(), i]));
  const gesorteerd = [...rijen].sort((a, b) => {
    const pa = plek.get(a.maat.toLowerCase()) ?? 10_000 + a.volgorde;
    const pb = plek.get(b.maat.toLowerCase()) ?? 10_000 + b.volgorde;
    return pa - pb;
  });
  for (let i = 0; i < gesorteerd.length; i++) {
    const nieuw = (i + 1) * 10;
    if (gesorteerd[i].volgorde === nieuw) continue;
    const { error: e } = await sb.from('variant_maten').update({ volgorde: nieuw }).eq('id', gesorteerd[i].id);
    if (e) return { ok: false, fout: dbFout(e) };
  }
  return { ok: true };
}
