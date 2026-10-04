'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, eisEigenaar, getHuidigeAdmin } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { bewaarCampagneInstellingen, bewaarFlow, markeerGereageerd, stopInschrijving, zetCampagneStatus } from '@/lib/kms/campagnes';
import { schrijfContactenIn, zoekKandidaten } from '@/lib/kms/campagneContacten';
import { getCampagneInstellingen } from '@/lib/kms/campagneInstellingen';
import { verstuurTestmail, voorbeeldMailHtml } from '@/lib/kms/campagneTest';
import { DOELGROEPEN, type Doelgroep } from '@/lib/campagnes/flow';

async function eis(): Promise<boolean> {
  if (!(await dashAuthed())) return false;
  await eisEigenaar();
  return true;
}

const pad = (id: string, tab?: string) => `/dashboard/campagnes/${id}${tab ? `?tab=${tab}` : ''}`;

/* Flowbouwer (aangeroepen vanuit de client, geeft een uitkomst terug) ---- */

export async function bewaarFlowActie(campagneId: string, flow: unknown): Promise<{ ok: boolean; fout?: string }> {
  if (!(await eis())) return { ok: false, fout: 'Je bent niet (meer) ingelogd.' };
  const res = await bewaarFlow(campagneId, flow);
  if (!res.ok) return { ok: false, fout: res.fout };
  await logAudit('campagne_flow_opgeslagen', { entiteit: 'campagnes', entiteitId: campagneId });
  revalidatePath(pad(campagneId));
  return { ok: true };
}

export async function testmailActie(campagneId: string, knoop: unknown): Promise<{ ok: boolean; melding: string }> {
  if (!(await eis())) return { ok: false, melding: 'Je bent niet (meer) ingelogd.' };
  const inst = await getCampagneInstellingen();
  let naar = inst.testadres;
  if (!naar) naar = (await getHuidigeAdmin().catch(() => null))?.email ?? '';
  const res = await verstuurTestmail(campagneId, knoop, naar);
  await logAudit('campagne_testmail', { entiteit: 'campagnes', entiteitId: campagneId, details: { naar, ok: res.ok } });
  return res;
}

export async function voorbeeldActie(campagneId: string, knoop: unknown): Promise<{ ok: boolean; html?: string; onderwerp?: string; fout?: string }> {
  if (!(await eis())) return { ok: false, fout: 'Je bent niet (meer) ingelogd.' };
  return voorbeeldMailHtml(campagneId, knoop);
}

/* Formulieren ---------------------------------------------------------- */

export async function wijzigStatusActie(formData: FormData) {
  if (!(await eis())) redirect('/dashboard');
  const id = String(formData.get('campagneId') ?? '');
  const status = String(formData.get('status') ?? '');
  const tab = String(formData.get('tab') ?? '');
  const res = await zetCampagneStatus(id, status);
  if (!res.ok) redirect(`${pad(id, tab)}${tab ? '&' : '?'}melding=${encodeURIComponent(res.fout ?? 'Niet gelukt.')}`);
  await logAudit('campagne_status_gewijzigd', { entiteit: 'campagnes', entiteitId: id, details: { status } });
  redirect(`${pad(id, tab)}${tab ? '&' : '?'}ok=status`);
}

export async function bewaarInstellingenActie(formData: FormData) {
  if (!(await eis())) redirect('/dashboard');
  const id = String(formData.get('campagneId') ?? '');
  let trigger: unknown = {};
  let doel: unknown = {};
  try {
    trigger = JSON.parse(String(formData.get('trigger') ?? '{}'));
    doel = JSON.parse(String(formData.get('doel') ?? '{}'));
  } catch {
    // Kapotte invoer: normaliseren maakt er de standaard van.
  }
  const res = await bewaarCampagneInstellingen(id, {
    naam: String(formData.get('naam') ?? ''),
    omschrijving: String(formData.get('omschrijving') ?? ''),
    van_naam: String(formData.get('van_naam') ?? ''),
    van_email: String(formData.get('van_email') ?? ''),
    doelgroep: String(formData.get('doelgroep') ?? 'prospect'),
    trigger,
    doel,
  });
  await logAudit('campagne_instellingen_gewijzigd', { entiteit: 'campagnes', entiteitId: id, details: { ok: res.ok } });
  if (!res.ok || res.fout) redirect(`${pad(id, 'instellingen')}&melding=${encodeURIComponent(res.fout ?? 'Opslaan mislukt.')}`);
  redirect(`${pad(id, 'instellingen')}&ok=opgeslagen`);
}

