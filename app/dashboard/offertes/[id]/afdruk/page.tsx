import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { getOfferte, offerteTotalen } from '@/lib/kms/offertes';
import { formatEuro, formatDatum } from '@/lib/format';
import { site } from '@/content/site';
import PrintKnop from './PrintKnop';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Offerte afdrukken', robots: { index: false, follow: false } };

export default async function OfferteAfdrukPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;

  const offerte = await getOfferte(id);
  if (!offerte) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Offerte niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze offerte bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/offertes" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar offertes</Link>
        </div>
      </main>
    );
  }

  const { subtotaal, korting, btw, totaal } = offerteTotalen(offerte.regels, offerte.btw_pct);
  const btwPct = offerte.btw_pct ?? 21;
  const nummer = offerte.offertenummer != null ? `${offerte.offertenummer}` : 'concept';

  return (
    <main className="container-x py-12">
      <style>{`@media print { .print\\:hidden { display: none !important; } #offerte-print { box-shadow: none !important; border: 0 !important; padding: 0 !important; margin: 0 !important; } body { background: #fff; } }`}</style>

      <div className="print:hidden flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Offerte {offerte.offertenummer != null ? `#${offerte.offertenummer}` : 'concept'}</h1>
          <p className="mt-1 text-sm text-warm">{offerte.organisatie_naam || 'Geen klant gekoppeld'}</p>
        </div>
        <div className="flex items-center gap-3">
          <PrintKnop />
          <Link href={`/dashboard/offertes/${id}`} className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar offerte</Link>
        </div>
      </div>

      <section className="mt-8">
        <div id="offerte-print" className="rounded-2xl border border-line bg-white p-8 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
            <div>
              <p className="font-display text-2xl font-extrabold text-ink-900">{site.name}</p>
              <p className="mt-1 text-sm text-warm">{site.address.street}</p>
              <p className="text-sm text-warm">{site.address.postalCode} {site.address.city}</p>
              <p className="mt-2 text-sm text-warm">{site.phone} · {site.email}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-xl font-extrabold text-ink-900">Offerte</p>
              <p className="mt-1 text-sm text-warm">Nummer: <span className="font-medium text-ink-900">{nummer}</span></p>
              <p className="text-sm text-warm">Datum: <span className="text-ink-900">{formatDatum(offerte.created_at) || '-'}</span></p>
              {offerte.geldig_tot && <p className="text-sm text-warm">Geldig tot: <span className="text-ink-900">{formatDatum(offerte.geldig_tot)}</span></p>}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-line p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-warm">Offerte aan</p>
            <p className="mt-1 font-semibold text-ink-900">{offerte.organisatie_naam || 'Onbekende klant'}</p>
            {offerte.contactpersoon && <p className="text-sm text-warm">T.a.v. {offerte.contactpersoon}</p>}
          </div>

          <table className="mt-6 w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-warm">
              <tr>
                <th className="py-2 pr-3">Omschrijving</th>
                <th className="py-2 px-3 text-right">Aantal</th>
                <th className="py-2 px-3 text-right">Stukprijs</th>
                <th className="py-2 pl-3 text-right">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {offerte.regels.length === 0 ? (
                <tr><td colSpan={4} className="py-4 text-warm">Geen regels op deze offerte.</td></tr>
              ) : (
                offerte.regels.map((r) => {
                  const aantal = Number(r.aantal) || 0;
                  const stukprijs = Number(r.stukprijs) || 0;
                  const kort = Number(r.korting_pct) || 0;
                  const netto = aantal * stukprijs * (1 - kort / 100);
                  return (
                    <tr key={r.id} className="border-b border-line">
                      <td className="py-2 pr-3 text-ink-900">{r.omschrijving || '-'}{kort ? ` (-${kort}% korting)` : ''}</td>
                      <td className="py-2 px-3 text-right text-warm">{aantal}</td>
                      <td className="py-2 px-3 text-right text-warm">{formatEuro(stukprijs)}</td>
                      <td className="py-2 pl-3 text-right font-medium text-ink-900">{formatEuro(netto)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
            {korting > 0 && <div className="flex justify-between"><span className="text-warm">Korting</span><span className="text-ink-900">- {formatEuro(korting)}</span></div>}
            <div className="flex justify-between"><span className="text-warm">Subtotaal</span><span className="text-ink-900">{formatEuro(subtotaal)}</span></div>
            <div className="flex justify-between"><span className="text-warm">Btw ({btwPct}%)</span><span className="text-ink-900">{formatEuro(btw)}</span></div>
            <div className="flex justify-between border-t border-line pt-1 font-extrabold text-ink-900"><span>Totaal</span><span>{formatEuro(totaal)}</span></div>
          </div>

          {offerte.notitie && (
            <div className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-warm">Toelichting</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-900">{offerte.notitie}</p>
            </div>
          )}

          <p className="mt-8 text-xs text-warm">
            {offerte.geldig_tot
              ? `Deze offerte is geldig tot ${formatDatum(offerte.geldig_tot)}.`
              : 'Vragen over deze offerte? Neem gerust contact met ons op.'}
            {' '}Vragen? Mail naar {site.email} of bel {site.phone}.
          </p>
        </div>
      </section>
    </main>
  );
}
