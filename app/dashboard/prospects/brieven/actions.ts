'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, eisEigenaar, kmsAdmin } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { datumNL, dashboardProspectUrl, kennismakingUrl, tijdNL, zetProspectTaak } from '@/lib/prospect/prospect';
import { getProspectRij } from '@/lib/prospect/dashboard';
import { tabelOntbreekt } from '@/lib/prospect/briefData';
import { kopieerOntwerp, normaliseerBriefOntwerp, type BriefOntwerp } from '@/lib/prospect/briefTypes';
import { ingebouwdTemplate, INGEBOUWDE_TEMPLATES, STANDAARD_TEMPLATE } from '@/lib/prospect/briefTemplates';
import { isOntvangerStatus, prospectStatusNa, type OntvangerStatus } from '@/lib/prospect/briefStatus';

const UUID = /^[0-9a-f-]{36}$/i;
const BASIS = '/dashboard/prospects/brieven';

async function eisToegang() {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
}

function ids(formData: FormData, veld = 'id', max = 500): string[] {
  return [...new Set(formData.getAll(veld).map(String).filter((i) => UUID.test(i)))].slice(0, max);
}

/** Stukken van 150 id's: een .in()-filter gaat in de url, en die mag niet te lang worden. */
function stukken<T>(lijst: T[], n = 150): T[][] {
  const uit: T[][] = [];
  for (let i = 0; i < lijst.length; i += n) uit.push(lijst.slice(i, i + n));
  return uit;
}

function veiligTerug(v: FormDataEntryValue | null, standaard: string): string {
  const t = String(v ?? '').trim();
  return t.startsWith('/dashboard/prospects') && !t.startsWith('//') ? t : standaard;
}

function met(url: string, qs: Record<string, string | number>): string {
  const u = new URL(url, 'http://x');
  for (const [k, v] of Object.entries(qs)) u.searchParams.set(k, String(v));
  return `${u.pathname}${u.search}${u.hash}`;
}

function schoneDatum(v: FormDataEntryValue | null): string {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : datumNL(0);
}

function vernieuw(batchId?: string) {
  revalidatePath('/dashboard/prospects');
  revalidatePath(BASIS);
  if (batchId) revalidatePath(`${BASIS}/${batchId}`);
}

/* ------------------------------------------------------------------ */
/* Oude flow (blijft werken zonder migratie)                           */
/* ------------------------------------------------------------------ */

/**
 * Markeert de getoonde brieven als verstuurd: brief_verstuurd_op = vandaag en
 * status 'benaderd' voor wie nog op 'nieuw' stond. Verdere statussen
 * (geinteresseerd, klant, afgemeld) laten we staan.
 */
export async function markeerBrievenVerstuurdActie(formData: FormData) {
  await eisToegang();
  const lijst = ids(formData, 'id', 200);
  const terug = veiligTerug(formData.get('terug'), `${BASIS}/snel`);
  const sb = kmsAdmin();
  let aantal = 0;
  if (sb && lijst.length) {
    const nu = new Date().toISOString();
    for (const groep of stukken(lijst)) {
      const { data } = await sb
        .from('prospecten')
        .update({ brief_verstuurd_op: datumNL(0), laatste_contact: nu })
        .in('id', groep)
        .is('afgemeld_op', null)
        .select('id');
      aantal += (data as { id: string }[] | null)?.length ?? 0;
      await sb.from('prospecten').update({ status: 'benaderd' }).in('id', groep).eq('status', 'nieuw').is('afgemeld_op', null);
    }
    await logAudit('prospect.brieven_verstuurd', { entiteit: 'prospect', details: { aantal, ids: lijst } });
  }
  vernieuw();
  redirect(met(terug, { ok: 'bijgewerkt', verstuurd: aantal }));
}

/* ------------------------------------------------------------------ */
/* Verzending aanmaken en ontvangers                                   */
/* ------------------------------------------------------------------ */

/** Ontwerp uit een ingebouwd template (sleutel) of een eigen template (uuid). */
async function ontwerpVoorTemplate(keuze: string): Promise<{ ontwerp: BriefOntwerp; templateId: string | null }> {
  const sb = kmsAdmin();
  if (sb && UUID.test(keuze)) {
    const { data } = await sb.from('brief_templates').select('id, ontwerp').eq('id', keuze).maybeSingle();
    const o = normaliseerBriefOntwerp((data as { ontwerp?: unknown } | null)?.ontwerp);
    if (o) return { ontwerp: kopieerOntwerp(o), templateId: keuze };
  }
  const t = ingebouwdTemplate(keuze) ?? ingebouwdTemplate(STANDAARD_TEMPLATE) ?? INGEBOUWDE_TEMPLATES[0];
  return { ontwerp: t.maak(), templateId: null };
}

