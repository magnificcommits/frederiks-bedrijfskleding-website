'use server';
import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { logWijziging } from '@/lib/kms/audit';
import { getPrijsInstellingen, zetPrijsInstellingen, PRIJS_TAG } from '@/lib/kms/prijsindicatieData';

export async function zetPrijsActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const getal = (k: string, std: number, min: number, max: number) => {
    const n = Number(String(formData.get(k) ?? '').replace(',', '.'));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std;
  };
  const vorig = await getPrijsInstellingen();
  const nieuw = {
    aan: formData.get('aan') === 'on',
    korting: Math.round(getal('korting', vorig.korting, 0, 60) * 10) / 10,
    teamAantal: Math.round(getal('team', vorig.teamAantal, 1, 500)),
  };
  if (!(await zetPrijsInstellingen(nieuw))) redirect('/dashboard/instellingen/prijzen?fout=1');
  await logWijziging('prijsindicatie_gewijzigd', { entiteit: 'instellingen', voor: vorig, na: nieuw });
  revalidateTag(PRIJS_TAG);
  revalidatePath('/', 'layout');
  redirect('/dashboard/instellingen/prijzen?ok=1');
}
