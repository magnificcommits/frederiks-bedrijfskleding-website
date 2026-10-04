'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import {
  voegFactuurregelToe,
  werkFactuurregel,
  verwijderFactuurregel,
  getFactuurregel,
  zetFactuurStatus,
  isFactuurStatus,
  zetFactuurEmail,
  mailFactuurNaarKlant,
  getFactuur,
  factuurRegelsGeslotenReden,
} from '@/lib/kms/facturen';
import { zoekArtikelen, kleurenVanArtikel, type ZoekArtikel, type ZoekKleur } from '@/lib/kms/productZoeker';
import { logAudit } from '@/lib/kms/audit';
import { naDefinitiefMaken } from '@/lib/kms/boekhouding';

/**
 * Bedrag of aantal uit een invoerveld. Nederlandse notatie: staat er een komma,
 * dan is dat het decimaalteken en zijn punten duizendtallen (1.234,50).
 * Onleesbare invoer wordt 0 in plaats van NaN.
 */
function getalOfNul(raw: string): number {
  const schoon = raw.replace(/[^0-9.,-]/g, '').trim();
  if (schoon === '') return 0;
  const genormaliseerd = schoon.includes(',') ? schoon.replace(/\./g, '').replace(',', '.') : schoon;
  const getal = Number(genormaliseerd);
  return Number.isFinite(getal) ? getal : 0;
}

