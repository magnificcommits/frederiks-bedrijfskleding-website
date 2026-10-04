import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { getOfferte } from '@/lib/kms/offertes';
import { klantAdresVoorDocument } from '@/lib/kms/documentKlant';
import PrintKnop from './PrintKnop';
import OfferteDocument, { naarDocumentData } from '@/components/dashboard/OfferteDocument';
import { DOCUMENT_ID, DocumentAfdrukStijl } from '@/components/dashboard/DocumentOnderdelen';

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

  const klantAdres = await klantAdresVoorDocument(offerte.organisatie_id);
  const titel = `Offerte ${offerte.offertenummer != null ? offerte.offertenummer : 'concept'}`;

  return (
    <div className="min-h-screen bg-ink-100 px-4 py-8">
      <DocumentAfdrukStijl voetLabel={`${titel} · Frederiks Bedrijfskleding`} />

      <div className="mx-auto flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="dash-h1">{titel}</h1>
          <p className="mt-1 text-sm text-warm">{offerte.organisatie_naam || 'Geen klant gekoppeld'}</p>
        </div>
        <div className="flex items-center gap-3">
          <PrintKnop />
          <Link href={`/dashboard/offertes/${id}`} className="knop-tekst">Terug naar offerte</Link>
        </div>
      </div>
      <p className="mx-auto mt-2 w-full max-w-[210mm] text-[12px] text-warm print:hidden">
        Tip: kies in het afdrukvenster &quot;Opslaan als PDF&quot; en zet &quot;Kop- en voetteksten&quot; uit.
      </p>

      {/* Een vel A4 op ware grootte. Zelfde component als het voorbeeld op de offertepagina. */}
      <article id={DOCUMENT_ID} className="mx-auto mt-5 w-[210mm] max-w-full bg-white p-[14mm] shadow-card">
        <OfferteDocument offerte={{ ...naarDocumentData(offerte), klant_adres: klantAdres }} />
      </article>
    </div>
  );
}
