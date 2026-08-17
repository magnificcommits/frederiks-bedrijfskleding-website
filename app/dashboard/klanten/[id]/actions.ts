'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { addGebruiker, maakItem, zetItemActief, zetBestellingStatus, werkOrganisatieBij } from '@/lib/portaalAdmin';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { maakContactpersoon, verwijderContactpersoon, maakActiviteit, verwijderActiviteit } from '@/lib/kms/crm';
import { uploadMedia } from '@/lib/kms/storage';
import { maakLogo, verwijderLogo } from '@/lib/kms/logos';
import { logAudit } from '@/lib/kms/audit';
import { listArtikelKeuze, type ArtikelKeuze } from '@/lib/kms/producten';
import {
  voegAssortimentRegelToe,
  werkAssortimentRegelBij,
  verwijderAssortimentRegel,
  KLEUR_NOG_NIET_BESCHIKBAAR,
  type AssortimentAntwoord,
  type Periode,
  type VerstrekkingType,
} from '@/lib/kms/assortiment';


/** Zelfde toegangsregel als de dashboard-layout: wachtwoord-cookie OF ingelogde admin. */
async function authed() {
  return dashAuthed();
}

export async function werkOrganisatie(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const naam = String(formData.get('naam') ?? '').trim();
  const plaats = String(formData.get('plaats') ?? '').trim();
  const adres = String(formData.get('adres') ?? '').trim();
  const postcode = String(formData.get('postcode') ?? '').trim();
  const telefoon = String(formData.get('telefoon') ?? '').trim();
  if (id && naam) {
    await werkOrganisatieBij(id, { naam, plaats, adres, postcode, telefoon });
    await logAudit('klant_gewijzigd', { entiteit: 'organisatie', entiteitId: id });
  }
  redirect('/dashboard/klanten/' + id);
}

export async function zetRetourenActiefActie(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '').trim();
  const aan = String(formData.get('aan') ?? '') === 'true';
  if (id) {
    const sb = kmsAdmin();
    if (sb) await sb.from('organisaties').update({ retouren_actief: aan }).eq('id', id);
    await logAudit('klant_retouren_toggle', { entiteit: 'organisatie', entiteitId: id, details: { aan } });
  }
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
    await logAudit('logo_toegevoegd', { entiteit: 'organisatie', entiteitId: id, details: { naam } });
  }
  redirect('/dashboard/klanten/' + id);
}

export async function verwijderLogoActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '').trim();
  const logoId = String(formData.get('logoId') ?? '').trim();
  if (logoId) {
    await verwijderLogo(logoId);
    await logAudit('logo_verwijderd', { entiteit: 'organisatie', entiteitId: id });
  }
  redirect('/dashboard/klanten/' + id);
}

/* --------------------------------------------------------------------- */
/* Assortiment: artikelen zoeken en met kleur en verstrekking toevoegen.  */
/* --------------------------------------------------------------------- */

/**
 * De hele catalogus voor de artikelkiezer. Wordt pas aangeroepen als het
 * zoekvenster opengaat, zodat de klantpagina zelf licht blijft. Daarna zoekt de
 * browser in de opgehaalde lijst en gaat er per toetsaanslag niets meer heen en
 * weer.
 */
export async function haalArtikelenActie(): Promise<ArtikelKeuze[]> {
  if (!(await dashAuthed())) redirect('/dashboard');
  return listArtikelKeuze();
}

/**
 * Artikel toevoegen aan het assortiment van een klant, met kleur en verstrekking
 * in dezelfde handeling.
 *
 * Geeft bewust een antwoord terug in plaats van door te sturen naar de
 * klantpagina: de tabbladen op die pagina houden hun eigen stand bij, dus een
 * redirect zou Jessi na elk artikel terugzetten op het eerste tabblad en het
 * zoekvenster sluiten. Nu blijft het venster open en kan ze in één keer een hele
 * kledinglijn samenstellen. De lijst zelf wordt met revalidatePath vernieuwd.
 */
