import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * In- en uitdienst van medewerkers van een klant, gedeeld door de open API
 * (/api/v1/medewerkers) en de CSV-import op de klantkaart.
 *
 * Sluit aan op de bestaande tabel `medewerkers` (zie lib/kms/werknemers.ts):
 * personeelsnummer, email, functie, afdeling_id, datum_in_dienst, datum_uit_dienst
 * en actief bestonden al; bron en bijgewerkt_op komen uit migratie 20261005_api_sleutels_hr.
 *
 * Regels:
 * - Aanmaken is idempotent: eerst zoeken op personeelsnummer, dan op e-mail. Bestaat de
 *   medewerker al, dan werken we hem bij in plaats van een tweede aan te maken.
 * - Uit dienst = datum_uit_dienst invullen. We verwijderen nooit. Is de einddatum
 *   vandaag of eerder, dan gaat actief uit; ligt hij in de toekomst, dan gebeurt dat
 *   op of na die dag (zie verwerkVerlopenUitDienst).
 * - Bij een echte in- of uitdienst (niet bij een herhaald verzoek) komt er een taak
 *   voor Jessi in de takenmodule.
 *
 * Alles via kmsAdmin() (service role). Alleen server-side gebruiken.
 */

export type HrBron = 'api' | 'csv' | 'handmatig';

export type HrInvoer = {
  naam?: string;
  voornaam?: string | null;
  achternaam?: string | null;
  email?: string | null;
  personeelsnummer?: string | null;
  afdeling?: string | null;
  functie?: string | null;
  /** YYYY-MM-DD */
  startdatum?: string | null;
};

export type HrStatus = 'in_dienst' | 'uit_dienst_gepland' | 'uit_dienst';

export type HrMedewerker = {
  id: string;
  personeelsnummer: string | null;
  naam: string;
  email: string | null;
  afdeling: string | null;
  functie: string | null;
  startdatum: string | null;
  einddatum: string | null;
  status: HrStatus;
  bron: string | null;
  bijgewerkt_op: string | null;
};

type Rij = {
  id: string;
  organisatie_id: string;
  naam: string | null;
  voornaam: string | null;
  tussenvoegsel: string | null;
  achternaam: string | null;
  email: string | null;
  personeelsnummer: string | null;
  functie: string | null;
  afdeling_id: string | null;
  datum_in_dienst: string | null;
  datum_uit_dienst: string | null;
  actief: boolean | null;
  bron?: string | null;
  bijgewerkt_op?: string | null;
  created_at?: string | null;
};

const BASIS = 'id, organisatie_id, naam, voornaam, tussenvoegsel, achternaam, email, personeelsnummer, functie, afdeling_id, datum_in_dienst, datum_uit_dienst, actief, created_at';
const MET_BRON = `${BASIS}, bron, bijgewerkt_op`;

/** Vandaag in Nederland als YYYY-MM-DD. */
export function vandaagNL(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date());
}

