import { kmsAdmin } from '@/lib/kms/adminClient';
import { maakOrder, voegOrderregelToe, type OrderregelVelden } from '@/lib/kms/orders';

/**
 * Data-access voor de module Offertes. Offertes met regels, status en een
 * afdrukbare (print-naar-PDF) weergave.
 *
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side
 * gebruiken, altijd achter dashAuthed().
 */

export const OFFERTE_STATUSSEN = ['concept', 'verstuurd', 'geaccepteerd', 'afgewezen'] as const;
export type OfferteStatus = (typeof OFFERTE_STATUSSEN)[number];

export type Offerte = {
  id: string;
  offertenummer: number | null;
  organisatie_id: string | null;
  lead_id: string | null;
  contactpersoon: string | null;
  status: string;
  geldig_tot: string | null;
  notitie: string | null;
  btw_pct: number | null;
  created_at: string;
};

export type Offerteregel = {
  id: string;
  offerte_id: string;
  omschrijving: string | null;
  aantal: number | null;
  stukprijs: number | null;
  korting_pct: number | null;
  inkoop: number | null;
  /** Gekoppeld artikel; leeg bij een vrije regel en bij oudere regels. */
  product_id: string | null;
  /** De ene gekozen kleur van het artikel. */
  kleur: string | null;
  /** Optioneel: de gekozen maat. Leeg betekent "maten volgen nog". */
  maat: string | null;
  lengte: number | null;
  positie: number | null;
  created_at: string;
};

/** Regel zoals de offertepagina en de afdruk hem tonen: met foto in de gekozen kleur. */
export type OfferteregelMetFoto = Offerteregel & { afbeelding: string | null };

export type OfferteMetKlant = Offerte & { organisatie_naam: string | null };
export type OfferteMetTotaal = OfferteMetKlant & { totaal: number };
export type OfferteDetail = Offerte & {
  organisatie_naam: string | null;
  /** Beste adres om de offerte naartoe te mailen (contactpersoon eerst). */
  organisatie_email: string | null;
  regels: OfferteregelMetFoto[];
};

export type OfferteVelden = {
  organisatie_id?: string | null;
  contactpersoon?: string | null;
  geldig_tot?: string | null;
  notitie?: string | null;
  btw_pct?: number | null;
};

export type RegelVelden = {
  omschrijving: string;
  aantal?: number;
  stukprijs?: number;
  korting_pct?: number;
  inkoop?: number | null;
  product_id?: string | null;
  kleur?: string | null;
  maat?: string | null;
};

/** Kleurnamen komen uit importbestanden: "Zwart", "zwart " en "ZWART" zijn hetzelfde. */
const kleurSleutel = (kleur: string | null | undefined) => (kleur ?? '').trim().toLowerCase();

/**
 * Omschrijving van een artikelregel: merk + naam + gekozen kleur (+ maat).
 * Bewust niet alle kleuren en maten van het artikel, alleen wat de klant krijgt.
 */
export function regelOmschrijving(p: { merk: string | null; naam: string }, kleur: string | null, maat: string | null): string {
  const naam = p.merk && !p.naam.toLowerCase().startsWith(p.merk.toLowerCase()) ? `${p.merk} ${p.naam}` : p.naam;
  const delen = [naam];
  if (kleur && kleur.trim()) delen.push(kleur.trim());
  if (maat && maat.trim()) delen.push(`maat ${maat.trim()}`);
  return delen.join(', ');
}

/**
 * Totalen voor een set regels: subtotaal (na regelkorting, excl. btw), het kortingsbedrag,
 * btw, totaal, en de marge (subtotaal min inkoopkosten, voor regels met een inkoopprijs).
 */
export function offerteTotalen(
  regels: { aantal: number | null; stukprijs: number | null; korting_pct?: number | null; inkoop?: number | null }[],
  btwPct: number | null | undefined,
): { subtotaal: number; korting: number; btw: number; totaal: number; marge: number } {
  let bruto = 0;
  let netto = 0;
  let kostprijs = 0;
  for (const r of regels) {
    const aantal = Number(r.aantal) || 0;
    const stuk = Number(r.stukprijs) || 0;
    const kort = Number(r.korting_pct) || 0;
    const regelBruto = aantal * stuk;
    bruto += regelBruto;
    netto += regelBruto * (1 - kort / 100);
    if (r.inkoop != null && Number.isFinite(Number(r.inkoop))) kostprijs += aantal * Number(r.inkoop);
  }
  const pct = Number(btwPct);
  const btw = netto * (Number.isFinite(pct) ? pct : 0) / 100;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    subtotaal: r2(netto),
    korting: r2(bruto - netto),
    btw: r2(btw),
    totaal: r2(netto + btw),
    marge: r2(netto - kostprijs),
  };
}

