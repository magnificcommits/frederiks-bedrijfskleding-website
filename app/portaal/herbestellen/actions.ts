'use server';
import { redirect } from 'next/navigation';
import { getPortaalUser, getMijnOrganisatie, getKledinglijn, maakBestelling } from '@/lib/portaal/queries';

export async function vraagHerbestelling(formData: FormData) {
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');

  const org = await getMijnOrganisatie();
  if (!org) redirect('/portaal');

  const items = await getKledinglijn();
  const notitie = String(formData.get('notitie') ?? '').trim();

  const regels = items
    .map((i) => {
      const aantal = Number(formData.get(`aantal_${i.id}`) ?? 0);
      const maat = String(formData.get(`maat_${i.id}`) ?? '').trim();
      return { item_naam: i.naam, kledinglijn_item_id: i.id, maat, aantal };
    })
    .filter((r) => Number.isFinite(r.aantal) && r.aantal > 0);

  if (regels.length === 0) {
    redirect('/portaal/herbestellen?leeg=1');
  }

  const res = await maakBestelling(org.id, user.email ?? user.id, notitie, regels);
  if (!res.ok) {
    redirect('/portaal/herbestellen?fout=1');
  }

  redirect('/portaal/bestellingen?ok=1');
}