export async function maakBatchActie(formData: FormData) {
  await eisToegang();
  const lijst = ids(formData);
  const naam = String(formData.get('naam') ?? '').trim().slice(0, 140) || `Brieven ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })}`;
  const terug = veiligTerug(formData.get('terug'), `${BASIS}/nieuw`);
  if (lijst.length === 0) redirect(met(terug, { melding: 'geen-keuze' }));
  const sb = kmsAdmin();
  if (!sb) redirect(terug);

  const { ontwerp, templateId } = await ontwerpVoorTemplate(String(formData.get('template') ?? STANDAARD_TEMPLATE));
  const { data, error } = await sb.from('brief_batches').insert({ naam, ontwerp, template_id: templateId, status: 'concept' }).select('id').single();
  if (error || !data) {
    if (tabelOntbreekt(error)) {
      // Migratie nog niet gedraaid: door naar de oude printflow met dezelfde keuze.
      const qs = new URLSearchParams();
      lijst.slice(0, 60).forEach((i) => qs.append('id', i));
      qs.set('toon', '1');
      qs.set('melding', 'geen-tabellen');
      redirect(`${BASIS}/snel?${qs.toString()}`);
    }
    redirect(met(terug, { melding: 'opslaan-mislukt' }));
  }
  const batchId = (data as { id: string }).id;
  const { error: fout } = await sb.from('brief_ontvangers').insert(lijst.map((prospect_id) => ({ batch_id: batchId, prospect_id, status: 'klaargezet' })));
  await logAudit('brief.batch_aangemaakt', { entiteit: 'brief_batch', entiteitId: batchId, details: { naam, aantal: lijst.length, fout: fout?.message ?? null } });
  vernieuw(batchId);
  redirect(`${BASIS}/${batchId}?stap=brief&ok=aangemaakt`);
}

export async function voegOntvangersToeActie(formData: FormData) {
  await eisToegang();
  const batchId = String(formData.get('batch') ?? '');
  const lijst = ids(formData);
  if (!UUID.test(batchId)) redirect(BASIS);
  const sb = kmsAdmin();
  let aantal = 0;
  if (sb && lijst.length) {
    const { data } = await sb
      .from('brief_ontvangers')
      .upsert(lijst.map((prospect_id) => ({ batch_id: batchId, prospect_id, status: 'klaargezet' })), { onConflict: 'batch_id,prospect_id', ignoreDuplicates: true })
      .select('id');
    aantal = (data as { id: string }[] | null)?.length ?? 0;
    await logAudit('brief.ontvangers_toegevoegd', { entiteit: 'brief_batch', entiteitId: batchId, details: { aantal } });
  }
  vernieuw(batchId);
  redirect(`${BASIS}/${batchId}?stap=ontvangers&ok=toegevoegd&toegevoegd=${aantal}`);
}

export async function verwijderOntvangersActie(formData: FormData) {
  await eisToegang();
  const batchId = String(formData.get('batch') ?? '');
  const lijst = ids(formData);
  const terug = veiligTerug(formData.get('terug'), `${BASIS}/${batchId}?stap=ontvangers`);
  const sb = kmsAdmin();
  if (sb && UUID.test(batchId) && lijst.length) {
    for (const groep of stukken(lijst)) await sb.from('brief_ontvangers').delete().eq('batch_id', batchId).in('id', groep);
    await logAudit('brief.ontvangers_verwijderd', { entiteit: 'brief_batch', entiteitId: batchId, details: { aantal: lijst.length } });
  }
  vernieuw(batchId);
  redirect(met(terug, { ok: 'verwijderd' }));
}

export async function hernoemBatchActie(formData: FormData) {
  await eisToegang();
  const batchId = String(formData.get('batch') ?? '');
  const naam = String(formData.get('naam') ?? '').trim().slice(0, 140);
  const notitie = String(formData.get('notitie') ?? '').trim().slice(0, 2000);
  const terug = veiligTerug(formData.get('terug'), `${BASIS}/${batchId}`);
  const sb = kmsAdmin();
  if (sb && UUID.test(batchId) && naam) {
    await sb.from('brief_batches').update({ naam, notitie: notitie || null, updated_at: new Date().toISOString() }).eq('id', batchId);
  }
  vernieuw(batchId);
  redirect(met(terug, { ok: 'opgeslagen' }));
}