/** Percentage tussen 0 en 100; leeg geeft de standaardwaarde. */
function pct(raw: FormDataEntryValue | null, standaard: number): number {
  const s = String(raw ?? '').trim();
  if (s === '') return standaard;
  return Math.min(100, Math.max(0, getalOfNul(s)));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Regels van een verzonden, betaalde of doorgezette factuur blijven staan. */
async function eisConcept(factuurId: string): Promise<void> {
  const reden = await factuurRegelsGeslotenReden(factuurId);
  if (!reden) return;
  const tekst =
    reden === 'boekhouding'
      ? 'Deze factuur staat al in Moneybird. Corrigeer met een creditfactuur.'
      : `Deze factuur is ${reden}. Zet hem eerst terug naar Concept, of corrigeer met een creditfactuur.`;
  redirect('/dashboard/facturen/' + factuurId + '?mailfout=' + encodeURIComponent(tekst));
}

function ververs(factuurId: string) {
  revalidatePath('/dashboard/facturen');
  if (factuurId) revalidatePath('/dashboard/facturen/' + factuurId);
}

/** Artikelen zoeken voor de regelkiezer (server-side, met limit); assortiment van de klant eerst. */
export async function zoekArtikelenActie(term: string, organisatieId: string | null): Promise<{ artikelen: ZoekArtikel[]; meer: boolean }> {
  if (!(await dashAuthed())) return { artikelen: [], meer: false };
  await eisEigenaar();
  return zoekArtikelen(String(term ?? '').slice(0, 120), organisatieId ? String(organisatieId) : null, 24);
}

/** Kleuren (met foto en maten) van één artikel, zodra het in de kiezer gekozen is. */
export async function haalKleurenActie(productId: string): Promise<ZoekKleur[]> {
  if (!(await dashAuthed())) return [];
  await eisEigenaar();
  return kleurenVanArtikel(String(productId ?? ''));
}

export async function voegRegel(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const factuurId = String(formData.get('factuurId') ?? '').trim();
  if (!factuurId) redirect('/dashboard/facturen');
  const omschrijving = String(formData.get('omschrijving') ?? '').trim();
  const aantal = getalOfNul(String(formData.get('aantal') ?? '1'));
  const stukprijs = getalOfNul(String(formData.get('stukprijs') ?? ''));
  const korting_pct = pct(formData.get('korting_pct'), 0);
  const btw_pct = pct(formData.get('btw_pct'), 21);
  const product_id = String(formData.get('product_id') ?? '').trim() || null;
  const kleur = product_id ? String(formData.get('kleur') ?? '').trim() || null : null;
  const maat = product_id ? String(formData.get('maat') ?? '').trim() || null : null;
  if (!omschrijving) redirect('/dashboard/facturen/' + factuurId + '?fout=omschrijving');
  await eisConcept(factuurId);
  const ok = await voegFactuurregelToe(factuurId, { omschrijving, aantal, stukprijs, korting_pct, btw_pct, product_id, kleur, maat });
  if (!ok) redirect('/dashboard/facturen/' + factuurId + '?fout=regel');
  await logAudit('factuurregel_toegevoegd', {
    entiteit: 'facturen',
    entiteitId: factuurId,
    details: { omschrijving, aantal, stukprijs, korting_pct, btw_pct, ...(product_id ? { product_id, kleur, maat } : {}) },
  });
  ververs(factuurId);
  redirect('/dashboard/facturen/' + factuurId + '?ok=toegevoegd');
}

export async function werkRegel(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const factuurId = String(formData.get('factuurId') ?? '').trim();
  const regelId = String(formData.get('regelId') ?? '').trim();
  const omschrijving = String(formData.get('omschrijving') ?? '').trim();
  const aantal = getalOfNul(String(formData.get('aantal') ?? '1'));
  const stukprijs = getalOfNul(String(formData.get('stukprijs') ?? ''));
  const btw_pct = pct(formData.get('btw_pct'), 21);
  // Korting en maat staan niet altijd in het formulier; ontbreken ze, dan blijven ze ongemoeid.
  const kortingVeld = formData.get('korting_pct');
  const korting_pct = kortingVeld == null ? undefined : pct(kortingVeld, 0);
  const maatVeld = formData.get('maat');
  const maat = maatVeld == null ? undefined : String(maatVeld).trim() || null;
  if (!regelId || !omschrijving) redirect('/dashboard/facturen/' + factuurId + '?fout=omschrijving');
  await eisConcept(factuurId);
  const voor = await getFactuurregel(regelId);
  const ok = await werkFactuurregel(regelId, {
    omschrijving,
    aantal,
    stukprijs,
    btw_pct,
    ...(korting_pct !== undefined ? { korting_pct } : {}),
    ...(maat !== undefined ? { maat } : {}),
  });
  if (!ok) redirect('/dashboard/facturen/' + factuurId + '?fout=regel');
  if (voor) {
    const na: Record<string, unknown> = { omschrijving, aantal, stukprijs, btw_pct };
    if (korting_pct !== undefined) na.korting_pct = korting_pct;
    if (maat !== undefined) na.maat = maat;
    const oud: Record<string, unknown> = {};
    const nieuw: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(na)) {
      const was = (voor as unknown as Record<string, unknown>)[k] ?? null;
      const gelijk = typeof v === 'number' ? Number(was) === v : String(was ?? '') === String(v ?? '');
      if (!gelijk) {
        oud[k] = was;
        nieuw[k] = v;
      }
    }
    if (Object.keys(nieuw).length) {
      await logAudit('factuurregel_gewijzigd', { entiteit: 'facturen', entiteitId: factuurId, details: { regelId, voor: oud, na: nieuw } });
    }
  }
  ververs(factuurId);
  redirect('/dashboard/facturen/' + factuurId + '?ok=opgeslagen');
}

export async function verwijderRegel(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const factuurId = String(formData.get('factuurId') ?? '').trim();
  const regelId = String(formData.get('regelId') ?? '').trim();
  if (regelId) {
    const oud = await getFactuurregel(regelId);
    await eisConcept(oud?.factuur_id ?? factuurId);
    const ok = await verwijderFactuurregel(regelId);
    if (ok) {
      await logAudit('factuurregel_verwijderd', { entiteit: 'facturen', entiteitId: factuurId, details: { regelId, omschrijving: oud?.omschrijving ?? null } });
    }
  }
  ververs(factuurId);
  redirect('/dashboard/facturen/' + factuurId + '?ok=verwijderd');
}

