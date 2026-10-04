import { randomBytes } from 'node:crypto';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { site } from '@/content/site';
import { maakTaak, werkTaakBij, verwijderTaak, herstelTaak, vinkTaak } from '@/lib/kms/taken';
import { datumKort, isDatum, isTijd, nlDelen, nlNaarDate, plusDagen } from '@/app/dashboard/taken/tijd';
import { afspraakMomenten, afspraakPersoon, getBeschikbaarheid, momentIsVrij } from '@/lib/afspraken/beschikbaarheid';
import { mailAnnulering, mailBevestiging, mailHerinnering, mailJessi, type MailAfspraak } from '@/lib/afspraken/mails';
import { SOORT_INFO, isAfspraakStatus, isSoort, type AfspraakSoort, type AfspraakStatus } from '@/lib/afspraken/soorten';
import { eisData } from '@/lib/dbFout';
import { saveLead } from '@/lib/supabase';
import { heeftHerkomst, herkomstTekst, type Herkomst } from '@/lib/leadHerkomst';

/**
 * Online afspraken: boeken, verzetten, annuleren, status in het KMS en de
 * herinnering een dag vooraf. Tabel `afspraken` (RLS aan, geen policies), dus
 * alles via kmsAdmin(). Alleen server-side.
 *
 * Bij elke boeking ontstaan er drie dingen:
 *  1. de afspraak zelf (met token voor de verzet-/annuleerlink);
 *  2. een lead (of een bestaande open lead van hetzelfde adres krijgt status 'afspraak');
 *  3. een afspraak in de takenmodule, in de agenda van Jessi.
 * Dubbel boeken voorkomt een exclusion constraint in de database; vooraf
 * rekenen we ook de buffer en de agenda van Jessi mee.
 */

export type Afspraak = {
  id: string;
  created_at: string;
  soort: AfspraakSoort;
  start_op: string;
  eind_op: string;
  status: AfspraakStatus;
  naam: string;
  bedrijf: string | null;
  email: string;
  telefoon: string | null;
  aantal_medewerkers: string | null;
  branche: string | null;
  opmerking: string | null;
  locatie: string | null;
  bron: string | null;
  token: string;
  ics_volgnummer: number;
  lead_id: string | null;
  taak_id: string | null;
  persoon_id: string | null;
  herinnering_verstuurd_op: string | null;
  geannuleerd_op: string | null;
  geannuleerd_door: string | null;
};

const KOLOMMEN =
  'id, created_at, soort, start_op, eind_op, status, naam, bedrijf, email, telefoon, aantal_medewerkers, branche, opmerking, locatie, bron, token, ics_volgnummer, lead_id, taak_id, persoon_id, herinnering_verstuurd_op, geannuleerd_op, geannuleerd_door';

const UUID = /^[0-9a-f-]{36}$/i;
const TOKEN = /^[A-Za-z0-9_-]{20,80}$/;

function naarMail(a: Afspraak): MailAfspraak {
  return {
    id: a.id,
    soort: a.soort,
    start: new Date(a.start_op),
    eind: new Date(a.eind_op),
    naam: a.naam,
    bedrijf: a.bedrijf,
    email: a.email,
    telefoon: a.telefoon,
    aantal_medewerkers: a.aantal_medewerkers,
    branche: a.branche,
    opmerking: a.opmerking,
    locatie: a.locatie,
    bron: a.bron,
    token: a.token,
    ics_volgnummer: a.ics_volgnummer,
  };
}

function tekst(v: unknown, max = 300): string | null {
  const s = String(v ?? '').trim().slice(0, max);
  return s || null;
}

export type BoekInvoer = {
  soort: string;
  datum: string;
  tijd: string;
  naam: string;
  bedrijf?: string;
  email: string;
  telefoon?: string;
  aantal?: string;
  branche?: string;
  opmerking?: string;
  /** Adres bij een pasdag. */
  locatie?: string;
  /** Bij een adviesgesprek: bellen of video. */
  vorm?: string;
  bron?: string;
  /** Gestructureerde herkomst uit de browser, al opgeschoond met schoneHerkomst(). */
  herkomst?: Herkomst | null;
};