export async function listOffertes(statusFilter?: string): Promise<OfferteMetKlant[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  let q = sb
    .from('offertes')
    .select('*, organisaties(naam)')
    .order('created_at', { ascending: false });
  if (statusFilter && statusFilter.trim()) q = q.eq('status', statusFilter.trim());
  const { data } = await q;
  const rows = (data as unknown as (Offerte & { organisaties: { naam: string } | null })[]) ?? [];
  return rows.map((r) => {
    const { organisaties, ...rest } = r;
    return { ...rest, organisatie_naam: organisaties?.naam ?? null } as OfferteMetKlant;
  });
}

/**
 * Eén pagina offertes (nieuwste eerst) met optioneel statusfilter, plus het totaal aantal rijen
 * voor paginering. Het bedrag per offerte wordt zonder N+1 berekend: van alle offertes op de pagina
 * halen we de regels in één extra query op (`.in('offerte_id', ids)`) en sommeren we in geheugen.
 */
export async function listOffertesPaged(opts: {
  pagina: number;
  perPagina: number;
  status?: string;
  zoek?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
}): Promise<{ rijen: OfferteMetTotaal[]; totaal: number }> {
  const sb = kmsAdmin(); if (!sb) return { rijen: [], totaal: 0 };
  const pagina = Math.max(1, opts.pagina);
  const from = (pagina - 1) * opts.perPagina;
  const to = from + opts.perPagina - 1;
  // Alleen sorteren op echte DB-kolommen. Het totaalbedrag wordt in geheugen berekend, dus dat staat hier bewust niet bij.
  const sorteerbaar = ['offertenummer', 'created_at', 'status', 'geldig_tot'];
  const kolom = opts.sort && sorteerbaar.includes(opts.sort) ? opts.sort : 'created_at';
  const oplopend = opts.dir === 'asc' ? true : false;
  let q = sb
    .from('offertes')
    .select('*, organisaties(naam)', { count: 'exact' })
    .order(kolom, { ascending: oplopend });
  if (opts.status && opts.status.trim()) q = q.eq('status', opts.status.trim());
  // Zoeken op klantnaam of offertenummer. De klant zit in een join, en PostgREST
  // kan daar niet zonder meer op filteren; daarom eerst de organisatie-ids ophalen.
  if (opts.zoek && opts.zoek.trim()) {
    const term = opts.zoek.trim().replace(/[%,()]/g, ' ');
    const { data: orgRijen } = await sb.from('organisaties').select('id').ilike('naam', `%${term}%`);
    const orgIds = ((orgRijen as { id: string }[]) ?? []).map((o) => o.id);
    const delen: string[] = [];
    if (orgIds.length) delen.push(`organisatie_id.in.(${orgIds.join(',')})`);
    if (/^\d+$/.test(term)) delen.push(`offertenummer.eq.${Number(term)}`);
    q = delen.length ? q.or(delen.join(',')) : q.eq('id', '00000000-0000-0000-0000-000000000000');
  }

  const { data, count } = await q.range(from, to);
  const rows = (data as unknown as (Offerte & { organisaties: { naam: string } | null })[]) ?? [];

  // Regels van alle offertes op deze pagina in één query; daarna per offerte in geheugen sommeren.
  const ids = rows.map((r) => r.id);
  const totaalPerOfferte = new Map<string, number>();
  if (ids.length > 0) {
    const { data: regelData } = await sb
      .from('offerteregels')
      .select('offerte_id, aantal, stukprijs, korting_pct')
      .in('offerte_id', ids);
    const regels = (regelData as { offerte_id: string; aantal: number | null; stukprijs: number | null; korting_pct: number | null }[]) ?? [];
    const subtotaalPer = new Map<string, number>();
    for (const r of regels) {
      const kort = Number(r.korting_pct) || 0;
      const sub = (Number(r.aantal) || 0) * (Number(r.stukprijs) || 0) * (1 - kort / 100);
      subtotaalPer.set(r.offerte_id, (subtotaalPer.get(r.offerte_id) ?? 0) + sub);
    }
    for (const o of rows) {
      const subtotaal = subtotaalPer.get(o.id) ?? 0;
      const pct = Number(o.btw_pct);
      const btw = subtotaal * (Number.isFinite(pct) ? pct : 0) / 100;
      totaalPerOfferte.set(o.id, Math.round((subtotaal + btw) * 100) / 100);
    }
  }

  const rijen = rows.map((r) => {
    const { organisaties, ...rest } = r;
    return {
      ...rest,
      organisatie_naam: organisaties?.naam ?? null,
      totaal: totaalPerOfferte.get(r.id) ?? 0,
    } as OfferteMetTotaal;
  });
  return { rijen, totaal: count ?? 0 };
}

