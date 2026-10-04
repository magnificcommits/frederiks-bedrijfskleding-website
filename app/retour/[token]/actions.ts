'use server';

import { redirect } from 'next/navigation';
import { verwerkRetour, type RetourRegelKeuze } from '@/lib/retourportaal';

export async function meldRetourAan(formData: FormData) {
  // auth: token (verwerkRetour controleert het retourtoken: bestaat, niet verlopen, niet gebruikt).
  const token = String(formData.get('token') ?? '').slice(0, 100);
  const methode = String(formData.get('methode') ?? 'ophalen').slice(0, 40);
  const opmerking = String(formData.get('opmerking') ?? '').slice(0, 2000);

  // Per aangevinkte regel staan aantal en reden onder een sleutel met het regel-id erin.
  const keuzes: RetourRegelKeuze[] = [];
  for (const id of formData.getAll('regel').map(String).slice(0, 200)) {
    keuzes.push({
      orderregel_id: id,
      aantal: Number(formData.get(`aantal-${id}`) ?? 1),
      reden: String(formData.get(`reden-${id}`) ?? 'anders'),
    });
  }
  if (!token) redirect('/klantenservice/retourneren');
  if (!keuzes.length) redirect(`/retour/${token}?geenregels=1`);

  const res = await verwerkRetour(token, keuzes, methode, opmerking);
  redirect(res.ok ? `/retour/${token}?ok=1` : `/retour/${token}?fout=1`);
}
