import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { site } from '@/content/site';
import { getRetourSessie, RETOUR_REDENEN, RETOUR_METHODES, methodeVan } from '@/lib/retourportaal';
import { meldRetourAan } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Retour aanmelden', robots: { index: false, follow: false } };

const datum = (s: string) =>
  new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s));

const STATUS: Record<string, { label: string; toon: string; uitleg: string }> = {
  aangemeld: { label: 'Aangemeld', toon: 'border-amber-300 bg-amber-50 text-amber-800', uitleg: 'We hebben je aanmelding binnen en kijken ernaar. Je hoort binnen één werkdag van ons.' },
  goedgekeurd: { label: 'Goedgekeurd', toon: 'border-green-300 bg-green-50 text-green-800', uitleg: 'De retour is akkoord. Hieronder staat wat je moet doen.' },
  afgewezen: { label: 'Afgewezen', toon: 'border-line bg-mist text-warm', uitleg: 'Deze retour kunnen we niet aannemen. In de toelichting lees je waarom — bel gerust als je het er niet mee eens bent.' },
  verwerkt: { label: 'Verwerkt', toon: 'border-green-300 bg-green-50 text-green-800', uitleg: 'We hebben de retour ontvangen en afgehandeld. De creditering of terugbetaling is in gang gezet.' },
};

