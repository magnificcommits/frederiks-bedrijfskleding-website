import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import {
  STANDAARD_POSITIES,
  WERKBON_LABEL,
  WERKBON_STATUSSEN,
  getOrderVoorWerkbon,
  listLogos,
  logoBestanden,
  logoKleuren,
  logoStaat,
  werkbonVoorOrder,
  type Decoratie,
} from '@/lib/kms/logos';
import { listDrukproevenVoorOrder } from '@/lib/kms/drukproeven';
import { site } from '@/content/site';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import DrukproefPreview from '@/app/dashboard/drukproeven/DrukproefPreview';
import AfdrukStijl from '@/app/dashboard/drukproeven/AfdrukStijl';
import Melding from '@/app/dashboard/logos/Melding';
import { DeadlineLabel } from '@/app/dashboard/logos/WerkbonKaart';
import { voegDecoratieToe, verwijderDecoratieActie, werkWerkbonActie } from './actions';
import PrintKnop from './PrintKnop';
import AutoAfdrukken from './AutoAfdrukken';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Werkbon', robots: { index: false, follow: false } };

const datum = (s: string | null) => (s ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s)) : '-');

/** Het bestand waar de machine mee werkt: DST bij borduren, anders vector, anders het plaatje. */
function productieBestand(d: Decoratie): { label: string; naam: string; url: string } | null {
  if (!d.logo) return null;
  const bestanden = logoBestanden(d.logo);
  const kies = (soort: string) => bestanden.find((b) => b.productie === soort);
  const b = d.techniek === 'borduren' ? kies('borduur') ?? kies('vector') ?? kies('bitmap') : kies('vector') ?? kies('bitmap');
  if (!b) return null;
  const label = b.productie === 'borduur' ? 'Borduurprogramma' : b.productie === 'vector' ? 'Vector' : 'Plaatje';
  return { label, naam: b.weergaveNaam, url: b.url };
}

function Kleuren({ d }: { d: Decoratie }) {
  if (!d.logo) return <span>-</span>;
  const kleuren = logoKleuren(d.logo);
  if (kleuren.length === 0) return <span>-</span>;
  return (
    <span className="flex flex-col gap-0.5">
      {kleuren.map((k, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 shrink-0 rounded-sm border border-line" style={{ background: k.hex ?? '#fff' }} />
          <span>{[k.pantone, k.naam].filter(Boolean).join(' · ') || k.hex}</span>
        </span>
      ))}
    </span>
  );
}

