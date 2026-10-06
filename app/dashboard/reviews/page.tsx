import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, magEigenaar } from '@/lib/kms/adminClient';
import { getReviewInstellingen, listReviews, npsStand, type ReviewFilter } from '@/lib/reviews/reviews';
import { datumKort, nlDelen } from '@/app/dashboard/taken/tijd';
import PaginaKop from '@/components/dashboard/ui/PaginaKop';
import { zetReviewInstellingenActie, zetReviewVlagActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reviews en NPS', robots: { index: false, follow: false } };

const FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: 'beantwoord', label: 'Alle antwoorden' },
  { id: 'te-modereren', label: 'Klaar om te publiceren' },
  { id: 'gepubliceerd', label: 'Online' },
  { id: 'laag', label: 'Score 0-6' },
  { id: 'open', label: 'Nog geen antwoord' },
];

const MELDINGEN: Record<string, { tekst: string; fout?: boolean }> = {
  opgeslagen: { tekst: 'Opgeslagen. De website toont het binnen een minuut.' },
  instellingen: { tekst: 'Instellingen opgeslagen.' },
  mislukt: { tekst: 'Dat lukte niet. Probeer het opnieuw.', fout: true },
};

function scoreKleur(s: number | null): string {
  if (s === null) return 'badge-rust';
  if (s >= 9) return 'badge-klaar';
  if (s >= 7) return 'badge-actie';
  return 'badge bg-red-100 text-red-800';
}

