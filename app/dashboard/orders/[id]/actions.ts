'use server';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import {
  voegOrderregelToe,
  verwijderOrderregel,
  zetOrderStatus,
  zetGoedkeuring,
  listVariantenVoorProduct,
  listProductenVoorRegels,
  werkOrderGegevens,
  type OrderVariant,
  type OrderProduct,
} from '@/lib/kms/orders';
import { genereerInkoopregels } from '@/lib/kms/inkoop';

/**
 * Bedrag of aantal uit een invoerveld. Nederlandse notatie: staat er een komma,
 * dan is dat het decimaalteken en zijn de punten duizendtallen (1.234,50).
 * Onleesbare invoer wordt null in plaats van NaN, want NaN belandt anders in de
 * database en maakt het ordertotaal onbruikbaar.
 */
function getalOfNull(raw: string): number | null {
  const schoon = raw.replace(/[^0-9.,-]/g, '').trim();
  if (schoon === '') return null;
  const genormaliseerd = schoon.includes(',') ? schoon.replace(/\./g, '').replace(',', '.') : schoon;
  const getal = Number(genormaliseerd);
  return Number.isFinite(getal) ? getal : null;
}

/** Terug naar de orderpagina met een melding; zonder id terug naar de lijst. */
function terugNaarOrder(orderId: string, ok: string): never {
  if (!orderId) redirect('/dashboard/orders');
  redirect(`/dashboard/orders/${orderId}?ok=${ok}`);
}

/**
 * De actieve catalogus voor de regelkiezer. De kiezer haalt hem zelf op zodra
 * hij in beeld komt, zodat de orderpagina niet bij elke keer openen de hele
 * catalogus meesleept voor iemand die alleen even de status komt bijwerken.
 */
export async function haalArtikelen(): Promise<OrderProduct[]> {
  if (!(await dashAuthed())) return [];
  return listProductenVoorRegels();
}

/**
 * Maten en kleuren van één artikel. Wordt vanuit de regelkiezer in de browser
 * aangeroepen zodra er een artikel is gekozen, zodat niet de complete
 * variantentabel (tienduizenden rijen) met elke orderpagina meegestuurd hoeft.
 */
export async function haalVarianten(productId: string): Promise<OrderVariant[]> {
  if (!(await dashAuthed())) return [];
  return listVariantenVoorProduct(productId);
}

export async function voegRegelToe(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  const item_naam = String(formData.get('item_naam') ?? '').trim();
  const product_id = String(formData.get('product_id') ?? '').trim() || null;
  const variant_id = String(formData.get('variant_id') ?? '').trim() || null;
  const maat = String(formData.get('maat') ?? '').trim() || null;
  const kleur = String(formData.get('kleur') ?? '').trim() || null;
  // Broeklengte staat alleen bij maatwerkartikelen in het formulier; ontbreekt hij, dan blijft hij leeg.
  const lengteRuw = getalOfNull(String(formData.get('lengte') ?? ''));
  const lengte = lengteRuw == null ? null : Math.round(lengteRuw);
  const aantal = Math.max(1, Math.round(getalOfNull(String(formData.get('aantal') ?? '1')) ?? 1));
  const stukprijs = getalOfNull(String(formData.get('stukprijs') ?? ''));
  if (!orderId) redirect('/dashboard/orders');
  if (!item_naam) terugNaarOrder(orderId, 'geen_item');

  const gelukt = await voegOrderregelToe(orderId, { item_naam, product_id, variant_id, maat, kleur, lengte, aantal, stukprijs });
  if (!gelukt) terugNaarOrder(orderId, 'mislukt');
  await logAudit('orderregel_toegevoegd', {
    entiteit: 'order',
    entiteitId: orderId,
    details: { item_naam, variant_id, aantal },
  });
  terugNaarOrder(orderId, 'regel');
}

export async function verwijderRegel(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  const regelId = String(formData.get('regelId') ?? '').trim();
  if (regelId) {
    await verwijderOrderregel(regelId);
    await logAudit('orderregel_verwijderd', { entiteit: 'order', entiteitId: orderId, details: { regelId } });
  }
  terugNaarOrder(orderId, 'regel_weg');
}

/**
 * Referentie, aanvrager en de notities van een order opslaan. Deze velden vult
 * Jessi bij het aanmaken in; zonder dit formulier zou ze ze daarna nergens meer
 * terugzien of kunnen verbeteren.
 */
export async function zetOrderGegevens(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  if (!orderId) redirect('/dashboard/orders');

  const gelukt = await werkOrderGegevens(orderId, {
    referentienr: String(formData.get('referentienr') ?? '').trim() || null,
    aangevraagd_door: String(formData.get('aangevraagd_door') ?? '').trim() || null,
    notitie: String(formData.get('notitie') ?? '').trim() || null,
    interne_notitie: String(formData.get('interne_notitie') ?? '').trim() || null,
  });
  if (!gelukt) terugNaarOrder(orderId, 'mislukt');
  await logAudit('order_gegevens', { entiteit: 'order', entiteitId: orderId });
  terugNaarOrder(orderId, 'gegevens');
}

export async function wijzigStatus(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (orderId && status) {
    await zetOrderStatus(orderId, status);
    await logAudit('order_status', { entiteit: 'order', entiteitId: orderId, details: { status } });
  }
  terugNaarOrder(orderId, 'status');
}

export async function beslisGoedkeuring(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  const status = String(formData.get('goedkeuring') ?? '').trim();
  const doorWie = String(formData.get('door_wie') ?? '').trim() || null;
  if (orderId && status) {
    await zetGoedkeuring(orderId, status, doorWie);
    // Bij goedkeuring meteen inkoopregels aanmaken voor wat niet op voorraad is,
    // zodat ze klaarstaan in het inkoop-bulkscherm. genereerInkoopregels voorkomt dubbels.
    if (status === 'goedgekeurd') await genereerInkoopregels(orderId);
    await logAudit('order_goedkeuring', { entiteit: 'order', entiteitId: orderId, details: { status, doorWie } });
  }
  terugNaarOrder(orderId, 'goedkeuring');
}

export async function maakInkoopregels(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  if (orderId) {
    await genereerInkoopregels(orderId);
    await logAudit('inkoopregels_gegenereerd', { entiteit: 'order', entiteitId: orderId });
  }
  terugNaarOrder(orderId, 'inkoop');
}

export async function zetTrackTrace(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  const track_trace_code = String(formData.get('track_trace_code') ?? '').trim() || null;
  const vervoerder = String(formData.get('vervoerder') ?? '').trim() || null;
  const sb = kmsAdmin();
  if (sb && orderId) {
    await sb.from('orders').update({ track_trace_code, vervoerder }).eq('id', orderId);
    await logAudit('order_verzending', { entiteit: 'order', entiteitId: orderId, details: { vervoerder } });
  }
  terugNaarOrder(orderId, 'verzending');
}
