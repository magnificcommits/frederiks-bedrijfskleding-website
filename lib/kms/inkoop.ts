import type { SupabaseClient } from '@supabase/supabase-js';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { sendEmail, emailLayout, escapeHtml } from '@/lib/email';

/**
 * Data-access voor de module Inkoop.
 * Genereert inkoopregels op basis van orderregels waar de voorraad tekortschiet
 * en beheert de status van die inkoopregels. Alleen server-side, achter dashAuthed().
 */

export const INKOOP_STATUSSEN = ['te_bestellen', 'besteld', 'deels', 'geleverd'] as const;
export type InkoopStatus = (typeof INKOOP_STATUSSEN)[number];

export type Inkoopregel = {
  id: string;
  order_id: string | null;
  orderregel_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  leverancier_id: string | null;
  merk: string | null;
  item_naam: string | null;
  maat: string | null;
  kleur: string | null;
  aantal: number;
  status: string;
  besteld_op: string | null;
  geleverd_aantal: number;
  created_at: string;
};

export type InkoopregelMetLeverancier = Inkoopregel & { leverancier_naam: string | null };

type OrderregelRij = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  aantal: number;
};

/**
 * Loopt door de orderregels van een order. Voor elke regel kijkt hij naar de
 * voorraad van de gekoppelde variant. Is die voorraad lager dan het bestelde
 * aantal (of is er geen variant), dan maakt hij een inkoopregel voor het tekort.
 * Merk en leverancier komen van het gekoppelde product. Geeft het aantal
 * aangemaakte inkoopregels terug.
 */
export async function genereerInkoopregels(orderId: string): Promise<number> {
  const sb = kmsAdmin(); if (!sb) return 0;

  const { data: regelData } = await sb
    .from('orderregels')
    .select('id, order_id, product_id, variant_id, item_naam, maat, kleur, aantal')
    .eq('order_id', orderId);
  const regels = (regelData as OrderregelRij[]) ?? [];
  if (regels.length === 0) return 0;

  // Voorkom dubbele inkoopregels: welke orderregels hebben er al een?
  const { data: bestaand } = await sb.from('inkoopregels').select('orderregel_id').eq('order_id', orderId);
  const alAanwezig = new Set(((bestaand as { orderregel_id: string | null }[]) ?? []).map((b) => b.orderregel_id).filter(Boolean));

  // Varianten ophalen voor de voorraadcheck.
  const variantIds = regels.map((r) => r.variant_id).filter((v): v is string => Boolean(v));
  const voorraadPerVariant = new Map<string, number>();
  if (variantIds.length > 0) {
    const { data: varData } = await sb.from('product_varianten').select('id, voorraad').in('id', variantIds);
    for (const v of (varData as { id: string; voorraad: number }[]) ?? []) voorraadPerVariant.set(v.id, Number(v.voorraad) || 0);
  }

  // Merk + leverancier per product ophalen.
  const productIds = regels.map((r) => r.product_id).filter((p): p is string => Boolean(p));
  const productInfo = new Map<string, { merk: string | null; leverancier_id: string | null }>();
  if (productIds.length > 0) {
    const { data: prodData } = await sb.from('producten').select('id, merk, leverancier_id').in('id', productIds);
    for (const p of (prodData as { id: string; merk: string | null; leverancier_id: string | null }[]) ?? []) {
      productInfo.set(p.id, { merk: p.merk, leverancier_id: p.leverancier_id });
    }
  }

  const nieuw: Record<string, unknown>[] = [];
  for (const r of regels) {
    if (alAanwezig.has(r.id)) continue;
    const voorraad = r.variant_id ? (voorraadPerVariant.get(r.variant_id) ?? 0) : 0;
    const tekort = Math.max(0, (Number(r.aantal) || 0) - voorraad);
    if (tekort <= 0) continue;
    const info = r.product_id ? productInfo.get(r.product_id) : undefined;
    nieuw.push({
      order_id: r.order_id,
      orderregel_id: r.id,
      product_id: r.product_id,
      variant_id: r.variant_id,
      leverancier_id: info?.leverancier_id ?? null,
      merk: info?.merk ?? null,
      item_naam: r.item_naam,
      maat: r.maat,
      kleur: r.kleur,
      aantal: tekort,
      status: 'te_bestellen',
    });
  }

  if (nieuw.length === 0) return 0;
  const { error } = await sb.from('inkoopregels').insert(nieuw);
  return error ? 0 : nieuw.length;
}

