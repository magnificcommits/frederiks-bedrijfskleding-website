'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { logAudit, huidigeActor } from '@/lib/kms/audit';
import {
  annuleerInkooporder,
  bestelBijLeverancier,
  boekAllesOntvangen,
  boekOntvangst,
  maakInkooporders,
  markeerRegelsBesteld,
  regelUitInkooporder,
  verstuurInkooporder,
  werkInkooporder,
  zetInkoopGeleverd,
  zetInkoopStatus,
} from '@/lib/kms/inkoop';

function getalOfNull(raw: string): number | null {
  const s = raw.replace(/[^0-9.,-]/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const datumOfNull = (raw: FormDataEntryValue | null) => {
  const s = String(raw ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

function vernieuw(poId?: string | null) {
  revalidatePath('/dashboard/inkoop');
  revalidatePath('/dashboard/voorraad');
  if (poId) revalidatePath(`/dashboard/inkoop/${poId}`);
}

export async function markeerInkoop(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('inkoopId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!id || !status) redirect('/dashboard/inkoop');

  // Een levering: het aantal dat nu binnenkomt telt op bij wat er al was.
  // Zonder klantorder gaat het de voorraad in, met klantorder schuift de order op.
  if (status === 'geleverd' || status === 'deels') {
    if (formData.has('ontvangen_nu')) {
      const res = await boekOntvangst(id, getalOfNull(String(formData.get('ontvangen_nu') ?? '')), await huidigeActor());
      await logAudit('inkoop_ontvangst', {
        entiteit: 'inkoopregels',
        entiteitId: id,
        details: { geboekt: res.geboekt, status: res.status, naarVoorraad: res.naarVoorraad, klantorders: res.klantorders },
      });
      vernieuw();
      if (!res.ok) redirect('/dashboard/inkoop?tab=regels&ok=mislukt');
      redirect(`/dashboard/inkoop?tab=regels&ok=${res.status === 'deels' ? 'deels' : 'geleverd'}`);
    }
    const res = await zetInkoopGeleverd(id, getalOfNull(String(formData.get('geleverd_aantal') ?? '').trim()));
    await logAudit('inkoopregel_status', { entiteit: 'inkoopregels', entiteitId: id, details: { status: res.status, geleverd_aantal: res.geleverd } });
    if (!res.ok) redirect('/dashboard/inkoop?ok=mislukt');
    redirect(`/dashboard/inkoop?ok=${res.status === 'deels' ? 'deels' : 'geleverd'}`);
  }

  let besteldOp: string | null | undefined = undefined;
  if (status === 'besteld') besteldOp = new Date().toISOString().slice(0, 10);
  // Terugzetten naar de bestellijst wist ook de besteldatum en het geleverde aantal.
  if (status === 'te_bestellen') besteldOp = null;
  const gelukt = await zetInkoopStatus(id, status, besteldOp, status === 'te_bestellen' ? 0 : undefined);
  await logAudit('inkoopregel_status', { entiteit: 'inkoopregels', entiteitId: id, details: { status, gelukt } });
  vernieuw();
  if (!gelukt) redirect('/dashboard/inkoop?ok=mislukt');
  redirect(`/dashboard/inkoop?tab=regels&ok=${status === 'te_bestellen' ? 'terug' : 'bijgewerkt'}`);
}

/**
 * De aangevinkte regels van één inkooppartij in één keer op besteld zetten.
 * De checkboxes heten allemaal `regelId`, dus getAll levert de hele selectie.
 * De datalaag bundelt ze daarna in een inkooporder met status verstuurd.
 */
export async function markeerRegelsBesteldActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const ids = formData.getAll('regelId').map((v) => String(v).trim()).filter(Boolean);
  const partij = String(formData.get('partij') ?? '').trim();
  if (ids.length === 0) redirect('/dashboard/inkoop?ok=geen_selectie');

  const aantal = await markeerRegelsBesteld(ids);
  await logAudit('inkoopregels_besteld', {
    entiteit: 'inkoopregels',
    details: { inkooppartij: partij || null, aangevinkt: ids.length, bijgewerkt: aantal },
  });
  vernieuw();
  redirect(`/dashboard/inkoop?ok=afgevinkt&aantal=${aantal}`);
}

export async function bestelBijLeverancierActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const leverancierId = String(formData.get('leverancierId') ?? '').trim();
  if (!leverancierId) redirect('/dashboard/inkoop');
  const res = await bestelBijLeverancier(leverancierId);
  await logAudit('inkoop_besteld_bij_leverancier', {
    entiteit: 'leveranciers',
    entiteitId: leverancierId,
    details: { aantal: res.aantal, gemaild: res.gemaild, leverancier: res.leverancier },
  });
  vernieuw();
  redirect(`/dashboard/inkoop?ok=besteld&aantal=${res.aantal}&gemaild=${res.gemaild ? 1 : 0}`);
}

/**
 * Maak een concept-inkooporder van de aangevinkte regels. Niets aangevinkt?
 * Dan alle regels van deze inkooppartij (die staan als `alleRegelId` in het formulier).
 */
export async function maakInkooporderActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  let ids = formData.getAll('regelId').map((v) => String(v).trim()).filter(Boolean);
  if (ids.length === 0) ids = formData.getAll('alleRegelId').map((v) => String(v).trim()).filter(Boolean);
  if (ids.length === 0) redirect('/dashboard/inkoop?ok=geen_selectie');

  const res = await maakInkooporders(ids, { status: 'concept' });
  await logAudit('inkooporder_aangemaakt', { entiteit: 'inkooporders', entiteitId: res.ids[0], details: { regels: ids.length, orders: res.ids.length } });
  vernieuw();
  if (!res.klaar) redirect('/dashboard/inkoop?ok=migratie');
  if (res.ids.length === 1) redirect(`/dashboard/inkoop/${res.ids[0]}?melding=concept`);
  redirect(`/dashboard/inkoop?tab=orders&status=concept&ok=po_concept&aantal=${res.ids.length}`);
}

export async function verstuurInkooporderActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '').trim();
  const mail = String(formData.get('mail') ?? '') === '1';
  if (!id) redirect('/dashboard/inkoop?tab=orders');
  const res = await verstuurInkooporder(id, { mail });
  await logAudit('inkooporder_verstuurd', {
    entiteit: 'inkooporders',
    entiteitId: id,
    details: { mail, gemaild: res.gemaild, mailFout: res.mailFout, klantorders: res.klantorders },
  });
  vernieuw(id);
  if (!res.ok) redirect(`/dashboard/inkoop/${id}?melding=mislukt`);
  if (mail && !res.gemaild) redirect(`/dashboard/inkoop/${id}?melding=mail_niet`);
  redirect(`/dashboard/inkoop/${id}?melding=${mail ? 'gemaild' : 'verstuurd'}`);
}

