'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { maakItem, zetItemActief, zetBestellingStatus } from '@/lib/portaalAdmin';
import { dashAuthed, kmsAdmin, magEigenaar } from '@/lib/kms/adminClient';
import {
  maakContactpersoon,
  werkContactpersoon,
  verwijderContactpersoon,
  maakActiviteit,
  verwijderActiviteit,
  geefPortaalToegang,
  stuurPortaalUitnodiging,
} from '@/lib/kms/crm';
import { uploadMedia } from '@/lib/kms/storage';
import { maakLogo, verwijderLogo } from '@/lib/kms/logos';
import { logAudit } from '@/lib/kms/audit';
import { bevestigPersoon, leesPersoonKeuze } from '@/lib/kms/personen';
import { listArtikelKeuze, type ArtikelKeuze } from '@/lib/kms/producten';
import { maakAfdeling, werkAfdeling, verwijderAfdeling } from '@/lib/kms/structuur';
import {
  maakWerknemer,
  werkWerknemerBij,
  werknemerVanContact,
  slaMatenOp,
  type MaatInvoer,
} from '@/lib/kms/werknemers';
import { leesJsonLijst, naarInvoerRijen, slaWerknemersOp, uitkomstTekst } from '../_delen/werknemersOpslaan';
import {
  voegAssortimentRegelToe,
  werkAssortimentRegelBij,
  verwijderAssortimentRegel,
  kleurKeuzesVoorArtikel,
  KLEUR_NOG_NIET_BESCHIKBAAR,
  type AssortimentAntwoord,
  type KleurKeuze,
  type Periode,
  type VerstrekkingType,
} from '@/lib/kms/assortiment';

/** Zelfde toegangsregel als de dashboard-layout: wachtwoord-cookie OF ingelogde admin. */
async function authed() {
  return dashAuthed();
}

const TABS = ['gegevens', 'assortiment', 'werknemers', 'afdelingen', 'contact', 'portaal', 'verkoop', 'logos'] as const;
type Tab = (typeof TABS)[number];

/**
 * Terug naar de klantpagina op het tabblad waar Jessi was. Zonder tab-parameter
 * sprong de pagina na elke opslag terug naar Gegevens.
 */
function terug(orgId: string, tab: Tab, ok?: string, extra?: Record<string, string>): never {
  const p = new URLSearchParams({ tab });
  if (ok) p.set('ok', ok);
  for (const [k, v] of Object.entries(extra ?? {})) if (v) p.set(k, v);
  redirect(`/dashboard/klanten/${orgId}?${p.toString()}`);
}

function tekst(formData: FormData, veld: string): string {
  return String(formData.get(veld) ?? '').trim();
}

/** Hoort deze afdeling (of vestiging) echt bij deze klant? Anders negeren we hem. */
async function hoortBijKlant(tabel: 'afdelingen' | 'vestigingen', orgId: string, id: string): Promise<boolean> {
  if (!id) return false;
  const sb = kmsAdmin();
  if (!sb) return false;
  const { data } = await sb.from(tabel).select('id').eq('id', id).eq('organisatie_id', orgId).maybeSingle();
  return Boolean(data);
}

export async function werkOrganisatie(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const naam = tekst(formData, 'naam');
  if (id && naam) {
    const sb = kmsAdmin();
    if (sb) {
      const gewenst: Record<string, string | null> = {
        naam,
        adres: tekst(formData, 'adres') || null,
        postcode: tekst(formData, 'postcode') || null,
        plaats: tekst(formData, 'plaats') || null,
        telefoon: tekst(formData, 'telefoon') || null,
        branche: tekst(formData, 'branche') || null,
      };
      // Velden die alleen meegaan als het formulier ze echt heeft, zodat een
      // formulier zonder deze velden ze nooit leegmaakt.
      for (const k of ['email_algemeen', 'factuur_email', 'kvk', 'btw_nummer'] as const) {
        if (!formData.has(k)) continue;
        const v = tekst(formData, k);
        gewenst[k] = (k === 'email_algemeen' || k === 'factuur_email' ? v.toLowerCase() : v) || null;
      }
      const { data } = await sb
        .from('organisaties')
        .select('naam, adres, postcode, plaats, telefoon, branche, email_algemeen, factuur_email, kvk, btw_nummer')
        .eq('id', id)
        .maybeSingle();
      const huidig = (data as Record<string, string | null> | null) ?? {};
      const voor: Record<string, unknown> = {};
      const na: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(gewenst)) {
        if ((huidig[k] ?? null) !== v) {
          voor[k] = huidig[k] ?? null;
          na[k] = v;
        }
      }
      if (Object.keys(na).length > 0) {
        await sb.from('organisaties').update(na).eq('id', id);
        await logAudit('klant_gewijzigd', { entiteit: 'organisatie', entiteitId: id, details: { voor, na } });
      }
    }
  }
  revalidatePath('/dashboard/klanten');
  terug(id, 'gegevens', 'opgeslagen');
}