export async function listInkoopregels(status?: string): Promise<InkoopregelMetLeverancier[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  let q = sb.from('inkoopregels').select('*, leveranciers(naam)').order('created_at', { ascending: false });
  if (status && status.trim()) q = q.eq('status', status.trim());
  const { data } = await q;
  const rows = (data as unknown as (Inkoopregel & { leveranciers: { naam: string } | null })[]) ?? [];
  return rows.map((r) => {
    const { leveranciers, ...rest } = r;
    return { ...rest, leverancier_naam: leveranciers?.naam ?? null } as InkoopregelMetLeverancier;
  });
}

export async function listInkoopregelsVoorOrder(orderId: string): Promise<InkoopregelMetLeverancier[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('inkoopregels')
    .select('*, leveranciers(naam)')
    .eq('order_id', orderId)
    .order('created_at');
  const rows = (data as unknown as (Inkoopregel & { leveranciers: { naam: string } | null })[]) ?? [];
  return rows.map((r) => {
    const { leveranciers, ...rest } = r;
    return { ...rest, leverancier_naam: leveranciers?.naam ?? null } as InkoopregelMetLeverancier;
  });
}

export async function zetInkoopStatus(id: string, status: string, besteldOp?: string | null, geleverdAantal?: number | null): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const patch: Record<string, unknown> = { status };
  if (besteldOp !== undefined) patch.besteld_op = besteldOp;
  if (geleverdAantal !== undefined && geleverdAantal !== null) patch.geleverd_aantal = geleverdAantal;
  const { error } = await sb.from('inkoopregels').update(patch).eq('id', id);
  return !error;
}

export type LeveringResultaat = { ok: boolean; status: 'deels' | 'geleverd' | null; geleverd: number };

/**
 * Legt vast hoeveel er van een inkoopregel binnen is. Het bestelde aantal komt
 * uit de regel zelf, want alleen daarmee kun je bepalen of de regel klaar is.
 *
 * Is er minder binnen dan besteld, dan wordt de status 'deels' in plaats van
 * 'geleverd'. Anders verdwijnt een regel waarvan nog zes stuks moeten komen uit
 * beeld met het stempel afgehandeld, en dan mist Jessi die zes stuks pas als de
 * klant erom belt. Een leeg aantal betekent: alles binnen.
 */
export async function zetInkoopGeleverd(id: string, geleverdAantal: number | null): Promise<LeveringResultaat> {
  const sb = kmsAdmin();
  if (!sb || !id) return { ok: false, status: null, geleverd: 0 };

  const { data } = await sb.from('inkoopregels').select('aantal').eq('id', id).maybeSingle();
  const rij = data as { aantal: number } | null;
  if (!rij) return { ok: false, status: null, geleverd: 0 };

  const besteld = Number(rij.aantal) || 0;
  const geleverd = geleverdAantal === null ? besteld : Math.max(0, Math.round(geleverdAantal));
  const status: 'deels' | 'geleverd' = besteld > 0 && geleverd < besteld ? 'deels' : 'geleverd';

  const { error } = await sb
    .from('inkoopregels')
    .update({ status, geleverd_aantal: geleverd })
    .eq('id', id);
  return error ? { ok: false, status: null, geleverd } : { ok: true, status, geleverd };
}

/* ------------------------------------------------------------------------
   Bestellijst per inkooppartij

   Elk MERK staat als eigen rij in `leveranciers`. Meerdere merken worden bij
   dezelfde handelspartij ingekocht (`inkoop_bij`): Houweling levert er tien,
   Roerdink zes, TopTex drie. Jessi bestelt in één sessie bij die partij, dus
   groeperen we eerst op inkooppartij en daarbinnen pas op merk. Groeperen op
   merk alleen zou haar voor Houweling tien keer laten inloggen.
   ------------------------------------------------------------------------ */

/** Lege string en spaties tellen als "niet ingevuld". */
function tekst(waarde: string | null | undefined): string | null {
  const s = (waarde ?? '').trim();
  return s === '' ? null : s;
}

function uniekeIds(waarden: (string | null)[]): string[] {
  return [...new Set(waarden.filter((v): v is string => Boolean(v)))];
}