/**
 * Foto per offerteregel: eerst de foto van de gekozen kleur, anders de eerste
 * productafbeelding. Twee queries voor de hele offerte, niet één per regel.
 */
async function fotoPerRegel(regels: Offerteregel[]): Promise<Map<string, string>> {
  const kaart = new Map<string, string>();
  const sb = kmsAdmin();
  const productIds = Array.from(new Set(regels.map((r) => r.product_id).filter((p): p is string => !!p)));
  if (!sb || productIds.length === 0) return kaart;
  const [{ data: prodData }, { data: kleurData }] = await Promise.all([
    sb.from('producten').select('id, afbeeldingen').in('id', productIds),
    sb.from('product_kleur_afbeeldingen').select('product_id, kleur, afbeelding_url').in('product_id', productIds),
  ]);
  const eersteFoto = new Map<string, string>();
  for (const p of (prodData as { id: string; afbeeldingen: string[] | null }[]) ?? []) {
    const eerste = (p.afbeeldingen ?? [])[0];
    if (eerste) eersteFoto.set(p.id, eerste);
  }
  const kleurFoto = new Map<string, string>();
  for (const k of (kleurData as { product_id: string; kleur: string | null; afbeelding_url: string | null }[]) ?? []) {
    if (k.afbeelding_url) kleurFoto.set(`${k.product_id}|${kleurSleutel(k.kleur)}`, k.afbeelding_url);
  }
  for (const r of regels) {
    if (!r.product_id) continue;
    const foto = kleurFoto.get(`${r.product_id}|${kleurSleutel(r.kleur)}`) ?? eersteFoto.get(r.product_id);
    if (foto) kaart.set(r.id, foto);
  }
  return kaart;
}

export async function getOfferte(id: string): Promise<OfferteDetail | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data } = await sb
    .from('offertes')
    .select('*, organisaties(naam, email_algemeen, factuur_email)')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const rij = data as unknown as Offerte & { organisaties: { naam: string; email_algemeen: string | null; factuur_email: string | null } | null };
  const { organisaties, ...rest } = rij;
  const { data: regelData } = await sb
    .from('offerteregels')
    .select('*')
    .eq('offerte_id', id)
    .order('positie', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  const regels = (regelData as Offerteregel[]) ?? [];
  const fotos = await fotoPerRegel(regels);

  // Mailadres: van de gekozen contactpersoon als die er een heeft, anders het
  // algemene adres van de klant. Een offerte gaat naar de inkoper, niet naar de boekhouding.
  let contactEmail: string | null = null;
  if (rest.organisatie_id && rest.contactpersoon?.trim()) {
    const { data: cp } = await sb
      .from('contactpersonen')
      .select('naam, email')
      .eq('organisatie_id', rest.organisatie_id);
    const gezocht = rest.contactpersoon.trim().toLowerCase();
    const match = ((cp as { naam: string | null; email: string | null }[]) ?? []).find(
      (c) => (c.naam ?? '').trim().toLowerCase() === gezocht && (c.email ?? '').trim(),
    );
    contactEmail = match?.email?.trim() || null;
  }

  return {
    ...(rest as Offerte),
    organisatie_naam: organisaties?.naam ?? null,
    organisatie_email: contactEmail || organisaties?.email_algemeen?.trim() || organisaties?.factuur_email?.trim() || null,
    regels: regels.map((r) => ({ ...r, afbeelding: fotos.get(r.id) ?? null })),
  };
}

export type OfferteContact = { id: string; naam: string; functie: string | null; email: string | null; hoofdcontact: boolean };

