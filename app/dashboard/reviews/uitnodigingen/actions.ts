'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { slaUitnodigingenOver, verstuurUitnodigingen, voegUitnodigingToe } from '@/lib/reviews/uitnodigingen';

function terug(melding: string): never {
  redirect(`/dashboard/reviews/uitnodigingen?melding=${encodeURIComponent(melding)}`);
}

const ids = (fd: FormData) => fd.getAll('id').map(String);

export async function verstuurActie(fd: FormData): Promise<void> {
  if (!(await dashAuthed())) redirect('/dashboard');
  const gekozen = ids(fd);
  if (!gekozen.length) terug('niets');
  const r = await verstuurUitnodigingen(gekozen);
  await logAudit('review_uitnodigingen_verstuurd', { entiteit: 'review_uitnodiging', details: { ...r, aantal: gekozen.length } });
  revalidatePath('/dashboard/reviews/uitnodigingen');
  if (r.geenLink) terug('geenlink');
  terug(r.mislukt ? `deels:${r.verstuurd}:${r.mislukt}` : `verstuurd:${r.verstuurd}`);
}

export async function overslaanActie(fd: FormData): Promise<void> {
  if (!(await dashAuthed())) redirect('/dashboard');
  const n = await slaUitnodigingenOver(ids(fd));
  await logAudit('review_uitnodigingen_overgeslagen', { entiteit: 'review_uitnodiging', details: { aantal: n } });
  revalidatePath('/dashboard/reviews/uitnodigingen');
  terug(`overgeslagen:${n}`);
}

export async function toevoegenActie(fd: FormData): Promise<void> {
  if (!(await dashAuthed())) redirect('/dashboard');
  const r = await voegUitnodigingToe(String(fd.get('organisatie_id') ?? ''));
  revalidatePath('/dashboard/reviews/uitnodigingen');
  terug(r.ok ? 'toegevoegd' : `fout:${r.fout ?? 'mislukt'}`);
}
