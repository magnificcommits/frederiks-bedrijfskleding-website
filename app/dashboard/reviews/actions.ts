'use server';
import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { zetReviewInstellingen, zetReviewVlag } from '@/lib/reviews/reviews';
import { REVIEWS_TAG } from '@/lib/reviews/tag';

function terug(filter: string, melding: string): never {
  redirect(`/dashboard/reviews?filter=${encodeURIComponent(filter)}&melding=${encodeURIComponent(melding)}`);
}

/** Publiceren/uitlichten aan of uit. Leegt meteen de cache van de site. */
export async function zetReviewVlagActie(formData: FormData): Promise<void> {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const veld = formData.get('veld') === 'uitgelicht' ? 'uitgelicht' : 'gepubliceerd';
  const aan = formData.get('aan') === '1';
  const filter = String(formData.get('filter') ?? 'beantwoord');
  const res = await zetReviewVlag(id, veld, aan);
  if (res.ok) {
    await logAudit(`review_${veld}`, { entiteit: 'review', entiteitId: id, details: { aan } });
    revalidateTag(REVIEWS_TAG);
    revalidatePath('/dashboard/reviews');
  }
  terug(filter, res.ok ? 'opgeslagen' : res.fout ?? 'mislukt');
}

export async function zetReviewInstellingenActie(formData: FormData): Promise<void> {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const ok = await zetReviewInstellingen({
    actief: formData.get('actief') === 'on',
    wachtdagen: Number(formData.get('wachtdagen')),
    googleLink: String(formData.get('googleLink') ?? ''),
  });
  if (ok) await logAudit('reviews_instellingen', { entiteit: 'instellingen', entiteitId: 'reviews_instellingen' });
  revalidatePath('/dashboard/reviews');
  terug(String(formData.get('filter') ?? 'beantwoord'), ok ? 'instellingen' : 'mislukt');
}