export default async function RetourPagina({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ ok?: string; fout?: string; geenregels?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const sessie = await getRetourSessie(token);
  if (!sessie) notFound();

  const kop = (
    <header className="border-b border-line bg-mist">
      <div className="border-t-2 border-dashed border-amber-500" aria-hidden="true" />
      <div className="container-x py-10 sm:py-12">
        <p className="eyebrow">Retourportaal</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          {sessie.retour ? `Retour ${sessie.retour.retournummer ?? ''}` : `Bestelling ${sessie.ordernummer ?? ''}`}
        </h1>
        <p className="mt-3 text-warm">
          {[sessie.organisatie, sessie.besteldatum ? `besteld op ${datum(sessie.besteldatum)}` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </header>
  );

  /* ---------------------------------------------------------------- status */
  if (sessie.retour) {
    const st = STATUS[sessie.retour.status] ?? STATUS.aangemeld;
    const m = methodeVan(sessie.retour.methode);
    return (
      <>
        {kop}
        <main className="container-x py-12">
          <div className="max-w-[46rem]">
            {sp?.ok && (
              <p className="mb-8 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">
                Gelukt. Je hebt een bevestiging per e-mail gekregen; deze pagina blijft je status tonen.
              </p>
            )}

            <span className={`inline-block rounded-full border px-3 py-1 text-xs font-bold ${st.toon}`}>{st.label}</span>
            <p className="mt-4 leading-relaxed text-warm">{st.uitleg}</p>

            <dl className="mt-8 divide-y divide-line border-y border-line text-sm">
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-warm">Retournummer</dt>
                <dd className="font-semibold text-ink-900">{sessie.retour.retournummer ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-warm">Aangemeld op</dt>
                <dd className="text-ink-900">{datum(sessie.retour.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-warm">Manier</dt>
                <dd className="text-right text-ink-900">{m?.label ?? '—'}</dd>
              </div>
            </dl>

            <h2 className="mt-10 text-lg font-extrabold text-ink-900">Wat je terugstuurt</h2>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {sessie.retour.regels.map((r, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2 py-3 text-sm">
                  <span className="font-semibold text-ink-900">{r.aantal}×</span>
                  <span className="text-ink-800">{r.item_naam}</span>
                  {(r.maat || r.kleur) && (
                    <span className="text-warm">{[r.maat, r.kleur].filter(Boolean).join(' / ')}</span>
                  )}
                  {r.reden && <span className="ml-auto text-warm">{r.reden}</span>}
                </li>
              ))}
            </ul>

            {sessie.retour.retouradres && (
              <p className="mt-6 rounded-lg border border-line bg-mist px-4 py-3 text-sm text-ink-800">
                <span className="font-semibold">Retouradres:</span> {sessie.retour.retouradres}
              </p>
            )}
            {sessie.retour.instructie && (
              <p className="mt-3 rounded-lg border border-line bg-mist px-4 py-3 text-sm text-ink-800">
                <span className="font-semibold">Van ons:</span> {sessie.retour.instructie}
              </p>
            )}

            <p className="mt-10 text-sm text-warm">
              Vragen over deze retour? Bel{' '}
              <a href={`tel:${site.phoneIntl}`} className="font-semibold text-amber-700 underline underline-offset-2">
                {site.phone}
              </a>{' '}
              en noem het retournummer.
            </p>
          </div>
        </main>
      </>
    );
  }

  /* --------------------------------------------------------------- keuze */
  const beschikbaar = sessie.regels.filter((r) => r.besteld - r.al_geretourneerd > 0);

  return (
    <>
      {kop}
      <main className="container-x py-12">
        <form action={meldRetourAan} className="max-w-[46rem]">
          <input type="hidden" name="token" value={sessie.token} />

          {sp?.geenregels && (
            <p className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
              Vink minstens één artikel aan.
            </p>
          )}
          {sp?.fout && (
            <p className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
              Er ging iets mis bij het aanmelden. Probeer het nog eens of bel {site.phone}.
            </p>
          )}

          <h2 className="text-xl font-extrabold text-ink-900">1. Wat wil je terugsturen?</h2>
          {beschikbaar.length === 0 ? (
            <p className="mt-4 text-warm">
              Alle artikelen uit deze bestelling zijn al aangemeld voor retour. Bel {site.phone} als er toch nog iets
              terug moet.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-line border-y border-line">
              {beschikbaar.map((r) => {
                const max = r.besteld - r.al_geretourneerd;
                return (
                  <li key={r.id} className="py-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox" name="regel" value={r.id} id={`regel-${r.id}`}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-line text-amber-500 focus:ring-amber-300"
                      />
                      <div className="min-w-0 flex-1">
                        <label htmlFor={`regel-${r.id}`} className="block font-semibold text-ink-900">
                          {r.item_naam}
                        </label>
                        <p className="mt-0.5 text-sm text-warm">
                          {[r.maat, r.kleur].filter(Boolean).join(' / ') || 'Geen maat of kleur vastgelegd'} ·{' '}
                          {r.besteld} besteld
                          {r.al_geretourneerd > 0 && ` · ${r.al_geretourneerd} al aangemeld`}
                        </p>

                        <div className="mt-3 flex flex-wrap items-end gap-4">
                          <div>
                            <label htmlFor={`aantal-${r.id}`} className="block text-xs font-semibold text-warm">Aantal</label>
                            <input
                              id={`aantal-${r.id}`} name={`aantal-${r.id}`} type="number" min={1} max={max} defaultValue={1}
                              className="mt-1 w-20 rounded-md border border-line px-2 py-1.5 text-sm text-ink-900 outline-none focus:border-amber-500"
                            />
                          </div>
                          <div className="min-w-[14rem] flex-1">
                            <label htmlFor={`reden-${r.id}`} className="block text-xs font-semibold text-warm">Reden</label>
                            <select
                              id={`reden-${r.id}`} name={`reden-${r.id}`} defaultValue="maat-te-klein"
                              className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink-900 outline-none focus:border-amber-500"
                            >
                              {RETOUR_REDENEN.map((rd) => (
                                <option key={rd.code} value={rd.code}>{rd.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {beschikbaar.length > 0 && (
            <>
              <h2 className="mt-12 text-xl font-extrabold text-ink-900">2. Hoe krijgen we het terug?</h2>
              <div className="mt-5 space-y-3">
                {RETOUR_METHODES.map((m, i) => (
                  <label
                    key={m.code}
                    className="flex cursor-pointer gap-3 rounded-xl border border-line bg-white p-4 transition hover:border-amber-400 has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50"
                  >
                    <input
                      type="radio" name="methode" value={m.code} defaultChecked={i === 0}
                      className="mt-1 h-4 w-4 shrink-0 border-line text-amber-500 focus:ring-amber-300"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink-900">{m.label}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-warm">{m.uitleg}</span>
                      <span className="mt-2 inline-block rounded border border-line bg-mist px-2 py-0.5 text-xs font-bold text-ink-800">
                        {m.kosten}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <h2 className="mt-12 text-xl font-extrabold text-ink-900">3. Nog iets wat we moeten weten?</h2>
              <label htmlFor="opmerking" className="mt-2 block text-sm text-warm">
                Bijvoorbeeld welke maat je in plaats daarvan wilt, of wanneer we langs kunnen komen.
              </label>
              <textarea
                id="opmerking" name="opmerking" rows={4}
                className="mt-3 w-full rounded-md border border-line px-3 py-2.5 text-ink-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                placeholder="Graag dezelfde broek in maat 52, en donderdag zijn we er de hele dag."
              />

              <button type="submit" className="btn-primary mt-8 w-full sm:w-auto">Retour aanmelden</button>
              <p className="mt-3 text-sm text-warm">
                Je krijgt meteen een bevestiging per e-mail op {sessie.email}, met een link om de status te volgen.
              </p>
            </>
          )}

          <p className="mt-10 border-t border-line pt-6 text-sm text-warm">
            Liever even bellen?{' '}
            <a href={`tel:${site.phoneIntl}`} className="font-semibold text-amber-700 underline underline-offset-2">
              {site.phone}
            </a>{' '}
            · <Link href="/klantenservice/retourneren" className="underline underline-offset-2">Terug naar de uitleg</Link>
          </p>
        </form>
      </main>
    </>
  );
}