/**
 * Maakt van het portaalveld een href die veilig in een <a> kan.
 * Geeft null terug als er geen bruikbare link in staat; de pagina toont dan de
 * bestelwijze in plaats van een knop die nergens heen gaat.
 */
export function portaalLink(ruw: string | null | undefined): string | null {
  const s = tekst(ruw);
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  // Een ander schema (javascript:, data:) mag hier nooit doorheen komen.
  if (/^[a-z][a-z0-9+-]*:/i.test(s)) return null;
  // Zonder schema leest de browser "www.houweling.nl/b2b" als pad binnen het
  // dashboard. Alleen iets dat op een domein lijkt krijgt https:// ervoor;
  // staat er per ongeluk een zin in dit veld, dan liever helemaal geen knop.
  if (/\s/.test(s) || !/^[^/]+\.[a-z]{2,}/i.test(s)) return null;
  return `https://${s}`;
}

/** Eén te bestellen regel, met prijs, order en klant erbij gezocht. */
export type BestelRegel = {
  id: string;
  merk: string;
  item_naam: string | null;
  maat: string | null;
  kleur: string | null;
  aantal: number;
  /** Inkoopprijs per stuk uit de variant. Null als de variant of de prijs ontbreekt. */
  inkoopprijs: number | null;
  /** aantal x inkoopprijs, of null als de inkoopprijs niet bekend is. */
  regelwaarde: number | null;
  order_id: string | null;
  ordernummer: number | null;
  klant_naam: string | null;
};

export type BestelMerkGroep = {
  /** Stabiele sleutel voor React; leverancier-id of de merknaam. */
  sleutel: string;
  merk: string;
  leverancier_id: string | null;
  bestelportaal_url: string | null;
  bestelwijze: string | null;
  contactpersoon: string | null;
  email: string | null;
  telefoon: string | null;
  regels: BestelRegel[];
  aantalStuks: number;
  inkoopwaarde: number;
  /** Regels waarvan de inkoopprijs onbekend is; die zitten niet in de inkoopwaarde. */
  regelsZonderPrijs: number;
};

export type BestelPartijGroep = {
  sleutel: string;
  /** De handelspartij waar in één sessie besteld wordt (leveranciers.inkoop_bij). */
  inkoopPartij: string;
  bestelportaal_url: string | null;
  bestelwijze: string | null;
  contactpersoon: string | null;
  email: string | null;
  telefoon: string | null;
  telefoon_hoofdkantoor: string | null;
  merken: BestelMerkGroep[];
  aantalRegels: number;
  aantalStuks: number;
  inkoopwaarde: number;
  regelsZonderPrijs: number;
};

type BestelRegelRij = {
  id: string;
  order_id: string | null;
  variant_id: string | null;
  leverancier_id: string | null;
  merk: string | null;
  item_naam: string | null;
  maat: string | null;
  kleur: string | null;
  aantal: number;
};

type LeverancierInkoop = {
  id: string;
  naam: string | null;
  contactpersoon: string | null;
  telefoon: string | null;
  email: string | null;
  inkoop_bij: string | null;
  bestelportaal_url: string | null;
  bestelwijze: string | null;
  telefoon_hoofdkantoor: string | null;
};

async function haalLeveranciers(sb: SupabaseClient, ids: string[]): Promise<Map<string, LeverancierInkoop>> {
  const kaart = new Map<string, LeverancierInkoop>();
  if (ids.length === 0) return kaart;
  const { data } = await sb
    .from('leveranciers')
    .select('id, naam, contactpersoon, telefoon, email, inkoop_bij, bestelportaal_url, bestelwijze, telefoon_hoofdkantoor')
    .in('id', ids);
  for (const l of ((data as LeverancierInkoop[]) ?? [])) kaart.set(l.id, l);
  return kaart;
}

async function haalInkoopprijzen(sb: SupabaseClient, ids: string[]): Promise<Map<string, number>> {
  const kaart = new Map<string, number>();
  if (ids.length === 0) return kaart;
  const { data } = await sb.from('product_varianten').select('id, inkoopprijs').in('id', ids);
  for (const v of ((data as { id: string; inkoopprijs: number | null }[]) ?? [])) {
    const prijs = Number(v.inkoopprijs);
    if (v.inkoopprijs !== null && Number.isFinite(prijs)) kaart.set(v.id, prijs);
  }
  return kaart;
}

