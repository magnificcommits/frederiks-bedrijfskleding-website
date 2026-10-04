'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { haalStatusOp, zetFactuurDoor, zetFacturenDoor } from '@/lib/kms/boekhouding';

/** Maximaal aantal facturen per klik op "Doorzetten" (Moneybird: 150 verzoeken per 5 minuten). */
const BULK_MAX = 25;

const detail = (id: string) => '/dashboard/facturen/' + id;

/** Eén factuur naar Moneybird (ook voor "Opnieuw proberen"). */
export async function naarMoneybirdActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const id = String(formData.get('factuurId') ?? '').trim();
  if (!id) redirect('/dashboard/facturen');
  const r = await zetFactuurDoor(id);
  revalidatePath('/dashboard/facturen');
  revalidatePath(detail(id));
  if (!r.ok) redirect(detail(id) + '?bkfout=' + encodeURIComponent(r.melding));
  await logAudit('factuur_naar_moneybird', { entiteit: 'facturen', entiteitId: id, details: { moneybirdId: r.moneybirdId } });
  redirect(detail(id) + '?bkok=' + encodeURIComponent(r.melding));
}

/** Betaalstatus van één factuur ophalen uit Moneybird. */
export async function statusOphalenActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const id = String(formData.get('factuurId') ?? '').trim();
  if (!id) redirect('/dashboard/facturen');
  const r = await haalStatusOp(id);
  revalidatePath('/dashboard/facturen');
  revalidatePath(detail(id));
  if (!r.ok) redirect(detail(id) + '?bkfout=' + encodeURIComponent(r.melding));
  redirect(detail(id) + '?bkok=' + encodeURIComponent(r.melding));
}

/** Bulkactie in de facturenlijst: geselecteerde facturen doorzetten. */
export async function bulkDoorzettenActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const alle = [...new Set(formData.getAll('factuur_ids').map(String).filter(Boolean))];
  if (alle.length === 0) redirect('/dashboard/facturen?mailfout=' + encodeURIComponent('Selecteer eerst een of meer facturen.'));
  const ids = alle.slice(0, BULK_MAX);
  const r = await zetFacturenDoor(ids);
  if (r.gelukt > 0) await logAudit('facturen_naar_moneybird', { entiteit: 'facturen', details: { aantal: r.gelukt, mislukt: r.mislukt } });
  revalidatePath('/dashboard/facturen');
  const delen: string[] = [];
  if (r.gelukt) delen.push(`${r.gelukt} ${r.gelukt === 1 ? 'factuur' : 'facturen'} doorgezet naar Moneybird.`);
  if (r.mislukt) delen.push(`${r.mislukt} niet gelukt: ${r.meldingen.join(' ')}`);
  if (alle.length > BULK_MAX) delen.push(`Er zijn er ${BULK_MAX} per keer verwerkt; selecteer de overige ${alle.length - BULK_MAX} opnieuw.`);
  const sleutel = r.mislukt ? 'mailfout' : 'melding';
  redirect(`/dashboard/facturen?${sleutel}=${encodeURIComponent(delen.join(' '))}`);
}