function plusDagen(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function leeg(v: string | null | undefined): string | null {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
}

function toonNaam(r: Pick<Rij, 'naam' | 'voornaam' | 'tussenvoegsel' | 'achternaam'>): string {
  const delen = [r.voornaam, r.tussenvoegsel, r.achternaam].map((d) => (d ?? '').trim()).filter(Boolean).join(' ');
  return r.naam?.trim() || delen || 'Naamloze medewerker';
}

function statusVan(r: Rij, vandaag = vandaagNL()): HrStatus {
  if (r.datum_uit_dienst && r.datum_uit_dienst <= vandaag) return 'uit_dienst';
  if (r.actief === false) return 'uit_dienst';
  if (r.datum_uit_dienst) return 'uit_dienst_gepland';
  return 'in_dienst';
}

function naarHr(r: Rij, afdelingNaam: Map<string, string>): HrMedewerker {
  return {
    id: r.id,
    personeelsnummer: r.personeelsnummer,
    naam: toonNaam(r),
    email: r.email,
    afdeling: r.afdeling_id ? afdelingNaam.get(r.afdeling_id) ?? null : null,
    functie: r.functie,
    startdatum: r.datum_in_dienst,
    einddatum: r.datum_uit_dienst,
    status: statusVan(r),
    bron: r.bron ?? null,
    bijgewerkt_op: r.bijgewerkt_op ?? r.created_at ?? null,
  };
}

async function afdelingenVan(orgId: string): Promise<{ perId: Map<string, string>; perNaam: Map<string, string> }> {
  const sb = kmsAdmin();
  const perId = new Map<string, string>();
  const perNaam = new Map<string, string>();
  if (!sb) return { perId, perNaam };
  const { data } = await sb.from('afdelingen').select('id, naam').eq('organisatie_id', orgId);
  for (const a of (data as { id: string; naam: string }[]) ?? []) {
    perId.set(a.id, a.naam);
    perNaam.set(a.naam.trim().toLowerCase(), a.id);
  }
  return { perId, perNaam };
}

/** Rijen ophalen; valt terug op de kolommen zonder bron als de migratie nog niet gedraaid is. */
type Waar = { kolom: 'id' | 'personeelsnummer'; waarde: string } | { emailGelijk: string };

async function haalRijen(orgId: string, waar?: Waar): Promise<Rij[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const uit: Rij[] = [];
  for (const kolommen of [MET_BRON, BASIS]) {
    uit.length = 0;
    let fout = false;
    for (let van = 0; ; van += 1000) {
      let q = sb.from('medewerkers').select(kolommen).eq('organisatie_id', orgId);
      if (waar && 'kolom' in waar) q = q.eq(waar.kolom, waar.waarde);
      else if (waar) q = q.ilike('email', waar.emailGelijk.replace(/[\\%_]/g, (m) => `\\${m}`));
      const { data, error } = await q.order('id').range(van, van + 999);
      if (error) {
        fout = true;
        break;
      }
      const rijen = (data as unknown as Rij[]) ?? [];
      uit.push(...rijen);
      if (rijen.length < 1000) break;
    }
    if (!fout) return uit;
  }
  return [];
}

/** Alle medewerkers van een klant, voor GET /api/v1/medewerkers en de voorvertoning van de CSV-import. */
export async function listHrMedewerkers(orgId: string): Promise<HrMedewerker[]> {
  const [rijen, afd] = await Promise.all([haalRijen(orgId), afdelingenVan(orgId)]);
  return rijen.map((r) => naarHr(r, afd.perId)).sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}

/** Zoekt een medewerker binnen één klant op personeelsnummer, anders op e-mail. */
async function zoek(orgId: string, sleutel: { personeelsnummer?: string | null; email?: string | null }): Promise<Rij | null> {
  const pnr = leeg(sleutel.personeelsnummer);
  const email = leeg(sleutel.email)?.toLowerCase() ?? null;
  if (pnr) {
    const rijen = await haalRijen(orgId, { kolom: 'personeelsnummer', waarde: pnr });
    if (rijen.length) return rijen[0];
  }
  if (email) {
    const rijen = await haalRijen(orgId, { emailGelijk: email });
    if (rijen.length) return rijen[0];
  }
  return null;
}

export async function vindOpPersoneelsnummer(orgId: string, pnr: string): Promise<HrMedewerker | null> {
  const rij = await zoek(orgId, { personeelsnummer: pnr });
  if (!rij) return null;
  const afd = await afdelingenVan(orgId);
  return naarHr(rij, afd.perId);
}

/** Schrijft naar medewerkers; zonder migratie nogmaals zonder bron/bijgewerkt_op. */
async function schrijf(
  soort: 'insert' | 'update',
  rij: Record<string, unknown>,
  id?: string,
): Promise<{ id: string | null; fout: string | null }> {
  const sb = kmsAdmin();
  if (!sb) return { id: null, fout: 'Database niet bereikbaar.' };
  const poging = async (r: Record<string, unknown>) =>
    soort === 'insert'
      ? sb.from('medewerkers').insert(r).select('id').single()
      : sb.from('medewerkers').update(r).eq('id', id!).select('id').single();
  let res = await poging(rij);
  if (res.error && /bron|bijgewerkt_op/.test(res.error.message ?? '')) {
    const zonder = { ...rij };
    delete zonder.bron;
    delete zonder.bijgewerkt_op;
    res = await poging(zonder);
  }
  if (res.error || !res.data) return { id: null, fout: res.error?.message ?? 'Opslaan mislukt.' };
  return { id: (res.data as { id: string }).id, fout: null };
}

export type HrUitkomst = {
  resultaat: 'aangemaakt' | 'bijgewerkt' | 'ongewijzigd' | 'uit_dienst' | 'weer_in_dienst';
  medewerker: HrMedewerker;
  waarschuwingen: string[];
  /** Was dit een echte in- of uitdienst (en niet een herhaald verzoek)? Dan hoort er een taak bij. */
  nieuwInDienst: boolean;
  nieuwUitDienst: boolean;
};

/** Zet de invoer om naar kolommen; onbekende afdelingen worden niet aangemaakt maar gemeld. */
function velden(invoer: HrInvoer, perNaam: Map<string, string>): { rij: Record<string, unknown>; waarschuwingen: string[] } {
  const rij: Record<string, unknown> = {};
  const waarschuwingen: string[] = [];
  if (invoer.naam !== undefined && leeg(invoer.naam)) rij.naam = leeg(invoer.naam);
  if (invoer.voornaam !== undefined) rij.voornaam = leeg(invoer.voornaam);
  if (invoer.achternaam !== undefined) rij.achternaam = leeg(invoer.achternaam);
  if (invoer.email !== undefined) rij.email = leeg(invoer.email)?.toLowerCase() ?? null;
  if (invoer.personeelsnummer !== undefined && leeg(invoer.personeelsnummer)) rij.personeelsnummer = leeg(invoer.personeelsnummer);
  if (invoer.functie !== undefined) rij.functie = leeg(invoer.functie);
  if (invoer.startdatum !== undefined) rij.datum_in_dienst = leeg(invoer.startdatum);
  if (invoer.afdeling !== undefined) {
    const naam = leeg(invoer.afdeling);
    if (!naam) rij.afdeling_id = null;
    else {
      const id = perNaam.get(naam.toLowerCase());
      if (id) rij.afdeling_id = id;
      else waarschuwingen.push(`Afdeling "${naam}" bestaat nog niet bij deze klant; de medewerker is zonder afdeling opgeslagen.`);
    }
  }
  return { rij, waarschuwingen };
}

function verschil(huidig: Rij, gewenst: Record<string, unknown>): Record<string, unknown> {
  const uit: Record<string, unknown> = {};
  const h = huidig as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(gewenst)) {
    if ((h[k] ?? null) !== (v ?? null)) uit[k] = v;
  }
  return uit;
}

