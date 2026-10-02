'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, eisEigenaar, kmsAdmin } from '@/lib/kms/adminClient';
import { werkProspect } from '@/lib/kms/prospecten';
import { logAudit } from '@/lib/kms/audit';
import { uploadMediaMetNaam } from '@/lib/kms/storage';
import { env } from '@/lib/env';
import { controleerUpload, slaLogoOpVanUrl, zoekLogo } from '@/lib/prospect/logoZoeker';
import { getProspectRij, huidigeKeuzes } from '@/lib/prospect/dashboard';
import { datumNL } from '@/lib/prospect/prospect';

const ID = /^[0-9a-f-]{36}$/i;

async function eisToegang() {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
}

function terug(id: string, extra: Record<string, string> = {}, anker = ''): never {
  const qs = new URLSearchParams(extra).toString();
  redirect(`/dashboard/prospects/${id}${qs ? `?${qs}` : ''}${anker}`);
}

function vernieuw(id: string) {
  revalidatePath(`/dashboard/prospects/${id}`);
  revalidatePath('/dashboard/prospects');
}

/** Werkt alle velden van een prospect bij vanaf de bewerkpagina. */
export async function werkProspectActie(formData: FormData) {
  await eisToegang();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/dashboard/prospects');
  const tekst = (naam: string) => String(formData.get(naam) ?? '');
  await werkProspect(id, {
    bedrijfsnaam: tekst('bedrijfsnaam'),
    contactpersoon: tekst('contactpersoon'),
    eigenaar: tekst('eigenaar'),
    email: tekst('email'),
    telefoon: tekst('telefoon'),
    branche: tekst('branche'),
    plaats: tekst('plaats'),
    website: tekst('website'),
    grootte: tekst('grootte'),
    // Alleen meesturen als het veld op het formulier stond, anders niets overschrijven.
    ...(formData.has('adres') ? { adres: tekst('adres') } : {}),
    ...(formData.has('postcode') ? { postcode: tekst('postcode') } : {}),
    status: tekst('status'),
    score: Number(formData.get('score') ?? 0),
    notitie: tekst('notitie'),
  });
  await logAudit('prospect.bijgewerkt', { entiteit: 'prospect', entiteitId: id });
  vernieuw(id);
  redirect(`/dashboard/prospects/${id}?ok=opgeslagen`);
}

/* ------------------------------------------------------------------ */
/* Logo                                                                */
/* ------------------------------------------------------------------ */

/** Logo uploaden (png/jpg/webp/svg, max 4 MB) naar media/prospects. */
export async function uploadLogoActie(formData: FormData) {
  await eisToegang();
  const id = String(formData.get('id') ?? '').trim();
  if (!ID.test(id)) redirect('/dashboard/prospects');
  const bestand = formData.get('logo');
  if (!(bestand instanceof File)) terug(id, { logofout: 'Kies eerst een bestand.' }, '#logo');
  const check = await controleerUpload(bestand);
  if ('fout' in check) terug(id, { logofout: check.fout }, '#logo');
  // Opnieuw verpakken met de echte extensie en het echte type, niet wat de naam beweert.
  const schoon = new File([new Uint8Array(await bestand.arrayBuffer())], `logo.${check.type.ext}`, { type: check.type.mime });
  const upload = await uploadMediaMetNaam(schoon, 'prospects');
  if (!upload) terug(id, { logofout: 'Opslaan mislukte. Probeer het nog eens.' }, '#logo');
  const sb = kmsAdmin();
  if (sb) await sb.from('prospecten').update({ logo_url: upload.url }).eq('id', id);
  await logAudit('prospect.logo_geupload', { entiteit: 'prospect', entiteitId: id, details: { url: upload.url } });
  vernieuw(id);
  terug(id, { ok: 'opgeslagen' }, '#logo');
}