/** Contactpersonen van een klant voor de kiezer op de offerte (hoofdcontact eerst). */
export async function listContactenVoorOfferte(orgId: string): Promise<OfferteContact[]> {
  const sb = kmsAdmin(); if (!sb || !orgId) return [];
  const { data } = await sb
    .from('contactpersonen')
    .select('id, naam, functie, email, hoofdcontact')
    .eq('organisatie_id', orgId)
    .order('hoofdcontact', { ascending: false })
    .order('naam');
  return ((data as { id: string; naam: string | null; functie: string | null; email: string | null; hoofdcontact: boolean | null }[]) ?? [])
    .filter((c) => (c.naam ?? '').trim())
    .map((c) => ({ id: c.id, naam: (c.naam ?? '').trim(), functie: c.functie, email: c.email, hoofdcontact: !!c.hoofdcontact }));
}

export type OfferteKlant = { id: string; naam: string; plaats: string | null; klantnummer: string | null };

/** Alle klanten voor de zoekbare klantkiezer (naam, plaats en klantnummer). */
export async function listKlantenVoorOfferte(): Promise<OfferteKlant[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('organisaties').select('id, naam, plaats, klantnummer').order('naam').limit(5000);
  return ((data as { id: string; naam: string | null; plaats: string | null; klantnummer: string | null }[]) ?? []).map((k) => ({
    id: k.id,
    naam: k.naam ?? 'Zonder naam',
    plaats: k.plaats,
    klantnummer: k.klantnummer,
  }));
}

export async function maakOfferte(v: OfferteVelden): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const btw = v.btw_pct == null ? 21 : Number(v.btw_pct);
  const { data, error } = await sb
    .from('offertes')
    .insert({
      organisatie_id: v.organisatie_id || null,
      contactpersoon: v.contactpersoon?.trim() || null,
      geldig_tot: v.geldig_tot || null,
      notitie: v.notitie?.trim() || null,
      btw_pct: Number.isFinite(btw) ? btw : 21,
      status: 'concept',
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function werkOfferte(id: string, v: OfferteVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const patch: Record<string, unknown> = {};
  if ('organisatie_id' in v) patch.organisatie_id = v.organisatie_id || null;
  if ('contactpersoon' in v) patch.contactpersoon = v.contactpersoon?.trim() || null;
  if ('geldig_tot' in v) patch.geldig_tot = v.geldig_tot || null;
  if ('notitie' in v) patch.notitie = v.notitie?.trim() || null;
  if ('btw_pct' in v) {
    const btw = Number(v.btw_pct);
    patch.btw_pct = Number.isFinite(btw) ? btw : 21;
  }
  const { error } = await sb.from('offertes').update(patch).eq('id', id);
  return !error;
}

export async function zetOfferteStatus(id: string, status: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('offertes').update({ status }).eq('id', id);
  return !error;
}

export async function verwijderOfferte(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('offertes').delete().eq('id', id);
  return !error;
}

/** Volgende positie onderaan de offerte, zodat nieuwe regels altijd achteraan komen. */
async function volgendePositie(sb: NonNullable<ReturnType<typeof kmsAdmin>>, offerteId: string): Promise<number> {
  const { data } = await sb.from('offerteregels').select('positie').eq('offerte_id', offerteId);
  const rijen = (data as { positie: number | null }[]) ?? [];
  const hoogste = rijen.reduce((m, r) => (r.positie != null && r.positie > m ? r.positie : m), 0);
  return Math.max(hoogste, rijen.length) + 1;
}

export async function voegRegelToe(offerteId: string, v: RegelVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const rij: Record<string, unknown> = {
    offerte_id: offerteId,
    omschrijving: v.omschrijving,
    aantal: Number(v.aantal) || 0,
    stukprijs: Number(v.stukprijs) || 0,
    korting_pct: Number(v.korting_pct) || 0,
    inkoop: v.inkoop != null && Number.isFinite(Number(v.inkoop)) ? Number(v.inkoop) : null,
    positie: await volgendePositie(sb, offerteId),
  };
  // Alleen meesturen als er echt een artikel gekozen is; een vrije regel laat ze weg.
  if (v.product_id) rij.product_id = v.product_id;
  if (v.kleur && v.kleur.trim()) rij.kleur = v.kleur.trim();
  if (v.maat && v.maat.trim()) rij.maat = v.maat.trim();
  const { error } = await sb.from('offerteregels').insert(rij);
  return !error;
}

export async function werkRegel(regelId: string, v: RegelVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const patch: Record<string, unknown> = {
    omschrijving: v.omschrijving,
    aantal: Number(v.aantal) || 0,
    stukprijs: Number(v.stukprijs) || 0,
    korting_pct: Number(v.korting_pct) || 0,
  };
  if (v.inkoop !== undefined) patch.inkoop = v.inkoop != null ? Number(v.inkoop) : null;
  // Maat mag later alsnog ingevuld of gewist worden; kleur en artikel blijven staan.
  if (v.maat !== undefined) patch.maat = v.maat && v.maat.trim() ? v.maat.trim() : null;
  const { error } = await sb.from('offerteregels').update(patch).eq('id', regelId);
  return !error;
}

/** Huidige waarden van een regel, voor het auditlog (voor/na). */
export async function getRegel(regelId: string): Promise<Offerteregel | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data } = await sb.from('offerteregels').select('*').eq('id', regelId).maybeSingle();
  return (data as Offerteregel | null) ?? null;
}

