'use server';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { voegFactuurregelToe, werkFactuurregel, verwijderFactuurregel, zetFactuurStatus, zetFactuurEmail, mailFactuurNaarKlant, getFactuur } from '@/lib/kms/facturen';
import { logAudit } from '@/lib/kms/audit';

function getalOfNul(raw: string): number {
  const s = raw.replace(/[^0-9.,-]/g, '').replace(',', '.');
  return s === '' ? 0 : Number(s);
}

export async function voegRegel(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const factuurId = String(formData.get('factuurId') ?? '').trim();
  const omschrijving = String(formData.get('omschrijving') ?? '').trim();
  const aantal = getalOfNul(String(formData.get('aantal') ?? '1'));
  const stukprijs = getalOfNul(String(formData.get('stukprijs') ?? ''));
  const btwRuw = String(formData.get('btw_pct') ?? '').trim();
  const btw_pct = btwRuw === '' ? 21 : getalOfNul(btwRuw);
  if (factuurId && omschrijving) {
    await voegFactuurregelToe(factuurId, { omschrijving, aantal, stukprijs, btw_pct });
  }
  redirect('/dashboard/facturen/' + factuurId);
}

export async function werkRegel(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const factuurId = String(formData.get('factuurId') ?? '').trim();
  const regelId = String(formData.get('regelId') ?? '').trim();
  const omschrijving = String(formData.get('omschrijving') ?? '').trim();
  const aantal = getalOfNul(String(formData.get('aantal') ?? '1'));
  const stukprijs = getalOfNul(String(formData.get('stukprijs') ?? ''));
  const btwRuw = String(formData.get('btw_pct') ?? '').trim();
  const btw_pct = btwRuw === '' ? 21 : getalOfNul(btwRuw);
  if (regelId && omschrijving) {
    await werkFactuurregel(regelId, { omschrijving, aantal, stukprijs, btw_pct });
  }
  redirect('/dashboard/facturen/' + factuurId);
}

export async function verwijderRegel(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const factuurId = String(formData.get('factuurId') ?? '').trim();
  const regelId = String(formData.get('regelId') ?? '').trim();
  if (regelId) await verwijderFactuurregel(regelId);
  redirect('/dashboard/facturen/' + factuurId);
}

export async function wijzigStatus(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const factuurId = String(formData.get('factuurId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (factuurId && status) await zetFactuurStatus(factuurId, status);
  redirect('/dashboard/facturen/' + factuurId);
}

/** Factuuradres voor deze ene factuur wijzigen (de klantkaart blijft zoals hij is). */
export async function zetFactuurEmailActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const factuurId = String(formData.get('factuurId') ?? '').trim();
  // "Terugzetten naar het voorstel" stuurt het adres via de knop mee.
  const herstel = String(formData.get('herstel_email') ?? '').trim();
  const email = herstel || String(formData.get('factuur_email') ?? '').trim();
  if (!factuurId) redirect('/dashboard/facturen');
  const oud = await getFactuur(factuurId);
  const voor = oud?.factuur_email ?? null;
  const na = email || null;
  if (voor !== na) {
    await zetFactuurEmail(factuurId, na);
    await logAudit('factuur_email_gewijzigd', { entiteit: 'facturen', entiteitId: factuurId, details: { voor: { factuur_email: voor }, na: { factuur_email: na } } });
  }
  redirect('/dashboard/facturen/' + factuurId + '?ok=opgeslagen');
}

/** Factuur naar de klant mailen op het ingevulde adres; dat adres wordt ook op de factuur bewaard. */
export async function mailFactuurKlantActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const factuurId = String(formData.get('factuurId') ?? '').trim();
  const email = String(formData.get('factuur_email') ?? '').trim();
  if (!factuurId) redirect('/dashboard/facturen');
  if (!email) redirect('/dashboard/facturen/' + factuurId + '?mailfout=' + encodeURIComponent('Vul eerst een e-mailadres in.'));
  const oud = await getFactuur(factuurId);
  if ((oud?.factuur_email ?? null) !== email) {
    await zetFactuurEmail(factuurId, email);
    await logAudit('factuur_email_gewijzigd', { entiteit: 'facturen', entiteitId: factuurId, details: { voor: { factuur_email: oud?.factuur_email ?? null }, na: { factuur_email: email } } });
  }
  const r = await mailFactuurNaarKlant(factuurId, email);
  if (!r.ok) redirect('/dashboard/facturen/' + factuurId + '?mailfout=' + encodeURIComponent(r.error ?? 'Versturen mislukt.'));
  await logAudit('factuur_gemaild_klant', { entiteit: 'facturen', entiteitId: factuurId, details: { naar: email } });
  redirect('/dashboard/facturen/' + factuurId + '?ok=gemaild');
}