export async function verwijderBatchActie(formData: FormData) {
  await eisToegang();
  const batchId = String(formData.get('batch') ?? '');
  const sb = kmsAdmin();
  if (sb && UUID.test(batchId)) {
    await sb.from('brief_batches').delete().eq('id', batchId);
    await logAudit('brief.batch_verwijderd', { entiteit: 'brief_batch', entiteitId: batchId });
  }
  vernieuw();
  redirect(`${BASIS}?ok=verwijderd`);
}

/* ------------------------------------------------------------------ */
/* Ontwerp en templates (aangeroepen vanuit de editor)                 */
/* ------------------------------------------------------------------ */

type Uitkomst<T = object> = ({ ok: true } & T) | { ok: false; fout: string };

export async function slaBatchOntwerpOpActie(batchId: string, ruw: unknown): Promise<Uitkomst<{ om: string }>> {
  if (!(await dashAuthed())) return { ok: false, fout: 'Je bent uitgelogd. Log opnieuw in en probeer het nog eens.' };
  await eisEigenaar();
  const ontwerp = normaliseerBriefOntwerp(ruw);
  if (!ontwerp || !UUID.test(batchId)) return { ok: false, fout: 'Dit ontwerp kon niet worden gelezen.' };
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Geen verbinding met de database.' };
  const om = new Date().toISOString();
  const { error } = await sb.from('brief_batches').update({ ontwerp, updated_at: om }).eq('id', batchId);
  if (error) return { ok: false, fout: tabelOntbreekt(error) ? 'De tabellen voor verzendingen bestaan nog niet. Vraag Tim de migratie te draaien.' : 'Opslaan is mislukt. Probeer het zo nog een keer.' };
  revalidatePath(`${BASIS}/${batchId}`);
  return { ok: true, om };
}

export async function bewaarTemplateActie(naam: string, ruw: unknown, omschrijving = ''): Promise<Uitkomst<{ id: string }>> {
  if (!(await dashAuthed())) return { ok: false, fout: 'Je bent uitgelogd.' };
  await eisEigenaar();
  const ontwerp = normaliseerBriefOntwerp(ruw);
  const schoon = String(naam ?? '').trim().slice(0, 80);
  if (!ontwerp || !schoon) return { ok: false, fout: 'Geef het template een naam.' };
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Geen verbinding met de database.' };
  const { data, error } = await sb
    .from('brief_templates')
    .insert({ naam: schoon, omschrijving: String(omschrijving ?? '').trim().slice(0, 300) || null, ontwerp })
    .select('id')
    .single();
  if (error || !data) return { ok: false, fout: tabelOntbreekt(error) ? 'Eigen templates kunnen pas na de migratie worden bewaard.' : 'Bewaren is mislukt.' };
  await logAudit('brief.template_bewaard', { entiteit: 'brief_template', entiteitId: (data as { id: string }).id, details: { naam: schoon } });
  return { ok: true, id: (data as { id: string }).id };
}

