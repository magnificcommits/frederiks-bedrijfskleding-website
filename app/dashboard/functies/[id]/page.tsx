import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { getFunctie } from '@/lib/kms/functies';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Functie', robots: { index: false, follow: false } };

/**
 * Functies zijn opgegaan in afdelingen bij de klant. Een oude link naar een
 * functie gaat daarom naar het tabblad Afdelingen van die klant.
 */
export default async function FunctieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;
  const functie = await getFunctie(id);
  if (functie?.organisatie_id) redirect(`/dashboard/klanten/${functie.organisatie_id}?tab=afdelingen`);
  redirect('/dashboard/functies');
}
