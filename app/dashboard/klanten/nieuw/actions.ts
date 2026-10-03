'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { logAudit, logWijziging } from '@/lib/kms/audit';
import {
  listContactpersonen,
  maakContactpersoon,
  werkContactpersoon,
  geefPortaalToegang,
} from '@/lib/kms/crm';
import { werknemerVanContact } from '@/lib/kms/werknemers';
import { listAfdelingen, maakAfdelingMetId, verwijderAfdeling, afdelingInGebruik } from '@/lib/kms/structuur';
import { wizardUrl } from '../_delen/inrichting';
import { leesJsonLijst, naarInvoerRijen, naarWijzigingen, slaWerknemersOp, uitkomstTekst } from '../_delen/werknemersOpslaan';

/**
 * Server actions van de wizard Nieuwe klant. Elke stap slaat direct op, zodat
 * Jessi kan stoppen en later verder kan (de klant bestaat vanaf stap 1).
 * Met de knop Terug wordt ook opgeslagen; daarna gaat het een stap terug.
 */

function tekst(formData: FormData, veld: string, max = 500): string {
  return String(formData.get(veld) ?? '').trim().slice(0, max);
}

/** Bestaat deze klant? Zo niet, dan terug naar het begin van de wizard. */
async function eisKlant(klantId: string): Promise<void> {
  const sb = kmsAdmin();
  if (!klantId || !sb) redirect('/dashboard/klanten/nieuw?fout=onbekend');
  const { data } = await sb.from('organisaties').select('id').eq('id', klantId).maybeSingle();
  if (!data) redirect('/dashboard/klanten/nieuw?fout=onbekend');
}

/** Volgende of vorige stap, afhankelijk van welke knop is ingedrukt. */
function naarStap(formData: FormData, klantId: string, huidig: number, melding?: string): never {
  const terug = formData.get('ga') === 'terug';
  const stap = terug ? Math.max(1, huidig - 1) : huidig + 1;
  redirect(wizardUrl(klantId, stap, melding ? { melding } : undefined));
}

/* --------------------------------------------------------------------- */
/* Stap 1: bedrijf                                                         */
/* --------------------------------------------------------------------- */

const BEDRIJF_VELDEN = [
  'naam',
  'branche',
  'adres',
  'postcode',
  'plaats',
  'telefoon',
  'email_algemeen',
  'factuur_email',
  'kvk',
  'btw_nummer',
  'interne_notities',
] as const;

export async function slaBedrijfOpActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const klantId = tekst(formData, 'klantId', 64);
  const waarden: Record<string, string> = {};
  for (const v of BEDRIJF_VELDEN) waarden[v] = tekst(formData, v, v === 'interne_notities' ? 4000 : 300);
  for (const v of ['email_algemeen', 'factuur_email']) waarden[v] = waarden[v].toLowerCase();

  if (!waarden.naam) {
    redirect(klantId ? wizardUrl(klantId, 1, { fout: 'naam' }) : '/dashboard/klanten/nieuw?fout=naam');
  }
  const sb = kmsAdmin();
  if (!sb) redirect('/dashboard/klanten/nieuw?fout=db');

  if (!klantId) {
    // Nieuwe klant: alleen ingevulde velden meesturen, de rest houdt de standaard van de database.
    const rij: Record<string, string> = {};
    for (const [k, v] of Object.entries(waarden)) if (v) rij[k] = v;
    const { data, error } = await sb.from('organisaties').insert(rij).select('id').single();
    if (error || !data) redirect('/dashboard/klanten/nieuw?fout=mislukt');
    const id = (data as { id: string }).id;
    await logAudit('klant_aangemaakt', {
      entiteit: 'organisatie',
      entiteitId: id,
      details: { naam: waarden.naam, branche: waarden.branche || null, via: 'wizard' },
    });
    revalidatePath('/dashboard/klanten');
    redirect(wizardUrl(id, 2));
  }

  // Bestaande klant (terug in stap 1): alleen wat echt verandert naar de database.
  await eisKlant(klantId);
  const { data } = await sb.from('organisaties').select(BEDRIJF_VELDEN.join(', ')).eq('id', klantId).maybeSingle();
  const huidig = (data as unknown as Record<string, string | null> | null) ?? {};
  const voor: Record<string, unknown> = {};
  const na: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(waarden)) {
    const nieuw = v || null;
    if ((huidig[k] ?? null) !== nieuw) {
      voor[k] = huidig[k] ?? null;
      na[k] = nieuw;
    }
  }
  if (Object.keys(na).length > 0) {
    await sb.from('organisaties').update(na).eq('id', klantId);
    await logWijziging('klant_gewijzigd', { entiteit: 'organisatie', entiteitId: klantId, voor, na });
    revalidatePath('/dashboard/klanten');
  }
  redirect(wizardUrl(klantId, 2));
}

