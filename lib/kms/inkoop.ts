import type { SupabaseClient } from '@supabase/supabase-js';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { sendEmail, emailLayout, escapeHtml } from '@/lib/email';
import { metIdTerugval, kolomOntbreekt } from '@/lib/kms/kolomTerugval';
import {
  alleRijen,
  inStukken,
  migratieOntbreekt,
  verhoogVoorraad,
  getVoorraadOverzicht,
} from '@/lib/kms/voorraad';

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
  /** Vanaf migratie 20261004_voorraad_inkoop_leveranciers. */
  inkooporder_id?: string | null;
  inkoopprijs?: number | null;
  ontvangen_op?: string | null;
  bron?: string | null;
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
  const prijsPerVariant = new Map<string, number | null>();
  if (variantIds.length > 0) {
    const { data: varData } = await sb.from('product_varianten').select('id, voorraad, inkoopprijs').in('id', variantIds);
    for (const v of (varData as { id: string; voorraad: number; inkoopprijs: number | null }[]) ?? []) {
      voorraadPerVariant.set(v.id, Number(v.voorraad) || 0);
      prijsPerVariant.set(v.id, v.inkoopprijs === null ? null : Number(v.inkoopprijs));
    }
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
      bron: 'order',
      inkoopprijs: r.variant_id ? (prijsPerVariant.get(r.variant_id) ?? null) : null,
    });
  }

  if (nieuw.length === 0) return 0;
  const { error } = await voegRegelsToe(sb, nieuw);
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

  const regels = await werkvoorraadRegels<BestelRegelRij>(
    sb,
    'id, order_id, variant_id, leverancier_id, merk, item_naam, maat, kleur, aantal',
  );
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
  const bijgewerkt = ((data as { id: string }[]) ?? []).map((r) => r.id);
  // Bundel ze meteen in een inkooporder, zodat ze bij "Inkooporders" te volgen zijn.
  if (bijgewerkt.length > 0) await maakInkooporders(bijgewerkt, { status: 'verstuurd', verstuurdPer: 'portaal' });
  return bijgewerkt.length;
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
  const regels = await werkvoorraadRegels<{ leverancier_id: string | null; aantal: number }>(sb, 'leverancier_id, aantal');
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

  const regels = await werkvoorraadRegels<MailRegel & { id: string }>(
    sb,
    'id, merk, item_naam, maat, kleur, aantal',
    leverancierId,
  );
  if (regels.length === 0) return { ok: false, aantal: 0, gemaild: false, leverancier: lev?.naam ?? null };

  let gemaild = false;
  if (lev?.email && lev.email.trim()) {
    const res = await sendEmail({
      to: lev.email.trim(),
      subject: 'Bestelling Frederiks Bedrijfskleding',
      html: bestelmailHtml(lev.naam, regels),
    }).catch(() => ({ sent: false }));
    gemaild = res.sent;
  }

  const ids = regels.map((r) => r.id);
  const vandaag = new Date().toISOString().slice(0, 10);
  await sb.from('inkoopregels').update({ status: 'besteld', besteld_op: vandaag }).in('id', ids);
  await maakInkooporders(ids, { status: 'verstuurd', verstuurdPer: gemaild ? 'mail' : null });
  return { ok: true, aantal: regels.length, gemaild, leverancier: lev?.naam ?? null };
}

/* ========================================================================
   Inkooporders

   Een inkooporder bundelt inkoopregels per inkooppartij (Houweling, Roerdink,
   Velkro). De regels zelf blijven in `inkoopregels`; die krijgen een
   inkooporder_id. Zo blijft de bestaande flow (genereren vanuit een order,
   bestelmail, afvinken) werken en is elke bestelling daarna te volgen tot hij
   binnen is.

   Status: concept -> verstuurd -> deels_ontvangen -> ontvangen (of geannuleerd).
   Een regel in een concept-inkooporder staat nog op 'te_bestellen', maar valt
   wel uit de werkvoorraad omdat hij al in een bestelling zit.
   ======================================================================== */

export const INKOOPORDER_STATUSSEN = ['concept', 'verstuurd', 'deels_ontvangen', 'ontvangen', 'geannuleerd'] as const;
export type InkooporderStatus = (typeof INKOOPORDER_STATUSSEN)[number];
export const INKOOPORDER_LABEL: Record<string, string> = {
  concept: 'concept',
  verstuurd: 'verstuurd',
  deels_ontvangen: 'deels ontvangen',
  ontvangen: 'ontvangen',
  geannuleerd: 'geannuleerd',
};
export const INKOOPORDER_BADGE: Record<string, string> = {
  concept: 'badge-rust',
  verstuurd: 'badge bg-ink-900 text-white',
  deels_ontvangen: 'badge-actie',
  ontvangen: 'badge-klaar',
  geannuleerd: 'badge bg-ink-50 text-ink-400 line-through',
};

const NIEUWE_REGELKOLOMMEN = ['bron', 'inkoopprijs', 'inkooporder_id', 'ontvangen_op'];

/** Datum van vandaag in Nederland als YYYY-MM-DD. */
export function vandaagNL(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date());
}