export type BoekResultaat =
  | { ok: true; token: string; start: string; eind: string }
  | { ok: false; fout: string; bezet?: boolean };

const BEZET = 'Dit moment is net door iemand anders geboekt. Kies een ander moment.';

/** Een lead aanmaken of een bestaande open lead van hetzelfde adres bijwerken. Geeft het lead-id terug. */
async function leadVoorAfspraak(
  a: { naam: string; bedrijf: string | null; email: string; telefoon: string | null; aantal: string | null; branche: string | null; opmerking: string | null; bron: string | null },
  stap: { tekst: string; datum: string; persoonId: string | null; persoonNaam: string | null },
  herkomst: Herkomst | null = null,
): Promise<string | null> {
  const sb = kmsAdmin();
  if (!sb) return null;
  const patroon = a.email.replace(/[\\%_]/g, (t) => `\\${t}`);
  const { data: bestaand } = await sb
    .from('leads')
    .select('id, status, email')
    .ilike('email', patroon)
    .in('status', ['nieuw', 'contact', 'afspraak', 'offerte'])
    .order('created_at', { ascending: false })
    .limit(1);
  const eerder = ((bestaand as { id: string; status: string; email: string }[]) ?? [])[0];
  const opvolg = {
    volgende_stap: stap.tekst,
    opvolgdatum: stap.datum,
    ...(stap.persoonId ? { eigenaar_id: stap.persoonId, eigenaar: stap.persoonNaam } : {}),
  };

  if (eerder) {
    const patch: Record<string, unknown> = { ...opvolg };
    if (eerder.status === 'nieuw' || eerder.status === 'contact') {
      patch.status = 'afspraak';
      patch.status_gewijzigd_op = new Date().toISOString();
    }
    const { error } = await sb.from('leads').update(patch).eq('id', eerder.id);
    if (error) await sb.from('leads').update({ status: patch.status ?? eerder.status }).eq('id', eerder.id);
    return eerder.id;
  }

  // Nieuwe lead via dezelfde opslag als de andere webleads (saveLead): die bewaart de
  // herkomstvelden en valt zelf terug als een kolom ontbreekt of als de check
  // leads_bron_kanaal_chk 'afspraak' nog niet kent (23514: opnieuw zonder bron_kanaal).
  // De bron begint altijd met 'afspraak', zodat er ook zonder bron_kanaal op te filteren is.
  const herkomstBron = herkomst && heeftHerkomst(herkomst) ? herkomstTekst(herkomst) : null;
  const bronTekst = ['afspraak', a.bron || herkomstBron].filter(Boolean).join(' | ').slice(0, 400);
  const opslag = await saveLead({
    name: a.naam,
    company: a.bedrijf,
    email: a.email,
    phone: a.telefoon,
    branche: a.branche,
    aantal: a.aantal,
    bericht: a.opmerking,
    bron: bronTekst,
    status: 'afspraak',
    bron_kanaal: 'afspraak',
    ...(herkomst ?? {}),
  });
  if (!opslag.saved || !opslag.id) return null;
  // Opvolgvelden apart: ontbreken die kolommen nog, dan blijft de lead zelf staan.
  const { error } = await sb.from('leads').update(opvolg).eq('id', opslag.id);
  if (error) console.error('[afspraak] opvolgvelden niet op de lead gezet:', error.code ?? '', error.message);
  return opslag.id;
}

