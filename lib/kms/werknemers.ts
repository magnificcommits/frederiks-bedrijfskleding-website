import type { SupabaseClient } from '@supabase/supabase-js';
import { kmsAdmin } from '@/lib/kms/adminClient';
import {
  haalAlles,
  inStukken,
  kleurenPerArtikel,
  listKaleRegels,
  regelGeldtVoor,
  zelfdeKleur,
} from '@/lib/kms/assortiment';

/**
 * Werknemers van een klant (tabel `medewerkers`), beheerd vanaf de klantpagina.
 * Plus alles voor de pasdag: per werknemer de artikelen uit zijn assortiment met
 * de maten in de vaste assortimentkleur, en de maten die al genoteerd zijn.
 *
 * Alle queries via kmsAdmin() (service-role). Alleen server-side gebruiken,
 * altijd achter dashAuthed().
 */

export type Werknemer = {
  id: string;
  organisatie_id: string;
  /** Naam zoals Jessi hem leest: de kolom naam, anders voornaam + achternaam. */
  naam: string;
  email: string | null;
  telefoon: string | null;
  personeelsnummer: string | null;
  afdeling_id: string | null;
  vestiging_id: string | null;
  actief: boolean;
  opmerkingen: string | null;
};

export type WerknemerVelden = {
  naam: string;
  /** Optioneel los bewaren (bijv. vanuit de wizard of een Excel-lijst). De kolom naam blijft leidend. */
  voornaam?: string | null;
  achternaam?: string | null;
  email?: string | null;
  telefoon?: string | null;
  personeelsnummer?: string | null;
  afdeling_id?: string | null;
  vestiging_id?: string | null;
  opmerkingen?: string | null;
};

type MedewerkerRij = {
  id: string;
  organisatie_id: string;
  naam: string | null;
  voornaam: string | null;
  tussenvoegsel: string | null;
  achternaam: string | null;
  email: string | null;
  telefoon: string | null;
  personeelsnummer: string | null;
  afdeling_id: string | null;
  vestiging_id: string | null;
  actief: boolean | null;
  opmerkingen: string | null;
};

const KOLOMMEN =
  'id, organisatie_id, naam, voornaam, tussenvoegsel, achternaam, email, telefoon, personeelsnummer, afdeling_id, vestiging_id, actief, opmerkingen';

