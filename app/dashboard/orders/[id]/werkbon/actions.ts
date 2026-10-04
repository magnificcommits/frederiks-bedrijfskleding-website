'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import {
  WERKBON_STATUSSEN,
  maakDecoratie,
  verwijderDecoratie,
  volgOrderstatus,
  werkbonVoorOrder,
  zetWerkbon,
  type Techniek,
  type WerkbonStatus,
} from '@/lib/kms/logos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function vernieuw(orderId: string) {
  revalidatePath('/dashboard/orders/' + orderId + '/werkbon');
  revalidatePath('/dashboard/orders/' + orderId);
  revalidatePath('/dashboard/logos');
}

export async function voegDecoratieToe(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  const orderregelId = String(formData.get('orderregelId') ?? '').trim();
  const logoId = String(formData.get('logoId') ?? '').trim() || null;
  const techniekRuw = String(formData.get('techniek') ?? '').trim();
  const techniek: Techniek = techniekRuw === 'borduren' ? 'borduren' : 'bedrukken';
  const positie = String(formData.get('positie') ?? '').trim() || null;
  const afmeting = String(formData.get('afmeting') ?? '').trim() || null;
  const opmerkingen = String(formData.get('opmerkingen') ?? '').trim() || null;
  if (orderregelId) {
    await maakDecoratie(orderregelId, { logo_id: logoId, techniek, positie, afmeting, opmerkingen });
  }
  vernieuw(orderId);
  redirect('/dashboard/orders/' + orderId + '/werkbon');
}

export async function verwijderDecoratieActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  const decoratieId = String(formData.get('decoratieId') ?? '').trim();
  if (decoratieId) await verwijderDecoratie(decoratieId);
  vernieuw(orderId);
  redirect('/dashboard/orders/' + orderId + '/werkbon');
}

/**
 * Status, deadline en notitie van de werkbon. Een statuswissel neemt de
 * orderstatus mee (zie volgOrderstatus). Zonder tabel werkbonnen (migratie)
 * melden we dat in plaats van stil te falen.
 */
export async function werkWerkbonActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  if (!UUID.test(orderId)) redirect('/dashboard/logos');
  const terug = '/dashboard/orders/' + orderId + '/werkbon';

  const statusRuw = String(formData.get('status') ?? '').trim();
  const status = (WERKBON_STATUSSEN as readonly string[]).includes(statusRuw) ? (statusRuw as WerkbonStatus) : undefined;
  const deadlineRuw = String(formData.get('deadline') ?? '').trim();
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(deadlineRuw) ? deadlineRuw : null;
  const notitie = String(formData.get('notitie') ?? '').trim().slice(0, 1000) || null;

  const { kaart } = await werkbonVoorOrder(orderId);
  if (!kaart) redirect(terug + '?melding=mislukt');

  const opslag = await zetWerkbon(orderId, { status, deadline, notitie }, kaart.status);
  const order = status && status !== kaart.status ? await volgOrderstatus(orderId, status, kaart.technieken[0] ?? null) : null;
  if (opslag.ok || order) {
    await logAudit('werkbon_bijgewerkt', {
      entiteit: 'order',
      entiteitId: orderId,
      details: {
        voor: { status: kaart.status, deadline: kaart.deadline, notitie: kaart.notitie },
        na: { status: status ?? kaart.status, deadline, notitie },
        ...(order ? { orderstatus: order } : {}),
      },
    });
  }
  vernieuw(orderId);
  if (!opslag.ok) redirect(terug + '?melding=' + (opslag.tabelOntbreekt ? (order ? 'werkbon_tabel_order' : 'werkbon_tabel') : 'mislukt'));
  if (order) redirect(terug + '?melding=order_' + order.naar);
  redirect(terug + '?ok=opgeslagen');
}