function filtersUit(formData: FormData) {
  const doelgroep = String(formData.get('doelgroep') ?? 'prospect');
  return {
    doelgroep: ((DOELGROEPEN as readonly string[]).includes(doelgroep) ? doelgroep : 'prospect') as Doelgroep,
    filters: {
      status: String(formData.get('f_status') ?? '').trim() || undefined,
      branche: String(formData.get('f_branche') ?? '').trim() || undefined,
      plaats: String(formData.get('f_plaats') ?? '').trim() || undefined,
      bron: String(formData.get('f_bron') ?? '').trim() || undefined,
      q: String(formData.get('f_q') ?? '').trim() || undefined,
    },
  };
}

export async function schrijfInActie(formData: FormData) {
  if (!(await eis())) redirect('/dashboard');
  const id = String(formData.get('campagneId') ?? '');
  const { doelgroep, filters } = filtersUit(formData);
  const gekozen = formData.getAll('contact').map(String).filter(Boolean);
  let kandidaten = await zoekKandidaten(doelgroep, filters, 2000);
  if (gekozen.length) {
    const set = new Set(gekozen);
    kandidaten = kandidaten.filter((k) => set.has(k.id));
  }
  const res = await schrijfContactenIn(id, kandidaten, { bron: 'handmatig' });
  await logAudit('campagne_ingeschreven', { entiteit: 'campagnes', entiteitId: id, details: { doelgroep, filters, ...res } });
  const delen = [`${res.nieuw} ingeschreven`];
  if (res.alIngeschreven) delen.push(`${res.alIngeschreven} zaten er al in`);
  if (res.afgemeld) delen.push(`${res.afgemeld} overgeslagen (afgemeld)`);
  if (res.fout) delen.push(res.fout);
  redirect(`${pad(id, 'ontvangers')}&melding=${encodeURIComponent(delen.join(', ') + '.')}`);
}

export async function stopOntvangerActie(formData: FormData) {
  if (!(await eis())) redirect('/dashboard');
  const id = String(formData.get('campagneId') ?? '');
  const insId = String(formData.get('inschrijvingId') ?? '');
  const terug = String(formData.get('terug') ?? '');
  if (insId) {
    await stopInschrijving(insId);
    await logAudit('campagne_ontvanger_gestopt', { entiteit: 'campagnes', entiteitId: id, details: { inschrijving: insId } });
  }
  redirect(terug.startsWith('/dashboard/campagnes/') ? terug : pad(id, 'ontvangers'));
}

export async function gereageerdActie(formData: FormData) {
  if (!(await eis())) redirect('/dashboard');
  const id = String(formData.get('campagneId') ?? '');
  const insId = String(formData.get('inschrijvingId') ?? '');
  const terug = String(formData.get('terug') ?? '');
  const res = insId ? await markeerGereageerd(insId) : { ok: false, fout: 'Geen ontvanger.' };
  await logAudit('campagne_ontvanger_gereageerd', { entiteit: 'campagnes', entiteitId: id, details: { inschrijving: insId } });
  const doel = terug.startsWith('/dashboard/campagnes/') ? terug : pad(id, 'ontvangers');
  if (!res.ok) redirect(`${doel}${doel.includes('?') ? '&' : '?'}melding=${encodeURIComponent(res.fout ?? 'Niet gelukt.')}`);
  redirect(doel);
}
