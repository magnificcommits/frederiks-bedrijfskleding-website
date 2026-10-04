'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { logAudit, huidigeActor } from '@/lib/kms/audit';
import {
  MUTATIE_REDENEN,
  mutatiesVoorVariant,
  verwerkTelling,
  wijzigVariant,
  zetLocatie,
  zetVoorraadBijhouden,
  type Mutatie,
} from '@/lib/kms/voorraad';
import { maakBijbestelregels } from '@/lib/kms/inkoop';

function getal(ruw: string): number | null {
  const s = ruw.trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type WijzigAntwoord = { ok: boolean; melding?: string; gelogd?: boolean; nieuw?: number | null };

/**
 * Inline wijzigen vanuit de voorraadtabel. Geeft een antwoord terug in plaats
 * van te redirecten: zo blijven filters, scrollpositie en focus staan.
 */
export async function wijzigVoorraadActie(
  variantId: string,
  veld: 'voorraad' | 'min_voorraad',
  waarde: string,
  reden: string,
): Promise<WijzigAntwoord> {
  if (!(await dashAuthed())) return { ok: false, melding: 'Je bent uitgelogd. Log opnieuw in.' };
  const n = getal(waarde);
  if (veld === 'voorraad' && n === null) return { ok: false, melding: 'Vul een aantal in.' };
  if (n !== null && n < 0) return { ok: false, melding: 'Een negatief aantal kan niet.' };
  const soort = (MUTATIE_REDENEN as readonly string[]).includes(reden) ? reden : 'correctie';
  const actor = await huidigeActor();
  const res = await wijzigVariant(variantId, veld, n, soort, { actor });
  if (!res.ok) {
    return {
      ok: false,
      melding:
        res.fout === 'migratie'
          ? 'Minimum per maat kan pas na de databasemigratie van 4 oktober.'
          : 'Opslaan is niet gelukt. Probeer het nog een keer.',
    };
  }
  await logAudit('voorraad_gewijzigd', {
    entiteit: 'product_varianten',
    entiteitId: variantId,
    details: { veld, van: res.oud, naar: res.nieuw, reden: soort },
    actor,
  });
  revalidatePath('/dashboard/voorraad');
  return { ok: true, gelogd: res.gelogd, nieuw: res.nieuw };
}

export async function haalHistorieActie(variantId: string): Promise<{ mutaties: Mutatie[]; klaar: boolean }> {
  if (!(await dashAuthed())) return { mutaties: [], klaar: false };
  return mutatiesVoorVariant(variantId);
}

export async function zetLocatieActie(variantId: string, locatie: string): Promise<boolean> {
  if (!(await dashAuthed())) return false;
  const ok = await zetLocatie(variantId, locatie);
  if (ok) revalidatePath('/dashboard/voorraad');
  return ok;
}

export async function zetBijhoudenActie(
  variantIds: string[],
  waarde: boolean,
  niveau: 'variant' | 'product',
): Promise<{ ok: boolean; melding: string }> {
  if (!(await dashAuthed())) return { ok: false, melding: 'Je bent uitgelogd. Log opnieuw in.' };
  const res = await zetVoorraadBijhouden(variantIds, waarde, niveau === 'product' ? 'product' : 'variant');
  if (!res.ok) {
    return {
      ok: false,
      melding: res.fout === 'migratie' ? 'Dit kan pas na de databasemigratie van 4 oktober.' : 'Dat is niet gelukt.',
    };
  }
  await logAudit('voorraadartikel_ingesteld', {
    entiteit: niveau === 'product' ? 'producten' : 'product_varianten',
    details: { waarde, niveau, geselecteerd: variantIds.length, bijgewerkt: res.aantal },
  });
  revalidatePath('/dashboard/voorraad');
  const wat = niveau === 'product' ? (res.aantal === 1 ? '1 product' : `${res.aantal} producten`) : res.aantal === 1 ? '1 variant' : `${res.aantal} varianten`;
  return { ok: true, melding: waarde ? `${wat} staan nu als voorraadartikel.` : `${wat} worden niet meer op voorraad gehouden.` };
}

/** Bijbestellen voor een selectie, vanuit de balk boven de tabel. */
export async function bijbestellenSelectieActie(variantIds: string[]): Promise<{ ok: boolean; melding: string }> {
  if (!(await dashAuthed())) return { ok: false, melding: 'Je bent uitgelogd. Log opnieuw in.' };
  const res = await maakBijbestelregels(variantIds);
  await logAudit('voorraad_bijbesteld', { entiteit: 'inkoopregels', details: { ...res, selectie: variantIds.length } });
  revalidatePath('/dashboard/voorraad');
  revalidatePath('/dashboard/inkoop');
  if (res.regels === 0) return { ok: false, melding: 'Niets bij te bestellen: de selectie zit niet onder het minimum, of het staat al besteld.' };
  return { ok: true, melding: `${res.regels === 1 ? '1 regel' : `${res.regels} regels`} (${res.stuks} stuks) staan klaar bij Inkoop.` };
}

/** De knop "Bijbestellen" bovenaan: alles onder minimum naar de inkoop-werkvoorraad. */
export async function bijbestellenActie() {
  if (!(await dashAuthed())) redirect('/dashboard');
  const res = await maakBijbestelregels();
  await logAudit('voorraad_bijbesteld', { entiteit: 'inkoopregels', details: res });
  revalidatePath('/dashboard/inkoop');
  if (res.regels === 0) redirect('/dashboard/voorraad?melding=niets_bij');
  redirect(`/dashboard/inkoop?ok=bijbesteld&aantal=${res.regels}`);
}

/** Telling opslaan: alle ingevulde velden `t_<variantId>`. Lege velden zijn niet geteld. */
export async function verwerkTellingActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const terug = String(formData.get('terug') ?? '/dashboard/voorraad/telling');
  const tellingen: { variantId: string; geteld: number }[] = [];
  for (const [sleutel, waarde] of formData.entries()) {
    if (!sleutel.startsWith('t_')) continue;
    const n = getal(String(waarde));
    if (n === null || n < 0) continue;
    tellingen.push({ variantId: sleutel.slice(2), geteld: Math.round(n) });
  }
  const notitie = String(formData.get('notitie') ?? '').trim() || null;
  const veiligTerug = terug.startsWith('/dashboard/voorraad') ? terug : '/dashboard/voorraad/telling';
  const scheiding = veiligTerug.includes('?') ? '&' : '?';
  if (tellingen.length === 0) redirect(`${veiligTerug}${scheiding}melding=leeg`);

  const actor = await huidigeActor();
  const res = await verwerkTelling(tellingen, { notitie, actor });
  await logAudit('voorraad_telling', { entiteit: 'product_varianten', details: { ...res, notitie }, actor });
  revalidatePath('/dashboard/voorraad');
  redirect(`${veiligTerug}${scheiding}melding=geteld&geteld=${res.geteld}&gewijzigd=${res.gewijzigd}&mislukt=${res.mislukt}`);
}
