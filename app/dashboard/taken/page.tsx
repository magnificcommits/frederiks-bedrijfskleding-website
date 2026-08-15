import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { formatDatum } from '@/lib/format';
import { listTaken, type Taak } from '@/lib/kms/taken';
import { listOrganisaties } from '@/lib/portaalAdmin';
import NavigateSelect from '@/components/dashboard/NavigateSelect';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import { maakTaakActie, zetTaakStatusActie, verwijderTaakActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Taken', robots: { index: false, follow: false } };

const inputCls =
  'veld';

const okBoodschap: Record<string, string> = {
  aangemaakt: 'Taak toegevoegd.',
  afgerond: 'Taak gemarkeerd als klaar.',
  heropend: 'Taak heropend.',
  verwijderd: 'Taak verwijderd.',
  geen_titel: 'Geef de taak eerst een titel.',
};

function prioriteitBadge(prioriteit: string) {
  const stijl =
    prioriteit === 'hoog'
      ? 'border-red-200 bg-red-50 text-red-700'
      : prioriteit === 'laag'
        ? 'border-line bg-mist text-warm'
        : 'border-line bg-white text-ink-800';
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${stijl}`}>
      {prioriteit === 'hoog' ? 'Hoog' : prioriteit === 'laag' ? 'Laag' : 'Normaal'}
    </span>
  );
}

export default async function TakenPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ok?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');

  const { status, ok } = await searchParams;
  const filter: 'open' | 'klaar' | 'alle' =
    status === 'klaar' ? 'klaar' : status === 'alle' ? 'alle' : 'open';

  const [taken, organisaties] = await Promise.all([listTaken(filter), listOrganisaties()]);
  const vandaag = new Date().toISOString().slice(0, 10);

  const isVerlopen = (t: Taak) =>
    t.status === 'open' && !!t.vervaldatum && t.vervaldatum < vandaag;

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Taken</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">
          Terug naar dashboard
        </Link>
      </div>
      <p className="mt-2 text-sm text-warm">
        Opvolgtaken voor de klantopvolging: bel-afspraken, offertes nasturen, passen inplannen.
      </p>

      {ok && okBoodschap[ok] && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">
          {okBoodschap[ok]}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Lijst */}
        <section>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-extrabold text-ink-900">Overzicht</h2>
            <div className="w-44">
              <NavigateSelect
                basePath="/dashboard/taken"
                param="status"
                value={filter}
                options={[
                  { value: 'open', label: 'Open taken' },
                  { value: 'klaar', label: 'Afgerond' },
                  { value: 'alle', label: 'Alle taken' },
                ]}
              />
            </div>
          </div>

          {taken.length === 0 ? (
            <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">
              {filter === 'klaar'
                ? 'Nog geen afgeronde taken.'
                : 'Geen taken. Maak rechts je eerste opvolgtaak aan.'}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {taken.map((t) => {
                const klaar = t.status === 'klaar';
                const verlopen = isVerlopen(t);
                return (
                  <li
                    key={t.id}
                    className={`rounded-2xl border border-line bg-white p-5 shadow-soft ${klaar ? 'opacity-70' : ''}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className={`font-display text-lg font-bold text-ink-900 ${klaar ? 'line-through' : ''}`}
                          >
                            {t.titel}
                          </h3>
                          {prioriteitBadge(t.prioriteit)}
                          {klaar && (
                            <span className="inline-block rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                              Klaar
                            </span>
                          )}
                        </div>
                        {t.omschrijving && (
                          <p className="mt-1.5 whitespace-pre-line text-sm text-warm">{t.omschrijving}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-warm">
                          {t.organisatie_naam && (
                            <span>
                              Klant: <span className="font-semibold text-ink-800">{t.organisatie_naam}</span>
                            </span>
                          )}
                          {t.vervaldatum && (
                            <span className={verlopen ? 'font-semibold text-red-600' : ''}>
                              Vervaldatum: {formatDatum(t.vervaldatum)}
                              {verlopen ? ' (verlopen)' : ''}
                            </span>
                          )}
                          {t.toegewezen_aan && <span>Voor: {t.toegewezen_aan}</span>}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <form action={zetTaakStatusActie}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="status" value={klaar ? 'open' : 'klaar'} />
                          <button
                            type="submit"
                            className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink-800 hover:bg-mist"
                          >
                            {klaar ? 'Heropenen' : 'Markeer als klaar'}
                          </button>
                        </form>
                        <form action={verwijderTaakActie}>
                          <input type="hidden" name="id" value={t.id} />
                          <ConfirmSubmit
                            message="Deze taak verwijderen? Dit kan niet ongedaan worden gemaakt."
                            className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                          >
                            Verwijderen
                          </ConfirmSubmit>
                        </form>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Nieuwe taak */}
        <aside>
          <div className="panel p-4">
            <h2 className="font-display text-lg font-bold text-ink-900">Nieuwe taak</h2>
            <form action={maakTaakActie} className="mt-4 space-y-4">
              <div>
                <label className="veld-label">Titel</label>
                <input
                  type="text"
                  name="titel"
                  required
                  placeholder="Bijv. Offerte nasturen Garage Jansen"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="veld-label">Omschrijving</label>
                <textarea name="omschrijving" rows={3} className={inputCls} />
              </div>
              <div>
                <label className="veld-label">Klant (optioneel)</label>
                <select name="organisatie_id" defaultValue="" className={inputCls}>
                  <option value="">Geen klant</option>
                  {organisaties.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.naam}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="veld-label">Prioriteit</label>
                <select name="prioriteit" defaultValue="normaal" className={inputCls}>
                  <option value="laag">Laag</option>
                  <option value="normaal">Normaal</option>
                  <option value="hoog">Hoog</option>
                </select>
              </div>
              <div>
                <label className="veld-label">Vervaldatum (optioneel)</label>
                <input type="date" name="vervaldatum" className={inputCls} />
              </div>
              <div>
                <label className="veld-label">Toegewezen aan (optioneel)</label>
                <input type="text" name="toegewezen_aan" placeholder="Bijv. Jessi" className={inputCls} />
              </div>
              <button
                type="submit"
                className="w-full knop-donker"
              >
                Taak toevoegen
              </button>
            </form>
          </div>
        </aside>
      </div>
    </main>
  );
}
