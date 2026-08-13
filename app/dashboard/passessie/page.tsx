import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { listPassessies } from '@/lib/kms/passessies';
import { startPassessie } from './actions';

export const metadata: Metadata = { title: 'Passessies', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const statusBadge: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800',
  afgerond: 'bg-ink-100 text-ink-700',
  omgezet: 'bg-green-100 text-green-800',
};
const statusLabel: Record<string, string> = { open: 'Open', afgerond: 'Afgerond', omgezet: 'Order gemaakt' };

const inputCls =
  'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

function fmt(d: string) {
  try {
    return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

export default async function PassessiesPage({ searchParams }: { searchParams: Promise<{ fout?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { fout } = await searchParams;

  const sb = kmsAdmin();
  const { data: klanten } = (await sb?.from('organisaties').select('id, naam, plaats').order('naam')) ?? { data: [] };
  const sessies = await listPassessies();

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Passessies</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">
          Terug naar dashboard
        </Link>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-warm">
        Leg bij de klant op locatie per medewerker het artikel, de kleur en de maat vast. Werkt op een tablet. Als je
        klaar bent maak je er in één keer een order van.
      </p>

      {fout && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          Er ging iets mis ({fout}). Probeer het opnieuw.
        </p>
      )}

      <section className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <h2 className="font-display text-xl font-bold text-ink-900">Nieuwe sessie starten</h2>
        <form action={startPassessie} className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-ink-800">
            Klant
            <select name="organisatie_id" required className={inputCls} defaultValue="">
              <option value="" disabled>
                Kies een klant
              </option>
              {((klanten as { id: string; naam: string; plaats: string | null }[]) ?? []).map((k) => (
                <option key={k.id} value={k.id}>
                  {k.naam}
                  {k.plaats ? ` - ${k.plaats}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-ink-800">
            Locatie <span className="font-normal text-warm">(optioneel)</span>
            <input name="locatie" className={inputCls} placeholder="Kantine, vestiging Hengelo" />
          </label>
          <label className="block text-sm font-medium text-ink-800">
            Notitie <span className="font-normal text-warm">(optioneel)</span>
            <input name="notitie" className={inputCls} placeholder="Nieuwe medewerkers najaar" />
          </label>
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="rounded-md bg-amber-500 px-5 py-2.5 text-sm font-bold text-ink-900 hover:bg-amber-400"
            >
              Sessie starten
            </button>
          </div>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink-900">Eerdere sessies</h2>
        {sessies.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line bg-mist p-6 text-sm text-warm">
            Nog geen passessies. Start hierboven de eerste.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="bg-mist text-left text-xs uppercase tracking-wide text-warm">
                <tr>
                  <th className="px-4 py-3">Datum</th>
                  <th className="px-4 py-3">Klant</th>
                  <th className="px-4 py-3">Locatie</th>
                  <th className="px-4 py-3">Regels</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sessies.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 whitespace-nowrap">{fmt(s.datum)}</td>
                    <td className="px-4 py-3 font-medium text-ink-900">{s.organisatie_naam ?? '-'}</td>
                    <td className="px-4 py-3 text-warm">{s.locatie ?? '-'}</td>
                    <td className="px-4 py-3">{s.regels}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge[s.status]}`}>
                        {statusLabel[s.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/passessie/${s.id}`} className="font-semibold text-warm hover:text-ink-800">
                        Openen
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