export function plusDagen(datum: string, dagen: number): string {
  const d = new Date(`${datum}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dagen);
  return d.toISOString().slice(0, 10);
}

/** Insert in inkoopregels; zonder migratie nogmaals zonder de nieuwe kolommen. */
async function voegRegelsToe(sb: SupabaseClient, rijen: Record<string, unknown>[]) {
  const eerste = await sb.from('inkoopregels').insert(rijen);
  if (!kolomOntbreekt(eerste.error)) return eerste;
  const zonder = rijen.map((r) => {
    const c = { ...r };
    for (const k of NIEUWE_REGELKOLOMMEN) delete c[k];
    return c;
  });
  return sb.from('inkoopregels').insert(zonder);
}

/**
 * De te bestellen regels die nog niet in een inkooporder zitten. Bestaat de
 * kolom inkooporder_id nog niet, dan gewoon alle te bestellen regels.
 */
async function werkvoorraadRegels<T>(sb: SupabaseClient, kolommen: string, leverancierId?: string): Promise<T[]> {
  const bouw = (metKolom: boolean) => {
    let q = sb.from('inkoopregels').select(kolommen).eq('status', 'te_bestellen');
    if (leverancierId) q = q.eq('leverancier_id', leverancierId);
    if (metKolom) q = q.is('inkooporder_id', null);
    return q;
  };
  const eerste = await bouw(true);
  if (eerste.error && kolomOntbreekt(eerste.error)) {
    const tweede = await bouw(false);
    return ((tweede.data as unknown as T[]) ?? []);
  }
  return ((eerste.data as unknown as T[]) ?? []);
}

type MailRegel = { merk: string | null; item_naam: string | null; maat: string | null; kleur: string | null; aantal: number };

/** De bestelmail: een nette tabel met artikel, maat/kleur en aantal. */
export function bestelmailHtml(naam: string | null, regels: MailRegel[], referentie?: string | null): string {
  const cel = 'padding:6px 0;border-bottom:1px solid #eeeeee;';
  const rijenHtml = regels
    .map(
      (r) =>
        `<tr><td style="${cel}">${escapeHtml(r.item_naam ?? '')}${r.merk ? ` (${escapeHtml(r.merk)})` : ''}</td><td style="${cel}">${escapeHtml([r.maat, r.kleur].filter(Boolean).join(', '))}</td><td style="${cel}text-align:right;">${r.aantal}</td></tr>`,
    )
    .join('');
  return emailLayout({
    heading: 'Bestelling',
    preheader: 'Nieuwe bestelling van Frederiks Bedrijfskleding',
    bodyHtml: `<p style="margin:0;">Beste ${escapeHtml(naam ?? 'leverancier')},</p><p style="margin:14px 0 0;">Graag onderstaande artikelen voor ons bestellen:</p>${
      referentie ? `<p style="margin:6px 0 0;">Onze referentie: <strong>${escapeHtml(referentie)}</strong></p>` : ''
    }<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px;"><thead><tr><th style="text-align:left;border-bottom:2px solid #1c1c1c;padding:6px 0;">Artikel</th><th style="text-align:left;border-bottom:2px solid #1c1c1c;padding:6px 0;">Maat/kleur</th><th style="text-align:right;border-bottom:2px solid #1c1c1c;padding:6px 0;">Aantal</th></tr></thead><tbody>${rijenHtml}</tbody></table><p style="margin:14px 0 0;">Graag een bevestiging met de verwachte leverdatum. Alvast bedankt.</p><p style="margin:8px 0 0;">Met vriendelijke groet, Frederiks Bedrijfskleding.</p>`,
  });
}

export type Inkooporder = {
  id: string;
  nummer: number | null;
  leverancier_id: string | null;
  inkoop_partij: string | null;
  status: string;
  besteld_op: string | null;
  verwacht_op: string | null;
  ontvangen_op: string | null;
  referentie: string | null;
  notitie: string | null;
  verstuurd_per: string | null;
  created_at: string;
  updated_at: string | null;
};

type LevInfo = {
  id: string;
  naam: string | null;
  inkoop_bij: string | null;
  email: string | null;
  levertijd_dagen: number | null;
  bestelportaal_url: string | null;
  bestelwijze: string | null;
  contactpersoon: string | null;
  telefoon: string | null;
};

async function haalLevInfo(sb: SupabaseClient, ids: string[]): Promise<Map<string, LevInfo>> {
  const kaart = new Map<string, LevInfo>();
  if (ids.length === 0) return kaart;
  const { data } = await sb
    .from('leveranciers')
    .select('id, naam, inkoop_bij, email, levertijd_dagen, bestelportaal_url, bestelwijze, contactpersoon, telefoon')
    .in('id', ids);
  for (const l of (data as LevInfo[]) ?? []) kaart.set(l.id, l);
  return kaart;
}

const partijVan = (lev: LevInfo | undefined, merk: string | null) =>
  tekst(lev?.inkoop_bij) ?? tekst(lev?.naam) ?? tekst(merk) ?? 'Zonder leverancier';

/** Bestaat de tabel inkooporders al? */
export async function inkoopordersKlaar(): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;
  const { error } = await sb.from('inkooporders').select('id').limit(1);
  return !error || !migratieOntbreekt(error);
}

