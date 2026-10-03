'use server';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { logAudit, logWijziging } from '@/lib/kms/audit';
import {
  maakTaakPersoon,
  werkTaakPersoonBij,
  verwijderTaakPersoon,
  vernieuwAgendaToken,
  getTaakPersoon,
  type PersoonVelden,
} from '@/lib/kms/taakPersonen';
import {
  maakTaakStatus,
  hernoemTaakStatus,
  zetTaakStatusKleur,
  zetTaakStatusGroep,
  verschuifTaakStatus,
  zetTaakStatusActief,
  verwijderTaakStatus,
  getTaakStatus,
} from '@/lib/kms/taakStatussen';

/** Beheer van personen en statussen (Taken → Instellingen). Alle acties geven een resultaat terug. */

export type Resultaat = { ok: true; melding?: string } | { ok: false; fout: string };

const NIET_INGELOGD = 'Je bent niet meer ingelogd. Ververs de pagina.';
const UUID = /^[0-9a-f-]{36}$/i;

function vernieuw() {
  revalidatePath('/dashboard/taken');
  revalidatePath('/dashboard/taken/instellingen');
}

async function toegang(id?: string): Promise<string | null> {
  if (!(await dashAuthed())) return NIET_INGELOGD;
  if (id !== undefined && !UUID.test(String(id))) return 'Niet gevonden.';
  return null;
}

/* ---------- Personen ---------- */

export async function maakPersoonActie(invoer: { naam: string; email?: string; kleur?: string }): Promise<Resultaat> {
  const fout = await toegang();
  if (fout) return { ok: false, fout };
  const res = await maakTaakPersoon({ naam: invoer?.naam, email: invoer?.email ?? null, kleur: invoer?.kleur });
  if (!res.ok) return res;
  await logAudit('taakpersoon_aangemaakt', { entiteit: 'taak_persoon', entiteitId: res.id, details: { naam: invoer.naam } });
  vernieuw();
  return { ok: true, melding: `${String(invoer.naam).trim()} toegevoegd.` };
}

export async function werkPersoonBijActie(id: string, velden: PersoonVelden): Promise<Resultaat> {
  const fout = await toegang(id);
  if (fout) return { ok: false, fout };
  const schoon: PersoonVelden = {};
  for (const k of ['naam', 'email', 'kleur', 'actief', 'dagoverzicht', 'weekoverzicht', 'ook_zonder_persoon'] as const) {
    if (velden && k in velden) (schoon as Record<string, unknown>)[k] = velden[k];
  }
  const res = await werkTaakPersoonBij(id, schoon);
  if (!res.ok) return res;
  await logWijziging('taakpersoon_bijgewerkt', { entiteit: 'taak_persoon', entiteitId: id, voor: res.voor, na: res.na });
  vernieuw();
  return { ok: true };
}

export async function verwijderPersoonActie(id: string): Promise<Resultaat> {
  const fout = await toegang(id);
  if (fout) return { ok: false, fout };
  const p = await getTaakPersoon(id);
  const res = await verwijderTaakPersoon(id);
  if (!res.ok) return res;
  await logAudit('taakpersoon_verwijderd', { entiteit: 'taak_persoon', entiteitId: id, details: { naam: p?.naam ?? null } });
  vernieuw();
  return { ok: true, melding: 'Verwijderd.' };
}

export async function vernieuwAgendaLinkActie(id: string): Promise<Resultaat> {
  const fout = await toegang(id);
  if (fout) return { ok: false, fout };
  const res = await vernieuwAgendaToken(id);
  if (!res.ok) return res;
  await logAudit('taakpersoon_agendalink_vernieuwd', { entiteit: 'taak_persoon', entiteitId: id });
  vernieuw();
  return { ok: true, melding: 'Nieuwe link gemaakt. De oude werkt niet meer.' };
}

/* ---------- Statussen ---------- */

export async function maakStatusActie(invoer: { naam: string; kleur?: string; groep?: string }): Promise<Resultaat> {
  const fout = await toegang();
  if (fout) return { ok: false, fout };
  const res = await maakTaakStatus(invoer ?? { naam: '' });
  if (!res.ok) return res;
  await logAudit('taakstatus_aangemaakt', { entiteit: 'taak_status', entiteitId: res.id, details: { ...invoer } });
  vernieuw();
  return { ok: true, melding: 'Status toegevoegd.' };
}

export async function hernoemStatusActie(id: string, naam: string): Promise<Resultaat> {
  const fout = await toegang(id);
  if (fout) return { ok: false, fout };
  const res = await hernoemTaakStatus(id, naam);
  if (!res.ok) return res;
  if (res.oud) {
    await logWijziging('taakstatus_hernoemd', {
      entiteit: 'taak_status',
      entiteitId: id,
      voor: { naam: res.oud },
      na: { naam: String(naam).trim() },
      extra: { takenBijgewerkt: res.aantal ?? 0 },
    });
  }
  vernieuw();
  const n = res.aantal ?? 0;
  return { ok: true, melding: n ? `Hernoemd. ${n} ${n === 1 ? 'taak is' : 'taken zijn'} meteen bijgewerkt.` : 'Hernoemd.' };
}

export async function zetStatusKleurActie(id: string, kleur: string): Promise<Resultaat> {
  const fout = await toegang(id);
  if (fout) return { ok: false, fout };
  const voor = await getTaakStatus(id);
  const res = await zetTaakStatusKleur(id, kleur);
  if (!res.ok) return res;
  await logWijziging('taakstatus_bijgewerkt', { entiteit: 'taak_status', entiteitId: id, voor: { kleur: voor?.kleur }, na: { kleur } });
  vernieuw();
  return { ok: true };
}

export async function zetStatusGroepActie(id: string, groep: string): Promise<Resultaat> {
  const fout = await toegang(id);
  if (fout) return { ok: false, fout };
  const voor = await getTaakStatus(id);
  const res = await zetTaakStatusGroep(id, groep);
  if (!res.ok) return res;
  await logWijziging('taakstatus_bijgewerkt', { entiteit: 'taak_status', entiteitId: id, voor: { groep: voor?.groep }, na: { groep } });
  vernieuw();
  return { ok: true };
}

export async function verschuifStatusActie(id: string, richting: -1 | 1): Promise<Resultaat> {
  const fout = await toegang(id);
  if (fout) return { ok: false, fout };
  const res = await verschuifTaakStatus(id, richting === -1 ? -1 : 1);
  if (!res.ok) return res;
  await logAudit('taakstatus_verplaatst', { entiteit: 'taak_status', entiteitId: id, details: { richting } });
  vernieuw();
  return { ok: true };
}

export async function zetStatusActiefActie(id: string, actief: boolean): Promise<Resultaat> {
  const fout = await toegang(id);
  if (fout) return { ok: false, fout };
  const res = await zetTaakStatusActief(id, Boolean(actief));
  if (!res.ok) return res;
  await logWijziging('taakstatus_bijgewerkt', { entiteit: 'taak_status', entiteitId: id, voor: { actief: !actief }, na: { actief } });
  vernieuw();
  return { ok: true };
}

export async function verwijderStatusActie(id: string): Promise<Resultaat> {
  const fout = await toegang(id);
  if (fout) return { ok: false, fout };
  const voor = await getTaakStatus(id);
  const res = await verwijderTaakStatus(id);
  if (!res.ok) return res;
  await logAudit('taakstatus_verwijderd', { entiteit: 'taak_status', entiteitId: id, details: { naam: voor?.naam ?? null } });
  vernieuw();
  return { ok: true, melding: 'Status verwijderd.' };
}
