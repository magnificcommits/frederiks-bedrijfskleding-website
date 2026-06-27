'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { zetInkoopStatus, bestelBijLeverancier } from '@/lib/kms/inkoop';

function getalOfNull(raw: string): number | null {
  const s = raw.replace(/[^0-9.,-]/g, '').replace(',', '.');
  return s === '' ? null : Number(s);
}

export async function markeerInkoop(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('inkoopId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!id || !status) redirect('/dashboard/inkoop');

  let besteldOp: string | null | undefined = undefined;
  if (status === 'besteld') besteldOp = new Date().toISOString().slice(0, 10);

  let geleverdAantal: number | null | undefined = undefined;
  const ga = String(formData.get('geleverd_aantal') ?? '').trim();
  if (status === 'geleverd' || status === 'deels') geleverdAantal = getalOfNull(ga);

  await zetInkoopStatus(id, status, besteldOp, geleverdAantal);
  redirect('/dashboard/inkoop');
}

export async function bestelBijLeverancierActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const leverancierId = String(formData.get('leverancierId') ?? '').trim();
  if (!leverancierId) redirect('/dashboard/inkoop');
  const res = await bestelBijLeverancier(leverancierId);
  redirect(`/dashboard/inkoop?ok=besteld&aantal=${res.aantal}&gemaild=${res.gemaild ? 1 : 0}`);
}