async function terug(id: string, orgId: string, perId: Map<string, string>): Promise<HrMedewerker | null> {
  const rijen = await haalRijen(orgId, { kolom: 'id', waarde: id });
  return rijen[0] ? naarHr(rijen[0], perId) : null;
}

/**
 * In dienst melden (idempotent). Bestaat de medewerker al (zelfde personeelsnummer of
 * e-mail), dan werken we de meegegeven velden bij. Stond hij uit dienst, dan komt hij
 * weer in dienst.
 */
export async function meldInDienst(orgId: string, invoer: HrInvoer, bron: HrBron): Promise<HrUitkomst | { fout: string }> {
  const naam = leeg(invoer.naam) ?? [leeg(invoer.voornaam), leeg(invoer.achternaam)].filter(Boolean).join(' ');
  if (!naam) return { fout: 'Naam ontbreekt.' };
  if (!leeg(invoer.personeelsnummer) && !leeg(invoer.email)) return { fout: 'Geef een personeelsnummer of e-mailadres mee, zodat we de medewerker later terugvinden.' };
  const afd = await afdelingenVan(orgId);
  const { rij, waarschuwingen } = velden({ ...invoer, naam }, afd.perNaam);
  const nu = new Date().toISOString();
  const bestaand = await zoek(orgId, invoer);

  if (!bestaand) {
    const nieuw: Record<string, unknown> = { ...rij, organisatie_id: orgId, naam, actief: true, bron, bijgewerkt_op: nu };
    if (!nieuw.datum_in_dienst) nieuw.datum_in_dienst = vandaagNL();
    const res = await schrijf('insert', nieuw);
    if (!res.id) return { fout: res.fout ?? 'Opslaan mislukt.' };
    const m = await terug(res.id, orgId, afd.perId);
    if (!m) return { fout: 'Opgeslagen, maar teruglezen mislukt.' };
    return { resultaat: 'aangemaakt', medewerker: m, waarschuwingen, nieuwInDienst: true, nieuwUitDienst: false };
  }

  // Bestaand personeelsnummer wordt niet overschreven door een e-mailmatch met een ander nummer.
  if (bestaand.personeelsnummer && rij.personeelsnummer && bestaand.personeelsnummer !== rij.personeelsnummer) {
    return { fout: `Het e-mailadres hoort al bij personeelsnummer ${bestaand.personeelsnummer}.` };
  }
  const wasUit = statusVan(bestaand) !== 'in_dienst';
  const gewenst: Record<string, unknown> = { ...rij };
  if (wasUit) {
    gewenst.actief = true;
    gewenst.datum_uit_dienst = null;
    if (!invoer.startdatum) gewenst.datum_in_dienst = vandaagNL();
  }
  const wijziging = verschil(bestaand, gewenst);
  if (Object.keys(wijziging).length === 0) {
    return { resultaat: 'ongewijzigd', medewerker: naarHr(bestaand, afd.perId), waarschuwingen, nieuwInDienst: false, nieuwUitDienst: false };
  }
  const res = await schrijf('update', { ...wijziging, bron, bijgewerkt_op: nu }, bestaand.id);
  if (!res.id) return { fout: res.fout ?? 'Opslaan mislukt.' };
  const m = await terug(bestaand.id, orgId, afd.perId);
  if (!m) return { fout: 'Opgeslagen, maar teruglezen mislukt.' };
  return { resultaat: wasUit ? 'weer_in_dienst' : 'bijgewerkt', medewerker: m, waarschuwingen, nieuwInDienst: wasUit, nieuwUitDienst: false };
}