type Orderinfo = { ordernummer: number | null; klant_naam: string | null };

async function haalOrderinfo(sb: SupabaseClient, ids: string[]): Promise<Map<string, Orderinfo>> {
  const kaart = new Map<string, Orderinfo>();
  if (ids.length === 0) return kaart;
  const { data } = await sb.from('orders').select('id, ordernummer, organisaties(naam)').in('id', ids);
  const rijen =
    (data as unknown as { id: string; ordernummer: number | null; organisaties: { naam: string | null } | null }[]) ?? [];
  for (const o of rijen) kaart.set(o.id, { ordernummer: o.ordernummer, klant_naam: o.organisaties?.naam ?? null });
  return kaart;
}

/** Centen afronden, anders krijg je van optellen bedragen als 412,80000000000007. */
const afgerond = (bedrag: number) => Math.round(bedrag * 100) / 100;

/**
 * Alles wat nog besteld moet worden, gegroepeerd per inkooppartij en daarbinnen
 * per merk. Per groep tellen we stuks en inkoopwaarde op, zodat zichtbaar is of
 * een bestelling in de buurt van een franco-grens komt.
 */
export async function teBestellenPerInkooppartij(): Promise<BestelPartijGroep[]> {
  const sb = kmsAdmin();
  if (!sb) return [];

  const { data: regelData } = await sb
    .from('inkoopregels')
    .select('id, order_id, variant_id, leverancier_id, merk, item_naam, maat, kleur, aantal')
    .eq('status', 'te_bestellen');
  const regels = (regelData as BestelRegelRij[]) ?? [];
  if (regels.length === 0) return [];

  const [leveranciers, prijzen, orders] = await Promise.all([
    haalLeveranciers(sb, uniekeIds(regels.map((r) => r.leverancier_id))),
    haalInkoopprijzen(sb, uniekeIds(regels.map((r) => r.variant_id))),
    haalOrderinfo(sb, uniekeIds(regels.map((r) => r.order_id))),
  ]);

  const partijen = new Map<string, BestelPartijGroep>();

  for (const r of regels) {
    const lev = r.leverancier_id ? leveranciers.get(r.leverancier_id) : undefined;
    const merkNaam = tekst(lev?.naam) ?? tekst(r.merk) ?? 'Zonder merk';
    const partijNaam = tekst(lev?.inkoop_bij) ?? tekst(lev?.naam) ?? tekst(r.merk) ?? 'Zonder leverancier';
    const partijSleutel = partijNaam.toLowerCase();

    let partij = partijen.get(partijSleutel);
    if (!partij) {
      partij = {
        sleutel: partijSleutel,
        inkoopPartij: partijNaam,
        bestelportaal_url: null,
        bestelwijze: null,
        contactpersoon: null,
        email: null,
        telefoon: null,
        telefoon_hoofdkantoor: null,
        merken: [],
        aantalRegels: 0,
        aantalStuks: 0,
        inkoopwaarde: 0,
        regelsZonderPrijs: 0,
      };
      partijen.set(partijSleutel, partij);
    }

    // Portaal en contactgegevens staan per merk in de tabel en horen binnen één
    // handelspartij gelijk te zijn. Staat het bij het ene merk leeg en bij het
    // andere gevuld, dan pakken we de eerste gevulde: anders valt de knop weg
    // door een merkrij waar niemand het veld heeft ingevuld.
    if (!partij.bestelportaal_url) partij.bestelportaal_url = tekst(lev?.bestelportaal_url);
    if (!partij.bestelwijze) partij.bestelwijze = tekst(lev?.bestelwijze);
    if (!partij.contactpersoon) partij.contactpersoon = tekst(lev?.contactpersoon);
    if (!partij.email) partij.email = tekst(lev?.email);
    if (!partij.telefoon) partij.telefoon = tekst(lev?.telefoon);
    if (!partij.telefoon_hoofdkantoor) partij.telefoon_hoofdkantoor = tekst(lev?.telefoon_hoofdkantoor);

    const merkSleutel = r.leverancier_id ?? `merk:${merkNaam.toLowerCase()}`;
    let merk = partij.merken.find((m) => m.sleutel === merkSleutel);
    if (!merk) {
      merk = {
        sleutel: merkSleutel,
        merk: merkNaam,
        leverancier_id: r.leverancier_id,
        bestelportaal_url: tekst(lev?.bestelportaal_url),
        bestelwijze: tekst(lev?.bestelwijze),
        contactpersoon: tekst(lev?.contactpersoon),
        email: tekst(lev?.email),
        telefoon: tekst(lev?.telefoon),
        regels: [],
        aantalStuks: 0,
        inkoopwaarde: 0,
        regelsZonderPrijs: 0,
      };
      partij.merken.push(merk);
    }

    const aantal = Number(r.aantal) || 0;
    const inkoopprijs = r.variant_id ? (prijzen.get(r.variant_id) ?? null) : null;
    const regelwaarde = inkoopprijs === null ? null : afgerond(inkoopprijs * aantal);
    const orderinfo = r.order_id ? orders.get(r.order_id) : undefined;

    merk.regels.push({
      id: r.id,
      merk: merkNaam,
      item_naam: tekst(r.item_naam),
      maat: tekst(r.maat),
      kleur: tekst(r.kleur),
      aantal,
      inkoopprijs,
      regelwaarde,
      order_id: r.order_id,
      ordernummer: orderinfo?.ordernummer ?? null,
      klant_naam: orderinfo?.klant_naam ?? null,
    });

    merk.aantalStuks += aantal;
    partij.aantalStuks += aantal;
    partij.aantalRegels += 1;
    if (regelwaarde === null) {
      merk.regelsZonderPrijs += 1;
      partij.regelsZonderPrijs += 1;
    } else {
      merk.inkoopwaarde += regelwaarde;
      partij.inkoopwaarde += regelwaarde;
    }
  }

  const lijst = [...partijen.values()];
  for (const p of lijst) {
    p.inkoopwaarde = afgerond(p.inkoopwaarde);
    p.merken.sort((a, b) => a.merk.localeCompare(b.merk, 'nl'));
    for (const m of p.merken) {
      m.inkoopwaarde = afgerond(m.inkoopwaarde);
      m.regels.sort(
        (a, b) =>
          (a.item_naam ?? '').localeCompare(b.item_naam ?? '', 'nl') ||
          (a.kleur ?? '').localeCompare(b.kleur ?? '', 'nl') ||
          (a.maat ?? '').localeCompare(b.maat ?? '', 'nl', { numeric: true }),
      );
    }
  }
  lijst.sort((a, b) => a.inkoopPartij.localeCompare(b.inkoopPartij, 'nl'));
  return lijst;
}

