'use server';
import { redirect } from 'next/navigation';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { meldKlacht, reageerOpKlacht, type KlachtSoort } from '@/lib/portaal/service';

export async function vraagKlacht(formData: FormData) {
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const org = await getMijnOrganisatie();
  if (!org) redirect('/portaal');

  const orderId = String(formData.get('order_id') ?? '').trim() || null;
  const soortRuw = String(formData.get('soort') ?? '').trim();
  const soort: KlachtSoort = soortRuw === 'klacht' ? 'klacht' : 'vraag';
  const omschrijving = String(formData.get('omschrijving') ?? '').trim();
  const categorie = String(formData.get('categorie') ?? '').trim() || null;
  if (!omschrijving) redirect('/portaal/klachten?leeg=1');

  const res = await meldKlacht({ orderId, soort, omschrijving, categorie });
  if (!res.ok) redirect('/portaal/klachten?fout=1');
  redirect('/portaal/klachten?ok=1');
}

export async function reageerKlacht(formData: FormData) {
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const org = await getMijnOrganisatie();
  if (!org) redirect('/portaal');

  const klachtId = String(formData.get('klacht_id') ?? '').trim();
  const tekst = String(formData.get('tekst') ?? '').trim();
  if (!klachtId || !tekst) redirect('/portaal/klachten?leeg=1');
  const res = await reageerOpKlacht(klachtId, tekst);
  if (!res.ok) redirect('/portaal/klachten?fout=1');
  redirect('/portaal/klachten?gereageerd=1');
}
