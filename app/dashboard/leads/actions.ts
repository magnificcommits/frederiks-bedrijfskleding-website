'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { aiTekst } from '@/lib/ai';
import {
  isUuid,
  koppelLeadAanKlant,
  logActiviteit,
  maakKlantVanLead,
  maakLead,
  maakOfferteVoorLead,
  voegLeadsSamen,
  werkLeadBij,
  zetLeadStatus,
  zetVolgendeStap,
} from '@/lib/kms/leads';
import { HANDMATIGE_BRONNEN, VERLOREN, schoneStatus } from '@/lib/kms/leadsModel';

/* ------------------------------------------------------------------ */
/* Hulpjes                                                             */
/* ------------------------------------------------------------------ */

/** Alleen interne paden: voorkomt doorsturen naar een externe site. */
function veiligPad(v: FormDataEntryValue | null, standaard: string): string {
  const s = String(v ?? '');
  return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\') ? s : standaard;
}

function metMelding(pad: string, sleutel: 'ok' | 'fout', waarde: string): string {
  const [basis, qs = ''] = pad.split('?');
  const p = new URLSearchParams(qs);
  p.delete('ok');
  p.delete('fout');
  p.set(sleutel, waarde);
  return `${basis}?${p.toString()}`;
}

const tekst = (f: FormData, k: string, max = 500) => String(f.get(k) ?? '').trim().slice(0, max) || null;

function bedrag(v: FormDataEntryValue | null): number | null {
  const ruw = String(v ?? '').replace(/[^0-9.,]/g, '');
  if (!ruw) return null;
  // "1.250,50" en "1250.5" allebei goed lezen.
  const n = Number(ruw.includes(',') ? ruw.replace(/\./g, '').replace(',', '.') : ruw);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function leadPad(id: string) {
  return `/dashboard/leads/${id}`;
}

/* ------------------------------------------------------------------ */
/* Pijplijn                                                            */
/* ------------------------------------------------------------------ */

/** Vanuit de pijplijn (slepen, toetsenbord of statusmenu). Geeft een uitkomst terug; geen redirect. */
export async function verplaatsLeadActie(id: string, status: string, reden?: string | null): Promise<{ ok: boolean; fout?: string }> {
  if (!(await dashAuthed())) return { ok: false, fout: 'Geen toegang.' };
  const s = schoneStatus(status);
  if (!isUuid(id) || !s) return { ok: false, fout: 'Onbekende status.' };
  if (s === VERLOREN && !String(reden ?? '').trim()) return { ok: false, fout: 'Kies een reden.' };
  const uit = await zetLeadStatus(id, s, reden ?? null);
  if (uit.ok) revalidatePath('/dashboard/leads');
  return uit.ok ? { ok: true } : { ok: false, fout: uit.fout };
}

/* ------------------------------------------------------------------ */
/* Detailpagina                                                        */
/* ------------------------------------------------------------------ */

export async function zetStatusActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const terug = veiligPad(formData.get('terug'), leadPad(id));
  const s = schoneStatus(formData.get('status'));
  if (!isUuid(id) || !s) redirect(metMelding(terug, 'fout', 'status'));
  const reden = tekst(formData, 'verloren_reden', 300);
  const toelichting = tekst(formData, 'reden_toelichting', 300);
  const volledig = reden && toelichting ? `${reden}: ${toelichting}` : reden ?? toelichting;
  if (s === VERLOREN && !volledig) redirect(metMelding(terug, 'fout', 'reden'));
  const uit = await zetLeadStatus(id, s, volledig);
  redirect(metMelding(terug, uit.ok ? 'ok' : 'fout', uit.ok ? 'status' : 'opslaan'));
}

export async function werkLeadBijActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const terug = veiligPad(formData.get('terug'), leadPad(id));
  if (!isUuid(id)) redirect('/dashboard/leads');
  const kansRuw = String(formData.get('kans') ?? '').trim();
  const kans = kansRuw === '' ? null : Math.max(0, Math.min(100, Math.round(Number(kansRuw))));
  const velden: Parameters<typeof werkLeadBij>[1] = {
    offertewaarde: bedrag(formData.get('offertewaarde')),
    kans: Number.isFinite(kans as number) ? kans : null,
  };
  if (formData.has('eigenaar_id')) velden.eigenaar_id = String(formData.get('eigenaar_id') ?? '') || null;
  const uit = await werkLeadBij(id, velden);
  redirect(metMelding(terug, uit.ok ? 'ok' : 'fout', uit.ok ? 'opgeslagen' : 'opslaan'));
}

