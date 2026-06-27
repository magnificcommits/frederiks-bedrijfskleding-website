import { kmsAdmin } from '@/lib/kms/adminClient';
import { maakOrder, voegOrderregelToe } from '@/lib/kms/orders';

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
  created_at: string;
};

export type OfferteMetKlant = Offerte & { organisatie_naam: string | null };
export type OfferteMetTotaal = OfferteMetKlant & { totaal: number };
export type OfferteDetail = Offerte & { organisatie_naam: string | null; organisatie_email: string | null; regels: Offerteregel[] };

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
};

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
}): Promise<{ rijen: OfferteMetTotaal[]; totaal: number }> {
  const sb = kmsAdmin(); if (!sb) return { rijen: [], totaal: 0 };
  const pagina = Math.max(1, opts.pagina);
  const from = (pagina - 1) * opts.perPagina;
  const to = from + opts.perPagina - 1;
  let q = sb
    .from('offertes')
    .select('*, organisaties(naam)', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (opts.status && opts.status.trim()) q = q.eq('status', opts.status.trim());
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
    .order('created_at', { ascending: true });
  return {
    ...(rest as Offerte),
    organisatie_naam: organisaties?.naam ?? null,
    organisatie_email: organisaties?.email_algemeen?.trim() || organisaties?.factuur_email?.trim() || null,
    regels: (regelData as Offerteregel[]) ?? [],
  };
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

export async function voegRegelToe(offerteId: string, v: RegelVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('offerteregels').insert({
    offerte_id: offerteId,
    omschrijving: v.omschrijving,
    aantal: Number(v.aantal) || 0,
    stukprijs: Number(v.stukprijs) || 0,
    korting_pct: Number(v.korting_pct) || 0,
    inkoop: v.inkoop != null && Number.isFinite(Number(v.inkoop)) ? Number(v.inkoop) : null,
  });
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
  const { error } = await sb.from('offerteregels').update(patch).eq('id', regelId);
  return !error;
}

export async function verwijderRegel(regelId: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('offerteregels').delete().eq('id', regelId);
  return !error;
}

export type OfferteProductOptie = {
  product_id: string;
  naam: string;
  merk: string | null;
  varianten: { id: string; maat: string | null; kleur: string | null; verkoopprijs: number | null; inkoop: number | null }[];
};

/**
 * Producten die voor een klant van toepassing zijn (uit het assortiment), met varianten en
 * verkoopprijs, voor de productkiezer op een offerte. Heeft de klant nog geen assortiment,
 * dan vallen we terug op alle actieve producten zodat de kiezer niet leeg is.
 */
export async function getKlantProductOpties(orgId: string | null): Promise<OfferteProductOptie[]> {
  const sb = kmsAdmin(); if (!sb) return [];

  let productIds: string[] | null = null;
  if (orgId) {
    const { data: ass } = await sb
      .from('assortiment')
      .select('product_id, toegestaan')
      .eq('organisatie_id', orgId);
    const toegestaan = ((ass as { product_id: string; toegestaan: boolean }[]) ?? [])
      .filter((a) => a.toegestaan)
      .map((a) => a.product_id);
    if (toegestaan.length > 0) productIds = Array.from(new Set(toegestaan));
  }

  let q = sb
    .from('producten')
    .select('id, naam, merk, product_varianten(id, maat, kleur, verkoopprijs, inkoopprijs, actief)')
    .eq('actief', true)
    .order('naam');
  if (productIds) q = q.in('id', productIds);
  const { data } = await q;

  const rows = (data as unknown as {
    id: string; naam: string; merk: string | null;
    product_varianten: { id: string; maat: string | null; kleur: string | null; verkoopprijs: number | null; inkoopprijs: number | null; actief: boolean | null }[] | null;
  }[]) ?? [];

  return rows.map((p) => ({
    product_id: p.id,
    naam: p.naam,
    merk: p.merk,
    varianten: (p.product_varianten ?? [])
      .filter((v) => v.actief !== false)
      .map((v) => ({ id: v.id, maat: v.maat, kleur: v.kleur, verkoopprijs: v.verkoopprijs, inkoop: v.inkoopprijs }))
      .sort((a, b) => (a.maat ?? '').localeCompare(b.maat ?? '', 'nl') || (a.kleur ?? '').localeCompare(b.kleur ?? '', 'nl')),
  }));
}

/**
 * Zet een offerte om naar een order: maakt een order voor dezelfde klant met de offerteregels
 * (nettoprijs na korting) als orderregels, en zet de offerte op 'geaccepteerd'. Geeft het
 * order-id terug, of null als er geen klant aan de offerte hangt.
 */
export async function maakOrderVanOfferte(offerteId: string): Promise<string | null> {
  const off = await getOfferte(offerteId);
  if (!off || !off.organisatie_id) return null;
  const orderId = await maakOrder({
    organisatie_id: off.organisatie_id,
    status: 'concept',
    notitie: `Aangemaakt uit offerte ${off.offertenummer != null ? `#${off.offertenummer}` : ''}`.trim(),
  });
  if (!orderId) return null;
  for (const r of off.regels) {
    const kort = Number(r.korting_pct) || 0;
    const netto = (Number(r.stukprijs) || 0) * (1 - kort / 100);
    await voegOrderregelToe(orderId, {
      item_naam: r.omschrijving ?? 'Regel',
      aantal: Math.max(1, Math.round(Number(r.aantal) || 1)),
      stukprijs: Math.round(netto * 100) / 100,
    });
  }
  await zetOfferteStatus(offerteId, 'geaccepteerd');
  return orderId;
}
