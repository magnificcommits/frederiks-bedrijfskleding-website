import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { portaalOverzicht } from '@/lib/kms/crm';
import PaginaKop from '@/components/dashboard/ui/PaginaKop';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Portaalgebruik', robots: { index: false, follow: false } };

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null);

function Tegel({ waarde, label, sub }: { waarde: string | number; label: string; sub?: string }) {
  return (
    <div className="panel p-4">
      <p className="font-display text-2xl font-extrabold tabular-nums text-ink-900">{waarde}</p>
      <p className="text-[12px] font-semibold text-ink-700">{label}</p>
      {sub && <p className="text-[11px] text-warm">{sub}</p>}
    </div>
  );
}

/** Welke klanten het portaal gebruiken: logins per rol, wie ooit inlogde, laatste inlog, activiteit. */
export default async function PortaalgebruikPage() {
  if (!(await dashAuthed())) redirect('/dashboard');
  const alle = await portaalOverzicht();
  const rijen = alle.filter((r) => !r.isDemo);
  const dertig = Date.now() - 30 * 86_400_000;
  const actief = rijen.filter((r) => r.laatsteLogin && new Date(r.laatsteLogin).getTime() >= dertig).length;
  const nooit = rijen.filter((r) => r.ooitIngelogd === 0).length;
  const logins = rijen.reduce((s, r) => s + r.logins, 0);

  return (
    <main className="container-app py-6">
      <PaginaKop
        titel="Portaalgebruik"
        sub="Welke klanten het portaal gebruiken, met hoeveel accounts, en wie er echt inlogt. Klik op een klant voor de details en de activiteit."
        acties={<Link href="/dashboard/klanten" className="knop-stil">Naar klanten</Link>}
      />

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tegel waarde={rijen.length} label="Klanten met portaaltoegang" />
        <Tegel waarde={logins} label="Accounts in totaal" sub="werkgevers, leidinggevenden en werknemers" />
        <Tegel waarde={actief} label="Actief in de laatste 30 dagen" sub="minimaal één inlog" />
        <Tegel waarde={nooit} label="Nog nooit ingelogd" sub="uitnodiging nalopen" />
      </div>

      {rijen.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">
          Nog geen klant heeft portaaltoegang. Geef toegang via een klant, tabblad Portaal.
        </p>
      ) : (
        <div className="panel mt-6 overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Klant</th>
                <th className="text-right">Werkgever</th>
                <th className="text-right">Leiding&shy;gevende</th>
                <th className="text-right">Werknemer</th>
                <th className="text-right">Ooit ingelogd</th>
                <th>Laatste inlog</th>
                <th className="text-right">Acties 30 dagen</th>
                <th className="text-right">Werknemers in KMS</th>
              </tr>
            </thead>
            <tbody>
              {rijen.map((r) => {
                const laatste = fmt(r.laatsteLogin);
                const status = r.ooitIngelogd === 0 ? 'Nog nooit ingelogd' : r.laatsteLogin && new Date(r.laatsteLogin).getTime() >= dertig ? null : 'Niet actief afgelopen maand';
                return (
                  <tr key={r.orgId} className="border-b border-line">
                    <td>
                      <Link href={`/dashboard/klanten/${r.orgId}?tab=portaal`} className="font-semibold text-ink-900 hover:underline">{r.naam}</Link>
                      {status && <p className="text-[12px] font-semibold text-amber-800">{status}</p>}
                    </td>
                    <td className="text-right tabular-nums">{r.werkgevers}</td>
                    <td className="text-right tabular-nums">{r.leidinggevenden}</td>
                    <td className="text-right tabular-nums">{r.werknemers}</td>
                    <td className="text-right tabular-nums">{r.ooitIngelogd} van {r.logins}</td>
                    <td className="text-[13px] text-ink-800">{laatste ?? '-'}</td>
                    <td className="text-right tabular-nums">{r.actiesMaand}</td>
                    <td className="text-right tabular-nums text-warm">{r.medewerkersInSysteem}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[12px] text-warm">De demoklant telt niet mee. Acties zijn handelingen in het portaal zoals bestellen, goedkeuren en toegang geven, vastgelegd vanaf 6 oktober 2026.</p>
    </main>
  );
}
