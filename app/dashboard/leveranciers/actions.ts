'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import {
  getLeverancierDetail,
  maakLeverancierVol,
  veiligeUrl,
  verwijderContact,
  voegContactToe,
  werkContactBij,
  werkLeverancierBij,
  zetDocumenten,
  type LeverancierInvoer,
} from '@/lib/kms/leveranciers';

const tekst = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? '').trim();
  return v === '' ? null : v;
};
const getal = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? '').replace(/[^0-9.,-]/g, '').replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Alle velden uit het leveranciersformulier. Alleen wat in het formulier staat, wordt meegenomen. */
function leesVelden(f: FormData): LeverancierInvoer {
  const v: LeverancierInvoer = {};
  const zet = <K extends keyof LeverancierInvoer>(k: K, waarde: LeverancierInvoer[K]) => {
    if (f.has(k as string)) v[k] = waarde;
  };
  zet('naam', tekst(f, 'naam') ?? undefined);
  zet('leveranciersnummer', tekst(f, 'leveranciersnummer'));
  zet('inkoop_bij', tekst(f, 'inkoop_bij'));
  zet('contactpersoon', tekst(f, 'contactpersoon'));
  zet('email', tekst(f, 'email'));
  zet('telefoon', tekst(f, 'telefoon'));
  zet('telefoon_hoofdkantoor', tekst(f, 'telefoon_hoofdkantoor'));
  zet('bestelwijze', tekst(f, 'bestelwijze'));
  zet('betaalcondities', tekst(f, 'betaalcondities'));
  zet('klantnummer', tekst(f, 'klantnummer'));
  zet('kortingspercentage', getal(f, 'kortingspercentage'));
  zet('franco_bedrag', getal(f, 'franco_bedrag'));
  const lt = getal(f, 'levertijd_dagen');
  zet('levertijd_dagen', lt === null ? null : Math.max(0, Math.round(lt)));
  zet('bestelportaal_url', veiligeUrl(String(f.get('bestelportaal_url') ?? '')));
  zet('website', veiligeUrl(String(f.get('website') ?? '')));
  const logo = String(f.get('logo_url') ?? '').trim();
  zet('logo_url', logo.startsWith('/') ? logo : veiligeUrl(logo));
  if (f.has('merken')) {
    const merken = String(f.get('merken') ?? '').split(',').map((m) => m.trim()).filter(Boolean);
    v.merken = merken.length ? merken : null;
  }
  return v;
}

export async function nieuweLeverancier(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const velden = leesVelden(formData);
  if (!velden.naam) redirect('/dashboard/leveranciers');
  const id = await maakLeverancierVol({ ...velden, naam: velden.naam });
  await logAudit('leverancier_aangemaakt', { entiteit: 'leveranciers', entiteitId: id ?? undefined, details: { naam: velden.naam } });
  revalidatePath('/dashboard/leveranciers');
  redirect(id ? `/dashboard/leveranciers/${id}?ok=aangemaakt` : '/dashboard/leveranciers?melding=mislukt');
}

export async function bewerkLeverancier(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/dashboard/leveranciers');
  const velden = leesVelden(formData);
  if ('naam' in velden && !velden.naam) delete velden.naam;
  const res = await werkLeverancierBij(id, velden);
  await logAudit('leverancier_bijgewerkt', { entiteit: 'leveranciers', entiteitId: id, details: { velden: Object.keys(velden), gelukt: res.ok } });
  revalidatePath(`/dashboard/leveranciers/${id}`);
  revalidatePath('/dashboard/leveranciers');
  if (!res.ok) redirect(`/dashboard/leveranciers/${id}?melding=mislukt`);
  redirect(`/dashboard/leveranciers/${id}?${res.zonderNieuw ? 'melding=deels' : 'ok=opgeslagen'}`);
}

export async function bewaarNotities(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/dashboard/leveranciers');
  const res = await werkLeverancierBij(id, { notities: tekst(formData, 'notities') });
  revalidatePath(`/dashboard/leveranciers/${id}`);
  redirect(`/dashboard/leveranciers/${id}?${res.ok && !res.zonderNieuw ? 'ok=opgeslagen' : 'melding=migratie'}`);
}

export async function voegContactActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('leverancier_id') ?? '').trim();
  const naam = tekst(formData, 'naam');
  if (!id || !naam) redirect(`/dashboard/leveranciers/${id}`);
  const res = await voegContactToe({
    leverancier_id: id,
    naam,
    rol: tekst(formData, 'rol'),
    email: tekst(formData, 'email'),
    telefoon: tekst(formData, 'telefoon'),
    notitie: tekst(formData, 'notitie'),
  });
  await logAudit('leverancier_contact_toegevoegd', { entiteit: 'leveranciers', entiteitId: id, details: { naam, gelukt: res.ok } });
  revalidatePath(`/dashboard/leveranciers/${id}`);
  redirect(`/dashboard/leveranciers/${id}?${res.ok ? 'ok=toegevoegd' : res.migratie ? 'melding=migratie' : 'melding=mislukt'}`);
}

export async function bewerkContactActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('leverancier_id') ?? '').trim();
  const contactId = String(formData.get('contact_id') ?? '').trim();
  const naam = tekst(formData, 'naam');
  if (!id || !contactId || !naam) redirect(`/dashboard/leveranciers/${id}`);
  const ok = await werkContactBij(contactId, {
    naam,
    rol: tekst(formData, 'rol'),
    email: tekst(formData, 'email'),
    telefoon: tekst(formData, 'telefoon'),
    notitie: tekst(formData, 'notitie'),
  });
  revalidatePath(`/dashboard/leveranciers/${id}`);
  redirect(`/dashboard/leveranciers/${id}?${ok ? 'ok=opgeslagen' : 'melding=mislukt'}`);
}

export async function verwijderContactActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('leverancier_id') ?? '').trim();
  const contactId = String(formData.get('contact_id') ?? '').trim();
  const ok = await verwijderContact(contactId);
  await logAudit('leverancier_contact_verwijderd', { entiteit: 'leveranciers', entiteitId: id, details: { contactId, gelukt: ok } });
  revalidatePath(`/dashboard/leveranciers/${id}`);
  redirect(`/dashboard/leveranciers/${id}?${ok ? 'ok=verwijderd' : 'melding=mislukt'}`);
}

export async function voegDocumentActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('leverancier_id') ?? '').trim();
  const naam = tekst(formData, 'naam');
  const url = veiligeUrl(String(formData.get('url') ?? ''));
  if (!id) redirect('/dashboard/leveranciers');
  if (!naam || !url) redirect(`/dashboard/leveranciers/${id}?melding=link`);
  const detail = await getLeverancierDetail(id);
  const res = await zetDocumenten(id, [...(detail?.leverancier.documenten ?? []), { naam, url }]);
  revalidatePath(`/dashboard/leveranciers/${id}`);
  redirect(`/dashboard/leveranciers/${id}?${res.ok ? 'ok=toegevoegd' : res.migratie ? 'melding=migratie' : 'melding=mislukt'}`);
}

export async function verwijderDocumentActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('leverancier_id') ?? '').trim();
  const url = String(formData.get('url') ?? '');
  const detail = await getLeverancierDetail(id);
  const res = await zetDocumenten(id, (detail?.leverancier.documenten ?? []).filter((d) => d.url !== url));
  revalidatePath(`/dashboard/leveranciers/${id}`);
  redirect(`/dashboard/leveranciers/${id}?${res.ok ? 'ok=verwijderd' : 'melding=mislukt'}`);
}
