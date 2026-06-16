import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { getMagazijnData } from '@/lib/kms/magazijn';
import PrintKnop from './PrintKnop';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Verzendsticker', robots: { index: false, follow: false } };

const AFZENDER = 'Frederiks Bedrijfskleding';

export default async function StickerPage({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <main className="container-x py-12">
      <style>{`@media print { .print\\:hidden { display: none !important; } body { background: #fff; } .sticker-kaart { box-shadow: none !important; border-width: 2px !important; } }`}</style>

      <div className="print:hidden flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Verzendsticker order {data.ordernummer || ''}</h1>
          <p className="mt-1 text-sm text-warm">{data.organisatie_naam || 'Onbekende klant'}</p>
        </div>
        <div className="flex items-center gap-3">
          <PrintKnop label="Print sticker" />
          <Link href={`/dashboard/orders/${id}`} className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar order</Link>
        </div>
      </div>

      <p className="print:hidden mt-6 text-sm text-warm">Compacte sticker om op de doos te plakken.</p>

      <section className="mt-4">
        <div className="sticker-kaart w-full max-w-md rounded-2xl border-2 border-ink-900 bg-white p-6 shadow-soft">
          <div className="flex items-start justify-between gap-3 border-b-2 border-ink-900 pb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-warm">Afzender</p>
              <p className="font-display text-sm font-bold text-ink-900">{AFZENDER}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-warm">Order</p>
              <p className="font-display text-xl font-extrabold text-ink-900">{data.ordernummer || '-'}</p>
            </div>
          </div>

          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-warm">Voor</p>
            <p className="font-display text-lg font-extrabold text-ink-900">{data.medewerker_naam || data.organisatie_naam || '-'}</p>
            <p className="text-sm text-ink-900">
              {[data.afdeling_naam, data.vestiging_naam].filter(Boolean).join(' · ') || ''}
            </p>
            {data.medewerker_naam && data.organisatie_naam && (
              <p className="text-sm text-warm">{data.organisatie_naam}</p>
            )}
          </div>

          <div className="mt-3 border-t-2 border-ink-900 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-warm">Inhoud</p>
            {data.regels.length === 0 ? (
              <p className="text-sm text-warm">Geen artikelen.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm text-ink-900">
                {data.regels.map((r) => (
                  <li key={r.id} className="flex justify-between gap-3">
                    <span className="font-semibold">
                      {r.item_naam}
                      {r.maat ? ` · maat ${r.maat}` : ''}
                      {r.kleur ? ` · ${r.kleur}` : ''}
                    </span>
                    <span className="shrink-0 tabular-nums">{r.aantal}x</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
