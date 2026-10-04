'use server';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { logAudit, huidigeActor } from '@/lib/kms/audit';
import {
  voegOrderregelToe,
  verwijderOrderregel,
  zetOrderStatusMetGevolgen,
  zetGoedkeuring,
  orderRegelsGeslotenReden,
  listVariantenVoorProduct,
  listProductenVoorRegels,
  werkOrderGegevens,
  type OrderVariant,
  type OrderProduct,
} from '@/lib/kms/orders';
import { genereerInkoopregels, volgOrderNaInkoop } from '@/lib/kms/inkoop';
import { bevestigPersoon, leesPersoonKeuze } from '@/lib/kms/personen';
import { lijktOpEmail, normaleNaam } from '@/lib/personen';

/** De klant van een order, om te controleren dat een gekozen persoon daarbij hoort. */
async function orderKlant(orderId: string): Promise<{ organisatie_id: string; aangevraagd_door: string | null } | null> {
  const sb = kmsAdmin();
  if (!sb || !orderId) return null;
  const { data } = await sb.from('orders').select('organisatie_id, aangevraagd_door').eq('id', orderId).maybeSingle();
  return (data as { organisatie_id: string; aangevraagd_door: string | null } | null) ?? null;
}

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
function terugNaarOrder(orderId: string, ok: string, extra?: Record<string, string | number>): never {
  if (!orderId) redirect('/dashboard/orders');
  const p = new URLSearchParams({ ok });
  for (const [k, v] of Object.entries(extra ?? {})) p.set(k, String(v));
  redirect(`/dashboard/orders/${orderId}?${p.toString()}`);
}

/** Regels van een afgeronde, geannuleerde of al gefactureerde order blijven zoals ze zijn. */
async function eisOpenOrder(orderId: string): Promise<void> {
  const reden = await orderRegelsGeslotenReden(orderId);
  if (reden) terugNaarOrder(orderId, `gesloten_${reden}`);
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
  await eisOpenOrder(orderId);

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
    await eisOpenOrder(orderId);
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

  const order = await orderKlant(orderId);
  const aanvrager = await bevestigPersoon(leesPersoonKeuze(formData, 'aangevraagd_door'), order?.organisatie_id ?? null);
  // Portaalbestellingen hebben het e-mailadres van de besteller als aanvrager;
  // daar gaan de statusmails heen. Is dat dezelfde persoon, dan blijft het adres staan.
  let aanvragerTekst = aanvrager.naam;
  const oud = order?.aangevraagd_door?.trim() ?? '';
  if (aanvrager.id && lijktOpEmail(oud)) {
    const sb = kmsAdmin();
    const tabel = aanvrager.soort === 'contact' ? 'contactpersonen' : 'medewerkers';
    const { data } = sb ? await sb.from(tabel).select('email').eq('id', aanvrager.id).maybeSingle() : { data: null };
    if (normaleNaam((data as { email: string | null } | null)?.email) === normaleNaam(oud)) aanvragerTekst = oud;
  }

  const gelukt = await werkOrderGegevens(orderId, {
    referentienr: String(formData.get('referentienr') ?? '').trim() || null,
    aangevraagd_door: aanvragerTekst,
    aangevraagd_door_contact_id: aanvrager.soort === 'contact' ? aanvrager.id : null,
    aangevraagd_door_medewerker_id: aanvrager.soort === 'medewerker' ? aanvrager.id : null,
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
  if (!orderId || !status) terugNaarOrder(orderId, 'mislukt');
  const actor = await huidigeActor().catch(() => null);
  const uitkomst = await zetOrderStatusMetGevolgen(orderId, status, actor);
  if (!uitkomst.ok) terugNaarOrder(orderId, uitkomst.foutCode ? `annuleren_${uitkomst.foutCode}` : 'mislukt');
  if (uitkomst.ongewijzigd) terugNaarOrder(orderId, 'status_gelijk');
  await logAudit('order_status', {
    entiteit: 'order',
    entiteitId: orderId,
    details: {
      status,
      ...(uitkomst.inkoopGeannuleerd ? { inkoop_ingetrokken: uitkomst.inkoopGeannuleerd } : {}),
      ...(uitkomst.voorraadAfgeboekt ? { voorraad_afgeboekt: uitkomst.voorraadAfgeboekt } : {}),
    },
  });
  if (status === 'geannuleerd') {
    terugNaarOrder(orderId, 'geannuleerd', { ingetrokken: uitkomst.inkoopGeannuleerd ?? 0, besteld: uitkomst.inkoopAlBesteld ?? 0 });
  }
  // Eigen code bij een afboeking: de algemene melding "status" haalt de toast weg, deze niet.
  if (uitkomst.voorraadAfgeboekt) terugNaarOrder(orderId, 'status_afgeboekt', { afgeboekt: uitkomst.voorraadAfgeboekt });
  terugNaarOrder(orderId, 'status');
}

export async function beslisGoedkeuring(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  const status = String(formData.get('goedkeuring') ?? '').trim();
  const order = await orderKlant(orderId);
  const goedkeurder = await bevestigPersoon(leesPersoonKeuze(formData, 'goedgekeurd_door'), order?.organisatie_id ?? null);
  const doorWie = goedkeurder.naam;
  if (orderId && status) {
    await zetGoedkeuring(orderId, status, doorWie, {
      contactId: goedkeurder.soort === 'contact' ? goedkeurder.id : null,
      medewerkerId: goedkeurder.soort === 'medewerker' ? goedkeurder.id : null,
    });
    // Inkoopregels en orderstatus lopen mee in zetGoedkeuring (zelfde gedrag als in het portaal).
    await logAudit('order_goedkeuring', { entiteit: 'order', entiteitId: orderId, details: { status, doorWie } });
  }
  terugNaarOrder(orderId, 'goedkeuring');
}

export async function maakInkoopregels(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  if (orderId) {
    await genereerInkoopregels(orderId);
    await volgOrderNaInkoop(orderId);
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