function toonNaam(r: Pick<MedewerkerRij, 'naam' | 'voornaam' | 'tussenvoegsel' | 'achternaam'>): string {
  const uitDelen = [r.voornaam, r.tussenvoegsel, r.achternaam]
    .map((d) => (d ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return r.naam?.trim() || uitDelen || 'Naamloze werknemer';
}

function naarWerknemer(r: MedewerkerRij): Werknemer {
  return {
    id: r.id,
    organisatie_id: r.organisatie_id,
    naam: toonNaam(r),
    email: r.email,
    telefoon: r.telefoon,
    personeelsnummer: r.personeelsnummer,
    afdeling_id: r.afdeling_id,
    vestiging_id: r.vestiging_id,
    // Alleen een expliciete false is non-actief; oudere rijen hebben soms null.
    actief: r.actief !== false,
    opmerkingen: r.opmerkingen,
  };
}

/** Alle werknemers van een klant, actieve eerst, daarna op naam. */
export async function listWerknemers(orgId: string): Promise<Werknemer[]> {
  const sb = kmsAdmin();
  if (!sb || !orgId) return [];
  const rijen = await haalAlles<MedewerkerRij>((van, tot) =>
    sb.from('medewerkers').select(KOLOMMEN).eq('organisatie_id', orgId).order('id').range(van, tot),
  );
  return rijen
    .map(naarWerknemer)
    .sort((a, b) => Number(b.actief) - Number(a.actief) || a.naam.localeCompare(b.naam, 'nl'));
}

export async function getWerknemer(id: string): Promise<Werknemer | null> {
  const sb = kmsAdmin();
  if (!sb || !id) return null;
  const { data } = await sb.from('medewerkers').select(KOLOMMEN).eq('id', id).maybeSingle();
  return data ? naarWerknemer(data as MedewerkerRij) : null;
}

/** Nieuwe werknemer. Geeft het id terug, of null als het niet lukte. */
export async function maakWerknemer(orgId: string, v: WerknemerVelden): Promise<string | null> {
  const sb = kmsAdmin();
  if (!sb || !orgId || !v.naam.trim()) return null;
  const { data, error } = await sb.from('medewerkers').insert(nieuweRij(orgId, v)).select('id').single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/** De rij voor een nieuwe werknemer. Lege velden weglaten: dan blijft de standaard van de database staan. */
function nieuweRij(orgId: string, v: WerknemerVelden): Record<string, unknown> {
  const rij: Record<string, unknown> = { organisatie_id: orgId, naam: v.naam.trim(), actief: true };
  if (v.voornaam?.trim()) rij.voornaam = v.voornaam.trim();
  if (v.achternaam?.trim()) rij.achternaam = v.achternaam.trim();
  if (v.email) rij.email = v.email;
  if (v.telefoon) rij.telefoon = v.telefoon;
  if (v.personeelsnummer) rij.personeelsnummer = v.personeelsnummer;
  if (v.afdeling_id) rij.afdeling_id = v.afdeling_id;
  if (v.vestiging_id) rij.vestiging_id = v.vestiging_id;
  if (v.opmerkingen) rij.opmerkingen = v.opmerkingen;
  return rij;
}

/**
 * Meerdere werknemers in één keer aanmaken (wizard, plakken uit Excel). Eén
 * verzoek per 200 rijen in plaats van één per werknemer. Geeft de nieuwe ids
 * met naam terug; lukt een blok niet, dan ontbreken die in de uitkomst.
 */
export async function maakWerknemers(
  orgId: string,
  lijst: WerknemerVelden[],
): Promise<{ id: string; naam: string }[]> {
  const sb = kmsAdmin();
  if (!sb || !orgId) return [];
  const rijen = lijst.filter((v) => v.naam.trim()).map((v) => nieuweRij(orgId, v));
  const uit: { id: string; naam: string }[] = [];
  for (const stuk of inStukken(rijen, 200)) {
    const { data, error } = await sb.from('medewerkers').insert(stuk).select('id, naam');
    if (error || !data) continue;
    uit.push(...(data as { id: string; naam: string }[]));
  }
  return uit;
}

/**
 * Werknemer bijwerken. Alleen velden die meegegeven zijn en echt veranderen gaan
 * naar de database. Geeft voor/na terug voor het logboek.
 */
export async function werkWerknemerBij(
  id: string,
  v: Partial<WerknemerVelden> & { actief?: boolean },
): Promise<{ ok: boolean; voor: Record<string, unknown>; na: Record<string, unknown> }> {
  const sb = kmsAdmin();
  if (!sb || !id) return { ok: false, voor: {}, na: {} };
  const { data } = await sb.from('medewerkers').select(KOLOMMEN).eq('id', id).maybeSingle();
  const huidig = data as MedewerkerRij | null;
  if (!huidig) return { ok: false, voor: {}, na: {} };

  const gewenst: Record<string, unknown> = {};
  if (v.naam !== undefined && v.naam.trim()) gewenst.naam = v.naam.trim();
  if (v.email !== undefined) gewenst.email = v.email || null;
  if (v.telefoon !== undefined) gewenst.telefoon = v.telefoon || null;
  if (v.personeelsnummer !== undefined) gewenst.personeelsnummer = v.personeelsnummer || null;
  if (v.afdeling_id !== undefined) gewenst.afdeling_id = v.afdeling_id || null;
  if (v.vestiging_id !== undefined) gewenst.vestiging_id = v.vestiging_id || null;
  if (v.opmerkingen !== undefined) gewenst.opmerkingen = v.opmerkingen || null;
  if (v.actief !== undefined) gewenst.actief = v.actief;

  const voor: Record<string, unknown> = {};
  const na: Record<string, unknown> = {};
  const huidigRecord = huidig as unknown as Record<string, unknown>;
  for (const [sleutel, waarde] of Object.entries(gewenst)) {
    const oud = huidigRecord[sleutel] ?? null;
    if (oud !== (waarde ?? null)) {
      voor[sleutel] = oud;
      na[sleutel] = waarde;
    }
  }
  if (Object.keys(na).length === 0) return { ok: true, voor, na };
  const { error } = await sb.from('medewerkers').update(na).eq('id', id);
  return { ok: !error, voor, na };
}

/**
 * Een contactpersoon omzetten naar werknemer: maakt een werknemer met dezelfde
 * naam, e-mail en telefoon. Bestaat er bij deze klant al een werknemer met
 * hetzelfde e-mailadres (of zonder e-mail: dezelfde naam), dan wordt die
 * teruggegeven in plaats van een dubbele aan te maken.
 */
export async function werknemerVanContact(
  contactId: string,
): Promise<{ id: string; naam: string; organisatie_id: string; bestond: boolean } | null> {
  const sb = kmsAdmin();
  if (!sb || !contactId) return null;
  const { data: contactData } = await sb
    .from('contactpersonen')
    .select('id, organisatie_id, naam, email, telefoon, mobiel')
    .eq('id', contactId)
    .maybeSingle();
  const contact = contactData as {
    id: string;
    organisatie_id: string;
    naam: string | null;
    email: string | null;
    telefoon: string | null;
    mobiel: string | null;
  } | null;
  if (!contact || !contact.organisatie_id) return null;

  const naam = contact.naam?.trim() || 'Naamloze werknemer';
  const email = contact.email?.trim() || null;
  const bestaande = await listWerknemers(contact.organisatie_id);
  const zelfde = bestaande.find((w) =>
    email ? (w.email ?? '').trim().toLowerCase() === email.toLowerCase() : w.naam.toLowerCase() === naam.toLowerCase(),
  );
  if (zelfde) {
    // Stond hij op non-actief, dan zetten we hem weer aan: Jessi wil hem gebruiken.
    if (!zelfde.actief) await sb.from('medewerkers').update({ actief: true }).eq('id', zelfde.id);
    return { id: zelfde.id, naam: zelfde.naam, organisatie_id: contact.organisatie_id, bestond: true };
  }

  const id = await maakWerknemer(contact.organisatie_id, {
    naam,
    email,
    telefoon: contact.mobiel?.trim() || contact.telefoon?.trim() || null,
  });
  if (!id) return null;
  return { id, naam, organisatie_id: contact.organisatie_id, bestond: false };
}

/* ------------------------------------------------------------------------- */
/* Pasdag: maten per werknemer per assortimentartikel.                        */
/* ------------------------------------------------------------------------- */

/** Eén artikel zoals de pasdag het toont: in de vaste kleur, met de maten daarin. */
export type PasArtikel = {
  /** product_id + kleur, uniek binnen de pasdag. */
  sleutel: string;
  product_id: string;
  naam: string;
  merk: string | null;
  kleur: string | null;
  afbeelding: string | null;
  maten: string[];
  /** Lengtes voor maatwerk (bijv. broeken), als het merk die kent. */
  lengtes: number[];
  maatwerk_lengte: boolean;
};

export type GenoteerdeMaat = {
  maat: string | null;
  lengte: number | null;
  opmerking: string | null;
  kleur: string | null;
  bijgewerkt_op: string | null;
};

export type PasdagGegevens = {
  artikelen: Record<string, PasArtikel>;
  /** Per werknemer de sleutels van zijn artikelen, in vaste volgorde. */
  perWerknemer: Record<string, string[]>;
  /** Per werknemer per product_id wat al genoteerd is. */
  maten: Record<string, Record<string, GenoteerdeMaat>>;
};

const MAATVOLGORDE = ['XXXS', '3XS', 'XXS', '2XS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', 'XXXXL', '5XL', '6XL', '7XL', '8XL'];

/** Maten in de volgorde waarin je ze op een etiket verwacht: XS, S, M, L ... en 44, 46, 48. */
export function sorteerMaten(maten: string[]): string[] {
  const rang = (m: string) => {
    const i = MAATVOLGORDE.indexOf(m.trim().toUpperCase());
    return i === -1 ? null : i;
  };
  return [...maten].sort((a, b) => {
    const ra = rang(a);
    const rb = rang(b);
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return a.localeCompare(b, 'nl', { numeric: true });
  });
}

type VariantMaatRij = { product_id: string; maat: string | null; kleur: string | null; actief: boolean | null };

async function haalVariantMaten(sb: SupabaseClient, productIds: string[]): Promise<VariantMaatRij[]> {
  const uit: VariantMaatRij[] = [];
  for (const stuk of inStukken(productIds)) {
    uit.push(
      ...(await haalAlles<VariantMaatRij>((van, tot) =>
        sb
          .from('product_varianten')
          .select('product_id, maat, kleur, actief')
          .in('product_id', stuk)
          .order('id')
          .range(van, tot),
      )),
    );
  }
  return uit;
}

/**
 * Alles voor de pasdag van één klant, in één keer: welke artikelen elke
 * werknemer krijgt (hele klant + zijn afdeling + specifiek voor hem), de maten
 * van dat artikel in de vaste assortimentkleur, en wat al genoteerd is.
 *
 * Staat hetzelfde artikel voor één werknemer in meerdere kleuren klaar, dan wint
 * de meest specifieke regel (voor hem persoonlijk, dan zijn afdeling, dan de hele
 * klant): de maat wordt per werknemer per artikel één keer bewaard.
 */
export async function pasdagGegevens(orgId: string, werknemers: Werknemer[]): Promise<PasdagGegevens> {
  const leeg: PasdagGegevens = { artikelen: {}, perWerknemer: {}, maten: {} };
  const sb = kmsAdmin();
  if (!sb || !orgId) return leeg;

  const regels = (await listKaleRegels(orgId)).filter((r) => r.toegestaan);
  const productIds = [...new Set(regels.map((r) => r.product_id))];
  const werknemerIds = werknemers.map((w) => w.id);

  type ProductRij = {
    id: string;
    naam: string | null;
    merk: string | null;
    afbeeldingen: string[] | null;
    maatwerk_lengte: boolean | null;
    actief: boolean | null;
  };
  const producten: ProductRij[] = [];
  for (const stuk of inStukken(productIds)) {
    const { data } = await sb
      .from('producten')
      .select('id, naam, merk, afbeeldingen, maatwerk_lengte, actief')
      .in('id', stuk);
    producten.push(...((data as ProductRij[]) ?? []));
  }
  const productVan = new Map(producten.map((p) => [p.id, p]));
  const hoofdfoto = new Map(producten.map((p) => [p.id, (p.afbeeldingen ?? [])[0] ?? null]));

  type MaatRij = {
    medewerker_id: string;
    product_id: string;
    voorkeursmaat: string | null;
    lengte: number | null;
    opmerking: string | null;
    kleur: string | null;
    bijgewerkt_op: string | null;
  };
  const [kleuren, varianten, maatRijen] = await Promise.all([
    kleurenPerArtikel(sb, productIds, hoofdfoto),
    haalVariantMaten(sb, productIds),
    (async () => {
      const uit: MaatRij[] = [];
      for (const stuk of inStukken(werknemerIds)) {
        uit.push(
          ...(await haalAlles<MaatRij>((van, tot) =>
            sb
              .from('medewerker_maten')
              .select('medewerker_id, product_id, voorkeursmaat, lengte, opmerking, kleur, bijgewerkt_op')
              .in('medewerker_id', stuk)
              .order('medewerker_id')
              .order('product_id')
              .range(van, tot),
          )),
        );
      }
      return uit;
    })(),
  ]);

  // Maatwerklengtes per merk, alleen voor artikelen die dat kennen.
  const merkenMetLengte = [
    ...new Set(producten.filter((p) => p.maatwerk_lengte && p.merk).map((p) => p.merk as string)),
  ];
  const lengtesPerMerk = new Map<string, number[]>();
  if (merkenMetLengte.length > 0) {
    const { data } = await sb.from('maatwerk_lengtes').select('merk, lengte').in('merk', merkenMetLengte);
    for (const r of (data as { merk: string; lengte: number }[]) ?? []) {
      const lijst = lengtesPerMerk.get(r.merk) ?? [];
      if (!lijst.includes(r.lengte)) lijst.push(r.lengte);
      lengtesPerMerk.set(r.merk, lijst);
    }
    for (const lijst of lengtesPerMerk.values()) lijst.sort((a, b) => a - b);
  }

  const artikelen: Record<string, PasArtikel> = {};
  function artikelVoor(productId: string, kleur: string | null): string | null {
    const p = productVan.get(productId);
    if (!p || p.actief === false) return null;
    const sleutel = `${productId}|${(kleur ?? '').toLowerCase()}`;
    if (artikelen[sleutel]) return sleutel;
    const actieveVarianten = varianten.filter((v) => v.product_id === productId && v.actief !== false);
    const inKleur = kleur ? actieveVarianten.filter((v) => zelfdeKleur(v.kleur, kleur)) : [];
    const bron = inKleur.length > 0 ? inKleur : actieveVarianten;
    const maten = sorteerMaten([
      ...new Set(bron.map((v) => (v.maat ?? '').trim()).filter((m) => m.length > 0)),
    ]);
    const kleurFoto = kleur ? (kleuren.get(productId) ?? []).find((k) => zelfdeKleur(k.kleur, kleur))?.afbeelding : null;
    artikelen[sleutel] = {
      sleutel,
      product_id: productId,
      naam: p.naam?.trim() || 'Naamloos',
      merk: p.merk,
      kleur,
      afbeelding: kleurFoto ?? hoofdfoto.get(productId) ?? null,
      maten,
      lengtes: p.maatwerk_lengte && p.merk ? lengtesPerMerk.get(p.merk) ?? [] : [],
      maatwerk_lengte: Boolean(p.maatwerk_lengte),
    };
    return sleutel;
  }

  const specificiteit = (r: { afdeling_id: string | null; medewerker_id: string | null }) =>
    r.medewerker_id ? 2 : r.afdeling_id ? 1 : 0;

  const perWerknemer: Record<string, string[]> = {};
  for (const w of werknemers) {
    const geldend = regels
      .filter((r) => regelGeldtVoor(r, w))
      .sort((a, b) => specificiteit(b) - specificiteit(a));
    const gezien = new Set<string>();
    const sleutels: string[] = [];
    for (const r of geldend) {
      if (gezien.has(r.product_id)) continue;
      gezien.add(r.product_id);
      const sleutel = artikelVoor(r.product_id, r.kleur);
      if (sleutel) sleutels.push(sleutel);
    }
    sleutels.sort((a, b) => {
      const x = artikelen[a];
      const y = artikelen[b];
      return (x.merk ?? '').localeCompare(y.merk ?? '', 'nl') || x.naam.localeCompare(y.naam, 'nl');
    });
    perWerknemer[w.id] = sleutels;
  }

  const maten: PasdagGegevens['maten'] = {};
  for (const m of maatRijen) {
    (maten[m.medewerker_id] ??= {})[m.product_id] = {
      maat: m.voorkeursmaat,
      lengte: m.lengte,
      opmerking: m.opmerking,
      kleur: m.kleur,
      bijgewerkt_op: m.bijgewerkt_op,
    };
  }

  return { artikelen, perWerknemer, maten };
}

export type MaatInvoer = {
  product_id: string;
  kleur: string | null;
  maat: string | null;
  lengte: number | null;
  opmerking: string | null;
};

/**
 * Maten van één werknemer opslaan. Ingevulde regels gaan als upsert op
 * (medewerker_id, product_id); een regel die helemaal leeg is gemaakt wordt
 * verwijderd, zodat er geen lege maten blijven hangen.
 */
export async function slaMatenOp(
  medewerkerId: string,
  regels: MaatInvoer[],
): Promise<{ ok: boolean; opgeslagen: number; gewist: number }> {
  const sb = kmsAdmin();
  if (!sb || !medewerkerId) return { ok: false, opgeslagen: 0, gewist: 0 };
  const nu = new Date().toISOString();
  const invullen = regels.filter((r) => r.maat || r.lengte != null || r.opmerking);
  const wissen = regels.filter((r) => !r.maat && r.lengte == null && !r.opmerking).map((r) => r.product_id);

  let ok = true;
  if (invullen.length > 0) {
    // Nieuwe regels krijgen expliciet plus_minus_toegestaan = false (de kolom kan
    // NOT NULL zonder default zijn); bestaande regels houden hun eigen waarde.
    const { data: bestaand } = await sb
      .from('medewerker_maten')
      .select('product_id')
      .eq('medewerker_id', medewerkerId)
      .in('product_id', invullen.map((r) => r.product_id));
    const bestaat = new Set(((bestaand as { product_id: string }[] | null) ?? []).map((r) => r.product_id));
    const rij = (r: MaatInvoer) => ({
      medewerker_id: medewerkerId,
      product_id: r.product_id,
      voorkeursmaat: r.maat || null,
      kleur: r.kleur || null,
      lengte: r.lengte,
      opmerking: r.opmerking || null,
      bijgewerkt_op: nu,
    });
    const oud = invullen.filter((r) => bestaat.has(r.product_id)).map(rij);
    const nieuw = invullen
      .filter((r) => !bestaat.has(r.product_id))
      .map((r) => ({ ...rij(r), plus_minus_toegestaan: false }));
    for (const lijst of [oud, nieuw]) {
      if (lijst.length === 0) continue;
      const { error } = await sb.from('medewerker_maten').upsert(lijst, { onConflict: 'medewerker_id,product_id' });
      if (error) ok = false;
    }
  }
  if (wissen.length > 0) {
    const { error } = await sb
      .from('medewerker_maten')
      .delete()
      .eq('medewerker_id', medewerkerId)
      .in('product_id', wissen);
    if (error) ok = false;
  }
  return { ok, opgeslagen: invullen.length, gewist: wissen.length };
}
