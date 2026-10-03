import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { listAudit, auditFilterOpties, berekenWijzigingen, type Wijzigingen } from '@/lib/kms/audit';
import { formatStatus } from '@/lib/format';
import AutoSubmitSelect from '@/components/dashboard/AutoSubmitSelect';

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

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Leesbare weergave van een waarde in het logboek. */
function waarde(v: unknown): string {
  if (v === null || v === undefined || v === '') return '(leeg)';
  if (typeof v === 'boolean') return v ? 'ja' : 'nee';
  if (typeof v === 'number') return String(v).replace('.', ',');
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return formatTijdstip(v);
    return v.length > 80 ? `${v.slice(0, 80)}…` : v;
  }
  try {
    const t = JSON.stringify(v);
    return t.length > 80 ? `${t.slice(0, 80)}…` : t;
  } catch {
    return String(v);
  }
}

/** Haalt de wijzigingen uit details: het nieuwe formaat { wijzigingen } of het oudere { voor, na }. */
function wijzigingenUit(details: unknown): { wijzigingen: Wijzigingen | null; overig: Record<string, unknown> } {
  if (!isObject(details)) return { wijzigingen: null, overig: {} };
  if (isObject(details.wijzigingen)) {
    const { wijzigingen, ...overig } = details;
    return { wijzigingen: wijzigingen as Wijzigingen, overig };
  }
  if (isObject(details.voor) && isObject(details.na)) {
    const { voor, na, ...overig } = details;
    return { wijzigingen: berekenWijzigingen(voor as Record<string, unknown>, na as Record<string, unknown>), overig };
  }
  return { wijzigingen: null, overig: details };
}

function actorLabel(actor: string | null): string {
  if (!actor || actor === 'dashboard') return 'Dashboard';
  if (actor === 'dashboard-wachtwoord') return 'Gedeeld wachtwoord';
  return actor;
}

type SP = { entiteit?: string; actor?: string };

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();

  const sp = await searchParams;
  const entiteit = (sp.entiteit ?? '').trim();
  const actor = (sp.actor ?? '').trim();

  const [regels, opties] = await Promise.all([
    listAudit(200, { entiteit: entiteit || undefined, actor: actor || undefined }),
    auditFilterOpties(),
  ]);

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Logboek</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Overzicht van de laatste wijzigingen in het dashboard: wie deed wat, wanneer, en wat er veranderde.</p>

      <form method="get" className="mt-5 flex flex-wrap items-end gap-3">
        {/* Een keuze filtert meteen; de knop is er alleen voor als JavaScript uit staat. */}
        <div>
          <span className="veld-label" aria-hidden="true">Onderdeel</span>
          <AutoSubmitSelect
            name="entiteit"
            aria-label="Onderdeel"
            defaultValue={entiteit}
            className="veld min-w-[12rem]"
            options={[{ value: '', label: 'Alles' }, ...opties.entiteiten.map((e) => ({ value: e, label: formatStatus(e) }))]}
          />
        </div>
        <div>
          <span className="veld-label" aria-hidden="true">Door</span>
          <AutoSubmitSelect
            name="actor"
            aria-label="Door"
            defaultValue={actor}
            className="veld min-w-[14rem]"
            options={[{ value: '', label: 'Iedereen' }, ...opties.actoren.map((a) => ({ value: a, label: actorLabel(a) }))]}
          />
        </div>
        <noscript>
          <button type="submit" className="knop-donker">Filteren</button>
        </noscript>
        {(entiteit || actor) && (
          <Link href="/dashboard/audit" className="text-sm font-semibold text-warm hover:text-ink-800">Filters wissen</Link>
        )}
      </form>

      {regels.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">
          {entiteit || actor ? 'Geen acties gevonden met deze filters.' : 'Er zijn nog geen acties vastgelegd.'}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto panel">
          <table className="tbl">
            <thead>
              <tr>
                <th>Datum en tijd</th>
                <th>Actie</th>
                <th>Onderdeel</th>
                <th>Wat veranderde</th>
                <th>Door</th>
              </tr>
            </thead>
            <tbody>
              {regels.map((r) => {
                const { wijzigingen, overig } = wijzigingenUit(r.details);
                const velden = wijzigingen ? Object.entries(wijzigingen) : [];
                const overigeVelden = Object.entries(overig).filter(([, v]) => v !== null && v !== undefined && v !== '');
                return (
                  <tr key={r.id} className="border-b border-line align-top">
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
                    <td className="text-sm">
                      {velden.length > 0 && (
                        <ul className="space-y-0.5">
                          {velden.map(([veld, w]) => (
                            <li key={veld}>
                              <span className="font-semibold text-ink-900">{formatStatus(veld)}:</span>{' '}
                              <span className="text-warm line-through decoration-warm/40">{waarde(w?.van)}</span>
                              <span className="mx-1 text-warm" aria-label="wordt">&rarr;</span>
                              <span className="text-ink-900">{waarde(w?.naar)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {overigeVelden.length > 0 && (
                        <ul className={`space-y-0.5 text-xs text-warm ${velden.length > 0 ? 'mt-1' : ''}`}>
                          {overigeVelden.slice(0, 6).map(([k, v]) => (
                            <li key={k}>
                              {formatStatus(k)}: {waarde(v)}
                            </li>
                          ))}
                        </ul>
                      )}
                      {velden.length === 0 && overigeVelden.length === 0 && <span className="text-warm/60">&ndash;</span>}
                    </td>
                    <td className="whitespace-nowrap text-warm">{actorLabel(r.actor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