/** Nieuwe afspraak vanaf de website. */
export async function boekAfspraak(invoer: BoekInvoer): Promise<BoekResultaat> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Online boeken lukt nu even niet. Bel of app ons gerust.' };
  if (!isSoort(invoer.soort)) return { ok: false, fout: 'Kies wat voor afspraak je wilt.' };
  if (!isDatum(invoer.datum) || !isTijd(invoer.tijd)) return { ok: false, fout: 'Kies een dag en een tijd.' };
  const soort = invoer.soort;

  const naam = tekst(invoer.naam, 120);
  const email = tekst(invoer.email, 200)?.toLowerCase() ?? null;
  if (!naam || naam.length < 2) return { ok: false, fout: 'Vul je naam in.' };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, fout: 'Vul een geldig e-mailadres in.' };
  const telefoon = tekst(invoer.telefoon, 40);
  if (soort !== 'showroom' && !telefoon) return { ok: false, fout: 'Vul je telefoonnummer in, dan kan Jessi je bellen.' };
  let locatie: string | null;
  if (soort === 'showroom') locatie = `${site.address.street}, ${site.address.postalCode} ${site.address.city}`;
  else if (soort === 'pasdag') {
    locatie = tekst(invoer.locatie, 300);
    if (!locatie) return { ok: false, fout: 'Vul het adres of de plaats in waar de pasdag moet komen.' };
  } else locatie = invoer.vorm === 'video' ? 'Videogesprek' : 'Telefonisch';

  if (!(await momentIsVrij(soort, invoer.datum, invoer.tijd))) return { ok: false, fout: BEZET, bezet: true };

  const inst = await getBeschikbaarheid();
  const persoon = await afspraakPersoon(inst);
  const { start, eind } = await afspraakMomenten(soort, invoer.datum, invoer.tijd);
  const token = randomBytes(24).toString('base64url');

  const rij = {
    soort,
    start_op: start.toISOString(),
    eind_op: eind.toISOString(),
    status: 'gepland',
    naam,
    bedrijf: tekst(invoer.bedrijf, 160),
    email,
    telefoon,
    aantal_medewerkers: tekst(invoer.aantal, 40),
    branche: tekst(invoer.branche, 80),
    opmerking: tekst(invoer.opmerking, 2000),
    locatie,
    bron: tekst(invoer.bron, 400),
    token,
    persoon_id: persoon?.id ?? null,
  };
  const { data, error } = await sb.from('afspraken').insert(rij).select(KOLOMMEN).single();
  if (error || !data) {
    // 23P01 = exclusion_violation: precies tegelijk geboekt.
    if (error?.code === '23P01') return { ok: false, fout: BEZET, bezet: true };
    return { ok: false, fout: 'Opslaan lukte niet. Probeer het nog eens of bel ons even.' };
  }
  const afspraak = data as unknown as Afspraak;
  const info = SOORT_INFO[soort];
  const eindTijd = nlDelen(eind).tijd;
  const wie = afspraak.bedrijf || afspraak.naam;

  // Lead en agenda: best effort, de afspraak zelf staat al.
  const leadId = await leadVoorAfspraak(
    {
      naam,
      bedrijf: afspraak.bedrijf,
      email,
      telefoon,
      aantal: afspraak.aantal_medewerkers,
      branche: afspraak.branche,
      opmerking: afspraak.opmerking,
      bron: afspraak.bron,
    },
    {
      tekst: `${info.label} ${datumKort(invoer.datum)} ${invoer.tijd}`,
      datum: invoer.datum,
      persoonId: persoon?.id ?? null,
      persoonNaam: persoon?.naam ?? null,
    },
    invoer.herkomst ?? null,
  ).catch(() => null);

  const omschrijving = [
    `Online geboekt via de website.`,
    `${naam}${afspraak.bedrijf ? `, ${afspraak.bedrijf}` : ''}`,
    [email, telefoon].filter(Boolean).join(' · '),
    afspraak.aantal_medewerkers ? `Medewerkers: ${afspraak.aantal_medewerkers}` : '',
    afspraak.branche ? `Branche: ${afspraak.branche}` : '',
    afspraak.opmerking ? `Opmerking: ${afspraak.opmerking}` : '',
    'Status bijhouden onder Afspraken.',
  ]
    .filter(Boolean)
    .join('\n');
  const taak = await maakTaak({
    titel: `${info.label}: ${wie}`,
    soort: 'afspraak',
    vervaldatum: invoer.datum,
    tijd: invoer.tijd,
    eind_tijd: eindTijd,
    locatie,
    omschrijving,
    persoon_id: persoon?.id ?? null,
    herinnering_minuten: 60,
  }).catch(() => ({ fout: 'mislukt' }));
  const taakId = 'id' in taak ? taak.id : null;

  if (taakId && leadId) await sb.from('taken').update({ lead_id: leadId }).eq('id', taakId);
  if (leadId && taakId) await sb.from('leads').update({ volgende_taak_id: taakId }).eq('id', leadId);
  if (leadId || taakId) await sb.from('afspraken').update({ lead_id: leadId, taak_id: taakId }).eq('id', afspraak.id);

  await Promise.all([mailBevestiging(naarMail(afspraak)), mailJessi(naarMail(afspraak), 'nieuw')]);
  return { ok: true, token, start: afspraak.start_op, eind: afspraak.eind_op };
}