export default async function WerkbonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ afdrukken?: string; melding?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;
  const zp = await searchParams;

  const werkbon = await getOrderVoorWerkbon(id);
  if (!werkbon) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Order niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze order bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/logos" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Naar de werkbonnen</Link>
        </div>
      </main>
    );
  }

  const [logos, { kaart, tabelBestaat }, proeven] = await Promise.all([
    werkbon.organisatie_id ? listLogos(werkbon.organisatie_id) : Promise.resolve([]),
    werkbonVoorOrder(id),
    listDrukproevenVoorOrder(id),
  ]);
  const goedeProeven = proeven.filter((p) => p.status === 'goedgekeurd');
  const getoondeProeven = goedeProeven.length ? goedeProeven : proeven.slice(0, 2);
  const regelsMetDeco = werkbon.regels.filter((r) => r.decoraties.length > 0);
  const totaalStuks = (regelsMetDeco.length ? regelsMetDeco : werkbon.regels).reduce((n, r) => n + (Number(r.aantal) || 0), 0);
  const status = kaart?.status ?? 'wacht_op_drukproef';

  return (
    <main className="container-app py-6">
      <AfdrukStijl doelId="werkbon-afdruk" />
      <AutoAfdrukken aan={zp.afdrukken === '1'} />

      <div className="dash-kop print:hidden flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dash-h1">Werkbon order {werkbon.ordernummer || ''}</h1>
          <p className="dash-sub">
            <Link href={werkbon.organisatie_id ? `/dashboard/klanten/${werkbon.organisatie_id}?tab=logos` : '#'} className="font-semibold text-amber-700 hover:text-amber-800">
              {werkbon.organisatie_naam || 'Onbekende klant'}
            </Link>
            {' · '}
            {WERKBON_LABEL[status]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PrintKnop />
          <Link href="/dashboard/logos" className="knop-stil">Naar de planning</Link>
          <Link href={`/dashboard/orders/${id}`} className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar order</Link>
        </div>
      </div>

      <div className="print:hidden">
        <Melding code={zp.melding} />
      </div>

      <div className="print:hidden mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ---------------- Decoraties ---------------- */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">Wat komt waar</h2>
          <p className="mt-1 text-sm text-warm">
            Koppel per artikel een logo met techniek, positie en maat. Logo&apos;s beheer je op de{' '}
            {werkbon.organisatie_id ? (
              <Link href={`/dashboard/klanten/${werkbon.organisatie_id}?tab=logos`} className="font-semibold text-amber-700 hover:text-amber-800">klantkaart</Link>
            ) : (
              'klantkaart'
            )}
            .
          </p>
          <datalist id="werkbon-posities">
            {STANDAARD_POSITIES.map((p) => <option key={p} value={p} />)}
          </datalist>
          {werkbon.regels.length === 0 ? (
            <p className="mt-4 rounded-xl border border-line bg-mist px-4 py-3 text-sm text-warm">Deze order heeft nog geen artikelen.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {werkbon.regels.map((r) => (
                <div key={r.id} className="panel p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-base font-bold text-ink-900">{r.item_naam}</h3>
                    <p className="text-sm text-warm">{[r.maat ? `maat ${r.maat}` : null, r.kleur, `${r.aantal}x`].filter(Boolean).join(' · ')}</p>
                  </div>

                  {r.decoraties.length === 0 ? (
                    <p className="mt-3 rounded-lg border border-dashed border-line bg-mist px-4 py-2.5 text-sm text-warm">Nog niets op dit artikel.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-line border-t border-line text-sm">
                      {r.decoraties.map((d) => {
                        const st = d.logo ? logoStaat(d.logo) : null;
                        const waarschuwing =
                          !d.logo ? 'Geen logo gekozen' : d.techniek === 'borduren' && !st?.heeftBorduur ? 'Geen borduurprogramma' : d.techniek !== 'borduren' && !st?.heeftVector ? 'Geen vectorbestand' : null;
                        return (
                          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                            <span className="flex items-center gap-3 text-ink-900">
                              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded border border-line bg-mist">
                                {st?.thumb ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={st.thumb} alt="" className="max-h-full max-w-full object-contain" />
                                ) : null}
                              </span>
                              <span>
                                {d.logo ? (
                                  <Link href={`/dashboard/logos/${d.logo.id}`} className="font-semibold hover:text-amber-800">{d.logo.naam}</Link>
                                ) : (
                                  <span className="font-semibold">Geen logo</span>
                                )}
                                <span className="text-warm"> · {d.techniek}{d.positie ? ` · ${d.positie}` : ''}{d.afmeting ? ` · ${d.afmeting}` : ''}{d.opmerkingen ? ` · ${d.opmerkingen}` : ''}</span>
                                {waarschuwing && <span className="block text-xs font-semibold text-amber-800">{waarschuwing}</span>}
                              </span>
                            </span>
                            <form action={verwijderDecoratieActie}>
                              <input type="hidden" name="orderId" value={id} />
                              <input type="hidden" name="decoratieId" value={d.id} />
                              <ConfirmSubmit message="Dit logo van het artikel halen?" className="knop-stil !px-2.5 !py-1 !text-xs">Weghalen</ConfirmSubmit>
                            </form>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <details className="mt-3 border-t border-line pt-3" open={r.decoraties.length === 0}>
                    <summary className="cursor-pointer text-sm font-semibold text-amber-700 hover:text-amber-800">Logo op dit artikel zetten</summary>
                    <form action={voegDecoratieToe} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input type="hidden" name="orderId" value={id} />
                      <input type="hidden" name="orderregelId" value={r.id} />
                      <div>
                        <label className="veld-label" htmlFor={`logo-${r.id}`}>Logo</label>
                        <select id={`logo-${r.id}`} name="logoId" className="veld !py-2 !text-sm">
                          <option value="">Geen logo</option>
                          {logos.map((l) => <option key={l.id} value={l.id}>{l.naam}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="veld-label" htmlFor={`tech-${r.id}`}>Techniek</label>
                        <select id={`tech-${r.id}`} name="techniek" defaultValue="borduren" className="veld !py-2 !text-sm">
                          <option value="borduren">Borduren</option>
                          <option value="bedrukken">Bedrukken</option>
                        </select>
                      </div>
                      <div>
                        <label className="veld-label" htmlFor={`pos-${r.id}`}>Positie</label>
                        <input id={`pos-${r.id}`} name="positie" list="werkbon-posities" placeholder="Bijv. Linker borst" className="veld !py-2 !text-sm" />
                      </div>
                      <div>
                        <label className="veld-label" htmlFor={`maat-${r.id}`}>Afmeting</label>
                        <input id={`maat-${r.id}`} name="afmeting" placeholder="Bijv. 9 x 4 cm" className="veld !py-2 !text-sm" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="veld-label" htmlFor={`opm-${r.id}`}>Opmerkingen</label>
                        <input id={`opm-${r.id}`} name="opmerkingen" placeholder="Bijv. garenkleur wit" className="veld !py-2 !text-sm" />
                      </div>
                      <div className="sm:col-span-2">
                        <button type="submit" className="knop-donker">Toevoegen</button>
                      </div>
                    </form>
                  </details>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---------------- Planning ---------------- */}
        <aside className="flex flex-col gap-4">
          <form action={werkWerkbonActie} className="panel flex flex-col gap-3 p-5">
            <input type="hidden" name="orderId" value={id} />
            <h2 className="font-display text-base font-bold text-ink-900">Planning</h2>
            <div>
              <label className="veld-label" htmlFor="wb-status">Status</label>
              <select id="wb-status" name="status" defaultValue={status} className="veld !py-2 !text-sm">
                {WERKBON_STATUSSEN.map((s) => <option key={s} value={s}>{WERKBON_LABEL[s]}</option>)}
              </select>
              {kaart?.bron === 'afgeleid' && <p className="veld-hint">Nu afgeleid uit de order en de drukproef.</p>}
            </div>
            <div>
              <label className="veld-label" htmlFor="wb-deadline">Deadline</label>
              <input id="wb-deadline" type="date" name="deadline" defaultValue={kaart?.deadline?.slice(0, 10) ?? ''} className="veld !py-2 !text-sm" />
              {kaart && <p className="mt-1 text-xs"><DeadlineLabel k={kaart} /></p>}
            </div>
            <div>
              <label className="veld-label" htmlFor="wb-notitie">Notitie voor de productie</label>
              <textarea id="wb-notitie" name="notitie" rows={3} defaultValue={kaart?.notitie ?? ''} placeholder="Bijv. eerst één proefstuk borduren" className="veld !text-sm" />
            </div>
            {!tabelBestaat && <p className="text-xs text-warm">Deadline en notitie worden bewaard na de database-update.</p>}
            <button type="submit" className="knop-donker self-start">Opslaan</button>
          </form>

          <div className="panel p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-ink-900">Drukproeven</h2>
              <Link href={`/dashboard/drukproeven/nieuw?org=${werkbon.organisatie_id ?? ''}&order=${id}`} className="text-xs font-semibold text-amber-700 hover:text-amber-800">Nieuwe</Link>
            </div>
            {proeven.length === 0 ? (
              <p className="mt-2 text-sm text-warm">Nog geen drukproef aan deze order. Bij een nieuw logo of nieuwe plek: eerst een proef laten goedkeuren.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {proeven.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <Link href={`/dashboard/drukproeven/${p.id}`} className="truncate text-ink-900 hover:text-amber-800">{p.naam}</Link>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.status === 'goedgekeurd' ? 'bg-green-100 text-green-800' : p.status === 'afgekeurd' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                      {p.status === 'verstuurd' ? 'ter goedkeuring' : p.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* ---------------- Afdruk ---------------- */}
      <section id="werkbon-afdruk" className="mt-10 rounded-lg border border-line bg-white p-8">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-ink-900 pb-4">
          <div>
            <div className="font-display text-xl font-extrabold tracking-wide text-ink-900">FREDERIKS</div>
            <div className="text-[10px] font-bold tracking-[0.32em] text-amber-700">BEDRIJFSKLEDING</div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-warm">Werkbon bedrukken en borduren</p>
            <h2 className="font-display text-2xl font-extrabold text-ink-900">{werkbon.organisatie_naam || 'Onbekende klant'}</h2>
            {werkbon.organisatie_plaats && <p className="text-sm text-warm">{werkbon.organisatie_plaats}</p>}
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-sm">
            <dt className="font-semibold text-ink-900">Order</dt><dd className="text-ink-800">{werkbon.ordernummer || '-'}</dd>
            <dt className="font-semibold text-ink-900">Besteld</dt><dd className="text-ink-800">{datum(werkbon.besteldatum)}</dd>
            <dt className="font-semibold text-ink-900">Deadline</dt><dd className="font-semibold text-ink-900">{datum(kaart?.deadline ?? null)}</dd>
            <dt className="font-semibold text-ink-900">Medewerker</dt><dd className="text-ink-800">{werkbon.medewerker_naam || '-'}</dd>
            <dt className="font-semibold text-ink-900">Afdeling</dt><dd className="text-ink-800">{werkbon.afdeling_naam || '-'}</dd>
            <dt className="font-semibold text-ink-900">Stuks</dt><dd className="text-ink-800">{totaalStuks}</dd>
          </dl>
        </header>

        {kaart?.notitie && (
          <p className="afdruk-blok mt-4 rounded border-l-4 border-amber-500 bg-amber-50 px-4 py-2 text-sm text-ink-900">{kaart.notitie}</p>
        )}

        <div className="mt-6 flex flex-col gap-6">
          {(regelsMetDeco.length ? regelsMetDeco : werkbon.regels).map((r) => (
            <div key={r.id} className="afdruk-blok border-b border-line pb-5 last:border-b-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-base font-bold text-ink-900">{r.item_naam}</p>
                <p className="text-sm text-ink-800">{[r.maat ? `maat ${r.maat}` : null, r.kleur, `aantal ${r.aantal}`].filter(Boolean).join(' · ')}</p>
              </div>

              {r.decoraties.length === 0 ? (
                <p className="mt-2 text-sm text-warm">Geen decoratie.</p>
              ) : (
                <table className="mt-3 w-full text-left text-sm">
                  <thead className="border-b border-line text-[11px] uppercase tracking-wide text-warm">
                    <tr>
                      <th className="py-1.5 pr-3">Logo</th>
                      <th className="py-1.5 pr-3">Techniek</th>
                      <th className="py-1.5 pr-3">Positie</th>
                      <th className="py-1.5 pr-3">Maat</th>
                      <th className="py-1.5 pr-3">Kleuren</th>
                      <th className="py-1.5 pr-3">Bestand</th>
                      <th className="py-1.5 text-center">Klaar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.decoraties.map((d) => {
                      const best = productieBestand(d);
                      const st = d.logo ? logoStaat(d.logo) : null;
                      return (
                        <tr key={d.id} className="border-b border-line align-top last:border-b-0">
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-white">
                                {st?.thumb ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={st.thumb} alt="" className="max-h-full max-w-full object-contain" />
                                ) : null}
                              </span>
                              <span className="font-semibold text-ink-900">{d.logo?.naam || '-'}</span>
                            </div>
                          </td>
                          <td className="py-2 pr-3 capitalize text-ink-800">
                            {d.techniek}
                            {d.techniek === 'borduren' && d.logo?.steken ? <span className="block text-xs normal-case text-warm">{d.logo.steken.toLocaleString('nl-NL')} steken</span> : null}
                          </td>
                          <td className="py-2 pr-3 text-ink-800">{d.positie || '-'}</td>
                          <td className="py-2 pr-3 text-ink-800">{d.afmeting || '-'}</td>
                          <td className="py-2 pr-3 text-xs text-ink-800"><Kleuren d={d} /></td>
                          <td className="py-2 pr-3 text-xs text-ink-800">
                            {best ? (
                              <a href={best.url} target="_blank" rel="noreferrer" className="break-all font-medium text-amber-700 hover:text-amber-800">
                                <span className="block text-[10px] uppercase tracking-wide text-warm">{best.label}</span>
                                {best.naam}
                              </a>
                            ) : (
                              <span className="font-semibold text-red-700">Ontbreekt</span>
                            )}
                            {d.opmerkingen && <span className="mt-1 block text-ink-800">{d.opmerkingen}</span>}
                          </td>
                          <td className="py-2 text-center"><span className="inline-block h-5 w-5 rounded border-2 border-ink-400" aria-label="Afvinken" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>

        {getoondeProeven.length > 0 && (
          <div className="afdruk-blok mt-6 border-t border-line pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-warm">
              {goedeProeven.length ? 'Goedgekeurde drukproef' : 'Drukproef (nog niet goedgekeurd)'}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {getoondeProeven.map((p) => (
                <div key={p.id}>
                  <p className="text-sm font-semibold text-ink-900">{p.naam}</p>
                  <div className="mt-2 rounded border border-line p-2">
                    <DrukproefPreview
                      afbeeldingUrl={p.afbeelding_url}
                      achterAfbeeldingUrl={p.achter_afbeelding_url ?? null}
                      ontwerp={p.ontwerp}
                      formaat="mini"
                      type={p.type}
                      kleur={p.kleur}
                      logoUrl={p.logo_url}
                      positie={p.positie}
                      techniek={p.techniek}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <footer className="afdruk-blok mt-8 grid grid-cols-3 gap-6 border-t border-line pt-5 text-sm text-ink-800">
          <div>
            <p className="font-semibold">Gemaakt door</p>
            <p className="mt-7 border-b border-ink-300" />
          </div>
          <div>
            <p className="font-semibold">Gecontroleerd</p>
            <p className="mt-7 border-b border-ink-300" />
          </div>
          <div>
            <p className="font-semibold">Datum klaar</p>
            <p className="mt-7 border-b border-ink-300" />
            <p className="mt-1 text-[10px] text-warm">{site.name} · {site.phone}</p>
          </div>
        </footer>
      </section>
    </main>
  );
}