/* --------------------------------------------------------------------- */
/* Stap 2: contactpersonen                                                 */
/* --------------------------------------------------------------------- */

type ContactRij = {
  id: string;
  naam: string;
  functie: string;
  email: string;
  telefoon: string;
  hoofdcontact: boolean;
  facturatie: boolean;
  portaal: boolean;
  werknemer: boolean;
};

function naarContactRijen(lijst: unknown[]): ContactRij[] {
  const s = (v: unknown, max = 200) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  return lijst.slice(0, 100).map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    return {
      id: s(o.id, 64),
      naam: s(o.naam),
      functie: s(o.functie),
      email: s(o.email).toLowerCase(),
      telefoon: s(o.telefoon, 50),
      hoofdcontact: o.hoofdcontact === true,
      facturatie: o.facturatie === true,
      portaal: o.portaal === true,
      werknemer: o.werknemer === true,
    };
  });
}

export async function slaContactenOpActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const klantId = tekst(formData, 'klantId', 64);
  await eisKlant(klantId);

  const rijen = naarContactRijen(leesJsonLijst(formData.get('rijen'))).filter((r) => r.naam);
  // Hoogstens één hoofdcontact en één facturatiecontact; bij twee wint de eerste.
  let hoofd = false;
  let fact = false;
  for (const r of rijen) {
    if (r.hoofdcontact && hoofd) r.hoofdcontact = false;
    if (r.facturatie && fact) r.facturatie = false;
    hoofd ||= r.hoofdcontact;
    fact ||= r.facturatie;
  }

  const bestaand = new Map((await listContactpersonen(klantId)).map((c) => [c.id, c]));
  const opgeslagen: (ContactRij & { contactId: string })[] = [];
  const meldingen: string[] = [];

  // Eerst wie het facturatievinkje kwijtraakt, daarna wie het krijgt: er mag er
  // in de database maar één tegelijk zijn.
  const bestaandeRijen = rijen
    .filter((r) => r.id && bestaand.has(r.id))
    .sort((a, b) => Number(a.facturatie) - Number(b.facturatie));
  for (const r of bestaandeRijen) {
    const { ok, voor, na } = await werkContactpersoon(r.id, {
      naam: r.naam,
      functie: r.functie || null,
      email: r.email || null,
      telefoon: r.telefoon || null,
      hoofdcontact: r.hoofdcontact,
      facturatie: r.facturatie,
    });
    if (ok && Object.keys(na).length > 0) {
      await logAudit('contactpersoon_gewijzigd', { entiteit: 'contactpersoon', entiteitId: r.id, details: { voor, na, via: 'wizard' } });
    }
    opgeslagen.push({ ...r, contactId: r.id });
  }

  for (const r of rijen.filter((x) => !x.id || !bestaand.has(x.id))) {
    const contactId = await maakContactpersoon(klantId, {
      naam: r.naam,
      functie: r.functie || null,
      email: r.email || null,
      telefoon: r.telefoon || null,
      hoofdcontact: r.hoofdcontact,
      facturatie: r.facturatie,
    });
    if (!contactId) {
      meldingen.push(`${r.naam} kon niet worden opgeslagen.`);
      continue;
    }
    await logAudit('contactpersoon_toegevoegd', {
      entiteit: 'contactpersoon',
      entiteitId: contactId,
      details: { organisatie_id: klantId, naam: r.naam, via: 'wizard' },
    });
    opgeslagen.push({ ...r, contactId });
  }

  // Draagt zelf kleding: meteen werknemer (bestaat hij al, dan wordt die gebruikt).
  // Mag inloggen: portaaltoegang, gekoppeld aan de werknemer als die er is.
  for (const r of opgeslagen) {
    let werknemerId: string | null = null;
    if (r.werknemer) {
      const w = await werknemerVanContact(r.contactId);
      if (w) {
        werknemerId = w.id;
        if (!w.bestond) {
          await logAudit('werknemer_aangemaakt', {
            entiteit: 'medewerker',
            entiteitId: w.id,
            details: { organisatie_id: klantId, naam: w.naam, uit_contactpersoon: r.contactId, via: 'wizard' },
          });
        }
      }
    }
    if (r.portaal) {
      if (!r.email) {
        meldingen.push(`${r.naam} heeft geen e-mailadres, dus geen portaaltoegang.`);
        continue;
      }
      const uitkomst = await geefPortaalToegang(klantId, r.email, r.naam, werknemerId);
      if (uitkomst === 'toegevoegd') {
        await logAudit('portaalgebruiker_gekoppeld', { entiteit: 'organisatie', entiteitId: klantId, details: { email: r.email, via: 'wizard' } });
      } else if (uitkomst === 'elders') {
        meldingen.push(`${r.email} kan al inloggen bij een andere klant en is daarom hier niet gekoppeld.`);
      } else if (uitkomst === 'mislukt') {
        meldingen.push(`Portaaltoegang voor ${r.email} is niet gelukt.`);
      }
    }
  }

  // De naam in de kolom Contactpersoon van de klantenlijst gelijk houden aan het hoofdcontact.
  const hoofdcontact = opgeslagen.find((r) => r.hoofdcontact);
  const sb = kmsAdmin();
  if (sb && hoofdcontact) {
    const { data } = await sb.from('organisaties').select('contactpersoon').eq('id', klantId).maybeSingle();
    const oud = (data as { contactpersoon: string | null } | null)?.contactpersoon ?? null;
    if (oud !== hoofdcontact.naam) {
      await sb.from('organisaties').update({ contactpersoon: hoofdcontact.naam }).eq('id', klantId);
    }
  }

  revalidatePath('/dashboard/klanten');
  revalidatePath('/dashboard/klanten/' + klantId);
  naarStap(formData, klantId, 2, meldingen.join(' ') || undefined);
}

