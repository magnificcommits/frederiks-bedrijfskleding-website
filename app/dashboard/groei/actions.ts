'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import {
  maakMarketingActie,
  werkMarketingActieBij,
  verwijderMarketingActie,
  leesCategorie,
  leesEigenaar,
  leesKpi,
  leesPrioriteit,
  leesStatus,
  type ActieInvoer,
} from '@/lib/kms/groei';

const tekst = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const datum = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function terug(f: FormData, melding?: string): never {
  const q = tekst(f, 'terug');
  const p = new URLSearchParams(q.startsWith('?') ? q.slice(1) : q);
  if (melding) p.set('melding', melding); else p.delete('melding');
  revalidatePath('/dashboard/groei');
  redirect(`/dashboard/groei${p.toString() ? `?${p}` : ''}`);
}

function invoer(f: FormData): ActieInvoer {
  return {
    titel: tekst(f, 'titel').slice(0, 200),
    omschrijving: tekst(f, 'omschrijving') || null,
    categorie: leesCategorie(tekst(f, 'categorie')),
    eigenaar: leesEigenaar(tekst(f, 'eigenaar')),
    prioriteit: leesPrioriteit(tekst(f, 'prioriteit')),
    status: leesStatus(tekst(f, 'status')),
    deadline: datum(tekst(f, 'deadline')),
    kpi: leesKpi(tekst(f, 'kpi')),
    notities: tekst(f, 'notities') || null,
  };
}

export async function nieuweActieActie(f: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const v = invoer(f);
  if (!v.titel) terug(f, 'Geef de actie een titel.');
  const id = await maakMarketingActie(v);
  if (id) await logAudit('marketing_actie_aangemaakt', { entiteit: 'marketing_actie', entiteitId: id, details: { titel: v.titel } });
  terug(f, id ? 'Actie toegevoegd.' : 'Toevoegen is niet gelukt.');
}

/** Volledig bewerken vanuit het venster. */
export async function bewaarActieActie(f: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(f, 'id');
  const v = invoer(f);
  if (!v.titel) terug(f, 'Een actie heeft een titel nodig.');
  const ok = await werkMarketingActieBij(id, v);
  if (ok) await logAudit('marketing_actie_gewijzigd', { entiteit: 'marketing_actie', entiteitId: id, details: { titel: v.titel, status: v.status } });
  terug(f, ok ? 'Opgeslagen.' : 'Opslaan is niet gelukt.');
}

/** Snel één veld wijzigen vanuit de lijst (status, eigenaar). */
export async function snelActieActie(f: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(f, 'id');
  const velden: Partial<ActieInvoer> = {};
  if (f.has('status')) velden.status = leesStatus(tekst(f, 'status'));
  if (f.has('eigenaar')) velden.eigenaar = leesEigenaar(tekst(f, 'eigenaar'));
  const ok = await werkMarketingActieBij(id, velden);
  if (ok) await logAudit('marketing_actie_gewijzigd', { entiteit: 'marketing_actie', entiteitId: id, details: velden });
  terug(f);
}

export async function verwijderActieActie(f: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = tekst(f, 'id');
  const ok = await verwijderMarketingActie(id);
  if (ok) await logAudit('marketing_actie_verwijderd', { entiteit: 'marketing_actie', entiteitId: id, details: { titel: tekst(f, 'titel') } });
  terug(f, ok ? 'Actie verwijderd.' : 'Verwijderen is niet gelukt.');
}
