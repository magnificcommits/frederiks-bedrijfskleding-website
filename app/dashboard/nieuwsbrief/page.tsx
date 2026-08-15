import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { formatDatum, formatGetal } from '@/lib/format';
import { listInschrijvingen } from '@/lib/kms/nieuwsbrief';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nieuwsbrief', robots: { index: false, follow: false } };

export default async function NieuwsbriefPage() {
  if (!(await dashAuthed())) redirect('/dashboard');

  const inschrijvingen = await listInschrijvingen();

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Nieuwsbrief</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">
        Inschrijvingen via het formulier in de footer.{' '}
        <span className="font-semibold text-ink-900">{formatGetal(inschrijvingen.length)}</span>
        {inschrijvingen.length === 1 ? ' inschrijving' : ' inschrijvingen'}.
      </p>

      {inschrijvingen.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">
          Er zijn nog geen inschrijvingen. Zodra bezoekers zich via de footer inschrijven, verschijnen ze hier.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto panel">
          <table className="tbl">
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Naam</th>
                <th>Bron</th>
                <th>Datum</th>
              </tr>
            </thead>
            <tbody>
              {inschrijvingen.map((r) => (
                <tr key={r.id} className="border-b border-line">
                  <td className="text-ink-900">{r.email}</td>
                  <td className="text-warm">{r.naam || '-'}</td>
                  <td className="text-warm">{r.bron || '-'}</td>
                  <td className="whitespace-nowrap text-warm">{formatDatum(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