export async function boekOntvangstActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const poId = String(formData.get('poId') ?? '').trim();
  const regelId = String(formData.get('regelId') ?? '').trim();
  const n = getalOfNull(String(formData.get('ontvangen_nu') ?? ''));
  const res = await boekOntvangst(regelId, n, await huidigeActor());
  await logAudit('inkoop_ontvangst', {
    entiteit: 'inkoopregels',
    entiteitId: regelId,
    details: { inkooporder: poId, geboekt: res.geboekt, status: res.status, naarVoorraad: res.naarVoorraad, klantorders: res.klantorders },
  });
  vernieuw(poId);
  const terug = poId ? `/dashboard/inkoop/${poId}` : '/dashboard/inkoop?tab=regels';
  const sep = terug.includes('?') ? '&' : '?';
  if (!res.ok) redirect(`${terug}${sep}melding=mislukt`);
  redirect(`${terug}${sep}melding=ontvangen&stuks=${res.geboekt}&voorraad=${res.naarVoorraad ? 1 : 0}&klant=${res.klantorders.length}`);
}

export async function boekAllesActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const poId = String(formData.get('poId') ?? '').trim();
  if (!poId) redirect('/dashboard/inkoop?tab=orders');
  const res = await boekAllesOntvangen(poId, await huidigeActor());
  await logAudit('inkoop_ontvangst_alles', { entiteit: 'inkooporders', entiteitId: poId, details: res });
  vernieuw(poId);
  redirect(`/dashboard/inkoop/${poId}?melding=alles&stuks=${res.stuks}`);
}

export async function werkInkooporderActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/dashboard/inkoop?tab=orders');
  const ok = await werkInkooporder(id, {
    verwacht_op: datumOfNull(formData.get('verwacht_op')),
    referentie: String(formData.get('referentie') ?? '').trim() || null,
    notitie: String(formData.get('notitie') ?? '').trim() || null,
  });
  vernieuw(id);
  redirect(`/dashboard/inkoop/${id}?melding=${ok ? 'opgeslagen' : 'mislukt'}`);
}

export async function annuleerInkooporderActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/dashboard/inkoop?tab=orders');
  const res = await annuleerInkooporder(id);
  await logAudit('inkooporder_geannuleerd', { entiteit: 'inkooporders', entiteitId: id, details: res });
  vernieuw(id);
  if (res.verwijderd) redirect(`/dashboard/inkoop?ok=po_weg&aantal=${res.terug}`);
  redirect(`/dashboard/inkoop/${id}?melding=${res.ok ? 'geannuleerd' : 'mislukt'}`);
}

export async function regelUitOrderActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const regelId = String(formData.get('regelId') ?? '').trim();
  const res = await regelUitInkooporder(regelId);
  vernieuw(res.poId);
  redirect(res.poId ? `/dashboard/inkoop/${res.poId}?melding=${res.ok ? 'regel_terug' : 'mislukt'}` : '/dashboard/inkoop');
}
