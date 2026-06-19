'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import {
  werkOfferte,
  zetOfferteStatus,
  verwijderOfferte,
  voegRegelToe,
  werkRegel,
  verwijderRegel,
} from '@/lib/kms/offertes';
import { logAudit } from '@/lib/kms/audit';

function getalOfNul(raw: string): number {
  const s = raw.replace(/[^0-9.,-]/g, '').replace(',', '.');
  return s === '' ? 0 : Number(s);
}

export async function werkOfferteActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('offerteId') ?? '').trim();
  if (!id) redirect('/dashboard/offertes');
  const organisatie_id = String(formData.get('organisatie_id') ?? '').trim();
  const contactpersoon = String(formData.get('contactpersoon') ?? '').trim();
  const geldig_tot = String(formData.get('geldig_tot') ?? '').trim();
  const notitie = String(formData.get('notitie') ?? '').trim();
  const btwRuw = String(formData.get('btw_pct') ?? '').trim();
  const btw_pct = btwRuw === '' ? 21 : getalOfNul(btwRuw);
  await werkOfferte(id, {
    organisatie_id: organisatie_id || null,
    contactpersoon: contactpersoon || null,
    geldig_tot: geldig_tot || null,
    notitie: notitie || null,
    btw_pct,
  });
  await logAudit('offerte_gewijzigd', { entiteit: 'offertes', entiteitId: id });
  redirect('/dashboard/offertes/' + id + '?ok=opgeslagen');
}

export async function wijzigStatusActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('offerteId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (id && status) {
    await zetOfferteStatus(id, status);
    await logAudit('offerte_status_gewijzigd', { entiteit: 'offertes', entiteitId: id, details: { status } });
  }
  redirect('/dashboard/offertes/' + id + '?ok=status');
}

export async function verwijderOfferteActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('offerteId') ?? '').trim();
  if (id) {
    await verwijderOfferte(id);
    await logAudit('offerte_verwijderd', { entiteit: 'offertes', entiteitId: id });
  }
  redirect('/dashboard/offertes');
}

export async function voegRegelActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const offerteId = String(formData.get('offerteId') ?? '').trim();
  const omschrijving = String(formData.get('omschrijving') ?? '').trim();
  const aantal = getalOfNul(String(formData.get('aantal') ?? '1'));
  const stukprijs = getalOfNul(String(formData.get('stukprijs') ?? ''));
  if (offerteId && omschrijving) {
    await voegRegelToe(offerteId, { omschrijving, aantal, stukprijs });
    await logAudit('offerteregel_toegevoegd', { entiteit: 'offertes', entiteitId: offerteId });
  }
  redirect('/dashboard/offertes/' + offerteId);
}

export async function werkRegelActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const offerteId = String(formData.get('offerteId') ?? '').trim();
  const regelId = String(formData.get('regelId') ?? '').trim();
  const omschrijving = String(formData.get('omschrijving') ?? '').trim();
  const aantal = getalOfNul(String(formData.get('aantal') ?? '1'));
  const stukprijs = getalOfNul(String(formData.get('stukprijs') ?? ''));
  if (regelId && omschrijving) {
    await werkRegel(regelId, { omschrijving, aantal, stukprijs });
  }
  redirect('/dashboard/offertes/' + offerteId);
}

export async function verwijderRegelActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const offerteId = String(formData.get('offerteId') ?? '').trim();
  const regelId = String(formData.get('regelId') ?? '').trim();
  if (regelId) await verwijderRegel(regelId);
  redirect('/dashboard/offertes/' + offerteId);
}