export async function zetRetourenActiefActie(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const aan = String(formData.get('aan') ?? '') === 'true';
  if (id) {
    const sb = kmsAdmin();
    if (sb) await sb.from('organisaties').update({ retouren_actief: aan }).eq('id', id);
    await logAudit('klant_retouren_toggle', { entiteit: 'organisatie', entiteitId: id, details: { voor: { retouren_actief: !aan }, na: { retouren_actief: aan } } });
  }
  terug(id, 'gegevens', 'opgeslagen');
}

/**
 * Portaaltoegang geven. Zelfde regels als in de wizard Nieuwe klant: geen
 * dubbele rij, en een adres dat al bij een andere klant inlogt niet nog een keer
 * koppelen (dan weet het portaal niet welke klant het moet tonen). Daarna gaat
 * er een uitnodiging naar het adres, tenzij Jessi dat vinkje uitzet.
 */
export async function koppelGebruiker(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const email = tekst(formData, 'email');
  const naam = tekst(formData, 'naam');
  const uitnodigen = formData.get('uitnodigen') != null;
  const rolKeuze = tekst(formData, 'rol');
  const rol = PORTAAL_ROLLEN.includes(rolKeuze as PortaalRolKms) ? rolKeuze : 'medewerker';
  if (!id) redirect('/dashboard/klanten');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    terug(id, 'portaal', undefined, { melding: 'Vul een geldig e-mailadres in.' });
  }
  const uitkomst = await geefPortaalToegang(id, email, naam || null, null, rol as PortaalRolKms);
  if (uitkomst === 'elders') terug(id, 'portaal', undefined, { melding: `${email} kan al inloggen bij een andere klant en is daarom hier niet gekoppeld.` });
  if (uitkomst === 'bestond') terug(id, 'portaal', undefined, { melding: `${email} had al toegang tot het portaal van deze klant.` });
  if (uitkomst === 'mislukt') terug(id, 'portaal', undefined, { melding: 'Koppelen is niet gelukt. Probeer het opnieuw.' });
  await logAudit('portaalgebruiker_gekoppeld', { entiteit: 'organisatie', entiteitId: id, details: { email, rol, uitgenodigd: uitnodigen } });
  if (!uitnodigen) terug(id, 'portaal', undefined, { melding: `${email} heeft toegang. Er is geen uitnodiging verstuurd.` });
  const verstuurd = await stuurPortaalUitnodiging(email, naam || null, id);
  terug(id, 'portaal', undefined, {
    melding: verstuurd
      ? `${email} heeft toegang en heeft een uitnodiging per mail gekregen.`
      : `${email} heeft toegang, maar de uitnodiging kon niet worden gemaild. Laat de klant zelf weten dat hij kan inloggen op /portaal/login.`,
  });
}

const PORTAAL_ROLLEN = ['beheerder', 'leidinggevende', 'medewerker'] as const;
type PortaalRolKms = (typeof PORTAAL_ROLLEN)[number];

/** Rol van een portaalgebruiker wijzigen (werkgever, leidinggevende of werknemer). */
export async function wijzigPortaalRol(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const gebruikerId = tekst(formData, 'gebruikerId');
  const rol = tekst(formData, 'rol');
  if (!id || !gebruikerId || !PORTAAL_ROLLEN.includes(rol as PortaalRolKms)) terug(id || '', 'portaal', undefined, { melding: 'Rol wijzigen is niet gelukt.' });
  const sb = kmsAdmin();
  const { error } = sb ? await sb.from('portaal_gebruikers').update({ rol }).eq('id', gebruikerId).eq('organisatie_id', id) : { error: true };
  if (!error) await logAudit('portaalgebruiker_rol', { entiteit: 'organisatie', entiteitId: id, details: { gebruiker_id: gebruikerId, rol } });
  terug(id, 'portaal', undefined, { melding: error ? 'Rol wijzigen is niet gelukt.' : 'Rol aangepast.' });
}

