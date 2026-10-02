import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listKlantenVoorOfferte } from '@/lib/kms/offertes';
import KlantContactKiezer from '../KlantContactKiezer';
import { maakOfferteActie } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nieuwe offerte', robots: { index: false, follow: false } };

const groot = 'veld py-2.5 text-[15px]';

/** Standaard geldigheid: 30 dagen vanaf vandaag. */
function over30Dagen(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

/**
 * Nieuwe offerte op een eigen, ruime pagina. Dit stond eerder in een smalle
 * lade waarin alleen een klein keuzeveld zichtbaar was. Hier kies je de klant
 * door te typen, daarna de contactpersoon uit de contactpersonen van die klant.
 * Met ?klant=<id> staat de klant al ingevuld (bijvoorbeeld vanaf de klantkaart).
 */
export default async function NieuweOffertePage({ searchParams }: { searchParams: Promise<{ klant?: string; fout?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { klant, fout } = await searchParams;
  if (!kmsAdmin()) redirect('/dashboard/offertes');

  const klanten = await listKlantenVoorOfferte();

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Nieuwe offerte</h1>
        <Link href="/dashboard/offertes" className="knop-tekst">Terug naar offertes</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Kies de klant en de contactpersoon. Na het aanmaken voeg je de artikelen toe.</p>

      {fout === 'aanmaken' && (
        <p className="mt-4 max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          De offerte kon niet worden aangemaakt. Probeer het nog een keer.
        </p>
      )}

      <form action={maakOfferteActie} className="panel mt-5 max-w-3xl space-y-6 p-6">
        <KlantContactKiezer klanten={klanten} beginKlantId={klant ?? ''} autoFocus />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="veld-label" htmlFor="geldig_tot">Geldig tot</label>
            <input id="geldig_tot" type="date" name="geldig_tot" defaultValue={over30Dagen()} className={groot} />
            <p className="veld-hint">Standaard 30 dagen. Pas aan als dat nodig is.</p>
          </div>
        </div>

        <div>
          <label className="veld-label" htmlFor="notitie">Notitie</label>
          <textarea
            id="notitie"
            name="notitie"
            rows={5}
            placeholder="Toelichting voor de klant, bijvoorbeeld levertijd of afspraken over bedrukking"
            className={groot}
          />
          <p className="veld-hint">Deze tekst staat onderaan de offerte die de klant krijgt.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <button type="submit" className="knop-primair px-5 py-2.5 text-[15px]">Offerte aanmaken</button>
          <Link href="/dashboard/offertes" className="knop-tekst">Annuleren</Link>
        </div>
      </form>
    </main>
  );
}
