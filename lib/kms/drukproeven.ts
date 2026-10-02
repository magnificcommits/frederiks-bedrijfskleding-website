import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Data-access voor de module Drukproeven. Een drukproef hoort bij een klant en toont
 * hoe een logo op een kledingstuk komt (plek, maat, techniek). Jessi maakt hem aan,
 * automatisch gegenereerd (via de garment-render) of met een eigen geuploade afbeelding;
 * daarna kan de klant hem goedkeuren (per mail of in het portaal).
 * Alle queries via kmsAdmin() (service-role). Alleen server-side, achter dashAuthed().
 */

export const DRUKPROEF_STATUSSEN = ['concept', 'verstuurd', 'goedgekeurd', 'afgekeurd'] as const;

export type Drukproef = {
  id: string;
  organisatie_id: string;
  product_id: string | null;
  order_id: string | null;
  naam: string;
  type: string;
  kleur: number;
  techniek: string;
  positie: string;
  logo_url: string | null;
  afbeelding_url: string | null;
  omschrijving: string | null;
  status: string;
  opmerking: string | null;
  token: string;
  behandeld_op: string | null;
  created_at: string;
  /** Kleur van het kledingstuk zoals in de catalogus (bv. "Zwart"). */
  product_kleur?: string | null;
  /** Foto van de achterkant; bij een ontwerp is afbeelding_url de voorkant. */
  achter_afbeelding_url?: string | null;
  /** Logo-plaatsingen { voor, achter }; zie app/dashboard/drukproeven/ontwerp.ts. */
  ontwerp?: unknown;
};

export type DrukproefMetKlant = Drukproef & { organisatie_naam: string | null };

export type DrukproefVelden = {
  naam: string;
  product_id?: string | null;
  order_id?: string | null;
  type?: string;
  kleur?: number;
  techniek?: string;
  positie?: string;
  logo_url?: string | null;
  afbeelding_url?: string | null;
  omschrijving?: string | null;
  product_kleur?: string | null;
  achter_afbeelding_url?: string | null;
  ontwerp?: unknown;
  status?: string;
};

export async function listDrukproevenVoorKlant(orgId: string): Promise<Drukproef[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('drukproeven').select('*').eq('organisatie_id', orgId).order('created_at', { ascending: false });
  return (data as Drukproef[]) ?? [];
}

/** De drukproeven die aan een order hangen (voor de drukproef-sectie op de order). */
export async function listDrukproevenVoorOrder(orderId: string): Promise<Drukproef[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('drukproeven').select('*').eq('order_id', orderId).order('created_at', { ascending: false });
  return (data as Drukproef[]) ?? [];
}

/**
 * Zet een goedgekeurde drukproef die aan een order hangt door naar productie:
 * de order krijgt status 'borduren' of 'bedrukken' op basis van de techniek, maar
 * alleen vanuit een vroege fase (we overschrijven geen verder gevorderde status).
 */
export async function verwerkDrukproefGoedkeuring(drukproefId: string): Promise<void> {
  const sb = kmsAdmin(); if (!sb) return;
  const { data } = await sb.from('drukproeven').select('order_id, techniek, status').eq('id', drukproefId).maybeSingle();
  const dp = data as { order_id: string | null; techniek: string | null; status: string } | null;
  if (!dp || dp.status !== 'goedgekeurd' || !dp.order_id) return;

  const { data: orderData } = await sb.from('orders').select('status').eq('id', dp.order_id).maybeSingle();
  const huidige = (orderData as { status: string } | null)?.status;
  const vroeg = ['concept', 'offerte_verstuurd', 'offerte_goedgekeurd', 'nog_bestellen', 'besteld', 'deellevering', 'compleet_geleverd'];
  if (!huidige || !vroeg.includes(huidige)) return;
  const nieuwe = dp.techniek === 'bedrukken' ? 'bedrukken' : 'borduren';
  await sb.from('orders').update({ status: nieuwe }).eq('id', dp.order_id);
}

export async function getDrukproef(id: string): Promise<DrukproefMetKlant | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data } = await sb.from('drukproeven').select('*, organisaties(naam)').eq('id', id).maybeSingle();
  if (!data) return null;
  const r = data as unknown as Drukproef & { organisaties: { naam: string } | null };
  const { organisaties, ...rest } = r;
  return { ...rest, organisatie_naam: organisaties?.naam ?? null };
}