/** De uitnodiging voor het portaal opnieuw mailen. */
export async function herstuurUitnodiging(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const email = tekst(formData, 'email');
  const naam = tekst(formData, 'naam');
  if (!id || !email) redirect('/dashboard/klanten');
  const ok = await stuurPortaalUitnodiging(email, naam || null, id);
  terug(id, 'portaal', undefined, { melding: ok ? `Uitnodiging opnieuw gemaild naar ${email}.` : `Mailen naar ${email} is niet gelukt.` });
}

export async function voegItemToe(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const naam = tekst(formData, 'naam');
  const merk = tekst(formData, 'merk') || null;
  const kleur = tekst(formData, 'kleur') || null;
  const logopositie = tekst(formData, 'logopositie') || null;
  const techniek = tekst(formData, 'techniek') || null;
  const ruw = String(formData.get('richtprijs') ?? '').replace(/[^0-9.,]/g, '').replace(',', '.');
  const richtprijs = ruw === '' ? null : Number(ruw);
  if (id && naam) await maakItem(id, { naam, merk, kleur, logopositie, techniek, richtprijs });
  terug(id, 'assortiment', 'toegevoegd');
}

export async function wisselItemActief(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const itemId = tekst(formData, 'itemId');
  const actief = String(formData.get('actief') ?? '') === 'true';
  if (itemId) await zetItemActief(itemId, actief);
  terug(id, 'assortiment', 'bijgewerkt');
}

export async function zetStatus(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const bestelId = tekst(formData, 'bestelId');
  const status = tekst(formData, 'status');
  if (bestelId && status) await zetBestellingStatus(bestelId, status);
  terug(id, 'verkoop', 'status');
}

/* --------------------------------------------------------------------- */
/* Contactpersonen                                                         */
/* --------------------------------------------------------------------- */

export async function nieuwContact(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const naam = tekst(formData, 'naam');
  if (id && naam) {
    const contactId = await maakContactpersoon(id, {
      naam,
      functie: tekst(formData, 'functie') || null,
      email: tekst(formData, 'email') || null,
      telefoon: tekst(formData, 'telefoon') || null,
      mobiel: tekst(formData, 'mobiel') || null,
      hoofdcontact: formData.get('hoofdcontact') === 'on',
      facturatie: formData.get('facturatie') === 'on',
    });
    if (contactId) {
      await logAudit('contactpersoon_toegevoegd', { entiteit: 'contactpersoon', entiteitId: contactId, details: { organisatie_id: id, naam } });
    }
  }
  terug(id, 'contact', 'toegevoegd');
}

export async function werkContactActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const contactId = tekst(formData, 'contactId');
  const naam = tekst(formData, 'naam');
  if (contactId && naam) {
    const { ok, voor, na } = await werkContactpersoon(contactId, {
      naam,
      functie: tekst(formData, 'functie') || null,
      email: tekst(formData, 'email') || null,
      telefoon: tekst(formData, 'telefoon') || null,
      mobiel: tekst(formData, 'mobiel') || null,
      hoofdcontact: formData.get('hoofdcontact') === 'on',
      facturatie: formData.get('facturatie') === 'on',
    });
    if (ok && Object.keys(na).length > 0) {
      await logAudit('contactpersoon_gewijzigd', { entiteit: 'contactpersoon', entiteitId: contactId, details: { voor, na } });
    }
  }
  terug(id, 'contact', 'opgeslagen');
}

export async function verwijderContactActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const contactId = tekst(formData, 'contactId');
  if (contactId) {
    await verwijderContactpersoon(contactId);
    await logAudit('contactpersoon_verwijderd', { entiteit: 'contactpersoon', entiteitId: contactId, details: { organisatie_id: id } });
  }
  terug(id, 'contact', 'verwijderd');
}

