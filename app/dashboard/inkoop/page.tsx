import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listInkoopregels, type InkoopregelMetLeverancier } from '@/lib/kms/inkoop';
import { markeerInkoop } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inkoop', robots: { index: false, follow: false } };

function fmt(d: string | null) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
const inkoopBadge: Record<string, string> = {
  te_bestellen: 'bg-amber-100 text-amber-800',
  besteld: 'bg-ink-100 text-ink-700',
  deels: 'bg-ink-100 text-ink-700',
  geleverd: 'bg-green-100 text-green-800',
};

function groepeer(regels: InkoopregelMetLeverancier[]) {
  const groepen = new Map<string, InkoopregelMetLeverancier[]>();
  for (const r of regels) {
    const sleutel = [r.merk, r.leverancier_naam].filter(Boolean).join(' · ') || 'Zonder merk/leverancier';
    const lijst = groepen.get(sleutel) ?? [];
    lijst.push(r);
    groepen.set(sleutel, lijst);
  }
  return [...groepen.entries()].sort((a, b) => a[0].localeCompare(b[0], 'nl'));
}

function Tabel({ groepen }: { groepen: [string, InkoopregelMetLeverancier[]][] }) {
  return (
    <div className="mt-4 flex flex-col gap-6">
      {groepen.map(([sleutel, regels]) => (
        <div key={sleutel} className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
          <div className="border-b border-line bg-mist px-4 py-3">
            <h3 className="font-display text-sm font-bold text-ink-900">{sleutel}</h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-warm">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Maat / kleur</th>
                <th className="px-4 py-3">Aantal</th>
                <th className="px-4 py-3">Besteld op</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actie</th>
              </tr>
            </thead>
            <tbody>
              {regels.map((r) => (
                <tr key={r.id} className="border-b border-line align-top">
                  <td className="px-4 py-3 font-semibold text-ink-900">{r.item_naam || '-'}</td>
                  <td className="px-4 py-3 text-warm">{[r.maat, r.kleur].filter(Boolean).join(' · ') || '-'}</td>
                  <td className="px-4 py-3 text-warm">{r.aantal}x{r.geleverd_aantal ? ` (${r.geleverd_aantal} geleverd)` : ''}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-warm">{fmt(r.besteld_op)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${inkoopBadge[r.status] ?? 'bg-ink-100 text-ink-600'}`}>{r.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {r.status === 'te_bestellen' && (
                        <form action={markeerInkoop}>
                          <input type="hidden" name="inkoopId" value={r.id} />
                          <input type="hidden" name="status" value="besteld" />
                          <button type="submit" className="rounded-md bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-ink-800">Besteld</button>
                        </form>
                      )}
                      {(r.status === 'besteld' || r.status === 'deels') && (
                        <form action={markeerInkoop} className="flex items-center gap-1">
                          <input type="hidden" name="inkoopId" value={r.id} />
                          <input type="hidden" name="status" value="geleverd" />
                          <input name="geleverd_aantal" type="number" min="0" defaultValue={r.aantal} className="w-16 rounded-md border border-line px-2 py-1 text-xs" />
                          <button type="submit" className="rounded-md bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-ink-800">Geleverd</button>
                        </form>
                      )}
                      {r.status === 'geleverd' && <span className="text-xs text-warm">Afgehandeld</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export default async function InkoopPage() {
  if (!(await dashAuthed())) redirect('/dashboard');
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
        </div>
      </main>
    );
  }

  const alle = await listInkoopregels();
  const teBestellen = alle.filter((r) => r.status === 'te_bestellen');
  const rest = alle.filter((r) => r.status !== 'te_bestellen');

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Inkoop</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Inkoopregels die uit orders zijn gegenereerd, gegroepeerd per merk en leverancier.</p>

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-ink-900">Te bestellen</h2>
        {teBestellen.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Niets te bestellen. Genereer inkoopregels vanuit een order.</p>
        ) : (
          <Tabel groepen={groepeer(teBestellen)} />
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-ink-900">Al besteld of geleverd</h2>
        {rest.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog niets besteld.</p>
        ) : (
          <Tabel groepen={groepeer(rest)} />
        )}
      </section>
    </main>
  );
}