export async function wijzigStatus(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const factuurId = String(formData.get('factuurId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!factuurId) redirect('/dashboard/facturen');
  if (!isFactuurStatus(status)) redirect('/dashboard/facturen/' + factuurId + '?fout=status');
  const oud = await getFactuur(factuurId);
  if (oud && oud.status !== status) {
    const ok = await zetFactuurStatus(factuurId, status);
    if (!ok) redirect('/dashboard/facturen/' + factuurId + '?fout=status');
    await logAudit('factuur_status_gewijzigd', { entiteit: 'facturen', entiteitId: factuurId, details: { voor: { status: oud.status }, na: { status } } });
    // Uit concept gehaald: automatisch naar Moneybird als dat in Instellingen > Boekhouding aan staat.
    if (status !== 'concept') await naDefinitiefMaken(factuurId, oud.status);
  }
  ververs(factuurId);
  redirect('/dashboard/facturen/' + factuurId + '?ok=status');
}

/** Factuuradres voor deze ene factuur wijzigen (de klantkaart blijft zoals hij is). */
export async function zetFactuurEmailActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const factuurId = String(formData.get('factuurId') ?? '').trim();
  // "Terugzetten naar het voorstel" stuurt het adres via de knop mee.
  const herstel = String(formData.get('herstel_email') ?? '').trim();
  const email = herstel || String(formData.get('factuur_email') ?? '').trim();
  if (!factuurId) redirect('/dashboard/facturen');
  if (email && !EMAIL_RE.test(email)) {
    redirect('/dashboard/facturen/' + factuurId + '?mailfout=' + encodeURIComponent('Dit is geen geldig e-mailadres.'));
  }
  const oud = await getFactuur(factuurId);
  const voor = oud?.factuur_email ?? null;
  const na = email || null;
  if (voor !== na) {
    await zetFactuurEmail(factuurId, na);
    await logAudit('factuur_email_gewijzigd', { entiteit: 'facturen', entiteitId: factuurId, details: { voor: { factuur_email: voor }, na: { factuur_email: na } } });
  }
  ververs(factuurId);
  redirect('/dashboard/facturen/' + factuurId + '?ok=adres');
}

/** Factuur naar de klant mailen op het ingevulde adres; dat adres wordt ook op de factuur bewaard. */
export async function mailFactuurKlantActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const factuurId = String(formData.get('factuurId') ?? '').trim();
  const email = String(formData.get('factuur_email') ?? '').trim();
  if (!factuurId) redirect('/dashboard/facturen');
  if (!email) redirect('/dashboard/facturen/' + factuurId + '?mailfout=' + encodeURIComponent('Vul eerst een e-mailadres in.'));
  // Eerst controleren, dan pas bewaren: een tikfout komt niet op de factuur te staan.
  if (!EMAIL_RE.test(email)) redirect('/dashboard/facturen/' + factuurId + '?mailfout=' + encodeURIComponent('Dit is geen geldig e-mailadres.'));
  const oud = await getFactuur(factuurId);
  if (!oud) redirect('/dashboard/facturen');
  if (oud.regels.length === 0) {
    redirect('/dashboard/facturen/' + factuurId + '?mailfout=' + encodeURIComponent('Deze factuur heeft nog geen regels. Voeg eerst een regel toe.'));
  }
  if ((oud.factuur_email ?? null) !== email) {
    await zetFactuurEmail(factuurId, email);
    await logAudit('factuur_email_gewijzigd', { entiteit: 'facturen', entiteitId: factuurId, details: { voor: { factuur_email: oud.factuur_email ?? null }, na: { factuur_email: email } } });
  }
  const r = await mailFactuurNaarKlant(factuurId, email);
  ververs(factuurId);
  if (!r.ok) redirect('/dashboard/facturen/' + factuurId + '?mailfout=' + encodeURIComponent(r.error ?? 'Versturen mislukt.'));
  await logAudit('factuur_gemaild_klant', { entiteit: 'facturen', entiteitId: factuurId, details: { naar: email, statusVoor: oud.status } });
  await naDefinitiefMaken(factuurId, oud.status);
  redirect('/dashboard/facturen/' + factuurId + '?ok=gemaild');
}
