import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { listAudit } from '@/lib/kms/audit';
import { formatStatus } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Logboek', robots: { index: false, follow: false } };

function formatTijdstip(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function kortId(id: string | null): string {
  if (!id) return '';
  return id.length > 8 ? id.slice(0, 8) : id;
}

export default async function AuditPage() {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();

  const regels = await listAudit(100);

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Logboek</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Overzicht van de laatste wijzigingen in het dashboard: wie deed wat en wanneer.</p>

      {regels.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Er zijn nog geen acties vastgelegd.</p>
      ) : (
        <div className="mt-6 overflow-x-auto panel">
          <table className="tbl">
            <thead>
              <tr>
                <th>Datum en tijd</th>
                <th>Actie</th>
                <th>Entiteit</th>
                <th>Door</th>
              </tr>
            </thead>
            <tbody>
              {regels.map((r) => (
                <tr key={r.id} className="border-b border-line">
                  <td className="whitespace-nowrap text-warm">{formatTijdstip(r.created_at)}</td>
                  <td className="font-semibold text-ink-900">{formatStatus(r.actie)}</td>
                  <td className="text-warm">
                    {r.entiteit ? (
                      <span>
                        {formatStatus(r.entiteit)}
                        {r.entiteit_id ? <span className="ml-1 text-xs text-warm/70">#{kortId(r.entiteit_id)}</span> : null}
                      </span>
                    ) : (
                      <span className="text-warm/60">&ndash;</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-warm">{r.actor || 'dashboard'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
