import { revalidateTag } from 'next/cache';
import { kmsAdmin } from '@/lib/kms/adminClient';
import type { Formaat, Kosten, Tarief } from '@/lib/personalisatie';

/**
 * Beheer van de prijslijst voor personalisatie (mail Jessi 21 okt 2026): staffels
 * per techniek en formaat, de formaten zelf, vaste kosten, en afwijkende staffels
 * per klant. Alleen KMS (servicesleutel). De publieke prijsindicatie op de site
 * leest dezelfde tabellen; die cache wordt na elke wijziging ververst.
 */

export type StaffelRij = { vanaf_aantal: number; stukprijs: number };

function schoneStaffel(rijen: { vanaf: unknown; prijs: unknown }[]): StaffelRij[] {
  const uit = new Map<number, number>();
  for (const r of rijen) {
    const vanaf = Math.round(Number(String(r.vanaf ?? '').replace(',', '.')));
    const prijs = Number(String(r.prijs ?? '').replace(',', '.'));
    if (!Number.isFinite(vanaf) || vanaf < 1 || !Number.isFinite(prijs) || prijs < 0 || String(r.prijs ?? '').trim() === '') continue;
    uit.set(vanaf, Math.round(prijs * 100) / 100);
  }
  return [...uit.entries()].sort((a, b) => a[0] - b[0]).map(([vanaf_aantal, stukprijs]) => ({ vanaf_aantal, stukprijs }));
}

export async function leesCentralePrijslijst(): Promise<{ tarieven: Tarief[]; formaten: (Formaat & { id: string })[]; kosten: (Kosten & { id: string })[] }> {
  const sb = kmsAdmin(); if (!sb) return { tarieven: [], formaten: [], kosten: [] };
  const [t, f, k] = await Promise.all([
    sb.from('decoratie_tarieven').select('techniek, formaat, vanaf_aantal, stukprijs').order('vanaf_aantal'),
    sb.from('decoratie_formaten').select('id, techniek, formaat, omschrijving, max_oppervlakte_cm2, volgorde').order('volgorde'),
    sb.from('decoratie_kosten').select('id, techniek, soort, omschrijving, bedrag, eenheid').order('techniek'),
  ]);
  return {
    tarieven: ((t.data as Tarief[]) ?? []).map((r) => ({ ...r, vanaf_aantal: Number(r.vanaf_aantal), stukprijs: Number(r.stukprijs) })),
    formaten: ((f.data as (Formaat & { id: string })[]) ?? []).map((r) => ({ ...r, max_oppervlakte_cm2: r.max_oppervlakte_cm2 == null ? null : Number(r.max_oppervlakte_cm2), volgorde: r.volgorde == null ? null : Number(r.volgorde) })),
    kosten: ((k.data as (Kosten & { id: string })[]) ?? []).map((r) => ({ ...r, bedrag: Number(r.bedrag) })),
  };
}

/** Vervangt de centrale staffel van één techniek en formaat. Leeg = alle staffelregels weg. */
export async function zetCentraleStaffel(techniek: string, formaat: string, rijen: { vanaf: unknown; prijs: unknown }[]): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const staffel = schoneStaffel(rijen);
  const { error } = await sb.from('decoratie_tarieven').delete().eq('techniek', techniek).eq('formaat', formaat);
  if (error) return false;
  if (staffel.length) {
    const { error: e } = await sb.from('decoratie_tarieven').insert(staffel.map((s) => ({ techniek, formaat, ...s })));
    if (e) return false;
  }
  revalidateTag('prijsindicatie');
  return true;
}