function Tegel({ waarde, label, sub }: { waarde: string; label: string; sub?: string }) {
  return (
    <div className="panel p-4">
      <p className="font-display text-2xl font-extrabold tabular-nums text-ink-900">{waarde}</p>
      <p className="text-[12px] font-semibold text-ink-700">{label}</p>
      {sub && <p className="text-[11px] text-warm">{sub}</p>}
    </div>
  );
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ filter?: string; melding?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { filter: filterIn, melding } = await searchParams;
  const filter = (FILTERS.find((f) => f.id === filterIn)?.id ?? 'beantwoord') as ReviewFilter;
  const jaarGeleden = new Date(Date.now() - 365 * 86_400_000).toISOString();
  const [reviews, totaal, jaar, inst, eigenaar] = await Promise.all([
    listReviews(filter),
    npsStand(),
    npsStand(jaarGeleden),
    getReviewInstellingen(),
    magEigenaar(),
  ]);
  const m = melding ? MELDINGEN[melding] ?? { tekst: melding, fout: true } : null;

  return (
    <main className="container-app py-6">
      <PaginaKop
        titel="Reviews en NPS"
        sub="Na elke geleverde order vraagt een korte mail om een cijfer. Lage scores worden automatisch een klacht en een taak."
        acties={<Link href="/dashboard/klachten" className="knop-stil">Naar klachten</Link>}
      />

      {m && (
        <p className={`mt-4 rounded-lg border px-4 py-2 text-sm font-semibold ${m.fout ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}>
          {m.tekst}
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tegel waarde={jaar.nps === null ? '-' : String(jaar.nps)} label="NPS afgelopen 12 maanden" sub={totaal.nps === null ? undefined : `Sinds de start: ${totaal.nps}`} />
        <Tegel waarde={jaar.gemiddelde === null ? '-' : jaar.gemiddelde.toFixed(1).replace('.', ',')} label="Gemiddeld cijfer" sub={`${jaar.aantal} antwoorden`} />
        <Tegel waarde={String(jaar.promotors)} label="Promotors (9-10)" />
        <Tegel waarde={String(jaar.passief)} label="Passief (7-8)" />
        <Tegel waarde={String(jaar.criticasters)} label="Criticasters (0-6)" sub={jaar.respons === null ? undefined : `Respons ${jaar.respons}% van ${jaar.verstuurd} mails`} />
      </div>

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Filter">
        {FILTERS.map((f) => (
          <Link key={f.id} href={`/dashboard/reviews?filter=${f.id}`} className={`chip ${f.id === filter ? 'chip-aan' : ''}`}>
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="panel mt-3 overflow-x-auto">
        {reviews.length === 0 ? (
          <p className="p-6 text-sm text-warm">
            {filter === 'open' ? 'Geen openstaande verzoeken.' : 'Nog niets in deze weergave. De eerste mails gaan uit zodra een order een week geleverd is.'}
          </p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Cijfer</th>
                <th>Klant</th>
                <th>Reactie</th>
                <th>Opvolging</th>
                <th>Website</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => {
                const datum = r.beantwoord_op ?? r.verstuurd_op ?? r.created_at;
                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{datumKort(nlDelen(new Date(datum)).datum)}</td>
                    <td>
                      <span className={scoreKleur(r.score)}>{r.score === null ? (r.verstuurd_op ? 'verstuurd' : 'wacht') : r.score}</span>
                    </td>
                    <td>
                      {r.klant_id ? (
                        <Link href={`/dashboard/klanten/${r.klant_id}`} className="rij-link">{r.bedrijf || r.naam || 'Klant'}</Link>
                      ) : (
                        <span className="font-semibold text-ink-900">{r.bedrijf || r.naam || 'Klant'}</span>
                      )}
                      {r.naam && r.bedrijf && <span className="stil block text-[12px]">{r.naam}</span>}
                      {r.order_id && (
                        <Link href={`/dashboard/orders/${r.order_id}`} className="block text-[12px] text-warm hover:text-amber-700">Order bekijken</Link>
                      )}
                    </td>
                    <td className="max-w-[32rem] text-[12px] text-ink-800">
                      {r.tekst ?? <span className="stil">Geen toelichting</span>}
                      {r.tekst && (
                        <span className="stil block">{r.toestemming_publiceren ? 'Mag op de website' : 'Geen toestemming om te publiceren'}</span>
                      )}
                    </td>
                    <td className="text-[12px]">
                      {r.klacht_id ? (
                        <Link href={`/dashboard/klachten?id=${r.klacht_id}`} className="font-semibold text-red-800 hover:underline">Klacht aangemaakt</Link>
                      ) : (
                        <span className="stil">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {r.toestemming_publiceren && r.tekst ? (
                        <div className="flex flex-wrap gap-1.5">
                          <form action={zetReviewVlagActie}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="veld" value="gepubliceerd" />
                            <input type="hidden" name="aan" value={r.gepubliceerd ? '0' : '1'} />
                            <input type="hidden" name="filter" value={filter} />
                            <button type="submit" className={r.gepubliceerd ? 'knop-stil py-1 text-[12px]' : 'knop-primair py-1 text-[12px]'}>
                              {r.gepubliceerd ? 'Offline halen' : 'Publiceren'}
                            </button>
                          </form>
                          <form action={zetReviewVlagActie}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="veld" value="uitgelicht" />
                            <input type="hidden" name="aan" value={r.uitgelicht ? '0' : '1'} />
                            <input type="hidden" name="filter" value={filter} />
                            <button type="submit" className="knop-stil py-1 text-[12px]" title="Uitgelichte reviews staan bovenaan">
                              {r.uitgelicht ? 'Niet meer uitlichten' : 'Uitlichten'}
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="stil text-[12px]">-</span>
                      )}
                      {r.gepubliceerd && <span className="badge-klaar mt-1 inline-block">online{r.uitgelicht ? ', uitgelicht' : ''}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {eigenaar && (
        <section className="panel mt-6 max-w-3xl p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Instellingen</h2>
          <form action={zetReviewInstellingenActie} className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-[auto_8rem_minmax(0,1fr)] sm:items-end">
            <input type="hidden" name="filter" value={filter} />
            <label className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <input type="checkbox" name="actief" defaultChecked={inst.actief} /> Mails automatisch versturen
            </label>
            <div>
              <label className="veld-label" htmlFor="wachtdagen">Dagen na levering</label>
              <input id="wachtdagen" name="wachtdagen" type="number" min={1} max={90} className="veld" defaultValue={inst.wachtdagen} />
            </div>
            <div>
              <label className="veld-label" htmlFor="googleLink">Google-reviewlink</label>
              <input id="googleLink" name="googleLink" type="url" className="veld" defaultValue={inst.googleLink} placeholder="https://g.page/r/.../review" />
            </div>
            <p className="veld-hint sm:col-span-3">
              Klanten die een 9 of 10 geven, krijgen een knop naar deze link. Het is dezelfde link als {'{{reviewlink}}'} in de campagnes. Per klant gaat er
              hooguit eens per 90 dagen een verzoek uit, en nooit naar afgemelde adressen.
            </p>
            <button type="submit" className="knop-donker justify-self-start">Opslaan</button>
          </form>
        </section>
      )}
    </main>
  );
}
