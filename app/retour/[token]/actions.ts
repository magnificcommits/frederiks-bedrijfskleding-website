'use server';

import { redirect } from 'next/navigation';
import { verwerkRetour, type RetourRegelKeuze } from '@/lib/retourportaal';

export async function meldRetourAan(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const methode = String(formData.get('methode') ?? 'ophalen');
  const opmerking = String(formData.get('opmerking') ?? '');

  // Per aangevinkte regel staan aantal en reden onder een sleutel met het regel-id erin.
  const keuzes: RetourRegelKeuze[] = [];
  for (const id of formData.getAll('regel').map(String)) {
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
