'use server';

/**
 * Server actions voor één nieuwsbrief: de editor (Ontwerp) en het tabblad
 * Versturen. De editor-actions geven een resultaat terug in plaats van te
 * redirecten, zodat de editor zonder herladen kan blijven werken.
 *
 * Editor-actions (gebruikt door ./editor/NieuwsbriefEditor.tsx):
 *   slaOntwerpOp(id, ontwerp)            -> { ok: true, opgeslagenOp } | { ok: false, fout }
 *   slaModuleOp(naam, sectie)            -> { ok: true, module } | { ok: false, fout }
 *   verwijderModule(id)                  -> { ok: true } | { ok: false, fout }
 *   uploadNieuwsbriefAfbeelding(fd)      -> { url } | { fout }      (veld 'bestand')
 *   zoekProducten(term)                  -> ProductZoekResultaat[]
 */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { uploadMedia } from '@/lib/kms/storage';
import { fotosVan, productSlug, CATEGORIEEN } from '@/lib/kms/catalogus';
import { normaliseerDoelgroep, ontvangersVoorDoelgroep, type Doelgroep } from '@/lib/kms/nieuwsbrief';
import { controleerOntwerpVorm, normaliseerOntwerp, normaliseerSectie } from '@/lib/nieuwsbrief/valideer';
import { getNieuwsbrief, maakNieuwsbrief, siteUrl } from '@/lib/nieuwsbrief/opslag';
import { sanitizeHtml } from '@/lib/nieuwsbrief/sanitize';
import {
  probeerFoutenOpnieuw,
  startVerzending,
  verstuurTestmail,
  verwerkBatch,
  type BatchUitkomst,
  type StartUitkomst,
  type Uitkomst,
} from '@/lib/nieuwsbrief/verzenden';
import type { Module, Ontwerp, Sectie } from '@/lib/nieuwsbrief/types';

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const pad = (id: string) => `/dashboard/nieuwsbrief/${id}`;

