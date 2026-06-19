import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
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

  const regels = await listAudit(100);

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Logboek</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Overzicht van de laatste wijzigingen in het dashboard: wie deed wat en wanneer.</p>

      {regels.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Er zijn nog geen acties vastgelegd.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
              <tr>
                <th className="px-4 py-3">Datum en tijd</th>
                <th className="px-4 py-3">Actie</th>
                <th className="px-4 py-3">Entiteit</th>
                <th className="px-4 py-3">Door</th>
              </tr>
            </thead>
            <tbody>
              {regels.map((r) => (
                <tr key={r.id} className="border-b border-line">
                  <td className="whitespace-nowrap px-4 py-3 text-warm">{formatTijdstip(r.created_at)}</td>
                  <td className="px-4 py-3 font-semibold text-ink-900">{formatStatus(r.actie)}</td>
                  <td className="px-4 py-3 text-warm">
                    {r.entiteit ? (
                      <span>
                        {formatStatus(r.entiteit)}
                        {r.entiteit_id ? <span className="ml-1 text-xs text-warm/70">#{kortId(r.entiteit_id)}</span> : null}
                      </span>
                    ) : (
                      <span className="text-warm/60">&ndash;</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-warm">{r.actor || 'dashboard'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