export async function werkContactBijActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const terug = veiligPad(formData.get('terug'), leadPad(id));
  if (!isUuid(id)) redirect('/dashboard/leads');
  const naam = tekst(formData, 'name', 120);
  if (!naam) redirect(metMelding(terug, 'fout', 'naam'));
  const uit = await werkLeadBij(id, {
    name: naam,
    company: tekst(formData, 'company', 160),
    email: (tekst(formData, 'email', 200) ?? '').toLowerCase(),
    phone: tekst(formData, 'phone', 40),
    branche: tekst(formData, 'branche', 80),
    aantal: tekst(formData, 'aantal', 40),
  });
  redirect(metMelding(terug, uit.ok ? 'ok' : 'fout', uit.ok ? 'opgeslagen' : 'opslaan'));
}

export async function logActiviteitActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const terug = veiligPad(formData.get('terug'), leadPad(id));
  if (!isUuid(id)) redirect('/dashboard/leads');
  const soort = String(formData.get('soort') ?? 'notitie');
  const regel = tekst(formData, 'tekst', 4000);
  if (!regel && soort === 'notitie') redirect(metMelding(terug, 'fout', 'leeg'));
  const ok = await logActiviteit(id, soort, regel);
  redirect(metMelding(terug, ok ? 'ok' : 'fout', ok ? 'toegevoegd' : 'opslaan'));
}

export async function volgendeStapActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const terug = veiligPad(formData.get('terug'), leadPad(id));
  if (!isUuid(id)) redirect('/dashboard/leads');
  const tijd = String(formData.get('tijd') ?? '').trim();
  const uit = await zetVolgendeStap(id, {
    tekst: String(formData.get('stap') ?? ''),
    datum: String(formData.get('datum') ?? ''),
    tijd: /^\d{2}:\d{2}$/.test(tijd) ? tijd : null,
    persoonId: String(formData.get('persoon_id') ?? '') || null,
    vorigeAfronden: formData.get('vorige_afronden') === 'on',
  });
  redirect(metMelding(terug, uit.ok ? 'ok' : 'fout', uit.ok ? 'stap' : 'stap'));
}

export async function voegSamenActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const hoofd = String(formData.get('hoofd_id') ?? '');
  const dubbel = String(formData.get('dubbel_id') ?? '');
  if (!isUuid(hoofd) || !isUuid(dubbel)) redirect('/dashboard/leads');
  const uit = await voegLeadsSamen(hoofd, dubbel);
  redirect(metMelding(leadPad(hoofd), uit.ok ? 'ok' : 'fout', uit.ok ? 'samengevoegd' : 'samenvoegen'));
}

export async function koppelKlantActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const orgId = String(formData.get('organisatie_id') ?? '');
  const daarna = String(formData.get('daarna') ?? '');
  if (!isUuid(id) || !isUuid(orgId)) redirect('/dashboard/leads');
  const uit = await koppelLeadAanKlant(id, orgId);
  if (!uit.ok) redirect(metMelding(leadPad(id), 'fout', 'koppelen'));
  if (daarna === 'offerte') {
    const o = await maakOfferteVoorLead(id);
    if ('id' in o) redirect(`/dashboard/offertes/${o.id}`);
    redirect(metMelding(leadPad(id), 'fout', 'offerte'));
  }
  redirect(metMelding(leadPad(id), 'ok', 'gekoppeld'));
}

/** Nieuwe klant aanmaken van de lead; met daarna=offerte meteen door naar een concept-offerte. */
export async function nieuweKlantActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const daarna = String(formData.get('daarna') ?? '');
  if (!isUuid(id)) redirect('/dashboard/leads');
  const orgId = await maakKlantVanLead(id);
  if (!orgId) redirect(metMelding(leadPad(id), 'fout', 'klant'));
  if (daarna === 'offerte') {
    const o = await maakOfferteVoorLead(id);
    if ('id' in o) redirect(`/dashboard/offertes/${o.id}`);
    redirect(metMelding(leadPad(id), 'fout', 'offerte'));
  }
  if (daarna === 'blijf') redirect(metMelding(leadPad(id), 'ok', 'klant'));
  redirect('/dashboard/klanten/' + orgId);
}

export async function offerteActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) redirect('/dashboard/leads');
  const o = await maakOfferteVoorLead(id);
  if ('id' in o) redirect(`/dashboard/offertes/${o.id}`);
  redirect(metMelding(leadPad(id), 'fout', 'offerte'));
}

/* ------------------------------------------------------------------ */
/* Snelle invoer                                                       */
/* ------------------------------------------------------------------ */