export async function getAfspraakOpToken(token: string): Promise<Afspraak | null> {
  const sb = kmsAdmin();
  if (!sb || !TOKEN.test(String(token ?? ''))) return null;
  const { data } = await sb.from('afspraken').select(KOLOMMEN).eq('token', token).maybeSingle();
  return (data as unknown as Afspraak | null) ?? null;
}

async function getAfspraak(id: string): Promise<Afspraak | null> {
  const sb = kmsAdmin();
  if (!sb || !UUID.test(id)) return null;
  const { data } = await sb.from('afspraken').select(KOLOMMEN).eq('id', id).maybeSingle();
  return (data as unknown as Afspraak | null) ?? null;
}

/** Kan de klant deze afspraak nog zelf wijzigen? Alleen geplande afspraken die nog niet begonnen zijn. */
export function nogTeWijzigen(a: Afspraak, nu = new Date()): boolean {
  return a.status === 'gepland' && new Date(a.start_op).getTime() > nu.getTime();
}

export async function verzetAfspraak(token: string, datum: string, tijd: string): Promise<BoekResultaat> {
  const sb = kmsAdmin();
  const a = await getAfspraakOpToken(token);
  if (!sb || !a) return { ok: false, fout: 'Deze afspraak bestaat niet (meer).' };
  if (!nogTeWijzigen(a)) return { ok: false, fout: 'Deze afspraak kan niet meer online worden verzet. Bel of app ons even.' };
  if (!isDatum(datum) || !isTijd(tijd)) return { ok: false, fout: 'Kies een dag en een tijd.' };
  if (!(await momentIsVrij(a.soort, datum, tijd, a.id))) return { ok: false, fout: BEZET, bezet: true };

  const { start, eind } = await afspraakMomenten(a.soort, datum, tijd);
  const oudeStart = new Date(a.start_op);
  const { data, error } = await sb
    .from('afspraken')
    .update({
      start_op: start.toISOString(),
      eind_op: eind.toISOString(),
      ics_volgnummer: a.ics_volgnummer + 1,
      herinnering_verstuurd_op: null,
    })
    .eq('id', a.id)
    .eq('status', 'gepland')
    .select(KOLOMMEN)
    .single();
  if (error || !data) {
    if (error?.code === '23P01') return { ok: false, fout: BEZET, bezet: true };
    return { ok: false, fout: 'Verzetten lukte niet. Probeer het nog eens of bel ons even.' };
  }
  const nieuw = data as unknown as Afspraak;
  if (nieuw.taak_id) {
    await werkTaakBij(nieuw.taak_id, { vervaldatum: datum, tijd, eind_tijd: nlDelen(eind).tijd }).catch(() => null);
  }
  if (nieuw.lead_id) {
    await sb
      .from('leads')
      .update({ volgende_stap: `${SOORT_INFO[nieuw.soort].label} ${datumKort(datum)} ${tijd}`, opvolgdatum: datum })
      .eq('id', nieuw.lead_id);
  }
  await Promise.all([mailBevestiging(naarMail(nieuw), true), mailJessi(naarMail(nieuw), 'verzet', oudeStart)]);
  return { ok: true, token: nieuw.token, start: nieuw.start_op, eind: nieuw.eind_op };
}

