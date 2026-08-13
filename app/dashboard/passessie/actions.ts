'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, getHuidigeAdmin, kmsAdmin } from '@/lib/kms/adminClient';
import { getVariantKeuze, type VariantKeuze } from '@/lib/kms/passessies';
import { logAudit } from '@/lib/kms/audit';

async function bewaakt() {
  if (!(await dashAuthed())) redirect('/dashboard');
  const sb = kmsAdmin();
  if (!sb) redirect('/dashboard/passessie?fout=geen-db');
  return sb;
}

export async function startPassessie(formData: FormData): Promise<void> {
  const sb = await bewaakt();
  const organisatie_id = String(formData.get('organisatie_id') || '').trim();
  if (!organisatie_id) redirect('/dashboard/passessie?fout=geen-klant');
  const admin = await getHuidigeAdmin();
  const { data, error } = await sb
    .from('passessies')
    .insert({
      organisatie_id,
      locatie: String(formData.get('locatie') || '').trim() || null,
      notitie: String(formData.get('notitie') || '').trim() || null,
      aangemaakt_door: admin?.naam ?? admin?.email ?? null,
    })
    .select('id')
    .single();
  if (error || !data) redirect('/dashboard/passessie?fout=aanmaken');
  await logAudit('passessie_gestart', { entiteit: 'passessie', entiteitId: data.id, details: { organisatie_id } });
  redirect(`/dashboard/passessie/${data.id}`);
}

/** Kleuren en maten van één artikel; wordt vanuit het pasformulier aangeroepen. */
export async function haalVarianten(productId: string): Promise<VariantKeuze> {
  if (!(await dashAuthed())) return { kleuren: [], matenPerKleur: {}, lengtes: [] };
  return getVariantKeuze(productId);
}

export type RegelInvoer = {
  passessieId: string;
  medewerkerId: string | null;
  medewerkerNaam: string | null;
  productId: string;
  variantId: string | null;
  itemNaam: string;
  maat: string | null;
  kleur: string | null;
  lengte: number | null;
  aantal: number;
  stukprijs: number | null;
  opmerking: string | null;
};

export async function voegRegelToe(invoer: RegelInvoer): Promise<{ ok: boolean; fout?: string }> {
  if (!(await dashAuthed())) return { ok: false, fout: 'Geen toegang' };
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Geen database' };
  if (!invoer.medewerkerId && !invoer.medewerkerNaam) return { ok: false, fout: 'Kies eerst een medewerker' };
  if (!invoer.itemNaam) return { ok: false, fout: 'Kies eerst een artikel' };

  const { error } = await sb.from('passessie_regels').insert({
    passessie_id: invoer.passessieId,
    medewerker_id: invoer.medewerkerId,
    medewerker_naam: invoer.medewerkerNaam,
    product_id: invoer.productId,
    variant_id: invoer.variantId,
    item_naam: invoer.itemNaam,
    maat: invoer.maat,
    kleur: invoer.kleur,
    lengte: invoer.lengte,
    aantal: Math.max(1, invoer.aantal || 1),
    stukprijs: invoer.stukprijs,
    opmerking: invoer.opmerking,
  });
  if (error) return { ok: false, fout: error.message };
  revalidatePath(`/dashboard/passessie/${invoer.passessieId}`);
  return { ok: true };
}

export async function verwijderRegel(formData: FormData): Promise<void> {
  const sb = await bewaakt();
  const id = String(formData.get('id') || '');
  const sessie = String(formData.get('passessie_id') || '');
  if (id) await sb.from('passessie_regels').delete().eq('id', id);
  revalidatePath(`/dashboard/passessie/${sessie}`);
}

export async function rondAf(formData: FormData): Promise<void> {
  const sb = await bewaakt();
  const id = String(formData.get('id') || '');
  await sb.from('passessies').update({ status: 'afgerond' }).eq('id', id);
  redirect(`/dashboard/passessie/${id}?ok=afgerond`);
}

export async function heropen(formData: FormData): Promise<void> {
  const sb = await bewaakt();
  const id = String(formData.get('id') || '');
  await sb.from('passessies').update({ status: 'open' }).eq('id', id);
  redirect(`/dashboard/passessie/${id}`);
}

/**
 * Zet een afgeronde sessie om in één order voor de klant. Regels van dezelfde medewerker
 * blijven herkenbaar via de opmerking, zodat de picklijst weet voor wie wat is.
 */
export async function maakOrder(formData: FormData): Promise<void> {
  const sb = await bewaakt();
  const id = String(formData.get('id') || '');

  const { data: sessie } = await sb.from('passessies').select('*').eq('id', id).maybeSingle();
  if (!sessie) redirect('/dashboard/passessie?fout=onbekend');
  if (sessie.order_id) redirect(`/dashboard/orders/${sessie.order_id}`);

  const { data: regels } = await sb.from('passessie_regels').select('*').eq('passessie_id', id);
  if (!regels?.length) redirect(`/dashboard/passessie/${id}?fout=leeg`);

  const { data: order, error: eOrder } = await sb
    .from('orders')
    .insert({
      organisatie_id: sessie.organisatie_id,
      status: 'aangevraagd',
      aangevraagd_door: sessie.aangemaakt_door,
      notitie: `Uit passessie ${sessie.datum}${sessie.locatie ? ' - ' + sessie.locatie : ''}`,
    })
    .select('id')
    .single();
  if (eOrder || !order) redirect(`/dashboard/passessie/${id}?fout=order`);

  const namen = new Map<string, string>();
  const { data: mw } = await sb.from('medewerkers').select('id, naam').eq('organisatie_id', sessie.organisatie_id);
  for (const m of (mw as { id: string; naam: string }[]) ?? []) namen.set(m.id, m.naam);

  const { error: eRegels } = await sb.from('orderregels').insert(
    (regels as Record<string, unknown>[]).map((r) => ({
      order_id: order.id,
      product_id: r.product_id,
      variant_id: r.variant_id,
      item_naam: [
        r.item_naam,
        `voor ${r.medewerker_id ? namen.get(r.medewerker_id as string) ?? 'medewerker' : r.medewerker_naam}`,
      ].join(' - '),
      maat: r.maat,
      kleur: r.kleur,
      lengte: r.lengte,
      aantal: r.aantal,
      stukprijs: r.stukprijs,
    })),
  );
  if (eRegels) redirect(`/dashboard/passessie/${id}?fout=orderregels`);

  await sb.from('passessies').update({ status: 'omgezet', order_id: order.id }).eq('id', id);
  await logAudit('passessie_omgezet', { entiteit: 'order', entiteitId: order.id, details: { passessie: id } });
  redirect(`/dashboard/orders/${order.id}`);
}
