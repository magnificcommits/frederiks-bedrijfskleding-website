import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { getMagazijnData, type Adres } from '@/lib/kms/magazijn';
import PrintKnop from './PrintKnop';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pakbon', robots: { index: false, follow: false } };

const AFZENDER = {
  naam: 'Frederiks Bedrijfskleding',
  adres: 'Kruisbergseweg 9',
  postcode: '7255 AG',
  plaats: 'Hengelo (Gld)',
};

function datumNL(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function AdresBlok({ adres }: { adres: Adres }) {
  const heeftIets = adres.straat || adres.postcode || adres.plaats;
  if (!heeftIets) return <p className="text-sm text-warm">Geen leveradres bekend.</p>;
  return (
    <div className="text-sm text-ink-900">
      {adres.straat && <p>{adres.straat}</p>}
      <p>{[adres.postcode, adres.plaats].filter(Boolean).join(' ')}</p>
    </div>
  );
}

export default async function PakbonPage({ params }: { params: Promise<{ id: string }> }) {
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
      <style>{`@media print { .print\\:hidden { display: none !important; } .print\\:block { display: block !important; } body { background: #fff; } }`}</style>

      <div className="print:hidden flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Pakbon order {data.ordernummer || ''}</h1>
          <p className="mt-1 text-sm text-warm">{data.organisatie_naam || 'Onbekende klant'}</p>
        </div>
        <div className="flex items-center gap-3">
          <PrintKnop label="Print pakbon" />
          <Link href={`/dashboard/orders/${id}`} className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar order</Link>
        </div>
      </div>

      <section className="mt-8">
        <div className="rounded-2xl border border-line bg-white p-8 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-warm">Afzender</p>
              <p className="mt-1 font-display text-base font-bold text-ink-900">{AFZENDER.naam}</p>
              <p className="text-sm text-ink-900">{AFZENDER.adres}</p>
              <p className="text-sm text-ink-900">{AFZENDER.postcode} {AFZENDER.plaats}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-warm">Pakbon</p>
              <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{data.ordernummer || '-'}</p>
              <p className="text-sm text-warm">Besteldatum: {datumNL(data.besteldatum)}</p>
              {data.referentienr && <p className="text-sm text-warm">Referentie: {data.referentienr}</p>}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-warm">Bezorgen aan</p>
            <p className="mt-1 font-display text-lg font-bold text-ink-900">{data.organisatie_naam || 'Onbekende klant'}</p>
            {(data.medewerker_naam || data.afdeling_naam) && (
              <p className="text-sm text-warm">
                {[
                  data.medewerker_naam ? `T.a.v. ${data.medewerker_naam}` : null,
                  data.afdeling_naam ? `afdeling ${data.afdeling_naam}` : null,
                  data.vestiging_naam ? `vestiging ${data.vestiging_naam}` : null,
                ].filter(Boolean).join(' · ')}
              </p>
            )}
            <div className="mt-2">
              <AdresBlok adres={data.leveradres} />
            </div>
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-warm">
                <tr>
                  <th className="py-2 pr-3">Artikel</th>
                  <th className="py-2 pr-3">Maat</th>
                  <th className="py-2 pr-3">Kleur</th>
                  <th className="py-2 pr-3 text-right">Aantal</th>
                </tr>
              </thead>
              <tbody>
                {data.regels.length === 0 ? (
                  <tr><td colSpan={4} className="py-4 text-warm">Geen artikelen op deze order.</td></tr>
                ) : (
                  data.regels.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-b-0">
                      <td className="py-2 pr-3 font-semibold text-ink-900">{r.item_naam}</td>
                      <td className="py-2 pr-3 text-warm">{r.maat || '-'}</td>
                      <td className="py-2 pr-3 text-warm">{r.kleur || '-'}</td>
                      <td className="py-2 pr-3 text-right text-ink-900">{r.aantal}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-8 text-xs text-warm">
            Controleer de levering aan de hand van deze pakbon. Vragen? Neem contact op met {AFZENDER.naam}.
          </p>
        </div>
      </section>
    </main>
  );
}