export async function voegAssortimentToeActie(invoer: {
  orgId: string;
  productId: string;
  artikelNaam: string;
  kleur: string | null;
  verstrekking_type: VerstrekkingType;
  gratis_per_periode: number | null;
  periode: Periode;
}): Promise<AssortimentAntwoord> {
  if (!(await dashAuthed())) redirect('/dashboard');

  const orgId = invoer.orgId.trim();
  const productId = invoer.productId.trim();
  if (!orgId || !productId) return { ok: false, melding: 'Er is geen artikel gekozen.' };

  const uitkomst = await voegAssortimentRegelToe(orgId, {
    productId,
    kleur: invoer.kleur,
    verstrekking_type: invoer.verstrekking_type,
    gratis_per_periode: invoer.gratis_per_periode,
    periode: invoer.periode,
  });

  const naam = invoer.artikelNaam.trim() || 'Het artikel';
  if (uitkomst === 'bestaat_al') {
    return { ok: false, melding: `${naam} staat al in dit assortiment.` };
  }
  if (uitkomst === 'mislukt') {
    return { ok: false, melding: `${naam} kon niet worden toegevoegd. Probeer het opnieuw.` };
  }

  await logAudit('assortiment_toegevoegd', {
    entiteit: 'organisatie',
    entiteitId: orgId,
    details: { productId, kleur: invoer.kleur, verstrekking_type: invoer.verstrekking_type },
  });
  revalidatePath('/dashboard/klanten/' + orgId);
  return {
    ok: true,
    melding: `${naam} toegevoegd aan het assortiment.`,
    waarschuwing: uitkomst === 'toegevoegd_zonder_kleur' ? KLEUR_NOG_NIET_BESCHIKBAAR : undefined,
  };
}

/** Kleur, verstrekking of budget van een regel in het assortiment bijwerken. */
export async function werkAssortimentActie(invoer: {
  orgId: string;
  regelId: string;
  kleur: string | null;
  verstrekking_type: VerstrekkingType;
  gratis_per_periode: number | null;
  periode: Periode;
}): Promise<AssortimentAntwoord> {
  if (!(await dashAuthed())) redirect('/dashboard');

  const orgId = invoer.orgId.trim();
  const regelId = invoer.regelId.trim();
  if (!orgId || !regelId) return { ok: false, melding: 'Deze regel bestaat niet meer.' };

  const uitkomst = await werkAssortimentRegelBij(regelId, {
    kleur: invoer.kleur,
    verstrekking_type: invoer.verstrekking_type,
    gratis_per_periode: invoer.gratis_per_periode,
    periode: invoer.periode,
  });
  if (uitkomst === 'dubbel') {
    return { ok: false, melding: 'Dit artikel staat in die kleur al in het assortiment.' };
  }
  if (uitkomst === 'mislukt') {
    return { ok: false, melding: 'Opslaan is niet gelukt. Probeer het opnieuw.' };
  }

  await logAudit('assortiment_gewijzigd', {
    entiteit: 'organisatie',
    entiteitId: orgId,
    details: { regelId, kleur: invoer.kleur, verstrekking_type: invoer.verstrekking_type },
  });
  revalidatePath('/dashboard/klanten/' + orgId);
  return {
    ok: true,
    melding: 'Wijziging opgeslagen.',
    waarschuwing: uitkomst === 'opgeslagen_zonder_kleur' ? KLEUR_NOG_NIET_BESCHIKBAAR : undefined,
  };
}

/** Artikel uit het assortiment van deze klant halen. Het artikel zelf blijft bestaan. */
export async function verwijderAssortimentActie(invoer: {
  orgId: string;
  regelId: string;
}): Promise<AssortimentAntwoord> {
  if (!(await dashAuthed())) redirect('/dashboard');

  const orgId = invoer.orgId.trim();
  const regelId = invoer.regelId.trim();
  if (!orgId || !regelId) return { ok: false, melding: 'Deze regel bestaat niet meer.' };

  const gelukt = await verwijderAssortimentRegel(regelId);
  if (!gelukt) return { ok: false, melding: 'Verwijderen is niet gelukt. Probeer het opnieuw.' };

  await logAudit('assortiment_verwijderd', {
    entiteit: 'organisatie',
    entiteitId: orgId,
    details: { regelId },
  });
  revalidatePath('/dashboard/klanten/' + orgId);
  return { ok: true, melding: 'Artikel uit het assortiment gehaald.' };
}
