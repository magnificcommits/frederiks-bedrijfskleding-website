import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { keuzesVoorNieuweOrder } from '@/lib/kms/orders';
import NieuweOrderFormulier from './NieuweOrderFormulier';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nieuwe order', robots: { index: false, follow: false } };

/**
 * De datum van vandaag als jjjj-mm-dd voor het datumveld.
 *
 * De server draait op UTC; met toISOString() zou een order die 's avonds na
 * tienen wordt aangemaakt de datum van morgen krijgen. Daarom expliciet de
 * Nederlandse tijdzone.
 */
function vandaagInNederland(): string {
  const delen = new Intl.DateTimeFormat('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const waarde = (soort: string) => delen.find((d) => d.type === soort)?.value ?? '';
  return `${waarde('year')}-${waarde('month')}-${waarde('day')}`;
}

const foutBoodschap: Record<string, string> = {
  'geen-klant': 'Kies eerst een klant, anders weet de order niet bij wie hij hoort.',
  opslaan: 'Opslaan is niet gelukt. Probeer het opnieuw of controleer de databaseverbinding.',
};

export default async function NieuweOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ fout?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { fout } = await searchParams;
  const keuzes = await keuzesVoorNieuweOrder();
  const vandaag = vandaagInNederland();

  return (
    <main className="container-app py-6">
      <div className="dash-kop justify-between gap-4">
        <h1 className="dash-h1">Nieuwe order</h1>
        <Link href="/dashboard/orders" className="text-sm font-semibold text-warm hover:text-ink-800">
          Terug naar orders
        </Link>
      </div>

      {fout && foutBoodschap[fout] && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {foutBoodschap[fout]}
        </p>
      )}

      {/* Formulier krijgt de volle werkbreedte; het spoor rechts legt de volgorde uit. */}
      <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <NieuweOrderFormulier keuzes={keuzes} vandaag={vandaag} />
        </div>

        <aside className="panel p-5 lg:sticky lg:top-16">
          <h2 className="font-display text-base font-bold text-ink-900">Hoe het verder gaat</h2>
          <ol className="mt-3 space-y-2.5 text-[13px] leading-snug text-warm">
            <li>
              <span className="font-semibold text-ink-900">1. Order aanmaken.</span> De order krijgt status concept en
              een eigen ordernummer.
            </li>
            <li>
              <span className="font-semibold text-ink-900">2. Regels toevoegen.</span> Op de orderpagina kies je het
              artikel en daarna de kleur en de maat.
            </li>
            <li>
              <span className="font-semibold text-ink-900">3. Status bijwerken.</span> Zet de order op offerte
              verstuurd of nog bestellen zodra dat aan de orde is.
            </li>
          </ol>
          <p className="mt-4 border-t border-line pt-3 text-[12px] text-warm">
            Alleen de klant is verplicht. Al het andere kun je later nog aanvullen.
          </p>
        </aside>
      </div>
    </main>
  );
}
