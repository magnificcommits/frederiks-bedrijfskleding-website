'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, kmsAdmin, magEigenaar } from '@/lib/kms/adminClient';
import { huidigeActor, logAudit } from '@/lib/kms/audit';
import { isUuid } from '@/lib/kms/service';
import { maakSleutel, schrijfApiLog, trekSleutelIn } from '@/lib/api/sleutels';
import { maakHrTaken, meldInDienst, meldUitDienst, type HrMedewerker } from '@/lib/kms/hrKoppeling';
import { pnrSchema } from '@/lib/api/medewerkers';

/**
 * Koppelingen op de klantkaart: API-sleutels aanmaken en intrekken, en medewerkers
 * importeren uit een CSV-bestand. Sleutels beheren mag alleen de eigenaar; importeren
 * mag iedereen met toegang tot het dashboard.
 */

export type SleutelStaat = { sleutel?: string; naam?: string; fout?: string } | null;

async function klantNaam(orgId: string): Promise<string | null> {
  const sb = kmsAdmin();
  if (!sb) return null;
  const { data } = await sb.from('organisaties').select('naam').eq('id', orgId).maybeSingle();
  return (data as { naam: string } | null)?.naam ?? null;
}

/** Nieuwe sleutel. De volledige sleutel komt alleen in het antwoord van deze actie terug. */
export async function maakApiSleutelActie(_vorig: SleutelStaat, formData: FormData): Promise<SleutelStaat> {
  if (!(await dashAuthed())) redirect('/dashboard');
  if (!(await magEigenaar())) return { fout: 'Alleen de eigenaar kan API-sleutels aanmaken.' };
  const orgId = String(formData.get('organisatie_id') ?? '');
  if (!isUuid(orgId) || !(await klantNaam(orgId))) return { fout: 'Klant niet gevonden.' };
  const naam = String(formData.get('naam') ?? '').trim();
  const alleenLezen = formData.get('alleen_lezen') === 'on';
  const door = await huidigeActor();
  const res = await maakSleutel({
    organisatieId: orgId,
    naam,
    scopes: alleenLezen ? ['medewerkers:lezen'] : ['medewerkers:lezen', 'medewerkers:schrijven'],
    door,
  });
  if ('fout' in res) return { fout: res.fout };
  await logAudit('api_sleutel_aangemaakt', {
    entiteit: 'organisatie',
    entiteitId: orgId,
    details: { sleutel_id: res.rij.id, naam: res.rij.naam, laatste4: res.rij.laatste4, scopes: res.rij.scopes },
  });
  revalidatePath(`/dashboard/klanten/${orgId}`);
  return { sleutel: res.sleutel, naam: res.rij.naam };
}

export async function trekApiSleutelInActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orgId = String(formData.get('organisatie_id') ?? '');
  const id = String(formData.get('sleutel_id') ?? '');
  const terug = `/dashboard/klanten/${isUuid(orgId) ? orgId : ''}?tab=koppelingen`;
  if (!(await magEigenaar())) redirect(`${terug}&melding=geen-eigenaar`);
  if (!isUuid(orgId) || !isUuid(id)) redirect(`${terug}&melding=mislukt`);
  const rij = await trekSleutelIn(id, orgId);
  if (rij) {
    await logAudit('api_sleutel_ingetrokken', {
      entiteit: 'organisatie',
      entiteitId: orgId,
      details: { sleutel_id: id, naam: rij.naam, laatste4: rij.laatste4 },
    });
  }
  redirect(`${terug}&melding=${rij ? 'sleutel-ingetrokken' : 'mislukt'}`);
}

/* ------------------------------------------------------------------ CSV */

export type CsvRij = {
  naam: string;
  email: string;
  personeelsnummer: string;
  afdeling: string;
  startdatum: string;
  einddatum: string;
};

export type ImportUitkomst = {
  ok: boolean;
  fout?: string;
  aangemaakt: number;
  bijgewerkt: number;
  ongewijzigd: number;
  uitDienst: number;
  mislukt: { regel: number; naam: string; reden: string }[];
  waarschuwingen: string[];
  taken: number;
};

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Importeert medewerkers. Per rij: in dienst (aanmaken of bijwerken, idempotent op
 * personeelsnummer of e-mail) en, als er een einddatum is, daarna uit dienst.
 * Taken voor Jessi: één verzameltaak voor de nieuwe en één voor de vertrokken medewerkers.
 */