/** Contactpersoon ook als werknemer vastleggen (naam, e-mail en telefoon gaan mee). */
export async function contactNaarWerknemerActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const contactId = tekst(formData, 'contactId');
  let werknemerId = '';
  if (contactId) {
    const uitkomst = await werknemerVanContact(contactId);
    // Alleen als de contactpersoon echt bij deze klant hoort: anders niet doorsturen naar zijn maten.
    if (uitkomst && uitkomst.organisatie_id === id) werknemerId = uitkomst.id;
    if (uitkomst && !uitkomst.bestond) {
      await logAudit('werknemer_aangemaakt', {
        entiteit: 'medewerker',
        entiteitId: uitkomst.id,
        details: { organisatie_id: uitkomst.organisatie_id, naam: uitkomst.naam, uit_contactpersoon: contactId },
      });
    }
  }
  revalidatePath('/dashboard/klanten');
  // Meteen de maten van deze werknemer openklappen op het tabblad Werknemers.
  terug(id, 'werknemers', 'aangemaakt', { maten: werknemerId });
}

/* --------------------------------------------------------------------- */
/* Activiteiten en logo's                                                  */
/* --------------------------------------------------------------------- */

export async function nieuweActiviteit(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const soort = tekst(formData, 'soort') || undefined;
  const omschrijving = tekst(formData, 'omschrijving');
  const datum = tekst(formData, 'datum') || null;
  const opvolgdatum = tekst(formData, 'opvolgdatum') || null;
  // "Door" is een collega van Frederiks uit de PersoonKiezer (taak_personen).
  const doorKeuze = await bevestigPersoon(leesPersoonKeuze(formData, 'door'), null);
  const door = doorKeuze.naam;
  const door_persoon_id = doorKeuze.soort === 'intern' ? doorKeuze.id : null;
  if (id && omschrijving) await maakActiviteit(id, { soort, omschrijving, datum, opvolgdatum, door, door_persoon_id });
  terug(id, 'contact', 'toegevoegd');
}

export async function verwijderActiviteitActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const activiteitId = tekst(formData, 'activiteitId');
  if (activiteitId) await verwijderActiviteit(activiteitId);
  terug(id, 'contact', 'verwijderd');
}

export async function nieuwLogoActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const naam = tekst(formData, 'naam');
  const logoUpload = await uploadMedia(formData.get('logo_bestand') as File | null, 'logos');
  const vectorUpload = await uploadMedia(formData.get('vectorbestand') as File | null, 'logos');
  const borduurUpload = await uploadMedia(formData.get('borduurbestand') as File | null, 'logos');
  const logo_bestand_url = logoUpload ?? (tekst(formData, 'logo_bestand_url') || null);
  const vectorbestand_url = vectorUpload ?? (tekst(formData, 'vectorbestand_url') || null);
  const borduurbestand_url = borduurUpload ?? (tekst(formData, 'borduurbestand_url') || null);
  const opmerkingen = tekst(formData, 'opmerkingen') || null;
  if (id && naam) {
    await maakLogo(id, { naam, logo_bestand_url, vectorbestand_url, borduurbestand_url, opmerkingen });
    await logAudit('logo_toegevoegd', { entiteit: 'organisatie', entiteitId: id, details: { naam } });
  }
  terug(id, 'logos', 'toegevoegd');
}

export async function verwijderLogoActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const logoId = tekst(formData, 'logoId');
  if (logoId) {
    await verwijderLogo(logoId);
    await logAudit('logo_verwijderd', { entiteit: 'organisatie', entiteitId: id });
  }
  terug(id, 'logos', 'verwijderd');
}

/* --------------------------------------------------------------------- */
/* Werknemers                                                              */
/* --------------------------------------------------------------------- */

async function werknemerVelden(formData: FormData, orgId: string) {
  const afdeling = tekst(formData, 'afdeling_id');
  const vestiging = tekst(formData, 'vestiging_id');
  return {
    naam: tekst(formData, 'naam'),
    email: tekst(formData, 'email') || null,
    telefoon: tekst(formData, 'telefoon') || null,
    personeelsnummer: tekst(formData, 'personeelsnummer') || null,
    afdeling_id: afdeling && (await hoortBijKlant('afdelingen', orgId, afdeling)) ? afdeling : null,
    vestiging_id: vestiging && (await hoortBijKlant('vestigingen', orgId, vestiging)) ? vestiging : null,
    opmerkingen: tekst(formData, 'opmerkingen') || null,
  };
}

