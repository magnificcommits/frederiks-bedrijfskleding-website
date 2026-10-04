'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import {
  maakDrukproef,
  werkDrukproef,
  verwijderDrukproef,
  markeerVerstuurd,
  getDrukproef,
  zetDrukproefStatus,
  verwerkDrukproefGoedkeuring,
  zoekArtikelenVoorDrukproef,
  kleurenVoorDrukproef,
  type DrukproefArtikel,
  type DrukproefKleur,
} from '@/lib/kms/drukproeven';
import { sendEmail, emailLayout, escapeHtml } from '@/lib/email';
import { env, isEmailConfigured } from '@/lib/env';
import { normaliseerOntwerp, veiligeAfbeeldingUrl, plaatsingTekst, type Ontwerp } from './ontwerp';
import { veiligTerugPad } from './terug';

/**
 * Server-acties voor de module Drukproeven. Alles achter dashAuthed(): zonder geldige
 * dashboardsessie sturen we terug naar /dashboard. Uploads (logo's, foto's) lopen via
 * de route ./upload, omdat server-acties maar 1 MB mogen ontvangen.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TECHNIEKEN = ['borduren', 'bedrukken'];

/**
 * Terugadres na een actie, bijvoorbeeld de klantkaart. Alleen paden binnen het
 * dashboard: een volledige URL of '//' zou een open redirect zijn.
 */
function veiligTerug(v: unknown): string | null {
  return veiligTerugPad(typeof v === 'string' ? v : null);
}

/** Voeg een parameter toe aan een pad dat misschien al een querystring heeft. */
function metParam(pad: string, sleutel: string, waarde: string): string {
  const [basis, qs = ''] = pad.split('?');
  const p = new URLSearchParams(qs);
  p.set(sleutel, waarde);
  return `${basis}?${p.toString()}`;
}

/** Waar Jessi na de actie terechtkomt: het terugadres, of het overzicht van die klant. */
function bestemming(terug: string | null, orgId: string, sleutel: string, waarde: string): string {
  if (terug) return metParam(terug, sleutel, waarde);
  return `/dashboard/drukproeven?${orgId ? `org=${orgId}&` : ''}${sleutel}=${waarde}`;
}

/* ------------------------------------------------------------------------- */
/* Opzoeken voor de editor (aangeroepen vanuit de browser).                   */
/* ------------------------------------------------------------------------- */

export async function zoekArtikelenActie(zoekterm: string): Promise<DrukproefArtikel[]> {
  if (!(await dashAuthed())) return [];
  return zoekArtikelenVoorDrukproef(String(zoekterm ?? '').slice(0, 80));
}

export async function kleurenActie(productId: string): Promise<DrukproefKleur[]> {
  if (!(await dashAuthed())) return [];
  if (!UUID.test(String(productId ?? ''))) return [];
  return kleurenVoorDrukproef(productId);
}

/* ------------------------------------------------------------------------- */
/* Opslaan vanuit de editor.                                                  */
/* ------------------------------------------------------------------------- */

export type DrukproefInvoer = {
  /** Leeg bij een nieuwe drukproef. */
  id?: string | null;
  org_id: string;
  order_id?: string | null;
  naam: string;
  product_id: string | null;
  product_kleur: string | null;
  voor_url: string | null;
  achter_url: string | null;
  ontwerp: Ontwerp;
  techniek: string;
  /** Aantal drukkleuren (kolom drukproeven.kleur). */
  drukkleuren: number;
  omschrijving: string;
  /** Terug naar waar Jessi vandaan kwam (bijv. de klantkaart). */
  terug?: string | null;
};

export type BewaarUitkomst = { ok: false; melding: string };

function samenvatting(o: Ontwerp): string {
  const v = o.voor.length;
  const a = o.achter.length;
  return `${v} logo${v === 1 ? '' : "'s"} voorkant, ${a} logo${a === 1 ? '' : "'s"} achterkant`;
}

