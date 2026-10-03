'use server';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import {
  maakTaak,
  werkTaakBij,
  vinkTaak,
  getTaak,
  verwijderTaak,
  herstelTaak,
  archiveerTaak,
  verwijderTaakDefinitief,
  leegPrullenbak,
  takenV2Actief,
  type Taak,
  type TaakVelden,
} from '@/lib/kms/taken';
import { logAudit } from '@/lib/kms/audit';

/**
 * Server actions van de takenpagina. Alle acties worden vanuit de client
 * aangeroepen (popup, inline bewerken, toast "Ongedaan maken") en geven een
 * resultaat terug in plaats van te redirecten.
 */

export type TaakResultaat = { ok: true; taak: Taak | null; volgende?: Taak | null } | { ok: false; fout: string };
export type ActieResultaat = { ok: true } | { ok: false; fout: string };

const PAD = '/dashboard/taken';
const NIET_INGELOGD = 'Je bent niet meer ingelogd. Ververs de pagina.';
const UUID = /^[0-9a-f-]{36}$/i;

function vernieuw() {
  revalidatePath(PAD);
  revalidatePath('/dashboard');
}

/** Alleen bekende velden doorlaten. */
const TOEGESTAAN: (keyof TaakVelden)[] = [
  'titel',
  'organisatie_id',
  'omschrijving',
  'vervaldatum',
  'persoon_id',
  'soort',
  'tijd',
  'eind_tijd',
  'locatie',
  'werkstatus',
  'prioriteit',
  'herinnering_minuten',
  'herinnering_op',
  'herhaling',
];

function schoonVelden(velden: unknown): TaakVelden {
  const schoon: Record<string, unknown> = {};
  if (!velden || typeof velden !== 'object') return schoon;
  for (const k of TOEGESTAAN) {
    if (k in (velden as Record<string, unknown>)) schoon[k] = (velden as Record<string, unknown>)[k];
  }
  return schoon as TaakVelden;
}

async function metVolgende(id: string, volgendeId: string | null | undefined): Promise<TaakResultaat> {
  const [taak, volgende] = await Promise.all([getTaak(id), volgendeId ? getTaak(volgendeId) : Promise.resolve(null)]);
  return { ok: true, taak, volgende };
}

/** Eén of meer velden van een taak wijzigen (inline in de lijst). */
export async function werkTaakBijActie(id: string, velden: TaakVelden): Promise<TaakResultaat> {
  if (!(await dashAuthed())) return { ok: false, fout: NIET_INGELOGD };
  const schoonId = String(id ?? '').trim();
  if (!UUID.test(schoonId)) return { ok: false, fout: 'Taak niet gevonden.' };

  const res = await werkTaakBij(schoonId, schoonVelden(velden));
  if (!res.ok) return { ok: false, fout: res.fout ?? 'Opslaan is niet gelukt.' };
  if (res.na && Object.keys(res.na).length) {
    await logAudit('taak_bijgewerkt', { entiteit: 'taak', entiteitId: schoonId, details: { voor: res.voor ?? {}, na: res.na } });
    if (res.volgendeId) {
      await logAudit('taak_herhaald', { entiteit: 'taak', entiteitId: res.volgendeId, details: { vorige: schoonId } });
    }
    vernieuw();
  }
  return metVolgende(schoonId, res.volgendeId);
}

/** Afvinken (afgerond) of weer openzetten. */
export async function vinkTaakActie(id: string, klaar: boolean): Promise<TaakResultaat> {
  if (!(await dashAuthed())) return { ok: false, fout: NIET_INGELOGD };
  const schoonId = String(id ?? '').trim();
  if (!UUID.test(schoonId)) return { ok: false, fout: 'Taak niet gevonden.' };
  const res = await vinkTaak(schoonId, Boolean(klaar));
  if (!res.ok) return { ok: false, fout: res.fout ?? 'Opslaan is niet gelukt.' };
  if (res.na && Object.keys(res.na).length) {
    await logAudit(klaar ? 'taak_afgerond' : 'taak_heropend', { entiteit: 'taak', entiteitId: schoonId, details: { voor: res.voor ?? {}, na: res.na } });
    if (res.volgendeId) await logAudit('taak_herhaald', { entiteit: 'taak', entiteitId: res.volgendeId, details: { vorige: schoonId } });
    vernieuw();
  }
  return metVolgende(schoonId, res.volgendeId);
}