export async function nieuweLeadActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const naam = tekst(formData, 'name', 120);
  if (!naam) redirect('/dashboard/leads?fout=naam');
  const bronKeuze = String(formData.get('bron') ?? '');
  const bronAnders = tekst(formData, 'bron_anders', 120);
  const bron = bronKeuze === 'Anders' ? bronAnders ?? 'Anders' : (HANDMATIGE_BRONNEN as readonly string[]).includes(bronKeuze) ? bronKeuze : 'Telefonisch';
  const regels = [tekst(formData, 'bericht', 2000)];
  if (formData.get('passen') === 'on') regels.push('Passen op locatie gewenst: ja');
  const datum = String(formData.get('opvolgdatum') ?? '');
  const uit = await maakLead({
    name: naam,
    company: tekst(formData, 'company', 160),
    email: (tekst(formData, 'email', 200) ?? '').toLowerCase() || null,
    phone: tekst(formData, 'phone', 40),
    branche: tekst(formData, 'branche', 80),
    aantal: tekst(formData, 'aantal', 40),
    bericht: regels.filter(Boolean).join('\n') || null,
    bron,
    eigenaar_id: String(formData.get('eigenaar_id') ?? '') || null,
    opvolgdatum: /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : null,
  });
  if ('fout' in uit) redirect('/dashboard/leads?fout=opslaan');
  // Telefonisch binnengekomen = er is al contact geweest. Dat telt mee voor de reactietijd.
  if (bron === 'Telefonisch' || bron === 'Langs in de winkel' || bron === 'Beurs of evenement') {
    await logActiviteit(uit.id, bron === 'Telefonisch' ? 'telefoon' : 'afspraak', `Binnengekomen: ${bron.toLowerCase()}.`, { statusMeenemen: false });
  }
  redirect(`${leadPad(uit.id)}?ok=aangemaakt`);
}

/* ------------------------------------------------------------------ */
/* Bestaande acties                                                    */
/* ------------------------------------------------------------------ */

export async function converteerLead(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) redirect('/dashboard/leads');
  const orgId = await maakKlantVanLead(id);
  if (!orgId) redirect('/dashboard/leads');
  redirect('/dashboard/klanten/' + orgId);
}

/**
 * Converteert meerdere aangevinkte leads in een keer naar klant. Een fout bij een
 * enkele lead stopt de rest niet. Daarna terug naar de lijst (met de filter-URL).
 */
export async function bulkConverteerLeads(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const terug = veiligPad(formData.get('terug'), '/dashboard/leads');
  const ids = formData.getAll('lead_ids').map((v) => String(v)).filter(isUuid);
  for (const id of ids) {
    try {
      await maakKlantVanLead(id);
    } catch {
      // Een mislukte lead mag de rest van de batch niet blokkeren.
    }
  }
  redirect(metMelding(terug, 'ok', 'bijgewerkt'));
}

/**
 * Concept-opvolgmail met de bestaande AI-laag. Vorm is geschikt voor useActionState.
 * Geen redirect: de beheerder leest het concept na, past aan en verstuurt zelf.
 */
export async function aiOpvolgmailActie(
  _prev: { tekst?: string; error?: string } | null,
  formData: FormData,
): Promise<{ tekst?: string; error?: string }> {
  if (!(await dashAuthed())) return { error: 'Geen toegang.' };

  const naam = String(formData.get('naam') ?? '').trim();
  const bedrijf = String(formData.get('bedrijf') ?? '').trim();
  const branche = String(formData.get('branche') ?? '').trim();
  const bericht = String(formData.get('bericht') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  const context = String(formData.get('context') ?? '').trim().slice(0, 1500);

  const opdracht =
    'Schrijf een korte, persoonlijke en professionele opvolg-e-mail (max 120 woorden) ' +
    'namens Frederiks Bedrijfskleding aan een lead. ' +
    `Lead: naam=${naam || 'onbekend'}, ` +
    `bedrijf=${bedrijf || 'onbekend'}, ` +
    `branche=${branche || 'onbekend'}, ` +
    `hun bericht=${bericht || 'geen bericht'}, ` +
    `status=${status || 'onbekend'}. ` +
    (context ? `Eerder contact (nieuwste eerst): ${context}. Sluit daarop aan. ` : '') +
    'Toon: vriendelijk, concreet, gericht op een vrijblijvend adviesgesprek of ' +
    'langskomen om te passen. Geen gedachtestreepjes. ' +
    "Onderteken met 'Met vriendelijke groet, Frederiks Bedrijfskleding'. " +
    'Geen onderwerpregel, alleen de mailtekst.';

  const resultaat = await aiTekst(opdracht);
  if (!resultaat.ok) {
    return { error: resultaat.error ?? 'Er ging iets mis bij het genereren.' };
  }
  return { tekst: resultaat.tekst };
}