/** Zoekt het logo op de website. Slaat de kandidaat op in media; Jessi kiest daarna. */
export async function haalLogoVanWebsiteActie(formData: FormData) {
  await eisToegang();
  const id = String(formData.get('id') ?? '').trim();
  const p = await getProspectRij(id);
  if (!p) redirect('/dashboard/prospects');
  if (!p.website) terug(id, { logofout: 'Deze prospect heeft geen website.' }, '#logo');
  const r = await zoekLogo(p.website);
  await logAudit('prospect.logo_gezocht', { entiteit: 'prospect', entiteitId: id, details: { ok: r.ok, website: p.website } });
  const params: Record<string, string> = r.ok ? { kandidaat: r.url, bron: r.bron } : { logofout: r.fout };
  const qs = new URLSearchParams(params);
  for (const k of r.kandidaten.filter((k) => !r.ok || k.url !== r.bron).slice(0, 5)) qs.append('alt', k.url);
  redirect(`/dashboard/prospects/${id}?${qs.toString()}#logo`);
}

/** Een andere gevonden afbeelding proberen. */
export async function haalLogoVanBronActie(formData: FormData) {
  await eisToegang();
  const id = String(formData.get('id') ?? '').trim();
  const bron = String(formData.get('bron') ?? '').trim();
  if (!ID.test(id)) redirect('/dashboard/prospects');
  const alt = formData.getAll('alt').map(String).filter((a) => a && a !== bron).slice(0, 5);
  const qs = new URLSearchParams();
  try {
    const url = await slaLogoOpVanUrl(bron);
    qs.set('kandidaat', url);
    qs.set('bron', bron);
  } catch (e) {
    qs.set('logofout', `Deze afbeelding lukte niet: ${(e as Error).message}`);
  }
  for (const a of alt) qs.append('alt', a);
  redirect(`/dashboard/prospects/${id}?${qs.toString()}#logo`);
}

/** Alleen url's uit onze eigen media-opslag (map prospects/) mogen als logo worden vastgezet. */
function isEigenLogoUrl(url: string): boolean {
  const basis = env.supabaseUrl.replace(/\/$/, '');
  return Boolean(basis) && url.startsWith(`${basis}/storage/v1/object/public/media/prospects/`) && !url.includes('..');
}

export async function accepteerLogoActie(formData: FormData) {
  await eisToegang();
  const id = String(formData.get('id') ?? '').trim();
  const url = String(formData.get('url') ?? '').trim();
  if (!ID.test(id)) redirect('/dashboard/prospects');
  if (!isEigenLogoUrl(url)) terug(id, { logofout: 'Onbekende afbeelding.' }, '#logo');
  const sb = kmsAdmin();
  if (sb) await sb.from('prospecten').update({ logo_url: url }).eq('id', id);
  await logAudit('prospect.logo_geaccepteerd', { entiteit: 'prospect', entiteitId: id, details: { url } });
  vernieuw(id);
  terug(id, { ok: 'opgeslagen' }, '#logo');
}

export async function verwijderLogoActie(formData: FormData) {
  await eisToegang();
  const id = String(formData.get('id') ?? '').trim();
  if (!ID.test(id)) redirect('/dashboard/prospects');
  const sb = kmsAdmin();
  // Bewust null: Jessi wil het logo weghalen, dan tonen we de bedrijfsnaam.
  if (sb) await sb.from('prospecten').update({ logo_url: null }).eq('id', id);
  await logAudit('prospect.logo_verwijderd', { entiteit: 'prospect', entiteitId: id });
  vernieuw(id);
  terug(id, { ok: 'verwijderd' }, '#logo');
}