/** Nieuw formaat (of nieuwe techniek: dan is dit het eerste formaat ervan). */
export async function voegFormaatToe(v: { techniek: string; formaat: string; omschrijving: string | null; max: number | null; prijs: number | null }): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const techniek = v.techniek.trim().toLowerCase().slice(0, 40);
  const formaat = v.formaat.trim().toUpperCase().slice(0, 20);
  if (!techniek || !formaat) return false;
  const { data } = await sb.from('decoratie_formaten').select('volgorde').eq('techniek', techniek);
  const volgorde = ((data as { volgorde: number | null }[]) ?? []).reduce((m, r) => Math.max(m, Number(r.volgorde) || 0), 0) + 1;
  const { error } = await sb.from('decoratie_formaten').insert({ techniek, formaat, omschrijving: v.omschrijving, max_oppervlakte_cm2: v.max, volgorde });
  if (error) return false;
  if (v.prijs != null && v.prijs >= 0) await sb.from('decoratie_tarieven').insert({ techniek, formaat, vanaf_aantal: 1, stukprijs: v.prijs });
  revalidateTag('prijsindicatie');
  return true;
}

export async function werkFormaat(id: string, v: { omschrijving: string | null; max: number | null }): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('decoratie_formaten').update({ omschrijving: v.omschrijving, max_oppervlakte_cm2: v.max }).eq('id', id);
  revalidateTag('prijsindicatie');
  return !error;
}

/** Formaat verwijderen, met zijn staffel. */
export async function verwijderFormaat(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { data } = await sb.from('decoratie_formaten').select('techniek, formaat').eq('id', id).maybeSingle();
  const f = data as { techniek: string; formaat: string } | null;
  if (!f) return false;
  await sb.from('decoratie_tarieven').delete().eq('techniek', f.techniek).eq('formaat', f.formaat);
  const { error } = await sb.from('decoratie_formaten').delete().eq('id', id);
  revalidateTag('prijsindicatie');
  return !error;
}

export async function werkKosten(id: string, v: { omschrijving: string | null; bedrag: number; eenheid: string }): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('decoratie_kosten').update(v).eq('id', id);
  revalidateTag('prijsindicatie');
  return !error;
}

export async function voegKostenToe(v: { techniek: string; soort: string; omschrijving: string | null; bedrag: number; eenheid: string }): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('decoratie_kosten').insert({ ...v, techniek: v.techniek.trim().toLowerCase(), soort: v.soort.trim().toLowerCase() });
  revalidateTag('prijsindicatie');
  return !error;
}

export async function verwijderKosten(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('decoratie_kosten').delete().eq('id', id);
  revalidateTag('prijsindicatie');
  return !error;
}

/* ---------------- Per klant ---------------- */

export async function leesKlantStaffels(orgId: string): Promise<Tarief[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data, error } = await sb.from('klant_decoratie_tarieven').select('techniek, formaat, vanaf_aantal, stukprijs').eq('organisatie_id', orgId).order('vanaf_aantal');
  if (error) return [];
  return ((data as Tarief[]) ?? []).map((r) => ({ ...r, vanaf_aantal: Number(r.vanaf_aantal), stukprijs: Number(r.stukprijs) }));
}

/** Vervangt de afwijkende staffel van een klant voor één techniek en formaat. Leeg = weer de centrale prijslijst. */
export async function zetKlantStaffel(orgId: string, techniek: string, formaat: string, rijen: { vanaf: unknown; prijs: unknown }[]): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const staffel = schoneStaffel(rijen);
  const { error } = await sb.from('klant_decoratie_tarieven').delete().eq('organisatie_id', orgId).eq('techniek', techniek).eq('formaat', formaat);
  if (error) return false;
  if (staffel.length) {
    const { error: e } = await sb.from('klant_decoratie_tarieven').insert(staffel.map((s) => ({ organisatie_id: orgId, techniek, formaat, ...s })));
    if (e) return false;
  }
  return true;
}

/** Staffelregels uit een formulier: velden vanaf__N en prijs__N. */
export function staffelUitFormulier(fd: FormData): { vanaf: unknown; prijs: unknown }[] {
  const uit: { vanaf: unknown; prijs: unknown }[] = [];
  for (let i = 0; i < 40 && (fd.has(`vanaf__${i}`) || fd.has(`prijs__${i}`)); i++) {
    const vanaf = String(fd.get(`vanaf__${i}`) ?? '').trim() || String(fd.get(`vanafdef__${i}`) ?? '').trim();
    uit.push({ vanaf, prijs: fd.get(`prijs__${i}`) });
  }
  return uit;
}
