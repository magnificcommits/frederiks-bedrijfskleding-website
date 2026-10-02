'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import {
  maakTaak,
  zetTaakStatus,
  zetTaakWerkstatus,
  verwijderTaak,
  werkTaakBij,
  getTaak,
  type Taak,
  type TaakVelden,
} from '@/lib/kms/taken';
import { logAudit } from '@/lib/kms/audit';

export type TaakResultaat = { ok: true; taak: Taak | null } | { ok: false; fout: string };

const PAD = '/dashboard/taken';

/* ---------- Inline bewerken vanuit de tabel (aangeroepen vanuit de client) ---------- */

/** Eén of meer velden van een taak wijzigen (één cel in de tabel). */
export async function werkTaakBijActie(id: string, velden: TaakVelden): Promise<TaakResultaat> {
  if (!(await dashAuthed())) return { ok: false, fout: 'Je bent niet meer ingelogd. Ververs de pagina.' };
  const schoonId = String(id ?? '').trim();
  if (!schoonId) return { ok: false, fout: 'Taak niet gevonden.' };

  // Alleen bekende velden doorlaten.
  const toegestaan: (keyof TaakVelden)[] = [
    'titel',
    'organisatie_id',
    'omschrijving',
    'vervaldatum',
    'toegewezen_aan',
    'soort',
    'tijd',
    'werkstatus',
  ];
  const schoon: TaakVelden = {};
  for (const k of toegestaan) {
    if (velden && k in velden) (schoon as Record<string, unknown>)[k] = (velden as Record<string, unknown>)[k];
  }

  const res = await werkTaakBij(schoonId, schoon);
  if (!res.ok) return { ok: false, fout: res.fout ?? 'Opslaan is niet gelukt.' };
  if (res.na && Object.keys(res.na).length) {
    await logAudit('taak_bijgewerkt', {
      entiteit: 'taak',
      entiteitId: schoonId,
      details: { voor: res.voor ?? {}, na: res.na },
    });
    revalidatePath(PAD);
  }
  return { ok: true, taak: await getTaak(schoonId) };
}

/** Afvinken (Afgerond) of weer openzetten. */
export async function vinkTaakActie(id: string, klaar: boolean): Promise<TaakResultaat> {
  return werkTaakBijActie(id, { werkstatus: klaar ? 'Afgerond' : 'Niet gestart' });
}

/** Snel een taak of afspraak toevoegen via de lege rij onderaan de tabel. */
export async function maakSnelleTaakActie(input: {
  titel: string;
  organisatie_id?: string | null;
  omschrijving?: string | null;
  vervaldatum?: string | null;
  toegewezen_aan?: string | null;
  soort?: string | null;
  tijd?: string | null;
  werkstatus?: string | null;
}): Promise<TaakResultaat> {
  if (!(await dashAuthed())) return { ok: false, fout: 'Je bent niet meer ingelogd. Ververs de pagina.' };
  const titel = String(input?.titel ?? '').trim();
  if (!titel) return { ok: false, fout: 'Vul eerst een klant of onderwerp in.' };

  const id = await maakTaak({
    titel,
    organisatie_id: input.organisatie_id ?? null,
    omschrijving: input.omschrijving ?? null,
    vervaldatum: input.vervaldatum ?? null,
    toegewezen_aan: input.toegewezen_aan ?? null,
    soort: input.soort ?? 'taak',
    tijd: input.tijd ?? null,
    werkstatus: input.werkstatus ?? 'Niet gestart',
  });
  if (!id) return { ok: false, fout: 'Toevoegen is niet gelukt. Probeer het nog eens.' };

  await logAudit(input.soort === 'afspraak' ? 'afspraak_aangemaakt' : 'taak_aangemaakt', {
    entiteit: 'taak',
    entiteitId: id,
    details: { titel, soort: input.soort === 'afspraak' ? 'afspraak' : 'taak' },
  });
  revalidatePath(PAD);
  return { ok: true, taak: await getTaak(id) };
}

/**
 * Taak verwijderen. Automatische taken (uit een order of portaalbestelling)
 * zouden bij de volgende keer laden terugkomen; die ronden we daarom af.
 */
export async function verwijderTaakInlineActie(id: string): Promise<TaakResultaat> {
  if (!(await dashAuthed())) return { ok: false, fout: 'Je bent niet meer ingelogd. Ververs de pagina.' };
  const schoonId = String(id ?? '').trim();
  const taak = await getTaak(schoonId);
  if (!taak) return { ok: false, fout: 'Taak niet gevonden.' };

  if (taak.bron !== 'handmatig') {
    return werkTaakBijActie(schoonId, { werkstatus: 'Afgerond' });
  }
  const gelukt = await verwijderTaak(schoonId);
  if (!gelukt) return { ok: false, fout: 'Verwijderen is niet gelukt.' };
  await logAudit('taak_verwijderd', { entiteit: 'taak', entiteitId: schoonId, details: { titel: taak.titel } });
  revalidatePath(PAD);
  return { ok: true, taak: null };
}

/* ---------- Bestaande formulier-acties (blijven werken) ---------- */

export async function maakTaakActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const titel = String(formData.get('titel') ?? '').trim();
  if (!titel) redirect('/dashboard/taken?ok=geen_titel');

  const id = await maakTaak({
    titel,
    omschrijving: String(formData.get('omschrijving') ?? ''),
    organisatie_id: String(formData.get('organisatie_id') ?? '') || null,
    prioriteit: String(formData.get('prioriteit') ?? 'normaal'),
    werkstatus: String(formData.get('werkstatus') ?? ''),
    vervaldatum: String(formData.get('vervaldatum') ?? '') || null,
    toegewezen_aan: String(formData.get('toegewezen_aan') ?? '') || null,
    soort: String(formData.get('soort') ?? 'taak'),
    tijd: String(formData.get('tijd') ?? '') || null,
  });

  await logAudit('taak_aangemaakt', { entiteit: 'taak', entiteitId: id ?? undefined, details: { titel } });
  revalidatePath(PAD);
  redirect('/dashboard/taken?ok=aangemaakt');
}

export async function zetTaakStatusActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('status') ?? '') === 'klaar' ? 'klaar' : 'open';

  await zetTaakStatus(id, status);
  await logAudit('taak_status_gewijzigd', {
    entiteit: 'taak',
    entiteitId: id,
    details: { na: { status } },
  });
  revalidatePath(PAD);
  redirect(`/dashboard/taken?ok=${status === 'klaar' ? 'afgerond' : 'heropend'}`);
}

export async function zetTaakWerkstatusActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '').trim();
  const werkstatus = String(formData.get('werkstatus') ?? '');

  const gelukt = await zetTaakWerkstatus(id, werkstatus);
  if (gelukt) {
    await logAudit('taak_werkstatus_gewijzigd', {
      entiteit: 'taak',
      entiteitId: id,
      details: { na: { werkstatus } },
    });
  }
  revalidatePath(PAD);
  redirect(`/dashboard/taken?ok=${gelukt ? 'stap' : 'geen_stap'}`);
}

export async function verwijderTaakActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '').trim();

  await verwijderTaak(id);
  await logAudit('taak_verwijderd', { entiteit: 'taak', entiteitId: id });
  revalidatePath(PAD);
  redirect('/dashboard/taken?ok=verwijderd');
}