/**
 * Vinkt een selectie inkoopregels af als besteld, met de datum van vandaag.
 * De extra filter op status 'te_bestellen' voorkomt dat een tweede klik of een
 * verlopen pagina een al bestelde regel een nieuwe besteldatum geeft. Geeft het
 * aantal regels terug dat werkelijk is bijgewerkt.
 */
export async function markeerRegelsBesteld(ids: string[]): Promise<number> {
  const sb = kmsAdmin();
  const schoon = [...new Set(ids.map((i) => i.trim()).filter(Boolean))];
  if (!sb || schoon.length === 0) return 0;

  const vandaag = new Date().toISOString().slice(0, 10);
  const { data, error } = await sb
    .from('inkoopregels')
    .update({ status: 'besteld', besteld_op: vandaag })
    .in('id', schoon)
    .eq('status', 'te_bestellen')
    .select('id');
  if (error) return 0;
  return ((data as { id: string }[]) ?? []).length;
}

export type LeverancierBestelGroep = {
  leverancier_id: string | null;
  leverancier_naam: string | null;
  heeftEmail: boolean;
  aantalRegels: number;
  aantalStuks: number;
};

/** De te bestellen inkoopregels gegroepeerd per leverancier, voor het in een keer bestellen. */
export async function teBestellenPerLeverancier(): Promise<LeverancierBestelGroep[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('inkoopregels').select('leverancier_id, aantal').eq('status', 'te_bestellen');
  const regels = (data as { leverancier_id: string | null; aantal: number }[]) ?? [];
  if (regels.length === 0) return [];

  const per = new Map<string, { aantalRegels: number; aantalStuks: number }>();
  for (const r of regels) {
    const key = r.leverancier_id ?? 'geen';
    const g = per.get(key) ?? { aantalRegels: 0, aantalStuks: 0 };
    g.aantalRegels += 1;
    g.aantalStuks += Number(r.aantal) || 0;
    per.set(key, g);
  }

  const ids = [...per.keys()].filter((k) => k !== 'geen');
  const info = new Map<string, { naam: string | null; email: string | null }>();
  if (ids.length > 0) {
    const { data: levData } = await sb.from('leveranciers').select('id, naam, email').in('id', ids);
    for (const l of (levData as { id: string; naam: string | null; email: string | null }[]) ?? []) info.set(l.id, { naam: l.naam, email: l.email });
  }

  return [...per.entries()]
    .map(([key, g]) => {
      const lev = key !== 'geen' ? info.get(key) : undefined;
      return {
        leverancier_id: key === 'geen' ? null : key,
        leverancier_naam: lev?.naam ?? null,
        heeftEmail: Boolean(lev?.email && lev.email.trim()),
        aantalRegels: g.aantalRegels,
        aantalStuks: g.aantalStuks,
      };
    })
    .sort((a, b) => (a.leverancier_naam ?? 'zzz').localeCompare(b.leverancier_naam ?? 'zzz', 'nl'));
}