/** Gegevens wijzigen van een bestaande medewerker, gevonden op personeelsnummer. */
export async function wijzigMedewerker(
  orgId: string,
  personeelsnummer: string,
  invoer: HrInvoer,
  bron: HrBron,
): Promise<HrUitkomst | { fout: string; nietGevonden?: boolean }> {
  const bestaand = await zoek(orgId, { personeelsnummer });
  if (!bestaand) return { fout: 'Geen medewerker met dit personeelsnummer.', nietGevonden: true };
  const afd = await afdelingenVan(orgId);
  const { rij, waarschuwingen } = velden(invoer, afd.perNaam);
  if (rij.personeelsnummer && rij.personeelsnummer !== bestaand.personeelsnummer) {
    const ander = await zoek(orgId, { personeelsnummer: String(rij.personeelsnummer) });
    if (ander && ander.id !== bestaand.id) return { fout: 'Dat nieuwe personeelsnummer is al in gebruik.' };
  }
  if (rij.email && String(rij.email) !== (bestaand.email ?? '').toLowerCase()) {
    const ander = await zoek(orgId, { email: String(rij.email) });
    if (ander && ander.id !== bestaand.id) return { fout: 'Dit e-mailadres hoort al bij een andere medewerker.' };
  }
  const wijziging = verschil(bestaand, rij);
  if (Object.keys(wijziging).length === 0) {
    return { resultaat: 'ongewijzigd', medewerker: naarHr(bestaand, afd.perId), waarschuwingen, nieuwInDienst: false, nieuwUitDienst: false };
  }
  const res = await schrijf('update', { ...wijziging, bron, bijgewerkt_op: new Date().toISOString() }, bestaand.id);
  if (!res.id) return { fout: res.fout ?? 'Opslaan mislukt.' };
  const m = await terug(bestaand.id, orgId, afd.perId);
  if (!m) return { fout: 'Opgeslagen, maar teruglezen mislukt.' };
  return { resultaat: 'bijgewerkt', medewerker: m, waarschuwingen, nieuwInDienst: false, nieuwUitDienst: false };
}

/** Uit dienst melden. Verwijdert niets: vult de einddatum en zet actief uit zodra die bereikt is. */
export async function meldUitDienst(
  orgId: string,
  sleutel: { personeelsnummer?: string | null; email?: string | null },
  einddatum: string | null,
  bron: HrBron,
): Promise<HrUitkomst | { fout: string; nietGevonden?: boolean }> {
  const bestaand = await zoek(orgId, sleutel);
  if (!bestaand) return { fout: 'Geen medewerker gevonden met dit personeelsnummer of e-mailadres.', nietGevonden: true };
  const afd = await afdelingenVan(orgId);
  const datum = einddatum ?? vandaagNL();
  const gewenst: Record<string, unknown> = { datum_uit_dienst: datum };
  if (datum <= vandaagNL()) gewenst.actief = false;
  const wijziging = verschil(bestaand, gewenst);
  if (Object.keys(wijziging).length === 0) {
    return { resultaat: 'ongewijzigd', medewerker: naarHr(bestaand, afd.perId), waarschuwingen: [], nieuwInDienst: false, nieuwUitDienst: false };
  }
  const res = await schrijf('update', { ...wijziging, bron, bijgewerkt_op: new Date().toISOString() }, bestaand.id);
  if (!res.id) return { fout: res.fout ?? 'Opslaan mislukt.' };
  const m = await terug(bestaand.id, orgId, afd.perId);
  if (!m) return { fout: 'Opgeslagen, maar teruglezen mislukt.' };
  // Alleen een nieuwe taak als er nog geen einddatum stond; een verschoven datum is geen nieuwe uitdienst.
  return { resultaat: 'uit_dienst', medewerker: m, waarschuwingen: [], nieuwInDienst: false, nieuwUitDienst: !bestaand.datum_uit_dienst };
}