export async function nieuweWerknemerActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const velden = await werknemerVelden(formData, id);
  let nieuwId: string | null = null;
  if (id && velden.naam) {
    nieuwId = await maakWerknemer(id, velden);
    if (nieuwId) {
      await logAudit('werknemer_aangemaakt', {
        entiteit: 'medewerker',
        entiteitId: nieuwId,
        details: { organisatie_id: id, naam: velden.naam },
      });
    }
  }
  revalidatePath('/dashboard/klanten');
  // Na toevoegen klapt bij de pasdag meteen 'Maten invullen' open voor deze werknemer.
  terug(id, 'werknemers', nieuwId ? 'toegevoegd' : 'mislukt', nieuwId ? { maten: nieuwId } : undefined);
}

/** Meerdere werknemers tegelijk (getypt of geplakt uit Excel) op het tabblad Werknemers. */
export async function bulkWerknemersActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  if (!id) redirect('/dashboard/klanten');
  const rijen = naarInvoerRijen(leesJsonLijst(formData.get('rijen')));
  const uitkomst = await slaWerknemersOp(id, rijen);
  revalidatePath('/dashboard/klanten');
  terug(id, 'werknemers', 'toegevoegd', { melding: uitkomstTekst(uitkomst) });
}

export async function werkWerknemerActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const werknemerId = tekst(formData, 'werknemerId');
  const velden = await werknemerVelden(formData, id);
  if (werknemerId && velden.naam) {
    const { ok, voor, na } = await werkWerknemerBij(werknemerId, velden);
    if (ok && Object.keys(na).length > 0) {
      await logAudit('werknemer_gewijzigd', { entiteit: 'medewerker', entiteitId: werknemerId, details: { voor, na } });
    }
  }
  terug(id, 'werknemers', 'opgeslagen');
}

/** Op non-actief zetten (uit dienst) of weer actief maken. Er wordt niets verwijderd. */
export async function zetWerknemerActiefActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const werknemerId = tekst(formData, 'werknemerId');
  const actief = String(formData.get('actief') ?? '') === 'true';
  if (werknemerId) {
    const { ok, voor, na } = await werkWerknemerBij(werknemerId, { actief });
    if (ok && Object.keys(na).length > 0) {
      await logAudit(actief ? 'werknemer_actief' : 'werknemer_non_actief', {
        entiteit: 'medewerker',
        entiteitId: werknemerId,
        details: { voor, na },
      });
    }
  }
  revalidatePath('/dashboard/klanten');
  terug(id, 'werknemers', 'bijgewerkt');
}

/**
 * Pasdag: de maten van één werknemer plus de opmerking over zijn kleding in één
 * keer opslaan. Geeft een antwoord terug zodat het formulier openblijft en Jessi
 * meteen door kan naar de volgende werknemer.
 */
export async function slaPasdagOpActie(invoer: {
  orgId: string;
  werknemerId: string;
  regels: MaatInvoer[];
  opmerkingen: string;
}): Promise<{ ok: boolean; melding: string }> {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orgId = invoer.orgId.trim();
  const werknemerId = invoer.werknemerId.trim();
  if (!orgId || !werknemerId) return { ok: false, melding: 'Deze werknemer bestaat niet meer.' };

  const sb = kmsAdmin();
  if (!sb) return { ok: false, melding: 'Geen verbinding met de database.' };
  const { data } = await sb.from('medewerkers').select('id').eq('id', werknemerId).eq('organisatie_id', orgId).maybeSingle();
  if (!data) return { ok: false, melding: 'Deze werknemer hoort niet bij deze klant.' };

  const regels: MaatInvoer[] = invoer.regels
    .filter((r) => typeof r.product_id === 'string' && r.product_id)
    .map((r) => {
      const lengte = r.lengte == null ? null : Math.round(Number(r.lengte));
      return {
        product_id: r.product_id,
        kleur: r.kleur?.trim() || null,
        maat: r.maat?.trim() || null,
        lengte: lengte != null && Number.isFinite(lengte) && lengte > 0 ? lengte : null,
        opmerking: r.opmerking?.trim() || null,
      };
    });

  const maten = await slaMatenOp(werknemerId, regels);
  const opm = await werkWerknemerBij(werknemerId, { opmerkingen: invoer.opmerkingen.trim() || null });

  await logAudit('pasdag_maten_opgeslagen', {
    entiteit: 'medewerker',
    entiteitId: werknemerId,
    details: { organisatie_id: orgId, opgeslagen: maten.opgeslagen, gewist: maten.gewist, ...(Object.keys(opm.na).length > 0 ? { voor: opm.voor, na: opm.na } : {}) },
  });
  revalidatePath('/dashboard/klanten/' + orgId);
  if (!maten.ok || !opm.ok) return { ok: false, melding: 'Niet alles is opgeslagen. Probeer het nog eens.' };
  return { ok: true, melding: 'Opgeslagen.' };
}

