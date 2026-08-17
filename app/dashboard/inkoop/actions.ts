'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { zetInkoopStatus, zetInkoopGeleverd, bestelBijLeverancier, markeerRegelsBesteld } from '@/lib/kms/inkoop';

function getalOfNull(raw: string): number | null {
  const s = raw.replace(/[^0-9.,-]/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function markeerInkoop(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('inkoopId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!id || !status) redirect('/dashboard/inkoop');

  // Een levering loopt apart: het ingevulde aantal bepaalt of de regel compleet
  // is of dat er nog een restant openstaat. Alleen de datalaag kent het bestelde
  // aantal, dus die beslist over 'geleverd' of 'deels'.
  if (status === 'geleverd' || status === 'deels') {
    const res = await zetInkoopGeleverd(id, getalOfNull(String(formData.get('geleverd_aantal') ?? '').trim()));
    await logAudit('inkoopregel_status', {
      entiteit: 'inkoopregels',
      entiteitId: id,
      details: { status: res.status, geleverd_aantal: res.geleverd },
    });
    if (!res.ok) redirect('/dashboard/inkoop?ok=mislukt');
    redirect(`/dashboard/inkoop?ok=${res.status === 'deels' ? 'deels' : 'geleverd'}`);
  }

  let besteldOp: string | null | undefined = undefined;
  if (status === 'besteld') besteldOp = new Date().toISOString().slice(0, 10);
  // Terugzetten naar de bestellijst moet ook de besteldatum wissen, anders staat
  // er straks een regel op 'te bestellen' met een besteldatum van vorige week.
  if (status === 'te_bestellen') besteldOp = null;

  // Ook het geleverde aantal terug naar nul: een regel die weer besteld moet
  // worden, hoort niet te melden dat er al vier stuks binnen zijn.
  const gelukt = await zetInkoopStatus(id, status, besteldOp, status === 'te_bestellen' ? 0 : undefined);
  await logAudit('inkoopregel_status', {
    entiteit: 'inkoopregels',
    entiteitId: id,
    details: { status, gelukt },
  });
  if (!gelukt) redirect('/dashboard/inkoop?ok=mislukt');
  redirect(`/dashboard/inkoop?ok=${status === 'te_bestellen' ? 'terug' : 'bijgewerkt'}`);
}

/**
 * De aangevinkte regels van één inkooppartij in één keer op besteld zetten.
 * De checkboxes heten allemaal `regelId`, dus getAll levert de hele selectie.
 */
export async function markeerRegelsBesteldActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const ids = formData
    .getAll('regelId')
    .map((v) => String(v).trim())
    .filter(Boolean);
  const partij = String(formData.get('partij') ?? '').trim();
  if (ids.length === 0) redirect('/dashboard/inkoop?ok=geen_selectie');

  const aantal = await markeerRegelsBesteld(ids);
  await logAudit('inkoopregels_besteld', {
    entiteit: 'inkoopregels',
    details: { inkooppartij: partij || null, aangevinkt: ids.length, bijgewerkt: aantal },
  });
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
  redirect(`/dashboard/inkoop?ok=besteld&aantal=${res.aantal}&gemaild=${res.gemaild ? 1 : 0}`);
}