/**
 * De afspraak is geannuleerd: de lead gaat terug naar 'contact' met een nieuwe
 * volgende stap, zodat hij niet blijft hangen op een afspraak die niet doorgaat.
 * Alleen als de lead nog op 'afspraak' staat; een lead die al verder is
 * (offerte, gewonnen, verloren) laten we met rust.
 */
async function zetLeadTerugNaAnnulering(leadId: string): Promise<void> {
  const sb = kmsAdmin();
  if (!sb) return;
  const patch = {
    status: 'contact',
    status_gewijzigd_op: new Date().toISOString(),
    volgende_stap: 'Afspraak geannuleerd, opnieuw plannen',
    volgende_taak_id: null,
  };
  const { error } = await sb.from('leads').update(patch).eq('id', leadId).eq('status', 'afspraak');
  if (!error) return;
  // Opvolgkolommen ontbreken (migratie niet gedraaid): dan alleen de status.
  console.error('[afspraak] lead niet volledig teruggezet na annulering:', error.code ?? '', error.message);
  await sb.from('leads').update({ status: 'contact' }).eq('id', leadId).eq('status', 'afspraak');
}

async function annuleer(a: Afspraak, door: 'klant' | 'kms', mailKlant: boolean): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;
  const nu = new Date().toISOString();
  const { data, error } = await sb
    .from('afspraken')
    .update({ status: 'geannuleerd', status_gewijzigd_op: nu, geannuleerd_op: nu, geannuleerd_door: door, ics_volgnummer: a.ics_volgnummer + 1 })
    .eq('id', a.id)
    .select(KOLOMMEN)
    .single();
  if (error || !data) return false;
  const nieuw = data as unknown as Afspraak;
  if (nieuw.taak_id) await verwijderTaak(nieuw.taak_id).catch(() => false);
  if (nieuw.lead_id) await zetLeadTerugNaAnnulering(nieuw.lead_id).catch(() => undefined);
  const mails: Promise<boolean>[] = [];
  if (door === 'klant') mails.push(mailAnnulering(naarMail(nieuw), true), mailJessi(naarMail(nieuw), 'geannuleerd'));
  else if (mailKlant) mails.push(mailAnnulering(naarMail(nieuw), false));
  await Promise.all(mails);
  return true;
}

export async function annuleerAfspraakDoorKlant(token: string): Promise<{ ok: boolean; fout?: string }> {
  const a = await getAfspraakOpToken(token);
  if (!a) return { ok: false, fout: 'Deze afspraak bestaat niet (meer).' };
  if (a.status === 'geannuleerd') return { ok: true };
  if (!nogTeWijzigen(a)) return { ok: false, fout: 'Deze afspraak kan niet meer online worden geannuleerd. Bel of app ons even.' };
  return (await annuleer(a, 'klant', true)) ? { ok: true } : { ok: false, fout: 'Annuleren lukte niet. Probeer het nog eens of bel ons even.' };
}

/* ------------------------------------------------------------------ */
/* KMS                                                                  */
/* ------------------------------------------------------------------ */

export type AfspraakFilter = 'komend' | 'verleden' | 'geannuleerd' | 'alles';

export async function listAfspraken(filter: AfspraakFilter = 'komend'): Promise<Afspraak[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const vandaagBegin = nlNaarDate(nlDelen().datum).toISOString();
  let q = sb.from('afspraken').select(KOLOMMEN).limit(500);
  if (filter === 'komend') q = q.gte('start_op', vandaagBegin).neq('status', 'geannuleerd').order('start_op', { ascending: true });
  else if (filter === 'verleden') q = q.lt('start_op', vandaagBegin).neq('status', 'geannuleerd').order('start_op', { ascending: false });
  else if (filter === 'geannuleerd') q = q.eq('status', 'geannuleerd').order('start_op', { ascending: false });
  else q = q.order('start_op', { ascending: false });
  // KMS-lijst: een fout is geen lege lijst (anders lijkt het alsof er geen afspraken zijn).
  const data = eisData('afspraken.lijst', await q);
  return (data as unknown as Afspraak[]) ?? [];
}