export async function verwijderRegel(regelId: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('offerteregels').delete().eq('id', regelId);
  return !error;
}

export type OfferteArtikel = {
  id: string;
  naam: string;
  merk: string | null;
  categorie: string | null;
  afbeelding: string | null;
  /** Staat in het assortiment van deze klant: die tonen we bovenaan. */
  inAssortiment: boolean;
};

/**
 * Actieve artikelen voor de artikelzoeker op een offerte. Artikelen uit het
 * assortiment van de klant komen eerst, daarna de rest van de catalogus,
 * zodat Jessi ook iets nieuws kan aanbieden.
 */
export async function listOfferteArtikelen(orgId: string | null): Promise<OfferteArtikel[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const [{ data }, assRes] = await Promise.all([
    sb.from('producten').select('id, naam, merk, categorie, afbeeldingen').eq('actief', true).order('naam').limit(3000),
    orgId
      ? sb.from('assortiment').select('product_id, toegestaan').eq('organisatie_id', orgId)
      : Promise.resolve({ data: [] as { product_id: string; toegestaan: boolean }[] }),
  ]);
  const inAss = new Set(
    ((assRes.data as { product_id: string; toegestaan: boolean | null }[] | null) ?? [])
      .filter((a) => a.toegestaan !== false)
      .map((a) => a.product_id),
  );
  const lijst = ((data as { id: string; naam: string | null; merk: string | null; categorie: string | null; afbeeldingen: string[] | null }[]) ?? []).map(
    (p) => ({
      id: p.id,
      naam: p.naam ?? 'Naamloos',
      merk: p.merk,
      categorie: p.categorie,
      afbeelding: (p.afbeeldingen ?? [])[0] ?? null,
      inAssortiment: inAss.has(p.id),
    }),
  );
  // Stabiel: binnen elke groep blijft de alfabetische volgorde staan.
  return [...lijst.filter((p) => p.inAssortiment), ...lijst.filter((p) => !p.inAssortiment)];
}

export type OfferteMaat = { variantId: string; maat: string; prijs: number | null; inkoop: number | null };
export type OfferteKleur = {
  /** Kleurnaam zoals hij op de offerte komt ('' bij artikelen zonder kleur). */
  kleur: string;
  afbeelding: string | null;
  maten: OfferteMaat[];
  /** Prijs als er (nog) geen maat gekozen is: gelijk voor alle maten, of de laagste. */
  prijs: number | null;
  inkoop: number | null;
  /** Verschillen de prijzen per maat binnen deze kleur? */
  prijsVerschiltPerMaat: boolean;
};

/**
 * Kleuren van één artikel, elk met kleurfoto en de maten in die kleur.
 * Alleen kleuren die echt als variant bestaan. Prijs: verkoopprijs van de
 * variant, anders de basisprijs van het artikel.
 */