/* --------------------------------------------------------------------- */
/* Afdelingen                                                              */
/* --------------------------------------------------------------------- */

async function afdelingVelden(formData: FormData, orgId: string) {
  const vestiging = tekst(formData, 'vestiging_id');
  // Leidinggevende is een werknemer van deze klant (PersoonKiezer).
  const leiding = await bevestigPersoon(leesPersoonKeuze(formData, 'leidinggevende'), orgId);
  return {
    naam: tekst(formData, 'naam'),
    kostenplaats: tekst(formData, 'kostenplaats') || null,
    leidinggevende: leiding.naam,
    leidinggevende_medewerker_id: leiding.soort === 'medewerker' ? leiding.id : null,
    vestiging_id: vestiging && (await hoortBijKlant('vestigingen', orgId, vestiging)) ? vestiging : null,
  };
}

export async function nieuweAfdelingActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const velden = await afdelingVelden(formData, id);
  if (id && velden.naam) {
    const ok = await maakAfdeling(id, velden);
    if (ok) await logAudit('afdeling_aangemaakt', { entiteit: 'organisatie', entiteitId: id, details: { naam: velden.naam } });
  }
  terug(id, 'afdelingen', 'toegevoegd');
}

export async function werkAfdelingActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const afdelingId = tekst(formData, 'afdelingId');
  const velden = await afdelingVelden(formData, id);
  if (afdelingId && velden.naam && (await hoortBijKlant('afdelingen', id, afdelingId))) {
    const sb = kmsAdmin();
    const { data } = sb
      ? await sb.from('afdelingen').select('naam, kostenplaats, leidinggevende, vestiging_id').eq('id', afdelingId).maybeSingle()
      : { data: null };
    const huidig = (data as Record<string, string | null> | null) ?? {};
    const voor: Record<string, unknown> = {};
    const na: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(velden)) {
      if ((huidig[k] ?? null) !== (v ?? null)) {
        voor[k] = huidig[k] ?? null;
        na[k] = v;
      }
    }
    if (Object.keys(na).length > 0) {
      await werkAfdeling(afdelingId, na as Partial<typeof velden>);
      await logAudit('afdeling_gewijzigd', { entiteit: 'afdeling', entiteitId: afdelingId, details: { voor, na } });
    }
  }
  terug(id, 'afdelingen', 'opgeslagen');
}

export async function verwijderAfdelingKlantActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(formData, 'orgId');
  const afdelingId = tekst(formData, 'afdelingId');
  if (afdelingId && (await hoortBijKlant('afdelingen', id, afdelingId))) {
    await verwijderAfdeling(afdelingId);
    await logAudit('afdeling_verwijderd', { entiteit: 'afdeling', entiteitId: afdelingId, details: { organisatie_id: id } });
  }
  terug(id, 'afdelingen', 'verwijderd');
}

/* --------------------------------------------------------------------- */
/* Assortiment: artikelen zoeken en met kleur en verstrekking toevoegen.  */
/* --------------------------------------------------------------------- */

/**
 * De hele catalogus voor de artikelkiezer. Wordt pas aangeroepen als het
 * zoekvenster opengaat, zodat de klantpagina zelf licht blijft.
 */
export async function haalArtikelenActie(): Promise<ArtikelKeuze[]> {
  if (!(await dashAuthed())) redirect('/dashboard');
  return listArtikelKeuze();
}