/**
 * Bestelt in een keer alle te bestellen regels bij een leverancier: stuurt (als er een
 * e-mailadres is) een bestelmail met de artikelen en zet alle regels op 'besteld' met de datum van vandaag.
 */
export async function bestelBijLeverancier(leverancierId: string): Promise<{ ok: boolean; aantal: number; gemaild: boolean; leverancier: string | null }> {
  const sb = kmsAdmin(); if (!sb) return { ok: false, aantal: 0, gemaild: false, leverancier: null };

  const { data: levData } = await sb.from('leveranciers').select('naam, email').eq('id', leverancierId).maybeSingle();
  const lev = levData as { naam: string | null; email: string | null } | null;

  const { data: regelData } = await sb
    .from('inkoopregels')
    .select('id, merk, item_naam, maat, kleur, aantal')
    .eq('status', 'te_bestellen')
    .eq('leverancier_id', leverancierId);
  const regels = (regelData as { id: string; merk: string | null; item_naam: string | null; maat: string | null; kleur: string | null; aantal: number }[]) ?? [];
  if (regels.length === 0) return { ok: false, aantal: 0, gemaild: false, leverancier: lev?.naam ?? null };

  let gemaild = false;
  if (lev?.email && lev.email.trim()) {
    const rijenHtml = regels
      .map((r) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eeeeee;">${escapeHtml(r.item_naam ?? '')}${r.merk ? ` (${escapeHtml(r.merk)})` : ''}</td><td style="padding:6px 0;border-bottom:1px solid #eeeeee;">${escapeHtml([r.maat, r.kleur].filter(Boolean).join(', '))}</td><td style="padding:6px 0;border-bottom:1px solid #eeeeee;text-align:right;">${r.aantal}</td></tr>`)
      .join('');
    const html = emailLayout({
      heading: 'Bestelling',
      preheader: 'Nieuwe bestelling van Frederiks Bedrijfskleding',
      bodyHtml: `<p style="margin:0;">Beste ${escapeHtml(lev.naam ?? 'leverancier')},</p><p style="margin:14px 0 0;">Graag onderstaande artikelen voor ons bestellen:</p><table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px;"><thead><tr><th style="text-align:left;border-bottom:2px solid #1c1c1c;padding:6px 0;">Artikel</th><th style="text-align:left;border-bottom:2px solid #1c1c1c;padding:6px 0;">Maat/kleur</th><th style="text-align:right;border-bottom:2px solid #1c1c1c;padding:6px 0;">Aantal</th></tr></thead><tbody>${rijenHtml}</tbody></table><p style="margin:14px 0 0;">Alvast bedankt. Met vriendelijke groet, Frederiks Bedrijfskleding.</p>`,
    });
    const res = await sendEmail({ to: lev.email.trim(), subject: 'Bestelling Frederiks Bedrijfskleding', html }).catch(() => ({ sent: false }));
    gemaild = res.sent;
  }

  const ids = regels.map((r) => r.id);
  const vandaag = new Date().toISOString().slice(0, 10);
  await sb.from('inkoopregels').update({ status: 'besteld', besteld_op: vandaag }).in('id', ids);
  return { ok: true, aantal: regels.length, gemaild, leverancier: lev?.naam ?? null };
}