/**
 * Bundelt regels in nieuwe inkooporders, één per inkooppartij. Geeft de
 * id's van de nieuwe inkooporders terug, of klaar:false als de tabel nog
 * niet bestaat (dan blijven de regels gewoon losse regels, zoals voorheen).
 */
export async function maakInkooporders(
  regelIds: string[],
  opties: { status: 'concept' | 'verstuurd'; verstuurdPer?: string | null; verwachtOp?: string | null; notitie?: string | null },
): Promise<{ klaar: boolean; ids: string[] }> {
  const sb = kmsAdmin();
  const schoon = [...new Set(regelIds.filter(Boolean))];
  if (!sb || schoon.length === 0) return { klaar: false, ids: [] };

  const regels = await inStukken<{ id: string; leverancier_id: string | null; merk: string | null; variant_id: string | null }>(
    schoon,
    (stuk) => sb.from('inkoopregels').select('id, leverancier_id, merk, variant_id').in('id', stuk),
  );
  const levs = await haalLevInfo(sb, uniekeIds(regels.map((r) => r.leverancier_id)));

  const groepen = new Map<string, { partij: string; leverancier_id: string | null; levertijd: number | null; regelIds: string[] }>();
  for (const r of regels) {
    const lev = r.leverancier_id ? levs.get(r.leverancier_id) : undefined;
    const partij = partijVan(lev, r.merk);
    const sleutel = partij.toLowerCase();
    const g = groepen.get(sleutel) ?? { partij, leverancier_id: r.leverancier_id, levertijd: null, regelIds: [] };
    if (!g.leverancier_id) g.leverancier_id = r.leverancier_id;
    if (lev?.levertijd_dagen != null) g.levertijd = Math.max(g.levertijd ?? 0, lev.levertijd_dagen);
    g.regelIds.push(r.id);
    groepen.set(sleutel, g);
  }

  const vandaag = vandaagNL();
  const ids: string[] = [];
  for (const g of groepen.values()) {
    const verstuurd = opties.status === 'verstuurd';
    const { data, error } = await sb
      .from('inkooporders')
      .insert({
        leverancier_id: g.leverancier_id,
        inkoop_partij: g.partij,
        status: opties.status,
        besteld_op: verstuurd ? vandaag : null,
        verwacht_op: opties.verwachtOp ?? (verstuurd && g.levertijd ? plusDagen(vandaag, g.levertijd) : null),
        verstuurd_per: verstuurd ? opties.verstuurdPer ?? null : null,
        notitie: opties.notitie ?? null,
      })
      .select('id')
      .single();
    if (error) {
      if (migratieOntbreekt(error)) return { klaar: false, ids };
      continue;
    }
    const id = (data as { id: string }).id;
    ids.push(id);
    await sb.from('inkoopregels').update({ inkooporder_id: id }).in('id', g.regelIds);
    await bevriesPrijzen(sb, g.regelIds);
  }
  return { klaar: true, ids };
}

/** Legt de inkoopprijs van het moment vast op de regel, zodat latere prijswijzigingen de historie niet veranderen. */
async function bevriesPrijzen(sb: SupabaseClient, regelIds: string[]) {
  const { data, error } = await sb.from('inkoopregels').select('id, variant_id, inkoopprijs').in('id', regelIds).is('inkoopprijs', null);
  if (error) return;
  const zonder = (data as { id: string; variant_id: string | null }[]) ?? [];
  const prijzen = await haalInkoopprijzen(sb, uniekeIds(zonder.map((r) => r.variant_id)));
  const perPrijs = new Map<number, string[]>();
  for (const r of zonder) {
    const p = r.variant_id ? prijzen.get(r.variant_id) : undefined;
    if (p === undefined) continue;
    perPrijs.set(p, [...(perPrijs.get(p) ?? []), r.id]);
  }
  for (const [prijs, ids] of perPrijs) await sb.from('inkoopregels').update({ inkoopprijs: prijs }).in('id', ids);
}

type PoRegelDb = {
  id: string;
  inkooporder_id: string | null;
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
  geleverd_aantal: number | null;
  status: string;
  inkoopprijs: number | null;
  ontvangen_op: string | null;
  bron: string | null;
};

export type InkooporderRegel = PoRegelDb & {
  prijs: number | null;
  waarde: number | null;
  rest: number;
  ordernummer: number | null;
  klant_naam: string | null;
};

export type InkooporderOverzicht = Inkooporder & {
  aantalRegels: number;
  stuks: number;
  ontvangenStuks: number;
  waarde: number;
  openWaarde: number;
  merken: string[];
  klantorders: { id: string; ordernummer: number | null; klant_naam: string | null }[];
  teLaat: boolean;
  /** Dagen te laat (positief) of nog te gaan (negatief), null zonder verwachte datum. */
  dagenTeLaat: number | null;
};

const OPEN_PO = ['verstuurd', 'deels_ontvangen'];

function dagenTussen(van: string, tot: string): number {
  return Math.round((Date.parse(`${tot}T12:00:00Z`) - Date.parse(`${van}T12:00:00Z`)) / 86_400_000);
}

