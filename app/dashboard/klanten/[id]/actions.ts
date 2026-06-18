'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { addGebruiker, maakItem, zetItemActief, zetBestellingStatus, werkOrganisatieBij } from '@/lib/portaalAdmin';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakContactpersoon, verwijderContactpersoon, maakActiviteit, verwijderActiviteit } from '@/lib/kms/crm';
import { uploadMedia } from '@/lib/kms/storage';
import { maakLogo, verwijderLogo } from '@/lib/kms/logos';

const DASH_COOKIE = 'fb_dash';

async function authed() {
  return Boolean(env.dashboardPassword) && (await cookies()).get(DASH_COOKIE)?.value === env.dashboardPassword.trim();
}

export async function werkOrganisatie(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const naam = String(formData.get('naam') ?? '').trim();
  const plaats = String(formData.get('plaats') ?? '').trim();
  const adres = String(formData.get('adres') ?? '').trim();
  const postcode = String(formData.get('postcode') ?? '').trim();
  const telefoon = String(formData.get('telefoon') ?? '').trim();
  if (id && naam) await werkOrganisatieBij(id, { naam, plaats, adres, postcode, telefoon });
  redirect('/dashboard/klanten/' + id);
}

export async function koppelGebruiker(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const email = String(formData.get('email') ?? '').trim();
  const naam = String(formData.get('naam') ?? '').trim();
  if (id && email) await addGebruiker(id, email, naam);
  redirect('/dashboard/klanten/' + id);
}

export async function voegItemToe(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const naam = String(formData.get('naam') ?? '').trim();
  const merk = String(formData.get('merk') ?? '').trim() || null;
  const kleur = String(formData.get('kleur') ?? '').trim() || null;
  const logopositie = String(formData.get('logopositie') ?? '').trim() || null;
  const techniek = String(formData.get('techniek') ?? '').trim() || null;
  const ruw = String(formData.get('richtprijs') ?? '').replace(/[^0-9.,]/g, '').replace(',', '.');
  const richtprijs = ruw === '' ? null : Number(ruw);
  if (id && naam) await maakItem(id, { naam, merk, kleur, logopositie, techniek, richtprijs });
  redirect('/dashboard/klanten/' + id);
}

export async function wisselItemActief(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const itemId = String(formData.get('itemId') ?? '');
  const actief = String(formData.get('actief') ?? '') === 'true';
  if (itemId) await zetItemActief(itemId, actief);
  redirect('/dashboard/klanten/' + id);
}

export async function zetStatus(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const bestelId = String(formData.get('bestelId') ?? '');
  const status = String(formData.get('status') ?? '').trim();
  if (bestelId && status) await zetBestellingStatus(bestelId, status);
  redirect('/dashboard/klanten/' + id);
}

export async function nieuwContact(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const naam = String(formData.get('naam') ?? '').trim();
  const functie = String(formData.get('functie') ?? '').trim() || null;
  const email = String(formData.get('email') ?? '').trim() || null;
  const telefoon = String(formData.get('telefoon') ?? '').trim() || null;
  const mobiel = String(formData.get('mobiel') ?? '').trim() || null;
  const hoofdcontact = String(formData.get('hoofdcontact') ?? '') === 'on';
  if (id && naam) await maakContactpersoon(id, { naam, functie, email, telefoon, mobiel, hoofdcontact });
  redirect('/dashboard/klanten/' + id);
}

export async function verwijderContactActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const contactId = String(formData.get('contactId') ?? '');
  if (contactId) await verwijderContactpersoon(contactId);
  redirect('/dashboard/klanten/' + id);
}

export async function nieuweActiviteit(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const soort = String(formData.get('soort') ?? '').trim() || undefined;
  const omschrijving = String(formData.get('omschrijving') ?? '').trim();
  const datum = String(formData.get('datum') ?? '').trim() || null;
  const opvolgdatum = String(formData.get('opvolgdatum') ?? '').trim() || null;
  const door = String(formData.get('door') ?? '').trim() || null;
  if (id && omschrijving) await maakActiviteit(id, { soort, omschrijving, datum, opvolgdatum, door });
  redirect('/dashboard/klanten/' + id);
}

export async function verwijderActiviteitActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const activiteitId = String(formData.get('activiteitId') ?? '');
  if (activiteitId) await verwijderActiviteit(activiteitId);
  redirect('/dashboard/klanten/' + id);
}

export async function nieuwLogoActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '').trim();
  const naam = String(formData.get('naam') ?? '').trim();
  const logoUpload = await uploadMedia(formData.get('logo_bestand') as File | null, 'logos');
  const vectorUpload = await uploadMedia(formData.get('vectorbestand') as File | null, 'logos');
  const borduurUpload = await uploadMedia(formData.get('borduurbestand') as File | null, 'logos');
  const logo_bestand_url = logoUpload ?? (String(formData.get('logo_bestand_url') ?? '').trim() || null);
  const vectorbestand_url = vectorUpload ?? (String(formData.get('vectorbestand_url') ?? '').trim() || null);
  const borduurbestand_url = borduurUpload ?? (String(formData.get('borduurbestand_url') ?? '').trim() || null);
  const opmerkingen = String(formData.get('opmerkingen') ?? '').trim() || null;
  if (id && naam) {
    await maakLogo(id, { naam, logo_bestand_url, vectorbestand_url, borduurbestand_url, opmerkingen });
  }
  redirect('/dashboard/klanten/' + id);
}

export async function verwijderLogoActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '').trim();
  const logoId = String(formData.get('logoId') ?? '').trim();
  if (logoId) await verwijderLogo(logoId);
  redirect('/dashboard/klanten/' + id);
}
