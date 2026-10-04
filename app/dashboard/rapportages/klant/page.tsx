import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';

export const dynamic = 'force-dynamic';

/** Doel van de klantkeuze op de rapportenpagina: door naar het rapport van die klant. */
export default async function KlantKiezen({ searchParams }: { searchParams: Promise<{ klant?: string; jaar?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { klant, jaar } = await searchParams;
  if (klant && /^[0-9a-f-]{36}$/i.test(klant)) {
    redirect(`/dashboard/rapportages/klant/${klant}${jaar && /^\d{4}$/.test(jaar) ? `?jaar=${jaar}` : ''}`);
  }
  redirect('/dashboard/rapportages');
}