/**
 * De kleuren van één artikel met de foto per kleur. Wordt opgehaald zodra Jessi
 * een artikel aantikt. De kleuren uit de catalogus-lijst waren niet betrouwbaar:
 * die lijst haalt alle varianten in één verzoek op, en de database geeft daar
 * hoogstens 1000 rijen van terug. Bij de meeste artikelen ontbraken de kleuren
 * daardoor ('Bij dit artikel staan nog geen kleuren in het systeem').
 */
export async function haalKleurenActie(productId: string): Promise<KleurKeuze[]> {
  if (!(await dashAuthed())) redirect('/dashboard');
  return kleurKeuzesVoorArtikel(String(productId ?? '').trim());
}

/**
 * Artikel toevoegen aan het assortiment van een klant, met kleur, verstrekking
 * en voor wie (hele klant of afdelingen) in dezelfde handeling.
 *
 * Geeft een antwoord terug in plaats van door te sturen: zo blijft het
 * zoekvenster open en kan Jessi in één keer een hele kledinglijn samenstellen.
 */
export async function voegAssortimentToeActie(invoer: {
  orgId: string;
  productId: string;
  artikelNaam: string;
  kleur: string | null;
  verstrekking_type: VerstrekkingType;
  gratis_per_periode: number | null;
  periode: Periode;
  afdelingIds?: string[];
}): Promise<AssortimentAntwoord> {
  if (!(await dashAuthed())) redirect('/dashboard');

  const orgId = invoer.orgId.trim();
  const productId = invoer.productId.trim();
  if (!orgId || !productId) return { ok: false, melding: 'Er is geen artikel gekozen.' };

  // Alleen afdelingen van deze klant tellen mee.
  const afdelingIds: string[] = [];
  for (const a of invoer.afdelingIds ?? []) {
    if (await hoortBijKlant('afdelingen', orgId, a)) afdelingIds.push(a);
  }
  // Gevraagd voor bepaalde afdelingen, maar geen enkele bestaat (meer): dan niet
  // stilletjes voor de hele klant toevoegen.
  if ((invoer.afdelingIds ?? []).length > 0 && afdelingIds.length === 0) {
    return { ok: false, melding: 'De gekozen afdeling bestaat niet meer. Ververs de pagina en kies opnieuw.' };
  }

  const { uitkomst, toegevoegd, overgeslagen } = await voegAssortimentRegelToe(orgId, {
    productId,
    kleur: invoer.kleur,
    verstrekking_type: invoer.verstrekking_type,
    gratis_per_periode: invoer.gratis_per_periode,
    periode: invoer.periode,
    afdelingIds,
  });

  const naam = invoer.artikelNaam.trim() || 'Het artikel';
  if (uitkomst === 'kleur_verplicht') {
    return { ok: false, melding: `Kies eerst een kleur voor ${naam}. De kleur ligt na het toevoegen vast.` };
  }
  if (uitkomst === 'bestaat_al') {
    return { ok: false, melding: `${naam} staat in deze kleur al in dit assortiment.` };
  }
  if (uitkomst === 'mislukt') {
    return { ok: false, melding: `${naam} kon niet worden toegevoegd. Probeer het opnieuw.` };
  }

  await logAudit('assortiment_toegevoegd', {
    entiteit: 'organisatie',
    entiteitId: orgId,
    details: { productId, kleur: invoer.kleur, verstrekking_type: invoer.verstrekking_type, afdelingIds },
  });
  revalidatePath('/dashboard/klanten/' + orgId);
  const voorWie = afdelingIds.length > 0 ? ` voor ${toegevoegd} ${toegevoegd === 1 ? 'afdeling' : 'afdelingen'}` : '';
  return {
    ok: true,
    melding: `${naam} toegevoegd aan het assortiment${voorWie}.${overgeslagen > 0 ? ` ${overgeslagen} stond er al.` : ''}`,
    waarschuwing: uitkomst === 'toegevoegd_zonder_kleur' ? KLEUR_NOG_NIET_BESCHIKBAAR : undefined,
  };
}

/**
 * Verstrekking, budget of voor wie (hele klant / afdeling) van een regel
 * bijwerken. De kleur ligt vast en wordt hier niet meer veranderd.
 */