/** Opslaan vanuit de popup: nieuw (id = null) of bestaand. */
export async function bewaarTaakActie(id: string | null, invoer: TaakVelden): Promise<TaakResultaat> {
  if (!(await dashAuthed())) return { ok: false, fout: NIET_INGELOGD };
  const velden = schoonVelden(invoer);

  if (!id) {
    const titel = String(velden.titel ?? '').trim();
    if (!titel) return { ok: false, fout: 'Kies een klant of vul een onderwerp in.' };
    const res = await maakTaak({ ...velden, titel });
    if ('fout' in res) return { ok: false, fout: res.fout };
    const afspraak = velden.soort === 'afspraak';
    await logAudit(afspraak ? 'afspraak_aangemaakt' : 'taak_aangemaakt', {
      entiteit: 'taak',
      entiteitId: res.id,
      details: { titel, soort: afspraak ? 'afspraak' : 'taak', datum: velden.vervaldatum ?? null },
    });
    vernieuw();
    return { ok: true, taak: await getTaak(res.id) };
  }

  return werkTaakBijActie(id, velden);
}

/** Naar de prullenbak (ongedaan te maken met herstelTaakActie). */
export async function verwijderTaakActie(id: string): Promise<TaakResultaat> {
  if (!(await dashAuthed())) return { ok: false, fout: NIET_INGELOGD };
  const schoonId = String(id ?? '').trim();
  const taak = await getTaak(schoonId);
  if (!taak) return { ok: false, fout: 'Taak niet gevonden.' };
  if (!(await takenV2Actief())) return { ok: false, fout: 'De prullenbak is nog niet ingesteld (migratie ontbreekt).' };
  if (!(await verwijderTaak(schoonId))) return { ok: false, fout: 'Verwijderen is niet gelukt.' };
  await logAudit('taak_verwijderd', { entiteit: 'taak', entiteitId: schoonId, details: { titel: taak.titel, naar: 'prullenbak' } });
  vernieuw();
  return { ok: true, taak: null };
}

export async function herstelTaakActie(id: string): Promise<TaakResultaat> {
  if (!(await dashAuthed())) return { ok: false, fout: NIET_INGELOGD };
  const schoonId = String(id ?? '').trim();
  if (!(await herstelTaak(schoonId))) return { ok: false, fout: 'Terugzetten is niet gelukt.' };
  await logAudit('taak_hersteld', { entiteit: 'taak', entiteitId: schoonId });
  vernieuw();
  return { ok: true, taak: await getTaak(schoonId) };
}

export async function archiveerTaakActie(id: string, archiveren: boolean): Promise<TaakResultaat> {
  if (!(await dashAuthed())) return { ok: false, fout: NIET_INGELOGD };
  const schoonId = String(id ?? '').trim();
  if (!(await takenV2Actief())) return { ok: false, fout: 'Het archief is nog niet ingesteld (migratie ontbreekt).' };
  if (!(await archiveerTaak(schoonId, Boolean(archiveren)))) return { ok: false, fout: 'Opslaan is niet gelukt.' };
  await logAudit(archiveren ? 'taak_gearchiveerd' : 'taak_uit_archief', { entiteit: 'taak', entiteitId: schoonId });
  vernieuw();
  return { ok: true, taak: await getTaak(schoonId) };
}

export async function verwijderDefinitiefActie(id: string): Promise<ActieResultaat> {
  if (!(await dashAuthed())) return { ok: false, fout: NIET_INGELOGD };
  const schoonId = String(id ?? '').trim();
  const taak = await getTaak(schoonId);
  if (!(await verwijderTaakDefinitief(schoonId))) return { ok: false, fout: 'Definitief verwijderen is niet gelukt.' };
  await logAudit('taak_definitief_verwijderd', { entiteit: 'taak', entiteitId: schoonId, details: { titel: taak?.titel ?? null, bron: taak?.bron ?? null } });
  vernieuw();
  return { ok: true };
}

export async function leegPrullenbakActie(): Promise<ActieResultaat & { aantal?: number }> {
  if (!(await dashAuthed())) return { ok: false, fout: NIET_INGELOGD };
  const r = await leegPrullenbak(null);
  await logAudit('prullenbak_geleegd', { entiteit: 'taak', details: { verwijderd: r.verwijderd, gearchiveerd: r.gearchiveerd } });
  vernieuw();
  return { ok: true, aantal: r.verwijderd + r.gearchiveerd };
}