/** Zet actief uit bij medewerkers van wie de einddatum bereikt is. Licht genoeg om bij elk verzoek te draaien. */
export async function verwerkVerlopenUitDienst(orgId: string): Promise<void> {
  const sb = kmsAdmin();
  if (!sb) return;
  try {
    await sb
      .from('medewerkers')
      .update({ actief: false })
      .eq('organisatie_id', orgId)
      .eq('actief', true)
      .lte('datum_uit_dienst', vandaagNL());
  } catch {
    // Bewust stil.
  }
}

/* ------------------------------------------------------------------ taken */

async function persoonVoorHr(): Promise<string | null> {
  const sb = kmsAdmin();
  if (!sb) return null;
  const { data } = await sb.from('taak_personen').select('id, naam, actief').eq('actief', true);
  const lijst = (data as { id: string; naam: string }[]) ?? [];
  return lijst.find((p) => /jessi/i.test(p.naam))?.id ?? lijst[0]?.id ?? null;
}

function omschrijf(m: HrMedewerker): string {
  return [
    m.naam,
    m.personeelsnummer ? `Personeelsnummer ${m.personeelsnummer}` : null,
    m.email,
    [m.afdeling, m.functie].filter(Boolean).join(', ') || null,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Taak voor Jessi bij een in- of uitdienst. Bij meerdere tegelijk (CSV-import) één
 * verzameltaak per soort, zodat de takenlijst niet volloopt.
 */
export async function maakHrTaken(input: {
  organisatieId: string;
  klantNaam: string;
  inDienst: HrMedewerker[];
  uitDienst: HrMedewerker[];
  bronTekst: string;
}): Promise<string[]> {
  const { maakTaak } = await import('@/lib/kms/taken');
  const persoon = await persoonVoorHr();
  const vandaag = vandaagNL();
  const ids: string[] = [];
  const klantUrl = `/dashboard/klanten/${input.organisatieId}?tab=werknemers`;

  if (input.inDienst.length) {
    const eerste = input.inDienst
      .map((m) => m.startdatum)
      .filter((d): d is string => !!d)
      .sort()[0];
    // Een paar dagen voor de startdatum klaar, en nooit in het verleden.
    const deadline = eerste && plusDagen(eerste, -3) > vandaag ? plusDagen(eerste, -3) : plusDagen(vandaag, 1);
    const een = input.inDienst.length === 1 ? input.inDienst[0] : null;
    const res = await maakTaak({
      titel: een
        ? `Nieuwe medewerker bij ${input.klantNaam}: pakket klaarzetten`
        : `${input.inDienst.length} nieuwe medewerkers bij ${input.klantNaam}: pakketten klaarzetten`,
      organisatie_id: input.organisatieId,
      omschrijving: [
        een ? omschrijf(een) : input.inDienst.map((m) => `- ${m.naam}${m.personeelsnummer ? ` (${m.personeelsnummer})` : ''}${m.startdatum ? `, start ${m.startdatum}` : ''}`).join('\n'),
        een?.startdatum ? `Start: ${een.startdatum}` : null,
        `Doorgegeven via ${input.bronTekst}. Controleer afdeling, pakket en budget: ${klantUrl}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
      vervaldatum: deadline,
      persoon_id: persoon,
      prioriteit: 'normaal',
    });
    if ('id' in res) ids.push(res.id);
  }

  if (input.uitDienst.length) {
    const een = input.uitDienst.length === 1 ? input.uitDienst[0] : null;
    const datum = input.uitDienst.map((m) => m.einddatum).filter((d): d is string => !!d).sort()[0];
    const res = await maakTaak({
      titel: een ? `Uit dienst bij ${input.klantNaam}: kleding innemen` : `${input.uitDienst.length} uit dienst bij ${input.klantNaam}: kleding innemen`,
      organisatie_id: input.organisatieId,
      omschrijving: [
        een ? omschrijf(een) : input.uitDienst.map((m) => `- ${m.naam}${m.personeelsnummer ? ` (${m.personeelsnummer})` : ''}${m.einddatum ? `, laatste dag ${m.einddatum}` : ''}`).join('\n'),
        een?.einddatum ? `Laatste werkdag: ${een.einddatum}` : null,
        `Doorgegeven via ${input.bronTekst}. Spreek met de klant af hoe de kleding terugkomt en stop openstaande bestellingen: ${klantUrl}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
      vervaldatum: datum && datum > vandaag ? datum : vandaag,
      persoon_id: persoon,
      prioriteit: 'normaal',
    });
    if ('id' in res) ids.push(res.id);
  }
  return ids;
}