async function verrijkRegels(sb: SupabaseClient, regels: PoRegelDb[]): Promise<InkooporderRegel[]> {
  const [prijzen, orders] = await Promise.all([
    haalInkoopprijzen(sb, uniekeIds(regels.filter((r) => r.inkoopprijs === null).map((r) => r.variant_id))),
    haalOrderinfo(sb, uniekeIds(regels.map((r) => r.order_id))),
  ]);
  return regels.map((r) => {
    const prijs = r.inkoopprijs !== null ? Number(r.inkoopprijs) : r.variant_id ? prijzen.get(r.variant_id) ?? null : null;
    const aantal = Number(r.aantal) || 0;
    const geleverd = Number(r.geleverd_aantal) || 0;
    const o = r.order_id ? orders.get(r.order_id) : undefined;
    return {
      ...r,
      aantal,
      geleverd_aantal: geleverd,
      prijs,
      waarde: prijs === null ? null : afgerond(prijs * aantal),
      rest: Math.max(0, aantal - geleverd),
      ordernummer: o?.ordernummer ?? null,
      klant_naam: o?.klant_naam ?? null,
    };
  });
}

function vatSamen(po: Inkooporder, regels: InkooporderRegel[], vandaag: string): InkooporderOverzicht {
  let stuks = 0;
  let ontvangen = 0;
  let waarde = 0;
  let openWaarde = 0;
  const merken = new Set<string>();
  const klant = new Map<string, { id: string; ordernummer: number | null; klant_naam: string | null }>();
  for (const r of regels) {
    stuks += r.aantal;
    ontvangen += Math.min(r.aantal, Number(r.geleverd_aantal) || 0);
    if (r.prijs !== null) {
      waarde += r.prijs * r.aantal;
      openWaarde += r.prijs * r.rest;
    }
    if (r.merk) merken.add(r.merk);
    if (r.order_id) klant.set(r.order_id, { id: r.order_id, ordernummer: r.ordernummer, klant_naam: r.klant_naam });
  }
  const open = OPEN_PO.includes(po.status);
  const dagen = po.verwacht_op && open ? dagenTussen(po.verwacht_op, vandaag) : null;
  return {
    ...po,
    aantalRegels: regels.length,
    stuks,
    ontvangenStuks: ontvangen,
    waarde: afgerond(waarde),
    openWaarde: afgerond(open || po.status === 'concept' ? openWaarde : 0),
    merken: [...merken].sort((a, b) => a.localeCompare(b, 'nl')),
    klantorders: [...klant.values()],
    teLaat: dagen !== null && dagen > 0,
    dagenTeLaat: dagen,
  };
}

const PO_REGEL_KOLOMMEN =
  'id, inkooporder_id, order_id, orderregel_id, product_id, variant_id, leverancier_id, merk, item_naam, maat, kleur, aantal, geleverd_aantal, status, inkoopprijs, ontvangen_op, bron';

export type InkooporderFilter = {
  status?: string;
  partij?: string;
  /** 'week', '30', '90', '365' of leeg voor alles. */
  periode?: string;
  ordernummer?: string;
};

export async function listInkooporders(f: InkooporderFilter = {}): Promise<{ klaar: boolean; orders: InkooporderOverzicht[]; partijen: string[] }> {
  const sb = kmsAdmin();
  if (!sb) return { klaar: false, orders: [], partijen: [] };
  const { rijen: pos, error } = await alleRijen<Inkooporder>((van, tot) =>
    sb.from('inkooporders').select('*').order('created_at', { ascending: false }).range(van, tot),
  );
  if (error) return { klaar: !migratieOntbreekt(error), orders: [], partijen: [] };

  const partijen = [...new Set(pos.map((p) => p.inkoop_partij).filter((p): p is string => Boolean(p)))].sort((a, b) => a.localeCompare(b, 'nl'));
  const vandaag = vandaagNL();

  let gefilterd = pos;
  if (f.status === 'open') gefilterd = gefilterd.filter((p) => OPEN_PO.includes(p.status));
  else if (f.status === 'te_laat') gefilterd = gefilterd.filter((p) => OPEN_PO.includes(p.status) && p.verwacht_op && p.verwacht_op < vandaag);
  else if (f.status) gefilterd = gefilterd.filter((p) => p.status === f.status);
  if (f.partij) gefilterd = gefilterd.filter((p) => (p.inkoop_partij ?? '') === f.partij);
  if (f.periode) {
    const dagen = f.periode === 'week' ? 7 : Number(f.periode) || 0;
    if (dagen > 0) {
      const grens = plusDagen(vandaag, -dagen);
      gefilterd = gefilterd.filter((p) => (p.besteld_op ?? p.created_at.slice(0, 10)) >= grens);
    }
  }

  const ids = gefilterd.map((p) => p.id);
  const regelsDb = await inStukken<PoRegelDb>(ids, (stuk) => sb.from('inkoopregels').select(PO_REGEL_KOLOMMEN).in('inkooporder_id', stuk));
  const regels = await verrijkRegels(sb, regelsDb);
  const perPo = new Map<string, InkooporderRegel[]>();
  for (const r of regels) if (r.inkooporder_id) perPo.set(r.inkooporder_id, [...(perPo.get(r.inkooporder_id) ?? []), r]);

  let orders = gefilterd.map((p) => vatSamen(p, perPo.get(p.id) ?? [], vandaag));
  const zoekNr = (f.ordernummer ?? '').replace(/[^0-9]/g, '');
  if (zoekNr) orders = orders.filter((o) => o.klantorders.some((k) => String(k.ordernummer ?? '') === zoekNr));
  return { klaar: true, orders, partijen };
}

