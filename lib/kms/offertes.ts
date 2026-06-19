import { kmsAdmin } from '@/lib/kms/adminClient';

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
  created_at: string;
};

export type OfferteMetKlant = Offerte & { organisatie_naam: string | null };
export type OfferteMetTotaal = OfferteMetKlant & { totaal: number };
export type OfferteDetail = Offerte & { organisatie_naam: string | null; regels: Offerteregel[] };

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
};

/** Subtotaal (som aantal*stukprijs), btw en totaal voor een set regels. */
export function offerteTotalen(
  regels: { aantal: number | null; stukprijs: number | null }[],
  btwPct: number | null | undefined,
): { subtotaal: number; btw: number; totaal: number } {
  const subtotaal = regels.reduce(
    (t, r) => t + (Number(r.aantal) || 0) * (Number(r.stukprijs) || 0),
    0,
  );
  const pct = Number(btwPct);
  const btw = subtotaal * (Number.isFinite(pct) ? pct : 0) / 100;
  return {
    subtotaal: Math.round(subtotaal * 100) / 100,
    btw: Math.round(btw * 100) / 100,
    totaal: Math.round((subtotaal + btw) * 100) / 100,
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
      .select('offerte_id, aantal, stukprijs')
      .in('offerte_id', ids);
    const regels = (regelData as { offerte_id: string; aantal: number | null; stukprijs: number | null }[]) ?? [];
    const subtotaalPer = new Map<string, number>();
    for (const r of regels) {
      const sub = (Number(r.aantal) || 0) * (Number(r.stukprijs) || 0);
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
    .select('*, organisaties(naam)')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const rij = data as unknown as Offerte & { organisaties: { naam: string } | null };
  const { organisaties, ...rest } = rij;
  const { data: regelData } = await sb
    .from('offerteregels')
    .select('*')
    .eq('offerte_id', id)
    .order('created_at', { ascending: true });
  return {
    ...(rest as Offerte),
    organisatie_naam: organisaties?.naam ?? null,
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
  const aantal = Number(v.aantal) || 0;
  const stukprijs = Number(v.stukprijs) || 0;
  const { error } = await sb.from('offerteregels').insert({
    offerte_id: offerteId,
    omschrijving: v.omschrijving,
    aantal,
    stukprijs,
  });
  return !error;
}

export async function werkRegel(regelId: string, v: RegelVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const aantal = Number(v.aantal) || 0;
  const stukprijs = Number(v.stukprijs) || 0;
  const { error } = await sb
    .from('offerteregels')
    .update({ omschrijving: v.omschrijving, aantal, stukprijs })
    .eq('id', regelId);
  return !error;
}

export async function verwijderRegel(regelId: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('offerteregels').delete().eq('id', regelId);
  return !error;
}
