import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { formatEuro, formatGetal } from '@/lib/format';
import {
  medewerkersPerBedrijf,
  stuksPerMaand,
  omzetPerMaand,
  kerncijfersAnalyse,
  type GroeiCijfers,
} from '@/lib/kms/analytics';
import Grafieken from './Grafieken';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analyse', robots: { index: false, follow: false } };

function GroeiPijl({ groei, soort }: { groei: GroeiCijfers; soort: 'stuks' | 'omzet' }) {
  const vgl = groei.vorigeMaand;
  if (vgl.groeiPct === null) {
    return <span className="text-xs font-semibold text-warm">geen vergelijking</span>;
  }
  const omhoog = vgl.verschil >= 0;
  const cls = omhoog ? 'text-green-700' : 'text-red-600';
  const pijl = omhoog ? '▲' : '▼';
  return (
    <span className={`inline-flex items-baseline gap-1 text-xs font-semibold ${cls}`}>
      <span aria-hidden>{pijl}</span>
      <span>{Math.abs(vgl.groeiPct).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}%</span>
      <span className="font-normal text-warm">t.o.v. vorige maand</span>
    </span>
  );
}

export default async function AnalysePage() {
  if (!(await dashAuthed())) redirect('/dashboard');
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">
            Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai
            de migraties in <code>supabase/migrations</code>.
          </p>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">
            Terug naar dashboard
          </Link>
        </div>
      </main>
    );
  }

  const [cijfers, perBedrijf, stuks, omzet] = await Promise.all([
    kerncijfersAnalyse(),
    medewerkersPerBedrijf(),
    stuksPerMaand(12),
    omzetPerMaand(12),
  ]);

  const maxBedrijf = Math.max(1, ...perBedrijf.lijst.map((b) => b.aantal));

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Analyse</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">
          Terug naar dashboard
        </Link>
      </div>
      <p className="mt-2 text-sm text-warm">
        Cijfers en trends. Live berekend uit medewerkers, orders en facturen. Groei is t.o.v. de vorige maand;
        wissel in de grafieken naar jaar-op-jaar.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-warm">Totaal medewerkers</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{formatGetal(cijfers.totaalMedewerkers)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-warm">Totaal bedrijven</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{formatGetal(cijfers.totaalBedrijven)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-warm">Stuks deze maand</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{formatGetal(cijfers.stuks.huidig)}</p>
          <p className="mt-1">
            <GroeiPijl groei={cijfers.stuks} soort="stuks" />
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-warm">Omzet deze maand</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{formatEuro(cijfers.omzet.huidig, 0)}</p>
          <p className="mt-1">
            <GroeiPijl groei={cijfers.omzet} soort="omzet" />
          </p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink-900">Medewerkers per bedrijf</h2>
        <p className="mt-1 text-sm text-warm">Aantal medewerkers per organisatie, hoogste eerst.</p>
        {perBedrijf.lijst.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen medewerkers.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                <tr>
                  <th className="px-4 py-3">Bedrijf</th>
                  <th className="px-4 py-3">Verdeling</th>
                  <th className="px-4 py-3 text-right">Medewerkers</th>
                </tr>
              </thead>
              <tbody>
                {perBedrijf.lijst.map((b) => (
                  <tr key={b.organisatie} className="border-b border-line">
                    <td className="px-4 py-3 font-semibold text-ink-900">{b.organisatie}</td>
                    <td className="px-4 py-3">
                      <span className="block h-2.5 w-full max-w-xs rounded-full bg-mist">
                        <span
                          className="block h-2.5 rounded-full bg-amber-600"
                          style={{ width: `${Math.round((b.aantal / maxBedrijf) * 100)}%` }}
                        />
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-ink-900">{formatGetal(b.aantal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-mist">
                  <td className="px-4 py-3 font-semibold text-ink-900">Totaal</td>
                  <td className="px-4 py-3" />
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-ink-900">
                    {formatGetal(perBedrijf.totaal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink-900">Trends</h2>
        <p className="mt-1 text-sm text-warm">Laatste 12 maanden verkochte stuks en betaalde omzet.</p>
        <div className="mt-4">
          <Grafieken
            stuksPerMaand={stuks}
            omzetPerMaand={omzet}
            stuksGroei={cijfers.stuks}
            omzetGroei={cijfers.omzet}
          />
        </div>
      </section>
    </main>
  );
}