export type InkooporderDetail = {
  order: InkooporderOverzicht;
  regels: InkooporderRegel[];
  /** Gegevens van de inkooppartij: eerste gevulde waarde over de merkrijen. */
  partij: {
    email: string | null;
    bestelportaal_url: string | null;
    bestelwijze: string | null;
    contactpersoon: string | null;
    telefoon: string | null;
    levertijd_dagen: number | null;
  };
};

export async function getInkooporder(id: string): Promise<InkooporderDetail | null> {
  const sb = kmsAdmin();
  if (!sb || !id) return null;
  const { data, error } = await sb.from('inkooporders').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  const po = data as Inkooporder;
  const { data: regelData } = await sb.from('inkoopregels').select(PO_REGEL_KOLOMMEN).eq('inkooporder_id', id).order('created_at');
  const regels = await verrijkRegels(sb, (regelData as unknown as PoRegelDb[]) ?? []);
  regels.sort(
    (a, b) =>
      (a.merk ?? '').localeCompare(b.merk ?? '', 'nl') ||
      (a.item_naam ?? '').localeCompare(b.item_naam ?? '', 'nl') ||
      (a.kleur ?? '').localeCompare(b.kleur ?? '', 'nl') ||
      (a.maat ?? '').localeCompare(b.maat ?? '', 'nl', { numeric: true }),
  );

  const levIds = uniekeIds([po.leverancier_id, ...regels.map((r) => r.leverancier_id)]);
  const levs = [...(await haalLevInfo(sb, levIds)).values()];
  // Merkrijen van dezelfde partij die geen regel in deze order hebben, horen er ook bij.
  if (po.inkoop_partij) {
    const { data: zelfde } = await sb
      .from('leveranciers')
      .select('id, naam, inkoop_bij, email, levertijd_dagen, bestelportaal_url, bestelwijze, contactpersoon, telefoon')
      .eq('inkoop_bij', po.inkoop_partij);
    for (const l of (zelfde as LevInfo[]) ?? []) if (!levs.some((x) => x.id === l.id)) levs.push(l);
  }
  const eerste = (k: keyof LevInfo) => {
    const hoofd = levs.find((l) => l.id === po.leverancier_id);
    const v = hoofd && tekst(hoofd[k] as string | null);
    if (v) return v;
    for (const l of levs) {
      const w = tekst(l[k] as string | null);
      if (w) return w;
    }
    return null;
  };
  const levertijden = levs.map((l) => l.levertijd_dagen).filter((d): d is number => d != null);

  return {
    order: vatSamen(po, regels, vandaagNL()),
    regels,
    partij: {
      email: eerste('email'),
      bestelportaal_url: eerste('bestelportaal_url'),
      bestelwijze: eerste('bestelwijze'),
      contactpersoon: eerste('contactpersoon'),
      telefoon: eerste('telefoon'),
      levertijd_dagen: levertijden.length ? Math.max(...levertijden) : null,
    },
  };
}

/**
 * Zet de klantorder een stap verder op basis van zijn inkoopregels. Alleen
 * vooruit en alleen vanuit de inkoopfase: een order die al bij het bedrukken
 * zit, zetten we niet terug naar "besteld".
 */
async function werkKlantordersBij(sb: SupabaseClient, orderIds: string[]): Promise<{ order_id: string; status: string }[]> {
  const wijzigingen: { order_id: string; status: string }[] = [];
  for (const orderId of uniekeIds(orderIds)) {
    const [{ data: oData }, { data: rData }] = await Promise.all([
      sb.from('orders').select('status').eq('id', orderId).maybeSingle(),
      sb.from('inkoopregels').select('status, aantal, geleverd_aantal').eq('order_id', orderId),
    ]);
    const huidig = (oData as { status: string | null } | null)?.status ?? null;
    const regels = (rData as { status: string; aantal: number; geleverd_aantal: number | null }[]) ?? [];
    if (!huidig || regels.length === 0) continue;

    const allesBinnen = regels.every((r) => r.status === 'geleverd' || (Number(r.geleverd_aantal) || 0) >= (Number(r.aantal) || 0));
    const ietsBinnen = regels.some((r) => (Number(r.geleverd_aantal) || 0) > 0);
    const allesBesteld = regels.every((r) => r.status !== 'te_bestellen');

    let doel: string | null = null;
    if (allesBinnen && ['nog_bestellen', 'besteld', 'deellevering'].includes(huidig)) doel = 'compleet_geleverd';
    else if (ietsBinnen && ['nog_bestellen', 'besteld'].includes(huidig)) doel = 'deellevering';
    else if (allesBesteld && huidig === 'nog_bestellen') doel = 'besteld';
    if (doel && doel !== huidig) {
      const { error } = await sb.from('orders').update({ status: doel }).eq('id', orderId);
      if (!error) wijzigingen.push({ order_id: orderId, status: doel });
    }
  }
  return wijzigingen;
}

