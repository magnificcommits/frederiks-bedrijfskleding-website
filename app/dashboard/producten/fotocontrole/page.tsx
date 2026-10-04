import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { listFotoControle } from '@/lib/kms/afbeeldingen';
import FotoControle from './FotoControle';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fotocontrole', robots: { index: false, follow: false } };

export default async function FotoControlePage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { filter } = await searchParams;

  if (!kmsAdmin()) {
    return (
      <main className="container-app py-6">
        <h1 className="dash-h1">Fotocontrole</h1>
        <p className="mt-3 text-sm text-warm">De database is nog niet gekoppeld.</p>
      </main>
    );
  }

  const { fotos, ontbrekend, opslaan } = await listFotoControle();

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Fotocontrole</h1>
        <Link href="/dashboard/producten" className="knop-tekst">Terug naar producten</Link>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-warm">
        Elke productfoto wordt in je browser geladen en gemeten: pixels, verhouding, bestandsgrootte, scherpte en hoeveel witte
        rand er om het product zit. Afwijkingen staan bovenaan. Een foto die je hier ziet als &lsquo;mogelijk wazig&rsquo; is een
        schatting; kijk hem even op volle grootte na.
      </p>
      {!opslaan && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900">
          Metingen worden nog niet bewaard (migratie <code>20261004_varianten_en_fotocontrole</code> ontbreekt). Elke keer dat je
          deze pagina opent, wordt alles opnieuw gemeten.
        </p>
      )}
      <FotoControle fotos={fotos} ontbrekend={ontbrekend} opslaan={opslaan} beginFilter={filter ?? ''} />
    </main>
  );
}