export async function bewaarDrukproefActie(invoer: DrukproefInvoer): Promise<BewaarUitkomst> {
  if (!(await dashAuthed())) redirect('/dashboard');

  const orgId = String(invoer?.org_id ?? '').trim();
  if (!UUID.test(orgId)) return { ok: false, melding: 'Er is geen klant gekozen.' };
  const naam = String(invoer.naam ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (!naam) return { ok: false, melding: 'Geef de drukproef een naam.' };

  const ontwerp = normaliseerOntwerp(invoer.ontwerp) ?? { voor: [], achter: [] };
  const voorUrl = veiligeAfbeeldingUrl(invoer.voor_url);
  const achterUrl = veiligeAfbeeldingUrl(invoer.achter_url);
  if (!voorUrl && !achterUrl) return { ok: false, melding: 'Kies eerst een kledingstuk of upload een foto.' };
  if (ontwerp.voor.length + ontwerp.achter.length === 0) return { ok: false, melding: 'Zet minstens één logo op het kledingstuk.' };

  const productId = invoer.product_id && UUID.test(invoer.product_id) ? invoer.product_id : null;
  const productKleur = String(invoer.product_kleur ?? '').trim().slice(0, 80) || null;
  const orderId = invoer.order_id && UUID.test(invoer.order_id) ? invoer.order_id : null;
  const techniek = TECHNIEKEN.includes(invoer.techniek) ? invoer.techniek : 'borduren';
  const drukkleuren = Math.max(0, Math.min(20, Math.round(Number(invoer.drukkleuren) || 0)));
  const omschrijving = String(invoer.omschrijving ?? '').trim().slice(0, 2000) || null;
  const terug = veiligTerug(invoer.terug);

  // Korte samenvatting van de plekken voor lijsten die het ontwerp (nog) niet tonen,
  // zoals de order. Het eerste logo vullen we in voor oudere weergaven.
  const plekken = [...new Set([...ontwerp.voor, ...ontwerp.achter].map((p) => p.label).filter(Boolean))].join(', ');
  const positie = (plekken || 'Zie drukproef').slice(0, 200);
  const eersteLogo = (ontwerp.voor[0] ?? ontwerp.achter[0])?.logo_url ?? null;

  const velden = {
    naam,
    product_id: productId,
    product_kleur: productKleur,
    afbeelding_url: voorUrl,
    achter_afbeelding_url: achterUrl,
    ontwerp,
    techniek,
    kleur: drukkleuren,
    positie,
    logo_url: eersteLogo,
    omschrijving,
  };

  const id = invoer.id ? String(invoer.id) : '';
  if (id) {
    if (!UUID.test(id)) return { ok: false, melding: 'Deze drukproef bestaat niet meer.' };
    const huidig = await getDrukproef(id);
    if (!huidig || huidig.organisatie_id !== orgId) return { ok: false, melding: 'Deze drukproef bestaat niet meer.' };

    const oudOntwerp = normaliseerOntwerp(huidig.ontwerp);
    const voor: Record<string, unknown> = {};
    const na: Record<string, unknown> = {};
    const vergelijk: [string, unknown, unknown][] = [
      ['naam', huidig.naam, naam],
      ['product_id', huidig.product_id, productId],
      ['product_kleur', huidig.product_kleur ?? null, productKleur],
      ['afbeelding_url', huidig.afbeelding_url, voorUrl],
      ['achter_afbeelding_url', huidig.achter_afbeelding_url ?? null, achterUrl],
      ['techniek', huidig.techniek, techniek],
      ['kleur', huidig.kleur, drukkleuren],
      ['positie', huidig.positie, positie],
      ['omschrijving', huidig.omschrijving, omschrijving],
    ];
    for (const [veld, oud, nieuw] of vergelijk) {
      if ((oud ?? null) !== (nieuw ?? null)) {
        voor[veld] = oud ?? null;
        na[veld] = nieuw ?? null;
      }
    }
    const ontwerpGewijzigd = JSON.stringify(oudOntwerp) !== JSON.stringify(ontwerp);
    if (ontwerpGewijzigd) {
      voor.ontwerp = oudOntwerp ? samenvatting(oudOntwerp) : 'geen ontwerp';
      na.ontwerp = samenvatting(ontwerp);
    }

    // Is de proef al beoordeeld en verandert er iets, dan moet de klant opnieuw kijken.
    const beslist = huidig.status === 'goedgekeurd' || huidig.status === 'afgekeurd';
    const wijziging = Object.keys(na).length > 0;
    const status = beslist && wijziging ? 'concept' : undefined;
    if (status) {
      voor.status = huidig.status;
      na.status = status;
    }

    const ok = await werkDrukproef(id, {
      ...velden,
      ...(orderId ? { order_id: orderId } : {}),
      ...(status ? { status } : {}),
    });
    if (!ok) return { ok: false, melding: 'Opslaan is niet gelukt. Probeer het nog een keer.' };

    if (wijziging) await logAudit('drukproef_bijgewerkt', { entiteit: 'drukproef', entiteitId: id, details: { voor, na } });
    revalidatePath('/dashboard/drukproeven');
    revalidatePath(`/dashboard/drukproeven/${id}`);
    redirect(bestemming(terug, orgId, 'ok', 'opgeslagen'));
  }

  const nieuwId = await maakDrukproef(orgId, { ...velden, order_id: orderId });
  if (!nieuwId) return { ok: false, melding: 'Opslaan is niet gelukt. Probeer het nog een keer.' };
  await logAudit('drukproef_aangemaakt', {
    entiteit: 'drukproef',
    entiteitId: nieuwId,
    details: { naam, organisatie_id: orgId, product_kleur: productKleur, ontwerp: samenvatting(ontwerp), order_id: orderId },
  });
  revalidatePath('/dashboard/drukproeven');
  if (terug) revalidatePath(terug.split('?')[0]);
  redirect(bestemming(terug, orgId, 'ok', 'aangemaakt'));
}

/* ------------------------------------------------------------------------- */
/* Kopie, versturen, verwijderen.                                             */
/* ------------------------------------------------------------------------- */

/** Maak een kopie, handig voor een volgend kledingstuk met dezelfde logo's. */
export async function kopieerDrukproefActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '').trim();
  if (!UUID.test(id)) redirect('/dashboard/drukproeven');
  const dp = await getDrukproef(id);
  if (!dp) redirect('/dashboard/drukproeven');

  const nieuwId = await maakDrukproef(dp.organisatie_id, {
    naam: `${dp.naam} (kopie)`.slice(0, 160),
    product_id: dp.product_id,
    order_id: dp.order_id,
    type: dp.type,
    kleur: dp.kleur,
    techniek: dp.techniek,
    positie: dp.positie,
    logo_url: dp.logo_url,
    afbeelding_url: dp.afbeelding_url,
    omschrijving: dp.omschrijving,
    product_kleur: dp.product_kleur ?? null,
    achter_afbeelding_url: dp.achter_afbeelding_url ?? null,
    ontwerp: dp.ontwerp ?? null,
  });
  if (!nieuwId) redirect(`/dashboard/drukproeven?org=${dp.organisatie_id}`);
  await logAudit('drukproef_gekopieerd', { entiteit: 'drukproef', entiteitId: nieuwId, details: { kopie_van: id, naam: dp.naam } });
  revalidatePath('/dashboard/drukproeven');
  // Meteen openen, zodat Jessi het andere kledingstuk kan kiezen.
  redirect(`/dashboard/drukproeven/${nieuwId}?ok=aangemaakt`);
}