async function herberekenInkooporder(sb: SupabaseClient, poId: string): Promise<string | null> {
  const [{ data: po }, { data: rData }] = await Promise.all([
    sb.from('inkooporders').select('status').eq('id', poId).maybeSingle(),
    sb.from('inkoopregels').select('status, aantal, geleverd_aantal').eq('inkooporder_id', poId),
  ]);
  const huidig = (po as { status: string } | null)?.status;
  if (!huidig || huidig === 'geannuleerd') return huidig ?? null;
  const regels = (rData as { status: string; aantal: number; geleverd_aantal: number | null }[]) ?? [];
  if (regels.length === 0) return huidig;
  const allesBinnen = regels.every((r) => (Number(r.geleverd_aantal) || 0) >= (Number(r.aantal) || 0));
  const ietsBinnen = regels.some((r) => (Number(r.geleverd_aantal) || 0) > 0);
  const doel = allesBinnen ? 'ontvangen' : ietsBinnen ? 'deels_ontvangen' : huidig === 'concept' ? 'concept' : 'verstuurd';
  if (doel !== huidig) {
    await sb
      .from('inkooporders')
      .update({ status: doel, ontvangen_op: doel === 'ontvangen' ? vandaagNL() : null, updated_at: new Date().toISOString() })
      .eq('id', poId);
  }
  return doel;
}

export type OntvangstResultaat = {
  ok: boolean;
  status: 'deels' | 'geleverd' | null;
  geboekt: number;
  /** Voorraad opgehoogd (bijbestelling zonder klantorder). */
  naarVoorraad: boolean;
  klantorders: { order_id: string; status: string }[];
  inkooporderStatus: string | null;
};

/**
 * Boekt een ontvangst op één regel: het aantal dat nú binnenkomt komt bij wat
 * er al binnen was. Hoort de regel bij een klantorder, dan gaat het niet de
 * voorraad in maar schuift de klantorder op naar deellevering of compleet
 * geleverd. Zonder klantorder (bijbestelling) gaat het wel de voorraad in, met
 * een mutatie 'ontvangst' in de historie.
 */
export async function boekOntvangst(regelId: string, nuOntvangen: number | null, actor?: string | null): Promise<OntvangstResultaat> {
  const mislukt: OntvangstResultaat = { ok: false, status: null, geboekt: 0, naarVoorraad: false, klantorders: [], inkooporderStatus: null };
  const sb = kmsAdmin();
  if (!sb || !regelId) return mislukt;
  const { data } = await sb.from('inkoopregels').select('*').eq('id', regelId).maybeSingle();
  const r = data as (PoRegelDb & { besteld_op: string | null }) | null;
  if (!r) return mislukt;

  const besteld = Number(r.aantal) || 0;
  const al = Number(r.geleverd_aantal) || 0;
  const rest = Math.max(0, besteld - al);
  const n = nuOntvangen === null ? rest : Math.max(0, Math.round(nuOntvangen));
  if (n === 0) return { ...mislukt, ok: true, status: r.status === 'geleverd' ? 'geleverd' : 'deels' };
  const totaal = al + n;
  const status: 'deels' | 'geleverd' = totaal >= besteld ? 'geleverd' : 'deels';

  const res = await metIdTerugval(
    { status, geleverd_aantal: totaal, ontvangen_op: vandaagNL(), ...(r.besteld_op ? {} : { besteld_op: vandaagNL() }) },
    ['ontvangen_op'],
    (rij) => sb.from('inkoopregels').update(rij).eq('id', regelId),
  );
  if (res.error) return mislukt;

  let naarVoorraad = false;
  if (!r.order_id && r.variant_id) {
    const v = await verhoogVoorraad(r.variant_id, n, 'ontvangst', {
      inkoopregelId: regelId,
      actor: actor ?? null,
      notitie: 'Ontvangst inkoop',
    });
    naarVoorraad = v.ok;
  }
  const klantorders = r.order_id ? await werkKlantordersBij(sb, [r.order_id]) : [];
  const inkooporderStatus = r.inkooporder_id ? await herberekenInkooporder(sb, r.inkooporder_id) : null;
  return { ok: true, status, geboekt: n, naarVoorraad, klantorders, inkooporderStatus };
}

/** Alles wat nog openstaat in één keer binnen boeken. */
export async function boekAllesOntvangen(poId: string, actor?: string | null): Promise<{ regels: number; stuks: number }> {
  const sb = kmsAdmin();
  if (!sb || !poId) return { regels: 0, stuks: 0 };
  const { data } = await sb.from('inkoopregels').select('id, aantal, geleverd_aantal').eq('inkooporder_id', poId);
  let regels = 0;
  let stuks = 0;
  for (const r of (data as { id: string; aantal: number; geleverd_aantal: number | null }[]) ?? []) {
    const rest = Math.max(0, (Number(r.aantal) || 0) - (Number(r.geleverd_aantal) || 0));
    if (rest === 0) continue;
    const res = await boekOntvangst(r.id, rest, actor);
    if (res.ok) {
      regels += 1;
      stuks += res.geboekt;
    }
  }
  return { regels, stuks };
}

/**
 * Verstuurt een concept-inkooporder: status verstuurd, besteldatum vandaag,
 * verwachte datum uit de levertijd als die nog leeg is, en de regels op
 * besteld. Met mail=true gaat de bestelmail naar het adres van de partij.
 */
