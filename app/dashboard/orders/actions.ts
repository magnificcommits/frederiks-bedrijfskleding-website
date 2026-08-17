'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { maakOrder, zetOrderStatus, type OrderVelden } from '@/lib/kms/orders';

/** Leeg veld = niet ingevuld; die laten we uit de insert zodat de kolom leeg blijft. */
function tekstOfNull(formData: FormData, veld: string): string | null {
  return String(formData.get(veld) ?? '').trim() || null;
}

/**
 * De terugkeer-URL komt uit een verborgen veld en gaat rechtstreeks naar
 * redirect(). Alleen een pad binnen de orderlijst toelaten, zodat een
 * aangepast formulier Jessi niet naar een vreemde site kan sturen.
 */
function veiligTerug(ruw: FormDataEntryValue | null): string {
  const pad = String(ruw ?? '').trim();
  return pad.startsWith('/dashboard/orders') ? pad : '/dashboard/orders';
}

export async function nieuweOrder(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const organisatie_id = String(formData.get('organisatie_id') ?? '').trim();
  if (!organisatie_id) redirect('/dashboard/orders/nieuw?fout=geen-klant');

  const velden: OrderVelden = { organisatie_id };
  const medewerker_id = tekstOfNull(formData, 'medewerker_id');
  const afdeling_id = tekstOfNull(formData, 'afdeling_id');
  const vestiging_id = tekstOfNull(formData, 'vestiging_id');
  const besteldatum = tekstOfNull(formData, 'besteldatum');
  const referentienr = tekstOfNull(formData, 'referentienr');
  const aangevraagd_door = tekstOfNull(formData, 'aangevraagd_door');
  const notitie = tekstOfNull(formData, 'notitie');
  const interne_notitie = tekstOfNull(formData, 'interne_notitie');

  // Alleen ingevulde velden meesturen. Een sleutel met null zet de kolom
  // expliciet leeg en dat willen we hier niet; weglaten laat de standaard staan.
  if (medewerker_id) velden.medewerker_id = medewerker_id;
  if (afdeling_id) velden.afdeling_id = afdeling_id;
  if (vestiging_id) velden.vestiging_id = vestiging_id;
  if (besteldatum) velden.besteldatum = besteldatum;
  if (referentienr) velden.referentienr = referentienr;
  if (aangevraagd_door) velden.aangevraagd_door = aangevraagd_door;
  if (notitie) velden.notitie = notitie;
  if (interne_notitie) velden.interne_notitie = interne_notitie;

  const id = await maakOrder(velden);
  if (!id) redirect('/dashboard/orders/nieuw?fout=opslaan');
  await logAudit('order_aangemaakt', { entiteit: 'order', entiteitId: id, details: { organisatie_id } });
  redirect(`/dashboard/orders/${id}?ok=aangemaakt`);
}

/**
 * Inline statuswijziging vanaf de orderslijst. Hergebruikt dezelfde
 * `zetOrderStatus`-helper als de detailpagina (die ook de statusmail verstuurt),
 * maar blijft op de lijst staan via revalidatePath i.p.v. een redirect.
 * De huidige status- en paginafilter worden meegestuurd zodat de lijst na het
 * opslaan op dezelfde plek blijft.
 */
export async function wijzigOrderStatusInline(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (orderId && status) {
    await zetOrderStatus(orderId, status);
    await logAudit('order_status', { entiteit: 'order', entiteitId: orderId, details: { status } });
  }
  revalidatePath('/dashboard/orders');
  const terug = veiligTerug(formData.get('terug'));
  redirect(`${terug}${terug.includes('?') ? '&' : '?'}ok=status`);
}

/** Bulk-statuswijziging voor alle aangevinkte orders in één keer. */
export async function bulkOrderStatusActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const ids = formData.getAll('order_ids').map((v) => String(v).trim()).filter(Boolean);
  const status = String(formData.get('bulk_status') ?? '').trim();
  const terug = veiligTerug(formData.get('terug'));
  if (ids.length && status) {
    for (const id of ids) await zetOrderStatus(id, status);
    await logAudit('order_status_bulk', { entiteit: 'order', details: { status, aantal: ids.length } });
  }
  revalidatePath('/dashboard/orders');
  redirect(`${terug}${terug.includes('?') ? '&' : '?'}ok=status`);
}