export async function verstuurDrukproefActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');

  const id = String(formData.get('id') ?? '').trim();
  const orgId = String(formData.get('org_id') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const terug = veiligTerug(formData.get('terug'));
  if (!id || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(bestemming(terug, orgId, 'fout', 'mail'));
  }

  const dp = await getDrukproef(id);
  if (!dp) redirect(bestemming(terug, orgId, 'dp', 'weg'));

  // Zonder ingestelde mail (Resend) gaat er niets de deur uit. Dan zetten we de
  // proef ook niet op 'ter goedkeuring': de klant weet nog van niets.
  if (!isEmailConfigured) redirect(bestemming(terug, orgId, 'dp', 'mail_uit'));

  const link = `${env.siteUrl}/drukproef/${dp.token}`;
  const o = normaliseerOntwerp(dp.ontwerp);
  const plekken = o ? [...o.voor, ...o.achter].map(plaatsingTekst).filter(Boolean) : [];
  const plekkenHtml = plekken.length
    ? `<ul style="margin:12px 0 0;padding-left:18px;">${plekken.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`
    : '';
  const uitkomst = await sendEmail({
    to: email,
    subject: 'Je drukproef ter goedkeuring - Frederiks Bedrijfskleding',
    html: emailLayout({
      heading: 'Bekijk en keur je drukproef',
      preheader: 'We hebben een drukproef voor je klaargezet.',
      bodyHtml: `<p style="margin:0;">We hebben een drukproef voor <strong style="color:#1c1c1c;">${escapeHtml(dp.naam)}</strong> klaargezet. Bekijk hoe je logo op de kleding komt en keur de proef goed of geef je opmerkingen door.</p>${plekkenHtml}
<p style="margin:18px 0;"><a href="${link}" style="display:inline-block;background:#ec6726;color:#ffffff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;">Drukproef bekijken</a></p>
<p style="margin:0;font-size:13px;color:#52504e;">Werkt de knop niet? Open dan deze link:<br/>${escapeHtml(link)}</p>`,
    }),
  }).catch(() => ({ sent: false as const, error: 'onbekend' }));

  if (!uitkomst.sent) redirect(bestemming(terug, orgId, 'dp', 'mail_fout'));

  await markeerVerstuurd(id);
  await logAudit('drukproef_verstuurd', {
    entiteit: 'drukproef',
    entiteitId: id,
    details: { voor: { status: dp.status }, na: { status: 'verstuurd' }, email, opnieuw: dp.status === 'verstuurd' },
  });

  revalidatePath('/dashboard/drukproeven');
  if (terug) revalidatePath(terug.split('?')[0]);
  redirect(bestemming(terug, orgId, 'ok', 'gemaild'));
}