export async function listOfferteKleuren(productId: string): Promise<OfferteKleur[]> {
  const sb = kmsAdmin();
  if (!sb || !productId.trim()) return [];
  const [{ data: varData }, { data: fotoData }, { data: prodData }] = await Promise.all([
    sb
      .from('product_varianten')
      .select('id, maat, kleur, verkoopprijs, inkoopprijs')
      .eq('product_id', productId)
      .or('actief.is.null,actief.eq.true')
      .limit(3000),
    sb.from('product_kleur_afbeeldingen').select('kleur, afbeelding_url').eq('product_id', productId),
    sb.from('producten').select('afbeeldingen, verkoopprijs_basis').eq('id', productId).maybeSingle(),
  ]);
  const prod = prodData as { afbeeldingen: string[] | null; verkoopprijs_basis: number | null } | null;
  const basis = prod?.verkoopprijs_basis != null ? Number(prod.verkoopprijs_basis) : null;
  const eersteFoto = (prod?.afbeeldingen ?? [])[0] ?? null;

  const fotoVan = new Map<string, string>();
  for (const f of (fotoData as { kleur: string | null; afbeelding_url: string | null }[]) ?? []) {
    if (f.afbeelding_url) fotoVan.set(kleurSleutel(f.kleur), f.afbeelding_url);
  }

  const groepen = new Map<string, OfferteKleur>();
  for (const v of (varData as { id: string; maat: string | null; kleur: string | null; verkoopprijs: number | null; inkoopprijs: number | null }[]) ?? []) {
    const sleutel = kleurSleutel(v.kleur);
    let g = groepen.get(sleutel);
    if (!g) {
      g = {
        kleur: (v.kleur ?? '').trim(),
        afbeelding: fotoVan.get(sleutel) ?? eersteFoto,
        maten: [],
        prijs: null,
        inkoop: null,
        prijsVerschiltPerMaat: false,
      };
      groepen.set(sleutel, g);
    }
    const maat = (v.maat ?? '').trim();
    // Dubbele maat binnen dezelfde kleur (dubbele import): eerste houden.
    if (maat && g.maten.some((m) => m.maat.toLowerCase() === maat.toLowerCase())) continue;
    g.maten.push({
      variantId: v.id,
      maat,
      prijs: v.verkoopprijs != null ? Number(v.verkoopprijs) : basis,
      inkoop: v.inkoopprijs != null ? Number(v.inkoopprijs) : null,
    });
  }

  const kleuren = [...groepen.values()];
  // Artikel zonder varianten: één "kleur" zonder naam met de basisprijs, zodat
  // de prijs toch wordt voorgevuld.
  if (kleuren.length === 0) {
    return basis != null || eersteFoto
      ? [{ kleur: '', afbeelding: eersteFoto, maten: [], prijs: basis, inkoop: null, prijsVerschiltPerMaat: false }]
      : [];
  }
  for (const g of kleuren) {
    g.maten.sort((a, b) => {
      const na = a.maat ? Number(a.maat) : NaN;
      const nb = b.maat ? Number(b.maat) : NaN;
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return maatVolgorde(a.maat) - maatVolgorde(b.maat) || a.maat.localeCompare(b.maat, 'nl', { numeric: true });
    });
    const prijzen = g.maten.map((m) => m.prijs).filter((p): p is number => p != null);
    const inkopen = g.maten.map((m) => m.inkoop).filter((p): p is number => p != null);
    g.prijs = prijzen.length ? Math.min(...prijzen) : basis;
    g.inkoop = inkopen.length ? Math.min(...inkopen) : null;
    g.prijsVerschiltPerMaat = new Set(prijzen).size > 1;
  }
  kleuren.sort((a, b) => (a.kleur || '\uffff').localeCompare(b.kleur || '\uffff', 'nl'));
  return kleuren;
}

/** Confectiematen in logische volgorde (XS voor S voor M ... voor 4XL); onbekend achteraan. */
const MAAT_RIJ = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL'];
function maatVolgorde(maat: string): number {
  const m = maat.trim().toUpperCase();
  const i = MAAT_RIJ.indexOf(m);
  if (i === -1) return 100;
  // XXL en 2XL zijn dezelfde maat, net als XXXL en 3XL.
  if (m === '2XL') return MAAT_RIJ.indexOf('XXL');
  if (m === '3XL') return MAAT_RIJ.indexOf('XXXL');
  return i;
}

/**
 * Zet een offerte om naar een order: maakt een order voor dezelfde klant met de offerteregels
 * (nettoprijs na korting) als orderregels, en zet de offerte op 'geaccepteerd'. Geeft het
 * order-id terug, of null als er geen klant aan de offerte hangt.
 */
/**
 * Voegt alle producten van een klant-pakket in een keer toe als offerteregels.
 * Omschrijving, verkoopprijs en inkoopprijs komen uit de gekoppelde variant/product,
 * net als bij de losse productkiezer. Geeft het aantal toegevoegde regels terug.
 */
