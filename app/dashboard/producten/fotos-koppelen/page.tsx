import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import FotosKoppelen from './FotosKoppelen';
import FhbOphalen from './FhbOphalen';
import FotoLinks from './FotoLinks';

export const dynamic = 'force-dynamic';
export const metadata = { title: "Foto's koppelen", robots: { index: false, follow: false } };

export default async function FotosKoppelenPage() {
  if (!(await dashAuthed())) redirect('/dashboard');

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Foto&apos;s koppelen</h1>
        <Link href="/dashboard/producten" className="knop-tekst">Terug naar producten</Link>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-warm">
        FHB-kleurfoto&apos;s haal je met één klik op. Foto&apos;s van andere merken sleep je hier in, zonder ze te hernoemen. Het systeem leest artikel en kleur
        uit de bestandsnaam (bijvoorbeeld <code>Konrad_91490_1220_front.jpg</code>), slaat achterkanten over en verkleint de foto&apos;s
        voordat ze worden opgeslagen. Controleer de lijst en klik op Koppelen.
      </p>
      {kmsAdmin() ? (
        <>
          <FhbOphalen />
          <FotoLinks />
          <h2 className="mt-8 text-base font-bold text-ink-900">Zelf foto&apos;s koppelen</h2>
          <FotosKoppelen />
        </>
      ) : (
        <p className="mt-3 text-sm text-warm">De database is nog niet gekoppeld.</p>
      )}
    </main>
  );
}