/* --------------------------------------------------------------------- */
/* Stap 3: afdelingen                                                      */
/* --------------------------------------------------------------------- */

export async function slaAfdelingenOpActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const klantId = tekst(formData, 'klantId', 64);
  await eisKlant(klantId);

  const nieuw = leesJsonLijst(formData.get('nieuw'))
    .filter((n): n is string => typeof n === 'string')
    .map((n) => n.replace(/\s+/g, ' ').trim().slice(0, 120))
    .filter(Boolean);
  const weg = leesJsonLijst(formData.get('weg')).filter((n): n is string => typeof n === 'string');

  const bestaand = await listAfdelingen(klantId);
  const namen = new Set(bestaand.map((a) => a.naam.trim().toLowerCase()));
  const gemaakt: string[] = [];
  for (const naam of nieuw) {
    const sleutel = naam.toLowerCase();
    if (namen.has(sleutel)) continue;
    const id = await maakAfdelingMetId(klantId, { naam });
    if (id) {
      namen.add(sleutel);
      gemaakt.push(naam);
    }
  }

  const meldingen: string[] = [];
  const eigen = new Map(bestaand.map((a) => [a.id, a]));
  for (const id of weg) {
    const afd = eigen.get(id);
    if (!afd) continue;
    // Alleen weggooien als er nog niets aan hangt: anders verdwijnen werknemers
    // uit hun afdeling en artikelen uit het assortiment.
    const gebruik = await afdelingInGebruik(id);
    if (gebruik.werknemers > 0 || gebruik.artikelen > 0) {
      meldingen.push(`${afd.naam} is niet verwijderd: er hangen al werknemers of artikelen aan. Dat kan op de klantkaart.`);
      continue;
    }
    if (await verwijderAfdeling(id)) {
      await logAudit('afdeling_verwijderd', { entiteit: 'afdeling', entiteitId: id, details: { organisatie_id: klantId, naam: afd.naam, via: 'wizard' } });
    }
  }
  if (gemaakt.length > 0) {
    await logAudit('afdeling_aangemaakt', { entiteit: 'organisatie', entiteitId: klantId, details: { namen: gemaakt, via: 'wizard' } });
  }
  revalidatePath('/dashboard/klanten/' + klantId);
  naarStap(formData, klantId, 3, meldingen.join(' ') || undefined);
}

/* --------------------------------------------------------------------- */
/* Stap 4: werknemers                                                      */
/* --------------------------------------------------------------------- */

export async function slaWerknemersOpActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const klantId = tekst(formData, 'klantId', 64);
  await eisKlant(klantId);
  const rijen = naarInvoerRijen(leesJsonLijst(formData.get('rijen')));
  const wijzigingen = naarWijzigingen(leesJsonLijst(formData.get('bestaand')));
  let melding: string | undefined;
  if (rijen.length > 0 || wijzigingen.length > 0) {
    const uitkomst = await slaWerknemersOp(klantId, rijen, wijzigingen);
    melding = uitkomstTekst(uitkomst);
  }
  revalidatePath('/dashboard/klanten');
  revalidatePath('/dashboard/klanten/' + klantId);
  naarStap(formData, klantId, 4, melding);
}