export async function maakDrukproef(orgId: string, v: DrukproefVelden): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data, error } = await sb
    .from('drukproeven')
    .insert({
      organisatie_id: orgId,
      naam: v.naam.trim(),
      product_id: v.product_id ?? null,
      order_id: v.order_id ?? null,
      type: v.type ?? 'tshirt',
      kleur: Number.isFinite(Number(v.kleur)) ? Math.round(Number(v.kleur)) : 0,
      techniek: v.techniek ?? 'borduren',
      positie: v.positie ?? 'borst-links',
      logo_url: v.logo_url ?? null,
      afbeelding_url: v.afbeelding_url ?? null,
      omschrijving: v.omschrijving?.trim() || null,
      status: 'concept',
      ...(v.product_kleur !== undefined ? { product_kleur: v.product_kleur?.trim() || null } : {}),
      ...(v.achter_afbeelding_url !== undefined ? { achter_afbeelding_url: v.achter_afbeelding_url ?? null } : {}),
      ...(v.ontwerp !== undefined ? { ontwerp: v.ontwerp ?? null } : {}),
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function werkDrukproef(id: string, v: DrukproefVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const patch: Record<string, unknown> = { naam: v.naam.trim() };
  if (v.product_id !== undefined) patch.product_id = v.product_id ?? null;
  if (v.type !== undefined) patch.type = v.type;
  if (v.kleur !== undefined) patch.kleur = Math.round(Number(v.kleur)) || 0;
  if (v.techniek !== undefined) patch.techniek = v.techniek;
  if (v.positie !== undefined) patch.positie = v.positie;
  if (v.logo_url !== undefined) patch.logo_url = v.logo_url ?? null;
  if (v.afbeelding_url !== undefined) patch.afbeelding_url = v.afbeelding_url ?? null;
  if (v.omschrijving !== undefined) patch.omschrijving = v.omschrijving?.trim() || null;
  if (v.order_id !== undefined) patch.order_id = v.order_id ?? null;
  if (v.product_kleur !== undefined) patch.product_kleur = v.product_kleur?.trim() || null;
  if (v.achter_afbeelding_url !== undefined) patch.achter_afbeelding_url = v.achter_afbeelding_url ?? null;
  if (v.ontwerp !== undefined) patch.ontwerp = v.ontwerp ?? null;
  if (v.status !== undefined) {
    patch.status = v.status;
    // Terug naar concept betekent: de klant moet opnieuw beslissen.
    if (v.status === 'concept') patch.behandeld_op = null;
  }
  const { error } = await sb.from('drukproeven').update(patch).eq('id', id);
  return !error;
}

export async function zetDrukproefStatus(id: string, status: string, opmerking?: string | null): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const patch: Record<string, unknown> = { status };
  if (opmerking !== undefined) patch.opmerking = opmerking?.trim() || null;
  if (status === 'goedgekeurd' || status === 'afgekeurd') patch.behandeld_op = new Date().toISOString();
  const { error } = await sb.from('drukproeven').update(patch).eq('id', id);
  return !error;
}

export async function verwijderDrukproef(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('drukproeven').delete().eq('id', id);
  return !error;
}

/** Zet de drukproef op 'verstuurd' zodat de klant hem kan beoordelen (mail of portaal). */
export async function markeerVerstuurd(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('drukproeven').update({ status: 'verstuurd' }).eq('id', id);
  return !error;
}

/** Publieke ophaling via de geheime token (goedkeurlink in de mail, geen login nodig). */
export async function getDrukproefViaToken(token: string): Promise<DrukproefMetKlant | null> {
  const sb = kmsAdmin(); if (!sb || !token.trim()) return null;
  const { data } = await sb.from('drukproeven').select('*, organisaties(naam)').eq('token', token.trim()).maybeSingle();
  if (!data) return null;
  const r = data as unknown as Drukproef & { organisaties: { naam: string } | null };
  const { organisaties, ...rest } = r;
  return { ...rest, organisatie_naam: organisaties?.naam ?? null };
}

/**
 * Beslist een drukproef via de token: alleen toegestaan zolang hij nog niet behandeld is
 * (status concept of verstuurd). Geeft de bijgewerkte drukproef terug, of null bij fout.
 */
export async function beslisDrukproefViaToken(token: string, akkoord: boolean, opmerking?: string | null): Promise<DrukproefMetKlant | null> {
  const sb = kmsAdmin(); if (!sb || !token.trim()) return null;
  const huidig = await getDrukproefViaToken(token);
  if (!huidig || (huidig.status !== 'concept' && huidig.status !== 'verstuurd')) return null;
  const { error } = await sb
    .from('drukproeven')
    .update({ status: akkoord ? 'goedgekeurd' : 'afgekeurd', opmerking: opmerking?.trim() || null, behandeld_op: new Date().toISOString() })
    .eq('id', huidig.id);
  if (error) return null;
  if (akkoord) await verwerkDrukproefGoedkeuring(huidig.id);
  return { ...huidig, status: akkoord ? 'goedgekeurd' : 'afgekeurd', opmerking: opmerking?.trim() || null };
}

/* ------------------------------------------------------------------------- */
/* Artikelkeuze voor de drukproef-editor.                                     */
/* ------------------------------------------------------------------------- */

/** Een kledingstuk dat Jessi als basis voor de drukproef kan kiezen. */
export type DrukproefArtikel = {
  product_id: string;
  naam: string;
  merk: string | null;
  sku: string | null;
  /** Vaste kleur uit het assortiment van de klant; null = nog kiezen. */
  kleur: string | null;
  /** Foto in die kleur, anders de hoofdfoto. */
  afbeelding: string | null;
};

export type DrukproefKleur = { kleur: string; afbeelding: string | null };

const gelijkeTekst = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

function inStukken<T>(lijst: T[], grootte = 100): T[][] {
  const uit: T[][] = [];
  for (let i = 0; i < lijst.length; i += grootte) uit.push(lijst.slice(i, i + grootte));
  return uit;
}

type Sb = NonNullable<ReturnType<typeof kmsAdmin>>;
type KleurFotoRij = { product_id: string; kleur: string | null; afbeelding_url: string | null };

/** Haal alle rijen op in blokken van 1000 (PostgREST geeft er standaard maximaal 1000). */
async function allesInBlokken<T>(
  pagina: (van: number, tot: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const uit: T[] = [];
  for (let i = 0; i < 50; i++) {
    const van = i * 1000;
    const { data, error } = await pagina(van, van + 999);
    if (error) break;
    const rijen = (data as T[]) ?? [];
    uit.push(...rijen);
    if (rijen.length < 1000) break;
  }
  return uit;
}

async function kleurFotos(sb: Sb, productIds: string[]): Promise<KleurFotoRij[]> {
  const uit: KleurFotoRij[] = [];
  for (const stuk of inStukken(productIds)) {
    uit.push(
      ...(await allesInBlokken<KleurFotoRij>((van, tot) =>
        sb
          .from('product_kleur_afbeeldingen')
          .select('product_id, kleur, afbeelding_url')
          .in('product_id', stuk)
          .order('id')
          .range(van, tot),
      )),
    );
  }
  return uit;
}

function fotoVoorKleur(fotos: KleurFotoRij[], productId: string, kleur: string | null): string | null {
  if (!kleur) return null;
  return fotos.find((f) => f.product_id === productId && f.afbeelding_url && gelijkeTekst(f.kleur, kleur))?.afbeelding_url ?? null;
}

/**
 * Het assortiment van een klant als keuzelijst voor de drukproef: elk artikel in de
 * vaste kleur van de klant, met de foto in precies die kleur.
 */
export async function listArtikelenVoorDrukproef(orgId: string): Promise<DrukproefArtikel[]> {
  const sb = kmsAdmin(); if (!sb || !orgId) return [];
  const regels = await allesInBlokken<{ product_id: string | null; kleur: string | null; toegestaan: boolean | null }>((van, tot) =>
    sb.from('assortiment').select('product_id, kleur, toegestaan').eq('organisatie_id', orgId).order('id').range(van, tot),
  );
  const bruikbaar = regels.filter((r): r is { product_id: string; kleur: string | null; toegestaan: boolean | null } => Boolean(r.product_id) && r.toegestaan !== false);
  const ids = [...new Set(bruikbaar.map((r) => r.product_id))];
  if (ids.length === 0) return [];

  type ArtikelRij = { id: string; naam: string | null; merk: string | null; sku: string | null; afbeeldingen: string[] | null };
  const artikelen = new Map<string, ArtikelRij>();
  for (const stuk of inStukken(ids)) {
    const { data } = await sb.from('producten').select('id, naam, merk, sku, afbeeldingen').in('id', stuk);
    for (const a of (data as ArtikelRij[]) ?? []) artikelen.set(a.id, a);
  }
  const fotos = await kleurFotos(sb, ids);

  const gezien = new Set<string>();
  const uit: DrukproefArtikel[] = [];
  for (const r of bruikbaar) {
    const a = artikelen.get(r.product_id);
    if (!a) continue;
    const kleur = r.kleur?.trim() || null;
    const sleutel = `${r.product_id}|${(kleur ?? '').toLowerCase()}`;
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uit.push({
      product_id: a.id,
      naam: a.naam?.trim() || 'Naamloos artikel',
      merk: a.merk,
      sku: a.sku,
      kleur,
      afbeelding: fotoVoorKleur(fotos, a.id, kleur) ?? (a.afbeeldingen ?? [])[0] ?? null,
    });
  }
  return uit.sort((x, y) => x.naam.localeCompare(y.naam, 'nl') || (x.kleur ?? '').localeCompare(y.kleur ?? '', 'nl'));
}

/** Zoeken in alle actieve artikelen op naam, artikelnummer of merk. */
export async function zoekArtikelenVoorDrukproef(zoekterm: string): Promise<DrukproefArtikel[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  // Tekens die de filtertaal van de database verstoren eruit halen.
  const woorden = zoekterm.replace(/[%,()*\\:."']/g, ' ').split(/\s+/).map((w) => w.trim()).filter(Boolean);
  if (woorden.length === 0 || woorden.join('').length < 2) return [];
  const eerste = woorden[0];
  const { data } = await sb
    .from('producten')
    .select('id, naam, merk, sku, afbeeldingen, actief')
    .or(`naam.ilike.%${eerste}%,sku.ilike.%${eerste}%,merk.ilike.%${eerste}%`)
    .order('naam')
    .limit(150);
  type Rij = { id: string; naam: string | null; merk: string | null; sku: string | null; afbeeldingen: string[] | null; actief: boolean | null };
  const rijen = ((data as Rij[]) ?? []).filter((r) => r.actief !== false);
  const rest = woorden.slice(1).map((w) => w.toLowerCase());
  return rijen
    .filter((r) => {
      const hooi = `${r.naam ?? ''} ${r.merk ?? ''} ${r.sku ?? ''}`.toLowerCase();
      return rest.every((w) => hooi.includes(w));
    })
    .slice(0, 40)
    .map((r) => ({
      product_id: r.id,
      naam: r.naam?.trim() || 'Naamloos artikel',
      merk: r.merk,
      sku: r.sku,
      kleur: null,
      afbeelding: (r.afbeeldingen ?? [])[0] ?? null,
    }));
}

/** De kleuren van één artikel met de foto per kleur (anders de hoofdfoto). */
export async function kleurenVoorDrukproef(productId: string): Promise<DrukproefKleur[]> {
  const sb = kmsAdmin(); if (!sb || !productId) return [];
  const { data: artikel } = await sb.from('producten').select('afbeeldingen').eq('id', productId).maybeSingle();
  const hoofdfoto = ((artikel as { afbeeldingen: string[] | null } | null)?.afbeeldingen ?? [])[0] ?? null;

  const [varianten, fotos] = await Promise.all([
    allesInBlokken<{ kleur: string | null; actief: boolean | null }>((van, tot) =>
      sb.from('product_varianten').select('kleur, actief').eq('product_id', productId).order('id').range(van, tot),
    ),
    kleurFotos(sb, [productId]),
  ]);

  const kleuren: string[] = [];
  const voegToe = (k: string | null | undefined) => {
    const kleur = (k ?? '').trim();
    if (kleur && !kleuren.some((x) => gelijkeTekst(x, kleur))) kleuren.push(kleur);
  };
  for (const v of varianten) if (v.actief !== false) voegToe(v.kleur);
  if (kleuren.length === 0) for (const f of fotos) voegToe(f.kleur);

  return kleuren
    .sort((a, b) => a.localeCompare(b, 'nl'))
    .map((kleur) => ({ kleur, afbeelding: fotoVoorKleur(fotos, productId, kleur) ?? hoofdfoto }));
}

/** Naam en foto van een artikel in een bepaalde kleur (voor het bewerken van een bestaande proef). */
export async function artikelVoorDrukproef(productId: string, kleur: string | null): Promise<DrukproefArtikel | null> {
  const sb = kmsAdmin(); if (!sb || !productId) return null;
  const { data } = await sb.from('producten').select('id, naam, merk, sku, afbeeldingen').eq('id', productId).maybeSingle();
  const a = data as { id: string; naam: string | null; merk: string | null; sku: string | null; afbeeldingen: string[] | null } | null;
  if (!a) return null;
  const fotos = kleur ? await kleurFotos(sb, [productId]) : [];
  return {
    product_id: a.id,
    naam: a.naam?.trim() || 'Naamloos artikel',
    merk: a.merk,
    sku: a.sku,
    kleur: kleur?.trim() || null,
    afbeelding: fotoVoorKleur(fotos, a.id, kleur) ?? (a.afbeeldingen ?? [])[0] ?? null,
  };
}

/** Logo's van de klant die als plaatje op een kledingstuk gezet kunnen worden. */
export type DrukproefLogo = { id: string; naam: string; url: string };

const PLAATSBAAR = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif'];

function isPlaatsbaar(url: string | null | undefined, naam?: string | null): boolean {
  const ext = (s: string | null | undefined) => {
    const laatste = ((s ?? '').split('?')[0] ?? '').split('/').pop() ?? '';
    const punt = laatste.lastIndexOf('.');
    return punt > 0 ? laatste.slice(punt + 1).toLowerCase() : '';
  };
  return PLAATSBAAR.includes(ext(naam) || ext(url));
}

export async function listLogosVoorDrukproef(orgId: string): Promise<DrukproefLogo[]> {
  const sb = kmsAdmin(); if (!sb || !orgId) return [];
  const [{ data: logos }, { data: org }] = await Promise.all([
    sb.from('logos').select('id, naam, logo_bestand_url, logo_bestand_naam').eq('organisatie_id', orgId).order('naam'),
    sb.from('organisaties').select('portaal_logo_url').eq('id', orgId).maybeSingle(),
  ]);
  const uit: DrukproefLogo[] = [];
  for (const l of (logos as { id: string; naam: string | null; logo_bestand_url: string | null; logo_bestand_naam: string | null }[]) ?? []) {
    if (l.logo_bestand_url && isPlaatsbaar(l.logo_bestand_url, l.logo_bestand_naam)) {
      uit.push({ id: l.id, naam: l.naam?.trim() || 'Logo', url: l.logo_bestand_url });
    }
  }
  const portaalLogo = (org as { portaal_logo_url: string | null } | null)?.portaal_logo_url;
  if (portaalLogo && !uit.some((l) => l.url === portaalLogo)) {
    uit.push({ id: 'portaal', naam: 'Logo uit het klantportaal', url: portaalLogo });
  }
  return uit;
}

/** E-mailadressen van de klant om de proef naartoe te sturen; hoofdcontact eerst. */
export async function contactAdressenVoorDrukproef(orgId: string): Promise<{ email: string; naam: string }[]> {
  const sb = kmsAdmin(); if (!sb || !orgId) return [];
  const [{ data: contacten }, { data: org }] = await Promise.all([
    sb.from('contactpersonen').select('naam, email, hoofdcontact').eq('organisatie_id', orgId),
    sb.from('organisaties').select('naam, email_algemeen').eq('id', orgId).maybeSingle(),
  ]);
  const lijst = ((contacten as { naam: string | null; email: string | null; hoofdcontact: boolean | null }[]) ?? [])
    .filter((c) => c.email?.trim())
    .sort((a, b) => Number(Boolean(b.hoofdcontact)) - Number(Boolean(a.hoofdcontact)))
    .map((c) => ({ email: c.email!.trim(), naam: c.naam?.trim() || '' }));
  const o = org as { naam: string | null; email_algemeen: string | null } | null;
  if (o?.email_algemeen?.trim() && !lijst.some((c) => gelijkeTekst(c.email, o.email_algemeen))) {
    lijst.push({ email: o.email_algemeen.trim(), naam: o.naam ?? 'Algemeen' });
  }
  return lijst;
}

/** Meerdere drukproeven tegelijk, voor het afdrukvel. Alleen van één klant. */
export async function listDrukproevenOpIds(orgId: string, ids: string[]): Promise<Drukproef[]> {
  const sb = kmsAdmin(); if (!sb || !orgId) return [];
  let q = sb.from('drukproeven').select('*').eq('organisatie_id', orgId);
  if (ids.length > 0) q = q.in('id', ids.slice(0, 100));
  const { data } = await q.order('created_at', { ascending: true });
  return (data as Drukproef[]) ?? [];
}
