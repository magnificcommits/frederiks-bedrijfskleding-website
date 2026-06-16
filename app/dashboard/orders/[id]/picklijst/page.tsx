import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { getMagazijnData } from '@/lib/kms/magazijn';
import PrintKnop from './PrintKnop';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Verzamellijst', robots: { index: false, follow: false } };

function datumNL(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function PicklijstPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;

  const data = await getMagazijnData(id);
  if (!data) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Order niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze order bestaat niet of is verwijderd.</p>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
        </div>
      </main>
    );
  }

  const totaalStuks = data.regels.reduce((t, r) => t + (Number(r.aantal) || 0), 0);

  return (
    <main className="container-x py-12">
      <style>{`@media print { .print\\:hidden { display: none !important; } .print\\:block { display: block !important; } body { background: #fff; } }`}</style>

      <div className="print:hidden flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Verzamellijst order {data.ordernummer || ''}</h1>
          <p className="mt-1 text-sm text-warm">{data.organisatie_naam || 'Onbekende klant'}</p>
        </div>
        <div className="flex items-center gap-3">
          <PrintKnop label="Print verzamellijst" />
          <Link href={`/dashboard/orders/${id}`} className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar order</Link>
        </div>
      </div>

      <section className="mt-8">
        <div className="rounded-2xl border border-line bg-white p-8 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-warm">Verzamellijst magazijn</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-ink-900">{data.organisatie_naam || 'Onbekende klant'}</h2>
              {(data.vestiging_naam || data.afdeling_naam) && (
                <p className="text-sm text-warm">
                  {[data.vestiging_naam, data.afdeling_naam].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <div className="text-right text-sm text-warm">
              <p><span className="font-semibold text-ink-900">Order:</span> {data.ordernummer || '-'}</p>
              <p><span className="font-semibold text-ink-900">Besteldatum:</span> {datumNL(data.besteldatum)}</p>
              <p><span className="font-semibold text-ink-900">Regels:</span> {data.regels.length} · {totaalStuks} stuks</p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-warm">
                <tr>
                  <th className="w-12 py-2 pr-3 text-center">Klaar</th>
                  <th className="py-2 pr-3">Artikel</th>
                  <th className="py-2 pr-3">Maat</th>
                  <th className="py-2 pr-3">Kleur</th>
                  <th className="py-2 pr-3 text-right">Aantal</th>
                </tr>
              </thead>
              <tbody>
                {data.regels.length === 0 ? (
                  <tr><td colSpan={5} className="py-4 text-warm">Geen artikelen om te verzamelen.</td></tr>
                ) : (
                  data.regels.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-b-0">
                      <td className="py-3 pr-3 text-center">
                        <span className="inline-block h-5 w-5 rounded border border-ink-900 align-middle" aria-hidden="true" />
                      </td>
                      <td className="py-3 pr-3 font-semibold text-ink-900">{r.item_naam}</td>
                      <td className="py-3 pr-3 text-warm">{r.maat || '-'}</td>
                      <td className="py-3 pr-3 text-warm">{r.kleur || '-'}</td>
                      <td className="py-3 pr-3 text-right text-lg font-bold text-ink-900">{r.aantal}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-6 border-t border-line pt-4 text-sm text-warm">
            <p>Verzameld door: <span className="inline-block min-w-[140px] border-b border-ink-900">&nbsp;</span></p>
            <p>Datum: <span className="inline-block min-w-[120px] border-b border-ink-900">&nbsp;</span></p>
          </div>
        </div>
      </section>
    </main>
  );
}