export async function verwijderTemplateActie(id: string): Promise<Uitkomst> {
  if (!(await dashAuthed())) return { ok: false, fout: 'Je bent uitgelogd.' };
  await eisEigenaar();
  const sb = kmsAdmin();
  if (!sb || !UUID.test(id)) return { ok: false, fout: 'Onbekend template.' };
  const { error } = await sb.from('brief_templates').delete().eq('id', id);
  if (error) return { ok: false, fout: 'Verwijderen is mislukt.' };
  await logAudit('brief.template_verwijderd', { entiteit: 'brief_template', entiteitId: id });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Statussen                                                           */
/* ------------------------------------------------------------------ */

const DATUMKOLOM: Partial<Record<OntvangerStatus, string>> = {
  geprint: 'geprint_op',
  verstuurd: 'verstuurd_op',
  gereageerd: 'gereageerd_op',
  afspraak: 'gereageerd_op',
  klant: 'klant_op',
};

/**
 * Zet de status van een aantal ontvangers en trekt de prospect mee:
 * verstuurd zet brief_verstuurd_op en 'benaderd', gereageerd wordt 'reageerde',
 * afspraak 'gekwalificeerd' en klant 'klant'. Prospectstatussen gaan alleen
 * omhoog; een afgemelde prospect blijft afgemeld.
 */
async function pasStatusToe(ontvangerIds: string[], status: OntvangerStatus, datum: string, alleenVan?: OntvangerStatus[]): Promise<number> {
  const sb = kmsAdmin();
  if (!sb || ontvangerIds.length === 0) return 0;
  const rijen: { id: string; prospect_id: string; status: string }[] = [];
  for (const groep of stukken(ontvangerIds)) {
    let q = sb.from('brief_ontvangers').select('id, prospect_id, status').in('id', groep);
    if (alleenVan?.length) q = q.in('status', alleenVan);
    const { data } = await q;
    rijen.push(...((data as { id: string; prospect_id: string; status: string }[] | null) ?? []));
  }
  if (rijen.length === 0) return 0;
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  const kolom = DATUMKOLOM[status];
  if (kolom) patch[kolom] = datum;
  for (const groep of stukken(rijen.map((r) => r.id))) await sb.from('brief_ontvangers').update(patch).in('id', groep);

  const prospecten: { id: string; status: string; afgemeld_op: string | null }[] = [];
  for (const groep of stukken([...new Set(rijen.map((r) => r.prospect_id))])) {
    const { data: ps } = await sb.from('prospecten').select('id, status, afgemeld_op').in('id', groep);
    prospecten.push(...((ps as { id: string; status: string; afgemeld_op: string | null }[] | null) ?? []).filter((p) => !p.afgemeld_op));
  }
  const nu = new Date().toISOString();
  if (status === 'verstuurd') {
    for (const groep of stukken(prospecten.map((p) => p.id))) {
      await sb.from('prospecten').update({ brief_verstuurd_op: datum, laatste_contact: nu }).in('id', groep);
    }
  }
  const perDoel = new Map<string, string[]>();
  for (const p of prospecten) {
    const doel = prospectStatusNa(p.status, status);
    if (doel) perDoel.set(doel, [...(perDoel.get(doel) ?? []), p.id]);
  }
  for (const [doel, lijst] of perDoel) {
    for (const groep of stukken(lijst)) await sb.from('prospecten').update({ status: doel, laatste_contact: nu }).in('id', groep);
  }
  return rijen.length;
}

export async function zetOntvangerStatusActie(formData: FormData) {
  await eisToegang();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  const terug = veiligTerug(formData.get('terug'), BASIS);
  if (UUID.test(id) && isOntvangerStatus(status)) {
    await pasStatusToe([id], status, schoneDatum(formData.get('datum')));
    await logAudit('brief.status', { entiteit: 'brief_ontvanger', entiteitId: id, details: { status } });
  }
  vernieuw(String(formData.get('batch') ?? '') || undefined);
  redirect(met(terug, { ok: 'status' }));
}

export async function bulkOntvangerStatusActie(formData: FormData) {
  await eisToegang();
  const batchId = String(formData.get('batch') ?? '');
  const lijst = ids(formData);
  const status = String(formData.get('status') ?? '');
  const datum = schoneDatum(formData.get('datum'));
  const terug = veiligTerug(formData.get('terug'), `${BASIS}/${batchId}?stap=volgen`);
  let aantal = 0;
  if (isOntvangerStatus(status) && lijst.length) {
    aantal = await pasStatusToe(lijst, status, datum);
    await logAudit('brief.status_bulk', { entiteit: 'brief_batch', entiteitId: batchId || undefined, details: { status, datum, aantal } });
  }
  vernieuw(batchId || undefined);
  redirect(met(terug, { ok: 'bijgewerkt', aantal }));
}

/** Na het printen: de geprinte brieven op 'geprint', de verzending ook. */
export async function markeerGeprintActie(formData: FormData) {
  await eisToegang();
  const batchId = String(formData.get('batch') ?? '');
  const lijst = ids(formData);
  const datum = schoneDatum(formData.get('datum'));
  const sb = kmsAdmin();
  let aantal = 0;
  if (sb && UUID.test(batchId)) {
    aantal = await pasStatusToe(lijst, 'geprint', datum, ['klaargezet']);
    await sb.from('brief_batches').update({ geprint_op: datum, updated_at: new Date().toISOString() }).eq('id', batchId);
    await sb.from('brief_batches').update({ status: 'geprint' }).eq('id', batchId).eq('status', 'concept');
    await logAudit('brief.batch_geprint', { entiteit: 'brief_batch', entiteitId: batchId, details: { aantal, datum } });
  }
  vernieuw(batchId);
  redirect(`${BASIS}/${batchId}?stap=volgen&ok=bijgewerkt&geprint=${aantal}`);
}

/** Alle klaargezette en geprinte brieven van de verzending op 'verstuurd' (met datum). */
export async function markeerVerstuurdActie(formData: FormData) {
  await eisToegang();
  const batchId = String(formData.get('batch') ?? '');
  const datum = schoneDatum(formData.get('datum'));
  const sb = kmsAdmin();
  let aantal = 0;
  if (sb && UUID.test(batchId)) {
    const gekozen = ids(formData);
    let lijst = gekozen;
    if (lijst.length === 0) {
      // Zijn er brieven geprint, dan alleen die: wie niet geprint is (bv. zonder adres) ging ook niet op de post.
      const { data } = await sb.from('brief_ontvangers').select('id, status').eq('batch_id', batchId).in('status', ['klaargezet', 'geprint']);
      const rijen = (data as { id: string; status: string }[] | null) ?? [];
      const geprint = rijen.filter((r) => r.status === 'geprint');
      lijst = (geprint.length ? geprint : rijen).map((r) => r.id);
    }
    aantal = await pasStatusToe(lijst, 'verstuurd', datum, ['klaargezet', 'geprint']);
    await sb.from('brief_batches').update({ verstuurd_op: datum, status: 'verstuurd', updated_at: new Date().toISOString() }).eq('id', batchId);
    await logAudit('brief.batch_verstuurd', { entiteit: 'brief_batch', entiteitId: batchId, details: { aantal, datum } });
  }
  vernieuw(batchId);
  redirect(`${BASIS}/${batchId}?stap=volgen&ok=bijgewerkt&verstuurd=${aantal}`);
}

/* ------------------------------------------------------------------ */
/* Opvolgen                                                            */
/* ------------------------------------------------------------------ */

/**
 * "Taak maken" in de opvolglijst: de ene prospecttaak (bron 'prospect') aanmaken,
 * of een afgeronde weer openzetten voor vandaag.
 */
export async function maakOpvolgTaakActie(formData: FormData) {
  await eisToegang();
  const id = String(formData.get('prospect') ?? '');
  const terug = veiligTerug(formData.get('terug'), BASIS);
  const p = UUID.test(id) ? await getProspectRij(id) : null;
  const sb = kmsAdmin();
  let uitkomst = 'fout';
  if (p && sb) {
    const regels = [
      p.eerste_scan_op ? `${p.bedrijfsnaam} scande de brief op ${tijdNL(p.eerste_scan_op)} (${p.aantal_scans ?? 0}x in totaal).` : `${p.bedrijfsnaam} opvolgen na de brief.`,
      p.telefoon ? `Telefoon: ${p.telefoon}` : 'Telefoon: onbekend, zoek het op via de website.',
      p.website ? `Website: ${p.website}` : null,
      `Prospect in het dashboard: ${dashboardProspectUrl(p.id)}`,
      `Wat zij zagen: ${kennismakingUrl(p.token)}`,
    ].filter(Boolean);
    uitkomst = await zetProspectTaak(
      sb,
      p.id,
      { titel: `Bel ${p.bedrijfsnaam}: heeft de brief gescand`, omschrijving: regels.join('\n'), prioriteit: 'normaal', werkstatus: 'Benaderen', vervaldatum: datumNL(0) },
      { bijwerken: true, omschrijvingAanvullen: true },
    );
    await logAudit('brief.taak_gemaakt', { entiteit: 'prospect', entiteitId: p.id, details: { uitkomst } });
  }
  revalidatePath('/dashboard/taken');
  vernieuw();
  redirect(met(terug, uitkomst === 'fout' ? { melding: 'taak-mislukt' } : { ok: uitkomst === 'aangemaakt' ? 'aangemaakt' : 'bijgewerkt' }));
}

/** Adres aanvullen vanuit de brievenlijst ("adres ontbreekt: aanvullen"). */
export async function vulAdresAanActie(formData: FormData) {
  await eisToegang();
  const id = String(formData.get('id') ?? '');
  const terug = veiligTerug(formData.get('terug'), BASIS);
  const adres = String(formData.get('adres') ?? '').trim().slice(0, 200);
  const postcodeRuw = String(formData.get('postcode') ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const postcode = /^\d{4}[A-Z]{2}$/.test(postcodeRuw) ? `${postcodeRuw.slice(0, 4)} ${postcodeRuw.slice(4)}` : postcodeRuw.slice(0, 12);
  const plaats = String(formData.get('plaats') ?? '').trim().slice(0, 100);
  const contact = formData.has('contactpersoon') ? String(formData.get('contactpersoon') ?? '').trim().slice(0, 120) : undefined;
  const sb = kmsAdmin();
  if (sb && UUID.test(id)) {
    const patch: Record<string, unknown> = {};
    if (adres) patch.adres = adres;
    if (postcode) patch.postcode = postcode;
    if (plaats) patch.plaats = plaats;
    if (contact !== undefined) patch.contactpersoon = contact || null;
    if (Object.keys(patch).length) {
      await sb.from('prospecten').update(patch).eq('id', id);
      await logAudit('prospect.adres_aangevuld', { entiteit: 'prospect', entiteitId: id });
    }
  }
  vernieuw();
  revalidatePath(`/dashboard/prospects/${id}`);
  redirect(met(terug, { ok: 'opgeslagen' }));
}