export async function voegPakketAlsRegels(offerteId: string, pakketId: string): Promise<number> {
  const sb = kmsAdmin(); if (!sb) return 0;
  const { data: ppData } = await sb
    .from('pakket_producten')
    .select('product_id, variant_id, aantal, prod:producten(naam, merk), var:product_varianten(maat, kleur, verkoopprijs, inkoopprijs)')
    .eq('pakket_id', pakketId);
  const pp = (ppData as unknown as {
    product_id: string;
    variant_id: string | null;
    aantal: number;
    prod: { naam: string; merk: string | null } | null;
    var: { maat: string | null; kleur: string | null; verkoopprijs: number | null; inkoopprijs: number | null } | null;
  }[]) ?? [];
  if (pp.length === 0) return 0;

  const start = await volgendePositie(sb, offerteId);
  const rows = pp.map((r, i) => {
    const kleur = r.var?.kleur?.trim() || null;
    const maat = r.var?.maat?.trim() || null;
    const rij: Record<string, unknown> = {
      offerte_id: offerteId,
      omschrijving: regelOmschrijving({ naam: r.prod?.naam ?? 'Product', merk: r.prod?.merk ?? null }, kleur, maat),
      aantal: Math.max(1, Math.round(Number(r.aantal) || 1)),
      stukprijs: r.var?.verkoopprijs != null ? Number(r.var.verkoopprijs) : 0,
      korting_pct: 0,
      inkoop: r.var?.inkoopprijs != null ? Number(r.var.inkoopprijs) : null,
      positie: start + i,
      product_id: r.product_id,
    };
    if (kleur) rij.kleur = kleur;
    if (maat) rij.maat = maat;
    return rij;
  });
  const { error } = await sb.from('offerteregels').insert(rows);
  return error ? 0 : rows.length;
}

export async function maakOrderVanOfferte(offerteId: string): Promise<string | null> {
  const off = await getOfferte(offerteId);
  if (!off || !off.organisatie_id) return null;
  const orderId = await maakOrder({
    organisatie_id: off.organisatie_id,
    status: 'concept',
    notitie: `Aangemaakt uit offerte ${off.offertenummer != null ? `#${off.offertenummer}` : ''}`.trim(),
  });
  if (!orderId) return null;
  const sb = kmsAdmin();
  for (const r of off.regels) {
    const kort = Number(r.korting_pct) || 0;
    const netto = (Number(r.stukprijs) || 0) * (1 - kort / 100);
    const kleur = r.kleur?.trim() || null;
    const maat = r.maat?.trim() || null;
    // Kleur en maat gaan als eigen velden mee naar de order (pakbon, inkoop, coupeuse).
    // Staan ze ook al in de omschrijving, dan halen we ze daar weg, anders komen ze
    // op de factuur dubbel ("Polo, Zwart (M / Zwart)").
    let itemNaam = (r.omschrijving ?? '').trim() || 'Regel';
    if (maat && itemNaam.toLowerCase().endsWith(`, maat ${maat}`.toLowerCase())) itemNaam = itemNaam.slice(0, -`, maat ${maat}`.length);
    if (kleur && itemNaam.toLowerCase().endsWith(`, ${kleur}`.toLowerCase())) itemNaam = itemNaam.slice(0, -`, ${kleur}`.length);

    // Met artikel, kleur en maat is de exacte variant bekend; die koppelen we mee.
    let variantId: string | null = null;
    if (sb && r.product_id && maat) {
      const { data: varData } = await sb
        .from('product_varianten')
        .select('id, kleur, maat')
        .eq('product_id', r.product_id)
        .ilike('maat', maat);
      const match = ((varData as { id: string; kleur: string | null; maat: string | null }[]) ?? []).find(
        (v) => kleurSleutel(v.kleur) === kleurSleutel(kleur),
      );
      variantId = match?.id ?? null;
    }

    const regel: OrderregelVelden = {
      item_naam: itemNaam,
      aantal: Math.max(1, Math.round(Number(r.aantal) || 1)),
      stukprijs: Math.round(netto * 100) / 100,
    };
    if (r.product_id) regel.product_id = r.product_id;
    if (variantId) regel.variant_id = variantId;
    if (kleur) regel.kleur = kleur;
    if (maat) regel.maat = maat;
    if (r.lengte != null) regel.lengte = r.lengte;
    await voegOrderregelToe(orderId, regel);
  }
  await zetOfferteStatus(offerteId, 'geaccepteerd');
  return orderId;
}