/**
 * Zet een proef op 'ter goedkeuring' zonder mail, voor als Jessi de link zelf
 * heeft gedeeld (WhatsApp, eigen mail) of zolang de mail nog niet is ingesteld.
 */
export async function markeerVerstuurdActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '').trim();
  const orgId = String(formData.get('org_id') ?? '').trim();
  const terug = veiligTerug(formData.get('terug'));
  if (UUID.test(id)) {
    const dp = await getDrukproef(id);
    if (dp && (dp.status === 'concept' || dp.status === 'verstuurd') && (await markeerVerstuurd(id))) {
      await logAudit('drukproef_verstuurd', { entiteit: 'drukproef', entiteitId: id, details: { voor: { status: dp.status }, na: { status: 'verstuurd' }, handmatig: true } });
    }
  }
  revalidatePath('/dashboard/drukproeven');
  if (terug) revalidatePath(terug.split('?')[0]);
  redirect(bestemming(terug, orgId, 'dp', 'verstuurd_handmatig'));
}

/**
 * Goedkeuren namens de klant, als die telefonisch of in de winkel akkoord gaf.
 * Werkt precies als goedkeuren via de klantlink: hangt de proef aan een order en
 * zijn alle proeven van die order akkoord, dan gaat de werkbon naar 'goedgekeurd'
 * (en de order naar bedrukken of borduren als alle kleding al binnen is).
 */
export async function keurGoedNamensKlantActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '').trim();
  const orgId = String(formData.get('org_id') ?? '').trim();
  const terug = veiligTerug(formData.get('terug'));
  const notitie = String(formData.get('opmerking') ?? '').trim().slice(0, 500);
  if (!UUID.test(id)) redirect(bestemming(terug, orgId, 'dp', 'weg'));
  const dp = await getDrukproef(id);
  if (!dp || (dp.status !== 'concept' && dp.status !== 'verstuurd')) redirect(bestemming(terug, orgId, 'dp', 'weg'));

  const opmerking = notitie ? `Akkoord doorgegeven aan Frederiks: ${notitie}` : 'Akkoord doorgegeven aan Frederiks (telefonisch of in de winkel).';
  const ok = await zetDrukproefStatus(id, 'goedgekeurd', opmerking);
  if (ok) {
    await verwerkDrukproefGoedkeuring(id);
    await logAudit('drukproef_goedgekeurd', { entiteit: 'drukproef', entiteitId: id, details: { voor: { status: dp.status }, na: { status: 'goedgekeurd' }, namens_klant: true } });
  }
  revalidatePath('/dashboard/drukproeven');
  revalidatePath('/dashboard/logos');
  if (dp.order_id) revalidatePath(`/dashboard/orders/${dp.order_id}`);
  if (terug) revalidatePath(terug.split('?')[0]);
  redirect(bestemming(terug, orgId, 'dp', ok ? 'goedgekeurd' : 'mislukt'));
}

export async function verwijderDrukproefActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');

  const id = String(formData.get('id') ?? '').trim();
  const orgId = String(formData.get('org_id') ?? '').trim();
  if (id && UUID.test(id)) {
    const sb = kmsAdmin();
    const { data } = sb ? await sb.from('drukproeven').select('naam, status').eq('id', id).maybeSingle() : { data: null };
    const ok = await verwijderDrukproef(id);
    if (ok) await logAudit('drukproef_verwijderd', { entiteit: 'drukproef', entiteitId: id, details: (data as Record<string, unknown> | null) ?? {} });
  }

  const terug = veiligTerug(formData.get('terug'));
  revalidatePath('/dashboard/drukproeven');
  if (terug) revalidatePath(terug.split('?')[0]);
  redirect(bestemming(terug, orgId, 'ok', 'verwijderd'));
}