/** Hoeveel afspraken per status, voor de tabbladen en de kop. */
export async function afspraakTellingen(): Promise<{ komend: number; teVerwerken: number }> {
  const sb = kmsAdmin();
  if (!sb) return { komend: 0, teVerwerken: 0 };
  const nu = new Date().toISOString();
  const [k, v] = await Promise.all([
    sb.from('afspraken').select('id', { count: 'exact', head: true }).eq('status', 'gepland').gte('start_op', nu),
    sb.from('afspraken').select('id', { count: 'exact', head: true }).eq('status', 'gepland').lt('eind_op', nu),
  ]);
  return { komend: k.count ?? 0, teVerwerken: v.count ?? 0 };
}

/** Status zetten vanuit het KMS. Houdt de taak in de agenda in de pas. */
export async function zetAfspraakStatus(id: string, status: string, mailKlant = false): Promise<{ ok: boolean; fout?: string }> {
  const sb = kmsAdmin();
  const a = await getAfspraak(id);
  if (!sb || !a) return { ok: false, fout: 'Afspraak niet gevonden.' };
  if (!isAfspraakStatus(status)) return { ok: false, fout: 'Onbekende status.' };
  if (status === a.status) return { ok: true };

  if (status === 'geannuleerd') {
    return (await annuleer(a, 'kms', mailKlant)) ? { ok: true } : { ok: false, fout: 'Annuleren lukte niet.' };
  }

  const patch: Record<string, unknown> = { status, status_gewijzigd_op: new Date().toISOString() };
  if (a.status === 'geannuleerd') {
    patch.geannuleerd_op = null;
    patch.geannuleerd_door = null;
  }
  const { error } = await sb.from('afspraken').update(patch).eq('id', id);
  if (error) {
    if (error.code === '23P01') return { ok: false, fout: 'Op dat moment staat inmiddels een andere afspraak. Verzet een van beide eerst.' };
    return { ok: false, fout: 'Opslaan lukte niet.' };
  }
  if (a.taak_id) {
    if (a.status === 'geannuleerd') await herstelTaak(a.taak_id).catch(() => false);
    await vinkTaak(a.taak_id, status !== 'gepland').catch(() => null);
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Herinnering (dagelijkse cron)                                        */
/* ------------------------------------------------------------------ */

/**
 * Herinnering voor alle geplande afspraken van morgen (Nederlandse datum) die
 * er nog geen kregen. Draait in de dagelijkse cron; een tweede ronde op
 * dezelfde dag verstuurt niets dubbel dankzij herinnering_verstuurd_op.
 */
export async function verstuurAfspraakHerinneringen(nu = new Date()): Promise<{ verstuurd: number; mislukt: number }> {
  const sb = kmsAdmin();
  if (!sb) return { verstuurd: 0, mislukt: 0 };
  const morgen = plusDagen(nlDelen(nu).datum, 1);
  const van = nlNaarDate(morgen).toISOString();
  const tot = nlNaarDate(plusDagen(morgen, 1)).toISOString();
  const { data } = await sb
    .from('afspraken')
    .select(KOLOMMEN)
    .eq('status', 'gepland')
    .is('herinnering_verstuurd_op', null)
    .gte('start_op', van)
    .lt('start_op', tot)
    .limit(100);
  let verstuurd = 0;
  let mislukt = 0;
  for (const a of (data as unknown as Afspraak[]) ?? []) {
    const ok = await mailHerinnering(naarMail(a));
    if (ok) {
      verstuurd += 1;
      await sb.from('afspraken').update({ herinnering_verstuurd_op: new Date().toISOString() }).eq('id', a.id);
    } else mislukt += 1;
  }
  return { verstuurd, mislukt };
}