/** Tekst-HTML ook bij het opslaan door de allowlist halen (render.ts doet het daarnaast altijd). */
function schoneSectie(s: Sectie): Sectie {
  return {
    ...s,
    kolommen: s.kolommen.map((k) => ({
      ...k,
      blokken: k.blokken.map((b) => (b.type === 'tekst' ? { ...b, html: sanitizeHtml(b.html) } : b)),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

export type OpslaanUitkomst = { ok: true; opgeslagenOp: string } | { ok: false; fout: string };

/** Ontwerp opslaan. Wordt ook door automatisch opslaan gebruikt. */
export async function slaOntwerpOp(id: string, ontwerp: Ontwerp): Promise<OpslaanUitkomst> {
  if (!(await dashAuthed())) return { ok: false, fout: 'Je bent niet meer ingelogd. Log opnieuw in en probeer het nog eens.' };
  const sb = kmsAdmin();
  if (!sb || !isUuid(id)) return { ok: false, fout: 'Opslaan lukt nu niet.' };

  const vormFout = controleerOntwerpVorm(ontwerp);
  if (vormFout) return { ok: false, fout: vormFout };
  const genormaliseerd = normaliseerOntwerp(ontwerp);
  const schoon: Ontwerp = { ...genormaliseerd, secties: genormaliseerd.secties.map(schoneSectie) };

  const { data: oud } = await sb.from('nieuwsbrieven').select('status, updated_at, ontwerp').eq('id', id).maybeSingle();
  if (!oud) return { ok: false, fout: 'Deze nieuwsbrief bestaat niet meer.' };
  const vorige = oud as { status: string; updated_at: string; ontwerp: { secties?: unknown[] } | null };
  if (vorige.status === 'verzonden' || vorige.status === 'verzenden') {
    return { ok: false, fout: 'Deze nieuwsbrief is al verstuurd en kan niet meer worden aangepast. Maak een kopie.' };
  }

  const nu = new Date().toISOString();
  const { error } = await sb.from('nieuwsbrieven').update({ ontwerp: schoon, updated_at: nu }).eq('id', id);
  if (error) return { ok: false, fout: 'Opslaan is mislukt. Probeer het nog een keer.' };

  // Automatisch opslaan gebeurt vaak; in het logboek maar één regel per 10 minuten.
  if (Date.now() - new Date(vorige.updated_at).getTime() > 10 * 60 * 1000) {
    await logAudit('nieuwsbrief_ontwerp_bijgewerkt', {
      entiteit: 'nieuwsbrieven',
      entiteitId: id,
      details: { voor: { onderdelen: vorige.ontwerp?.secties?.length ?? 0 }, na: { onderdelen: schoon.secties.length } },
    });
  }
  return { ok: true, opgeslagenOp: nu };
}

export type ModuleUitkomst = { ok: true; module: Module } | { ok: false; fout: string };

/** Een sectie bewaren als herbruikbare module. */
export async function slaModuleOp(naam: string, sectie: Sectie): Promise<ModuleUitkomst> {
  if (!(await dashAuthed())) return { ok: false, fout: 'Je bent niet meer ingelogd.' };
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Opslaan lukt nu niet.' };
  const schoneNaam = String(naam ?? '').trim().slice(0, 120);
  if (!schoneNaam) return { ok: false, fout: 'Geef de module een naam.' };
  const genormaliseerd = normaliseerSectie(sectie);
  if (!genormaliseerd) return { ok: false, fout: 'Dit onderdeel kan niet als module worden bewaard.' };
  const schoon = schoneSectie(genormaliseerd);

  const { data, error } = await sb.from('nieuwsbrief_modules').insert({ naam: schoneNaam, sectie: schoon }).select('id').single();
  if (error || !data) return { ok: false, fout: 'Bewaren is mislukt. Probeer het nog een keer.' };
  const moduleId = (data as { id: string }).id;
  await logAudit('nieuwsbrief_module_aangemaakt', { entiteit: 'nieuwsbrief_modules', entiteitId: moduleId, details: { naam: schoneNaam } });
  return { ok: true, module: { id: moduleId, naam: schoneNaam, sectie: schoon } };
}

export async function verwijderModule(id: string): Promise<{ ok: true } | { ok: false; fout: string }> {
  if (!(await dashAuthed())) return { ok: false, fout: 'Je bent niet meer ingelogd.' };
  const sb = kmsAdmin();
  if (!sb || !isUuid(id)) return { ok: false, fout: 'Verwijderen lukt nu niet.' };
  const { data: oud } = await sb.from('nieuwsbrief_modules').select('naam').eq('id', id).maybeSingle();
  const { error } = await sb.from('nieuwsbrief_modules').delete().eq('id', id);
  if (error) return { ok: false, fout: 'Verwijderen is mislukt.' };
  await logAudit('nieuwsbrief_module_verwijderd', {
    entiteit: 'nieuwsbrief_modules',
    entiteitId: id,
    details: { naam: (oud as { naam?: string } | null)?.naam ?? null },
  });
  return { ok: true };
}

const AFBEELDING_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const AFBEELDING_EXT = /\.(png|jpe?g|gif|webp)$/i;
const MAX_AFBEELDING = 4 * 1024 * 1024;

/** Afbeelding uploaden naar de opslag (bucket media, map nieuwsbrief/). Veld: 'bestand'. */
export async function uploadNieuwsbriefAfbeelding(formData: FormData): Promise<{ url: string } | { fout: string }> {
  if (!(await dashAuthed())) return { fout: 'Je bent niet meer ingelogd.' };
  const bestand = formData.get('bestand');
  if (!(bestand instanceof File) || bestand.size === 0) return { fout: 'Kies eerst een afbeelding.' };
  if (bestand.size > MAX_AFBEELDING) return { fout: 'Deze afbeelding is groter dan 4 MB. Maak hem kleiner en probeer het opnieuw.' };
  const typeOk = AFBEELDING_TYPES.has(bestand.type) || (!bestand.type && AFBEELDING_EXT.test(bestand.name));
  if (!typeOk || !AFBEELDING_EXT.test(bestand.name)) {
    return { fout: 'Alleen afbeeldingen van het type PNG, JPG, GIF of WEBP kunnen in een nieuwsbrief.' };
  }
  const url = await uploadMedia(bestand, 'nieuwsbrief');
  if (!url) return { fout: 'Uploaden is mislukt. Probeer het nog een keer.' };
  await logAudit('nieuwsbrief_afbeelding_geupload', { entiteit: 'nieuwsbrieven', details: { url, naam: bestand.name } });
  return { url };
}

export type ProductZoekResultaat = {
  id: string;
  naam: string;
  merk: string | null;
  /** Eerste bruikbare foto (url of pad onder /public), of null. */
  foto: string | null;
  /** Basisprijs excl. btw, of null. */
  prijs: number | null;
  /** Link naar de productpagina op de site, of naar het assortiment als het artikel daar niet op staat. */
  url: string;
};

/** Producten zoeken op naam, merk of artikelnummer (max 20). */
export async function zoekProducten(term: string): Promise<ProductZoekResultaat[]> {
  if (!(await dashAuthed())) return [];
  const sb = kmsAdmin();
  const t = String(term ?? '')
    .trim()
    .replace(/[,%()*\\]/g, ' ')
    .slice(0, 80);
  if (!sb || t.length < 2) return [];
  const { data } = await sb
    .from('producten')
    .select('id, sku, naam, merk, categorie, afbeeldingen, verkoopprijs_basis, omschrijving')
    .eq('actief', true)
    .or(`naam.ilike.%${t}%,merk.ilike.%${t}%,sku.ilike.%${t}%`)
    .order('naam')
    .limit(20);
  const basis = siteUrl();
  type Rij = {
    id: string;
    sku: string | null;
    naam: string;
    merk: string | null;
    categorie: string | null;
    afbeeldingen: string[] | null;
    verkoopprijs_basis: number | null;
    omschrijving: string | null;
  };
  return ((data as Rij[]) ?? []).map((r) => {
    const fotos = fotosVan(r.afbeeldingen);
    const cat = CATEGORIEEN.find((c) => c.naam === r.categorie);
    // Alleen artikelen met foto en omschrijving staan op de site (zie lib/kms/catalogus.ts).
    const opDeSite = Boolean(cat && fotos.length > 0 && (r.omschrijving?.trim().length ?? 0) > 60);
    return {
      id: r.id,
      naam: r.naam,
      merk: r.merk,
      foto: fotos[0] ?? null,
      prijs: typeof r.verkoopprijs_basis === 'number' ? r.verkoopprijs_basis : null,
      url: opDeSite && cat ? `${basis}/assortiment/${cat.slug}/${productSlug(r)}` : `${basis}/assortiment`,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Versturen                                                           */
/* ------------------------------------------------------------------ */

/** Onderwerp, preheader, afzendernaam en doelgroep opslaan. */
export async function slaVerzendgegevensOp(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const sb = kmsAdmin();
  if (!sb || !isUuid(id)) redirect('/dashboard/nieuwsbrief');

  const brief = await getNieuwsbrief(id);
  if (!brief) redirect('/dashboard/nieuwsbrief');

  const soort = String(formData.get('doelgroep_soort') ?? 'alle');
  const branches = formData.getAll('doelgroep_branches').map(String);
  const na = {
    onderwerp: String(formData.get('onderwerp') ?? '').trim().slice(0, 250),
    preheader: String(formData.get('preheader') ?? '').trim().slice(0, 250),
    afzender_naam: String(formData.get('afzender_naam') ?? '').trim().slice(0, 120),
    doelgroep: normaliseerDoelgroep({ soort, branches }),
  };
  const voor = { onderwerp: brief.onderwerp ?? '', preheader: brief.preheader ?? '', afzender_naam: brief.afzender_naam ?? '', doelgroep: brief.doelgroep };

  const wijziging: Record<string, unknown> = {};
  const oudeWaarden: Record<string, unknown> = {};
  for (const k of Object.keys(na) as (keyof typeof na)[]) {
    if (JSON.stringify(na[k]) !== JSON.stringify(voor[k])) {
      wijziging[k] = na[k];
      oudeWaarden[k] = voor[k];
    }
  }
  if (Object.keys(wijziging).length > 0) {
    await sb
      .from('nieuwsbrieven')
      .update({ ...wijziging, updated_at: new Date().toISOString() })
      .eq('id', id);
    await logAudit('nieuwsbrief_bijgewerkt', { entiteit: 'nieuwsbrieven', entiteitId: id, details: { voor: oudeWaarden, na: wijziging } });
  }
  revalidatePath(pad(id));
  redirect(`${pad(id)}?tab=versturen&ok=opgeslagen`);
}

/** Naam van de nieuwsbrief wijzigen. */
export async function hernoemNieuwsbrief(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const naam = String(formData.get('naam') ?? '').trim().slice(0, 200);
  const sb = kmsAdmin();
  if (!sb || !isUuid(id)) redirect('/dashboard/nieuwsbrief');
  const brief = await getNieuwsbrief(id);
  if (brief && naam && naam !== brief.naam) {
    await sb.from('nieuwsbrieven').update({ naam, updated_at: new Date().toISOString() }).eq('id', id);
    await logAudit('nieuwsbrief_bijgewerkt', { entiteit: 'nieuwsbrieven', entiteitId: id, details: { voor: { naam: brief.naam }, na: { naam } } });
  }
  revalidatePath(pad(id));
  revalidatePath('/dashboard/nieuwsbrief');
  redirect(`${pad(id)}?ok=opgeslagen`);
}

/** Aantal ontvangers voor een doelgroep, live in het formulier. */
export async function telOntvangers(doelgroep: Doelgroep): Promise<number> {
  if (!(await dashAuthed())) return 0;
  const lijst = await ontvangersVoorDoelgroep(normaliseerDoelgroep(doelgroep));
  return lijst.length;
}

export async function stuurTestmail(id: string, naar: string): Promise<Uitkomst> {
  if (!(await dashAuthed())) return { ok: false, melding: 'Je bent niet meer ingelogd.' };
  if (!isUuid(id)) return { ok: false, melding: 'Deze nieuwsbrief bestaat niet.' };
  const uit = await verstuurTestmail(id, String(naar ?? ''));
  if (uit.ok) {
    await logAudit('nieuwsbrief_testmail', { entiteit: 'nieuwsbrieven', entiteitId: id, details: { naar: String(naar ?? '').trim().toLowerCase() } });
  }
  return uit;
}

/** Start het versturen: wachtrij vullen en status op 'verzenden'. */
export async function startVersturen(id: string): Promise<StartUitkomst> {
  if (!(await dashAuthed())) return { ok: false, melding: 'Je bent niet meer ingelogd.' };
  if (!isUuid(id)) return { ok: false, melding: 'Deze nieuwsbrief bestaat niet.' };
  const brief = await getNieuwsbrief(id);
  const uit = await startVerzending(id);
  if (uit.ok) {
    await logAudit('nieuwsbrief_verzenden_gestart', {
      entiteit: 'nieuwsbrieven',
      entiteitId: id,
      details: { voor: { status: brief?.status ?? null }, na: { status: 'verzenden', aantal_ontvangers: uit.aantal } },
    });
  }
  revalidatePath('/dashboard/nieuwsbrief');
  return uit;
}

/**
 * Eén batch (max 50) versturen. Het dashboard roept dit herhaald aan tot
 * `klaar` true is; zo blijft elke aanroep ruim binnen de tijdslimiet en kan
 * het na een onderbreking gewoon verder.
 */
export async function verstuurBatch(id: string): Promise<BatchUitkomst> {
  if (!(await dashAuthed())) {
    return { verzonden: 0, fouten: 0, totaal: 0, resterend: 0, klaar: false, melding: 'Je bent niet meer ingelogd.' };
  }
  if (!isUuid(id)) return { verzonden: 0, fouten: 0, totaal: 0, resterend: 0, klaar: false, melding: 'Deze nieuwsbrief bestaat niet.' };
  const uit = await verwerkBatch(id);
  if (uit.klaar) {
    await logAudit('nieuwsbrief_verzonden', {
      entiteit: 'nieuwsbrieven',
      entiteitId: id,
      details: { na: { status: uit.verzonden === 0 && uit.fouten > 0 ? 'mislukt' : 'verzonden', verzonden: uit.verzonden, fouten: uit.fouten } },
    });
    revalidatePath('/dashboard/nieuwsbrief');
    revalidatePath(pad(id));
  }
  return uit;
}

/** Mislukte adressen opnieuw in de wachtrij zetten. */
export async function probeerMisluktOpnieuw(id: string): Promise<StartUitkomst> {
  if (!(await dashAuthed())) return { ok: false, melding: 'Je bent niet meer ingelogd.' };
  if (!isUuid(id)) return { ok: false, melding: 'Deze nieuwsbrief bestaat niet.' };
  const uit = await probeerFoutenOpnieuw(id);
  if (uit.ok) {
    await logAudit('nieuwsbrief_opnieuw_geprobeerd', { entiteit: 'nieuwsbrieven', entiteitId: id, details: { aantal: uit.aantal } });
  }
  return uit;
}

/** Inplannen op een dag (vanaf morgen); de cron verstuurt hem die ochtend tussen 07:00 en 08:00. */
export async function planNieuwsbriefIn(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const datum = String(formData.get('datum') ?? '').trim();
  const sb = kmsAdmin();
  if (!sb || !isUuid(id)) redirect('/dashboard/nieuwsbrief');
  const brief = await getNieuwsbrief(id);
  if (!brief) redirect('/dashboard/nieuwsbrief');

  const vandaag = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
  // De verzending loopt via de dagelijkse cron van 06:00 UTC. Vandaag inplannen zou
  // pas morgen versturen; daarom kan het vanaf morgen (vandaag = Nu versturen).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum <= vandaag) redirect(`${pad(id)}?tab=versturen&melding=datum`);
  if (brief.is_template || brief.status === 'verzonden' || brief.status === 'verzenden') redirect(`${pad(id)}?tab=versturen&melding=status`);
  if (!brief.onderwerp?.trim()) redirect(`${pad(id)}?tab=versturen&melding=onderwerp`);

  // 04:00 UTC = 05:00 of 06:00 Nederlandse tijd: ruim vóór de cron van 06:00 UTC.
  const geplandOp = `${datum}T04:00:00.000Z`;
  await sb.from('nieuwsbrieven').update({ status: 'gepland', gepland_op: geplandOp, updated_at: new Date().toISOString() }).eq('id', id);
  await logAudit('nieuwsbrief_ingepland', {
    entiteit: 'nieuwsbrieven',
    entiteitId: id,
    details: { voor: { status: brief.status, gepland_op: brief.gepland_op }, na: { status: 'gepland', gepland_op: geplandOp } },
  });
  revalidatePath(pad(id));
  revalidatePath('/dashboard/nieuwsbrief');
  redirect(`${pad(id)}?tab=versturen&melding=ingepland`);
}

export async function annuleerPlanning(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const sb = kmsAdmin();
  if (!sb || !isUuid(id)) redirect('/dashboard/nieuwsbrief');
  const brief = await getNieuwsbrief(id);
  if (brief?.status === 'gepland') {
    await sb.from('nieuwsbrieven').update({ status: 'concept', updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'gepland');
    await logAudit('nieuwsbrief_planning_geannuleerd', {
      entiteit: 'nieuwsbrieven',
      entiteitId: id,
      details: { voor: { status: 'gepland', gepland_op: brief.gepland_op }, na: { status: 'concept' } },
    });
  }
  revalidatePath(pad(id));
  revalidatePath('/dashboard/nieuwsbrief');
  redirect(`${pad(id)}?tab=versturen&melding=geannuleerd`);
}

/** Deze brief bewaren als nieuwe template. */
export async function bewaarAlsTemplate(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const naam = String(formData.get('naam') ?? '').trim();
  if (!isUuid(id)) redirect('/dashboard/nieuwsbrief');
  const nieuw = await maakNieuwsbrief({ vanId: id, naam: naam || null, alsTemplate: true });
  if (!nieuw) redirect(`${pad(id)}?fout=template`);
  await logAudit('nieuwsbrief_template_aangemaakt', { entiteit: 'nieuwsbrieven', entiteitId: nieuw, details: { van: id } });
  revalidatePath('/dashboard/nieuwsbrief');
  redirect(`${pad(nieuw)}?ok=aangemaakt`);
}
