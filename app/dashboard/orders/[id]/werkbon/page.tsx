import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { getOrderVoorWerkbon, listLogos, type Decoratie, type Logo } from '@/lib/kms/logos';
import { voegDecoratieToe, verwijderDecoratieActie } from './actions';
import PrintKnop from './PrintKnop';
import ConfirmSubmit from '@/components/ConfirmSubmit';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Werkbon', robots: { index: false, follow: false } };

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

function decoratieBestand(d: Decoratie): { label: string; url: string } | null {
  const logo = d.logo;
  if (!logo) return null;
  if (d.techniek === 'borduren') {
    if (logo.borduurbestand_url) return { label: 'Borduurbestand', url: logo.borduurbestand_url };
  }
  if (logo.vectorbestand_url) return { label: 'Vectorbestand', url: logo.vectorbestand_url };
  if (logo.logo_bestand_url) return { label: 'Logo-bestand', url: logo.logo_bestand_url };
  return null;
}

export default async function WerkbonPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;

  const werkbon = await getOrderVoorWerkbon(id);
  if (!werkbon) {
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

  const logos = await logosVoorOrder(id);

  return (
    <main className="container-x py-12">
      <style>{`@media print { .print\\:hidden { display: none !important; } .print\\:block { display: block !important; } body { background: #fff; } }`}</style>

      <div className="print:hidden flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Werkbon order {werkbon.ordernummer || ''}</h1>
          <p className="mt-1 text-sm text-warm">{werkbon.organisatie_naam || 'Onbekende klant'}</p>
        </div>
        <div className="flex items-center gap-3">
          <PrintKnop />
          <Link href={`/dashboard/orders/${id}`} className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar order</Link>
        </div>
      </div>

      <section className="print:hidden mt-8">
        <h2 className="font-display text-xl font-bold text-ink-900">Decoraties beheren</h2>
        <p className="mt-1 text-sm text-warm">Koppel per orderregel een logo met techniek, positie en afmeting.</p>
        <div className="mt-4 flex flex-col gap-6">
          {werkbon.regels.map((r) => (
            <div key={r.id} className="rounded-2xl border border-line bg-white p-6 shadow-soft">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-base font-bold text-ink-900">{r.item_naam}</h3>
                <p className="text-sm text-warm">{[r.maat ? `maat ${r.maat}` : null, r.kleur, `${r.aantal}x`].filter(Boolean).join(' · ')}</p>
              </div>

              {r.decoraties.length === 0 ? (
                <p className="mt-3 rounded-xl border border-line bg-mist px-4 py-3 text-sm text-warm">Nog geen decoraties op deze regel.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line border-t border-line text-sm">
                  {r.decoraties.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="text-ink-900">
                        {d.logo?.naam || 'Geen logo'} · {d.techniek}
                        {d.positie ? ` · ${d.positie}` : ''}
                        {d.afmeting ? ` · ${d.afmeting}` : ''}
                        {d.opmerkingen ? ` · ${d.opmerkingen}` : ''}
                      </span>
                      <form action={verwijderDecoratieActie}>
                        <input type="hidden" name="orderId" value={id} />
                        <input type="hidden" name="decoratieId" value={d.id} />
                        <ConfirmSubmit message="Deze decoratie verwijderen?" className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">Verwijderen</ConfirmSubmit>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <form action={voegDecoratieToe} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                <input type="hidden" name="orderId" value={id} />
                <input type="hidden" name="orderregelId" value={r.id} />
                <div>
                  <label className="block text-xs font-semibold text-warm">Logo</label>
                  <select name="logoId" className={inputCls}>
                    <option value="">Geen logo</option>
                    {logos.map((l) => <option key={l.id} value={l.id}>{l.naam}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-warm">Techniek</label>
                  <select name="techniek" defaultValue="bedrukken" className={inputCls}>
                    <option value="bedrukken">bedrukken</option>
                    <option value="borduren">borduren</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-warm">Positie</label>
                  <input name="positie" placeholder="Bijv. borst links" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-warm">Afmeting</label>
                  <input name="afmeting" placeholder="Bijv. 8 cm" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-warm">Opmerkingen</label>
                  <input name="opmerkingen" placeholder="Optioneel" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Decoratie toevoegen</button>
                </div>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="rounded-2xl border border-line bg-white p-8 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-warm">Werkbon bedrukken / borduren</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-ink-900">{werkbon.organisatie_naam || 'Onbekende klant'}</h2>
              {werkbon.organisatie_plaats && <p className="text-sm text-warm">{werkbon.organisatie_plaats}</p>}
            </div>
            <div className="text-right text-sm text-warm">
              <p><span className="font-semibold text-ink-900">Order:</span> {werkbon.ordernummer || '-'}</p>
              <p><span className="font-semibold text-ink-900">Medewerker:</span> {werkbon.medewerker_naam || '-'}</p>
              <p><span className="font-semibold text-ink-900">Afdeling:</span> {werkbon.afdeling_naam || '-'}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-6">
            {werkbon.regels.map((r) => (
              <div key={r.id} className="border-b border-line pb-5 last:border-b-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-base font-bold text-ink-900">{r.item_naam}</p>
                  <p className="text-sm text-warm">{[r.maat ? `maat ${r.maat}` : null, r.kleur, `aantal ${r.aantal}`].filter(Boolean).join(' · ')}</p>
                </div>

                {r.decoraties.length === 0 ? (
                  <p className="mt-2 text-sm text-warm">Geen decoratie.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-line text-xs uppercase tracking-wide text-warm">
                        <tr>
                          <th className="py-2 pr-3">Logo</th>
                          <th className="py-2 pr-3">Techniek</th>
                          <th className="py-2 pr-3">Positie</th>
                          <th className="py-2 pr-3">Afmeting</th>
                          <th className="py-2 pr-3">Bestand</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.decoraties.map((d) => {
                          const best = decoratieBestand(d);
                          return (
                            <tr key={d.id} className="border-b border-line align-top last:border-b-0">
                              <td className="py-2 pr-3 font-semibold text-ink-900">{d.logo?.naam || '-'}</td>
                              <td className="py-2 pr-3 text-warm">{d.techniek}</td>
                              <td className="py-2 pr-3 text-warm">{d.positie || '-'}</td>
                              <td className="py-2 pr-3 text-warm">{d.afmeting || '-'}</td>
                              <td className="py-2 pr-3 text-warm">
                                {best ? <a href={best.url} target="_blank" rel="noreferrer" className="break-all font-medium text-amber-700 hover:text-amber-800">{best.url}</a> : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

async function logosVoorOrder(orderId: string): Promise<Logo[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb.from('orders').select('organisatie_id').eq('id', orderId).maybeSingle();
  const orgId = (data as { organisatie_id: string } | null)?.organisatie_id;
  if (!orgId) return [];
  return listLogos(orgId);
}