export async function verstuurInkooporder(
  id: string,
  opties: { mail: boolean },
): Promise<{ ok: boolean; gemaild: boolean; mailFout: string | null; klantorders: { order_id: string; status: string }[] }> {
  const sb = kmsAdmin();
  const leeg = { ok: false, gemaild: false, mailFout: null, klantorders: [] };
  if (!sb || !id) return leeg;
  const detail = await getInkooporder(id);
  if (!detail || detail.order.status === 'geannuleerd') return leeg;
  const vandaag = vandaagNL();

  let gemaild = false;
  let mailFout: string | null = null;
  if (opties.mail) {
    if (!detail.partij.email) mailFout = 'Geen e-mailadres bekend bij deze leverancier.';
    else {
      const res = await sendEmail({
        to: detail.partij.email,
        subject: `Bestelling Frederiks Bedrijfskleding${detail.order.nummer ? ` (inkooporder ${detail.order.nummer})` : ''}`,
        html: bestelmailHtml(detail.order.inkoop_partij, detail.regels, detail.order.nummer ? `inkooporder ${detail.order.nummer}` : null),
      }).catch((e: unknown) => ({ sent: false, error: e instanceof Error ? e.message : 'Versturen mislukt.' }));
      gemaild = res.sent;
      if (!res.sent) mailFout = ('error' in res && res.error) || 'Versturen mislukt.';
    }
  }

  const { error } = await sb
    .from('inkooporders')
    .update({
      status: detail.order.status === 'concept' ? 'verstuurd' : detail.order.status,
      besteld_op: detail.order.besteld_op ?? vandaag,
      verwacht_op:
        detail.order.verwacht_op ??
        (detail.partij.levertijd_dagen ? plusDagen(vandaag, detail.partij.levertijd_dagen) : null),
      verstuurd_per: gemaild ? 'mail' : detail.order.verstuurd_per ?? (opties.mail ? null : 'portaal'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return { ...leeg, gemaild, mailFout };

  await sb.from('inkoopregels').update({ status: 'besteld', besteld_op: vandaag }).eq('inkooporder_id', id).eq('status', 'te_bestellen');
  const klantorders = await werkKlantordersBij(sb, detail.regels.map((r) => r.order_id).filter((o): o is string => Boolean(o)));
  return { ok: true, gemaild, mailFout, klantorders };
}

export async function werkInkooporder(id: string, velden: { verwacht_op?: string | null; referentie?: string | null; notitie?: string | null }): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb || !id) return false;
  const { error } = await sb.from('inkooporders').update({ ...velden, updated_at: new Date().toISOString() }).eq('id', id);
  return !error;
}

/**
 * Concept weggooien of verstuurde order annuleren. Regels waar nog niets van
 * binnen is gaan terug naar de werkvoorraad; regels met een ontvangst blijven
 * aan de order hangen, want die goederen zijn er echt.
 */
export async function annuleerInkooporder(id: string): Promise<{ ok: boolean; terug: number; verwijderd: boolean }> {
  const sb = kmsAdmin();
  if (!sb || !id) return { ok: false, terug: 0, verwijderd: false };
  const { data: po } = await sb.from('inkooporders').select('status').eq('id', id).maybeSingle();
  const status = (po as { status: string } | null)?.status;
  if (!status) return { ok: false, terug: 0, verwijderd: false };

  const { data: terugData } = await sb
    .from('inkoopregels')
    .update({ inkooporder_id: null, status: 'te_bestellen', besteld_op: null })
    .eq('inkooporder_id', id)
    .or('geleverd_aantal.is.null,geleverd_aantal.eq.0')
    .select('id');
  const terug = ((terugData as unknown[]) ?? []).length;

  const { count } = await sb.from('inkoopregels').select('id', { count: 'exact', head: true }).eq('inkooporder_id', id);
  if (status === 'concept' && !count) {
    const { error } = await sb.from('inkooporders').delete().eq('id', id);
    return { ok: !error, terug, verwijderd: !error };
  }
  const { error } = await sb.from('inkooporders').update({ status: 'geannuleerd', updated_at: new Date().toISOString() }).eq('id', id);
  return { ok: !error, terug, verwijderd: false };
}

/** Eén regel uit een inkooporder terug naar de werkvoorraad (alleen als er nog niets van binnen is). */
export async function regelUitInkooporder(regelId: string): Promise<{ ok: boolean; poId: string | null }> {
  const sb = kmsAdmin();
  if (!sb || !regelId) return { ok: false, poId: null };
  const { data } = await sb.from('inkoopregels').select('inkooporder_id, geleverd_aantal').eq('id', regelId).maybeSingle();
  const r = data as { inkooporder_id: string | null; geleverd_aantal: number | null } | null;
  if (!r || (Number(r.geleverd_aantal) || 0) > 0) return { ok: false, poId: r?.inkooporder_id ?? null };
  const { error } = await sb.from('inkoopregels').update({ inkooporder_id: null, status: 'te_bestellen', besteld_op: null }).eq('id', regelId);
  return { ok: !error, poId: r.inkooporder_id };
}

export type InkoopKpis = {
  teBestellenWaarde: number;
  teBestellenRegels: number;
  openWaarde: number;
  openRegels: number;
  /** null = inkooporders bestaan nog niet, dus geen verwachte datums. */
  teLaat: number | null;
  teLaatWaarde: number | null;
  dezeWeek: number | null;
  concepten: number | null;
};

export async function inkoopKpis(): Promise<InkoopKpis> {
  const sb = kmsAdmin();
  const leeg: InkoopKpis = { teBestellenWaarde: 0, teBestellenRegels: 0, openWaarde: 0, openRegels: 0, teLaat: null, teLaatWaarde: null, dezeWeek: null, concepten: null };
  if (!sb) return leeg;

  const { rijen } = await alleRijen<{ variant_id: string | null; aantal: number; geleverd_aantal: number | null; status: string; inkoopprijs?: number | null }>(
    (van, tot) => sb.from('inkoopregels').select('variant_id, aantal, geleverd_aantal, status').in('status', ['te_bestellen', 'besteld', 'deels']).range(van, tot),
  );
  const prijzen = await haalInkoopprijzen(sb, uniekeIds(rijen.map((r) => r.variant_id)));
  const k = { ...leeg };
  for (const r of rijen) {
    const p = r.variant_id ? prijzen.get(r.variant_id) ?? 0 : 0;
    const rest = Math.max(0, (Number(r.aantal) || 0) - (Number(r.geleverd_aantal) || 0));
    if (r.status === 'te_bestellen') {
      k.teBestellenRegels += 1;
      k.teBestellenWaarde += p * rest;
    } else {
      k.openRegels += 1;
      k.openWaarde += p * rest;
    }
  }
  k.teBestellenWaarde = afgerond(k.teBestellenWaarde);
  k.openWaarde = afgerond(k.openWaarde);

  const { klaar, orders } = await listInkooporders({});
  if (klaar) {
    const vandaag = vandaagNL();
    const dag = (new Date(`${vandaag}T12:00:00Z`).getUTCDay() + 6) % 7; // maandag = 0
    const maandag = plusDagen(vandaag, -dag);
    const zondag = plusDagen(maandag, 6);
    const open = orders.filter((o) => OPEN_PO.includes(o.status));
    const laat = open.filter((o) => o.teLaat);
    k.teLaat = laat.length;
    k.teLaatWaarde = afgerond(laat.reduce((t, o) => t + o.openWaarde, 0));
    k.dezeWeek = open.filter((o) => o.verwacht_op && o.verwacht_op >= maandag && o.verwacht_op <= zondag).length;
    k.concepten = orders.filter((o) => o.status === 'concept').length;
  }
  return k;
}

/**
 * Zet voor alle voorraadartikelen onder hun minimum een inkoopregel klaar.
 * Aantal = minimum - (beschikbaar + al onderweg), zodat een tweede klik niets
 * dubbel bestelt. Met variantIds alleen voor die selectie.
 */
export async function maakBijbestelregels(variantIds?: string[]): Promise<{ regels: number; stuks: number }> {
  const sb = kmsAdmin();
  if (!sb) return { regels: 0, stuks: 0 };
  const { rijen } = await getVoorraadOverzicht();
  const filter = variantIds && variantIds.length ? new Set(variantIds) : null;
  const nieuw: Record<string, unknown>[] = [];
  let stuks = 0;
  for (const r of rijen) {
    if (filter && !filter.has(r.variant_id)) continue;
    if (!r.bijhouden || r.min_voorraad == null) continue;
    const tekort = r.min_voorraad - (r.beschikbaar + r.onderweg);
    if (tekort <= 0) continue;
    stuks += tekort;
    nieuw.push({
      order_id: null,
      orderregel_id: null,
      product_id: r.product_id,
      variant_id: r.variant_id,
      leverancier_id: r.leverancier_id,
      merk: r.merk,
      item_naam: r.product_naam,
      maat: r.maat,
      kleur: r.kleur,
      aantal: tekort,
      status: 'te_bestellen',
      bron: 'bijbestellen',
      inkoopprijs: r.inkoopprijs,
    });
  }
  if (nieuw.length === 0) return { regels: 0, stuks: 0 };
  for (let i = 0; i < nieuw.length; i += 200) {
    const { error } = await voegRegelsToe(sb, nieuw.slice(i, i + 200));
    if (error) return { regels: i, stuks };
  }
  return { regels: nieuw.length, stuks };
}

/** Regels die nog binnen moeten komen maar (nog) niet in een inkooporder zitten: oude data of migratie nog niet gedraaid. */
export async function losseOpenRegels(): Promise<InkoopregelMetLeverancier[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const bouw = (metKolom: boolean) => {
    let q = sb.from('inkoopregels').select('*, leveranciers(naam)').in('status', ['besteld', 'deels', 'geleverd']).order('created_at', { ascending: false }).limit(500);
    if (metKolom) q = q.is('inkooporder_id', null);
    return q;
  };
  let res = await bouw(true);
  if (res.error && kolomOntbreekt(res.error)) res = await bouw(false);
  const rows = (res.data as unknown as (Inkoopregel & { leveranciers: { naam: string } | null })[]) ?? [];
  return rows.map((r) => {
    const { leveranciers, ...rest } = r;
    return { ...rest, leverancier_naam: leveranciers?.naam ?? null } as InkoopregelMetLeverancier;
  });
}