export async function zetHuisstijlKleurActie(formData: FormData) {
  await eisToegang();
  const id = String(formData.get('id') ?? '').trim();
  if (!ID.test(id)) redirect('/dashboard/prospects');
  const wissen = formData.get('wissen') === '1';
  const kleur = String(formData.get('kleur') ?? '').trim();
  if (!wissen && !/^#[0-9a-f]{6}$/i.test(kleur)) terug(id, { logofout: 'Kies een kleur als #RRGGBB.' }, '#logo');
  const sb = kmsAdmin();
  if (sb) await sb.from('prospecten').update({ huisstijl_kleur: wissen ? null : kleur.toLowerCase() }).eq('id', id);
  await logAudit('prospect.huisstijlkleur', { entiteit: 'prospect', entiteitId: id, details: { kleur: wissen ? null : kleur } });
  vernieuw(id);
  terug(id, { ok: 'opgeslagen' }, '#logo');
}

/* ------------------------------------------------------------------ */
/* Mockup-artikelen                                                    */
/* ------------------------------------------------------------------ */

/**
 * Zet één van de vier plekken op een artikel + kleur. De andere plekken nemen
 * we over zoals ze nu op de pagina staan (ook als die automatisch gekozen waren).
 */
export async function zetMockupArtikelActie(formData: FormData) {
  await eisToegang();
  const id = String(formData.get('id') ?? '').trim();
  const plek = Math.max(0, Math.min(3, Number(formData.get('plek') ?? 0) || 0));
  const productId = String(formData.get('productId') ?? '').trim();
  const kleur = String(formData.get('kleur') ?? '').trim() || null;
  const p = await getProspectRij(id);
  if (!p || !ID.test(productId)) redirect('/dashboard/prospects');
  const keuzes = await huidigeKeuzes(p);
  const nieuw = [...keuzes];
  // Hetzelfde artikel niet twee keer: staat het al op een andere plek, dan ruilen.
  const elders = nieuw.findIndex((k, i) => i !== plek && k.productId === productId);
  if (elders >= 0 && nieuw[plek]) nieuw[elders] = nieuw[plek];
  else if (elders >= 0) nieuw.splice(elders, 1);
  if (plek < nieuw.length) nieuw[plek] = { productId, kleur };
  else nieuw.push({ productId, kleur });
  const sb = kmsAdmin();
  if (sb) await sb.from('prospecten').update({ mockup_artikelen: nieuw.slice(0, 4) }).eq('id', id);
  await logAudit('prospect.mockup_gewijzigd', { entiteit: 'prospect', entiteitId: id, details: { plek, productId, kleur } });
  vernieuw(id);
  terug(id, { ok: 'opgeslagen' }, '#artikelen');
}

/** Terug naar de automatische keuze op branche. */
export async function resetMockupActie(formData: FormData) {
  await eisToegang();
  const id = String(formData.get('id') ?? '').trim();
  if (!ID.test(id)) redirect('/dashboard/prospects');
  const sb = kmsAdmin();
  // Bewust null: dat betekent "automatisch kiezen".
  if (sb) await sb.from('prospecten').update({ mockup_artikelen: null }).eq('id', id);
  await logAudit('prospect.mockup_automatisch', { entiteit: 'prospect', entiteitId: id });
  vernieuw(id);
  terug(id, { ok: 'opgeslagen' }, '#artikelen');
}

/* ------------------------------------------------------------------ */
/* Brief                                                               */
/* ------------------------------------------------------------------ */

export async function markeerBriefVerstuurdActie(formData: FormData) {
  await eisToegang();
  const id = String(formData.get('id') ?? '').trim();
  const p = await getProspectRij(id);
  if (!p) redirect('/dashboard/prospects');
  const sb = kmsAdmin();
  if (sb) {
    const patch: Record<string, unknown> = { brief_verstuurd_op: datumNL(0), laatste_contact: new Date().toISOString() };
    if (p.status === 'nieuw') patch.status = 'benaderd';
    await sb.from('prospecten').update(patch).eq('id', id);
  }
  await logAudit('prospect.brief_verstuurd', { entiteit: 'prospect', entiteitId: id });
  vernieuw(id);
  terug(id, { ok: 'bijgewerkt' });
}