export async function werkAssortimentActie(invoer: {
  orgId: string;
  regelId: string;
  verstrekking_type: VerstrekkingType;
  gratis_per_periode: number | null;
  periode: Periode;
  /** Weglaten = niet veranderen; leeg = hele klant. */
  afdeling_id?: string | null;
}): Promise<AssortimentAntwoord> {
  if (!(await dashAuthed())) redirect('/dashboard');

  const orgId = invoer.orgId.trim();
  const regelId = invoer.regelId.trim();
  if (!orgId || !regelId) return { ok: false, melding: 'Deze regel bestaat niet meer.' };

  let afdeling: string | null | undefined = undefined;
  if (invoer.afdeling_id !== undefined) {
    afdeling = invoer.afdeling_id ? invoer.afdeling_id : null;
    if (afdeling && !(await hoortBijKlant('afdelingen', orgId, afdeling))) {
      return { ok: false, melding: 'Die afdeling hoort niet bij deze klant.' };
    }
  }

  const { uitkomst, voor, na } = await werkAssortimentRegelBij(regelId, {
    verstrekking_type: invoer.verstrekking_type,
    gratis_per_periode: invoer.gratis_per_periode,
    periode: invoer.periode,
    ...(afdeling !== undefined ? { afdeling_id: afdeling } : {}),
  });
  if (uitkomst === 'dubbel') {
    return { ok: false, melding: 'Dit artikel staat in die kleur al voor die groep in het assortiment.' };
  }
  if (uitkomst === 'mislukt') {
    return { ok: false, melding: 'Opslaan is niet gelukt. Probeer het opnieuw.' };
  }

  if (Object.keys(na).length > 0) {
    await logAudit('assortiment_gewijzigd', {
      entiteit: 'assortiment',
      entiteitId: regelId,
      details: { organisatie_id: orgId, voor, na },
    });
  }
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

/**
 * Maakt een eenmalige inloglink voor een portaalgebruiker, zonder mail.
 *
 * Voor testen ("kijk mee als deze medewerker") en voor support als een klant zijn
 * mail niet krijgt. Alleen voor de eigenaar, en elke link komt in het logboek.
 * De link werkt één keer en verloopt na een uur (Supabase OTP-verloop). Open hem in
 * een incognitovenster: hij vervangt de sessie in de browser waarin je hem opent.
 */
export async function maakInloglinkActie(
  gebruikerId: string,
): Promise<{ ok: true; link: string; email: string } | { ok: false; fout: string }> {
  if (!(await authed())) return { ok: false, fout: 'Niet ingelogd.' };
  if (!(await magEigenaar())) return { ok: false, fout: 'Alleen de eigenaar kan inloglinks maken.' };
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const id = String(gebruikerId ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, fout: 'Onbekende gebruiker.' };

  const { data: g } = await sb.from('portaal_gebruikers').select('id, email, organisatie_id').eq('id', id).maybeSingle();
  const email = (g?.email ?? '').trim().toLowerCase();
  if (!g || !email) return { ok: false, fout: 'Deze gebruiker heeft geen e-mailadres.' };

  // Heeft deze gebruiker nog nooit ingelogd, dan bestaat hij nog niet in Supabase Auth:
  // dan een uitnodigingslink, die maakt het account meteen aan.
  let type: 'magiclink' | 'invite' = 'magiclink';
  let res = await sb.auth.admin.generateLink({ type: 'magiclink', email });
  if (res.error || !res.data?.properties?.hashed_token) {
    type = 'invite';
    res = await sb.auth.admin.generateLink({ type: 'invite', email });
  }
  const hash = res.data?.properties?.hashed_token;
  if (res.error || !hash) return { ok: false, fout: `Link maken lukte niet${res.error?.message ? `: ${res.error.message}` : ''}.` };

  const { headers } = await import('next/headers');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const link = `${proto}://${host}/portaal/auth/bevestig?token_hash=${encodeURIComponent(hash)}&type=${type}`;

  await logAudit('portaal_inloglink_gemaakt', {
    entiteit: 'portaal_gebruiker',
    entiteitId: id,
    details: { email, organisatie_id: g.organisatie_id },
  });
  return { ok: true, link, email };
}