export async function importeerCsvActie(orgId: string, rijen: CsvRij[], takenMaken: boolean): Promise<ImportUitkomst> {
  const leegUit: ImportUitkomst = { ok: false, aangemaakt: 0, bijgewerkt: 0, ongewijzigd: 0, uitDienst: 0, mislukt: [], waarschuwingen: [], taken: 0 };
  if (!(await dashAuthed())) return { ...leegUit, fout: 'Je bent niet (meer) ingelogd.' };
  if (!isUuid(orgId)) return { ...leegUit, fout: 'Klant niet gevonden.' };
  const naam = await klantNaam(orgId);
  if (!naam) return { ...leegUit, fout: 'Klant niet gevonden.' };
  if (!Array.isArray(rijen) || rijen.length === 0) return { ...leegUit, fout: 'Er staan geen rijen in het bestand.' };
  if (rijen.length > 2000) return { ...leegUit, fout: 'Maximaal 2000 rijen per import. Splits het bestand.' };

  const uit: ImportUitkomst = { ...leegUit, ok: true };
  const nieuw: HrMedewerker[] = [];
  const weg: HrMedewerker[] = [];
  const waarschuwingen = new Set<string>();

  for (let i = 0; i < rijen.length; i++) {
    const r = rijen[i];
    const regel = i + 2; // regel 1 is de kop
    const rNaam = String(r.naam ?? '').trim().slice(0, 160);
    const email = String(r.email ?? '').trim().toLowerCase();
    const pnr = String(r.personeelsnummer ?? '').trim();
    const start = String(r.startdatum ?? '').trim();
    const eind = String(r.einddatum ?? '').trim();
    const reden =
      !rNaam ? 'naam ontbreekt'
      : !pnr && !email ? 'personeelsnummer of e-mail ontbreekt'
      : email && !EMAIL.test(email) ? 'e-mailadres klopt niet'
      : pnr && !pnrSchema.safeParse(pnr).success ? 'personeelsnummer heeft een vreemde vorm'
      : start && !DATUM.test(start) ? 'startdatum is geen JJJJ-MM-DD'
      : eind && !DATUM.test(eind) ? 'einddatum is geen JJJJ-MM-DD'
      : null;
    if (reden) {
      uit.mislukt.push({ regel, naam: rNaam || '(geen naam)', reden });
      continue;
    }
    const res = await meldInDienst(
      orgId,
      {
        naam: rNaam,
        email: email || undefined,
        personeelsnummer: pnr || undefined,
        afdeling: String(r.afdeling ?? '').trim() || undefined,
        startdatum: start || undefined,
      },
      'csv',
    );
    if ('fout' in res) {
      uit.mislukt.push({ regel, naam: rNaam, reden: res.fout });
      continue;
    }
    res.waarschuwingen.forEach((w) => waarschuwingen.add(w));
    if (res.resultaat === 'aangemaakt') uit.aangemaakt++;
    else if (res.resultaat === 'ongewijzigd') uit.ongewijzigd++;
    else uit.bijgewerkt++;

    if (eind) {
      const u = await meldUitDienst(orgId, { personeelsnummer: res.medewerker.personeelsnummer, email: res.medewerker.email }, eind, 'csv');
      if ('fout' in u) uit.mislukt.push({ regel, naam: rNaam, reden: u.fout });
      else {
        if (u.resultaat === 'uit_dienst') uit.uitDienst++;
        // Nieuw aangemaakt en meteen uit dienst is een oud dossier: geen kleding om in te nemen.
        if (u.nieuwUitDienst && res.resultaat !== 'aangemaakt') weg.push(u.medewerker);
      }
    } else if (res.nieuwInDienst) {
      nieuw.push(res.medewerker);
    }
  }
  uit.waarschuwingen = [...waarschuwingen].slice(0, 20);

  if (takenMaken && (nieuw.length || weg.length)) {
    const ids = await maakHrTaken({ organisatieId: orgId, klantNaam: naam, inDienst: nieuw, uitDienst: weg, bronTekst: 'een CSV-import' });
    uit.taken = ids.length;
  }

  const samenvatting = {
    rijen: rijen.length,
    aangemaakt: uit.aangemaakt,
    bijgewerkt: uit.bijgewerkt,
    ongewijzigd: uit.ongewijzigd,
    uit_dienst: uit.uitDienst,
    mislukt: uit.mislukt.length,
    taken: uit.taken,
  };
  const actor = await huidigeActor();
  await schrijfApiLog({ organisatieId: orgId, methode: 'CSV', pad: 'import medewerkers', status: 200, actie: 'csv_import', details: { ...samenvatting, door: actor } });
  await logAudit('medewerkers_csv_import', { entiteit: 'organisatie', entiteitId: orgId, details: { klant: naam, ...samenvatting } });
  revalidatePath(`/dashboard/klanten/${orgId}`);
  return uit;
}
