import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { getOfferte } from '@/lib/kms/offertes';
import PrintKnop from './PrintKnop';
import OfferteDocument, { naarDocumentData } from '@/components/dashboard/OfferteDocument';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Offerte afdrukken', robots: { index: false, follow: false } };

export default async function OfferteAfdrukPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;

  const offerte = await getOfferte(id);
  if (!offerte) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Offerte niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze offerte bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/offertes" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar offertes</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container-smal py-12">
      <style>{`@media print { .print\\:hidden { display: none !important; } #offerte-print { box-shadow: none !important; border: 0 !important; padding: 0 !important; margin: 0 !important; } body { background: #fff; } #offerte-print tr { break-inside: avoid; } @page { margin: 14mm; } }`}</style>

      <div className="print:hidden flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Offerte {offerte.offertenummer != null ? `#${offerte.offertenummer}` : 'concept'}</h1>
          <p className="mt-1 text-sm text-warm">{offerte.organisatie_naam || 'Geen klant gekoppeld'}</p>
        </div>
        <div className="flex items-center gap-3">
          <PrintKnop />
          <Link href={`/dashboard/offertes/${id}`} className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar offerte</Link>
        </div>
      </div>

      <section className="mt-8">
        <div id="offerte-print" className="panel p-8">
          {/* Zelfde component als het voorbeeld op de offertepagina. */}
          <OfferteDocument offerte={naarDocumentData(offerte)} />
        </div>
      </section>
    </main>
  );
}
