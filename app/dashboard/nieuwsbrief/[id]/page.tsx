import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { formatDatum } from '@/lib/format';
import Tabs from '@/components/dashboard/Tabs';
import { bedrijf } from '@/content/bedrijf';
import { nieuwsbriefBranches, ontvangersVoorDoelgroep, DOELGROEP_LABELS } from '@/lib/kms/nieuwsbrief';
import { STATUS_LABEL, getNieuwsbrief, listModules, listOntvangers, siteUrl, webversieUrl } from '@/lib/nieuwsbrief/opslag';
import { GEEN_MAIL_MELDING, controleerVerzendklaar, nieuwsbriefMailKlaar } from '@/lib/nieuwsbrief/verzenden';
import { renderNieuwsbrief } from '@/lib/nieuwsbrief/render';
import NieuwsbriefEditor from './editor/NieuwsbriefEditor';
import DoelgroepKiezer from './DoelgroepKiezer';
import Testmail from './Testmail';
import Verzenden from './Verzenden';
import { annuleerPlanning, bewaarAlsTemplate, hernoemNieuwsbrief, planNieuwsbriefIn, slaVerzendgegevensOp } from './actions';
import { kopieerNieuwsbriefActie, nieuweNieuwsbriefActie } from '../actions';

export const dynamic = 'force-dynamic';
/** Elke batch van 50 mails blijft hier ruim binnen. */
export const maxDuration = 60;
export const metadata = { title: 'Nieuwsbrief', robots: { index: false, follow: false } };

const MELDINGEN: Record<string, { tekst: string; goed: boolean }> = {
  datum: { tekst: 'Kies een datum vanaf morgen. Wil je vandaag versturen? Gebruik dan Nu versturen.', goed: false },
  status: { tekst: 'Deze nieuwsbrief kan niet (meer) worden ingepland.', goed: false },
  onderwerp: { tekst: 'Vul eerst een onderwerp in en klik op Opslaan. Daarna kun je inplannen.', goed: false },
  ingepland: { tekst: 'Ingepland. De nieuwsbrief wordt op de gekozen dag \'s ochtends vroeg (tussen 07:00 en 08:00) verstuurd.', goed: true },
  geannuleerd: { tekst: 'De planning is geannuleerd. De nieuwsbrief staat weer op concept.', goed: true },
};

const STATUS_BADGE: Record<string, string> = {
  concept: 'badge-rust',
  gepland: 'badge-actie',
  verzenden: 'badge-actie',
  verzonden: 'badge-klaar',
  mislukt: 'badge bg-red-100 text-red-800',
};

const ONTVANGER_STATUS: Record<string, string> = {
  wachtrij: 'Wacht nog',
  verzonden: 'Verstuurd',
  fout: 'Niet gelukt',
  overgeslagen: 'Overgeslagen',
};

function datumNl(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(
    new Date(iso),
  );
}

function tijdNl(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(
    new Date(iso),
  );
}

export default async function NieuwsbriefDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; melding?: string; fout?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;
  const { tab, melding, fout } = await searchParams;

  const brief = await getNieuwsbrief(id);
  if (!brief) notFound();

  const verstuurd = brief.status === 'verzonden' || brief.status === 'verzenden';
  const bewerkbaar = !verstuurd;
  const basis = siteUrl();

  const [modules, branches, ontvangers, ontvangerLijst] = await Promise.all([
    listModules(),
    brief.is_template ? Promise.resolve([]) : nieuwsbriefBranches(),
    brief.is_template || verstuurd ? Promise.resolve([]) : ontvangersVoorDoelgroep(brief.doelgroep),
    brief.is_template ? Promise.resolve([]) : listOntvangers(brief.id),
  ]);

  // De cijfers op de brief zelf zijn leidend (de lijst hieronder toont er max. 1000).
  const totaal = Math.max(brief.aantal_ontvangers ?? 0, ontvangerLijst.length);
  const verzondenAantal = Math.max(brief.aantal_verzonden, ontvangerLijst.filter((o) => o.status === 'verzonden').length);
  const foutAantal = brief.status === 'verzenden' ? ontvangerLijst.filter((o) => o.status === 'fout').length : brief.aantal_fouten;
  const stand = {
    verzonden: verzondenAantal,
    fouten: foutAantal,
    totaal,
    resterend: Math.max(0, totaal - verzondenAantal - foutAantal),
  };
  const webversieZichtbaar = !brief.is_template && ['gepland', 'verzenden', 'verzonden'].includes(brief.status);
  const meldingInfo = melding ? MELDINGEN[melding] : undefined;
  // Inplannen kan vanaf morgen: de verzending loopt via de ochtendronde (zie actions.ts).
  const morgen = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date(Date.now() + 24 * 60 * 60 * 1000));

  /* ---------------- Ontwerp ---------------- */
  const ontwerpTab = bewerkbaar ? (
    <NieuwsbriefEditor nieuwsbriefId={brief.id} naam={brief.naam} initieelOntwerp={brief.ontwerp} modules={modules} siteUrl={basis} />
  ) : (
    <div>
      <p className="mb-3 rounded-lg border border-line bg-mist px-4 py-2.5 text-[13px] text-warm">
        Deze nieuwsbrief is verstuurd en kan niet meer worden aangepast. Wil je hem opnieuw gebruiken? Klik bovenaan op Kopiëren.
      </p>
      <iframe
        title={`Voorbeeld van ${brief.naam}`}
        sandbox=""
        srcDoc={renderNieuwsbrief(brief.ontwerp, { onderwerp: brief.onderwerp || brief.naam, preheader: brief.preheader, modus: 'web', siteUrl: basis })}
        className="h-[80vh] w-full rounded-xl border border-line bg-white"
      />
    </div>
  );

  /* ---------------- Versturen ---------------- */
  const versturenTab = brief.is_template ? (
    <div className="panel max-w-2xl p-5">
      <h2 className="font-display text-lg font-bold text-ink-900">Dit is een template</h2>
      <p className="mt-2 text-[15px] text-warm">
        Een template verstuur je niet zelf. Pas hem aan op het tabblad Ontwerp en maak er daarna een nieuwsbrief van. Elke
        nieuwe nieuwsbrief die je van deze template maakt, begint met dit ontwerp.
      </p>
      <form action={nieuweNieuwsbriefActie} className="mt-4">
        <input type="hidden" name="van" value={brief.id} />
        <button type="submit" className="knop-primair text-[15px]">
          Maak een nieuwsbrief van deze template
        </button>
      </form>
    </div>
  ) : (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-5">
        <section className="panel p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">1. Onderwerp en ontvangers</h2>
          <form action={slaVerzendgegevensOp} className="mt-4 flex flex-col gap-4">
            <input type="hidden" name="id" value={brief.id} />
            <fieldset disabled={verstuurd} className="flex flex-col gap-4 disabled:opacity-70">
              <div>
                <label className="veld-label" htmlFor="onderwerp">
                  Onderwerp
                </label>
                <input
                  id="onderwerp"
                  name="onderwerp"
                  defaultValue={brief.onderwerp ?? ''}
                  maxLength={250}
                  placeholder="Bijv. Nieuw: de winterjassen van 2026 zijn binnen"
                  className="veld text-[16px]"
                />
                <p className="veld-hint">Dit ziet de ontvanger als eerste in de inbox. Je kunt {'{{naam}}'} of {'{{bedrijf}}'} gebruiken.</p>
              </div>
              <div>
                <label className="veld-label" htmlFor="preheader">
                  Voorvertoningstekst
                </label>
                <input
                  id="preheader"
                  name="preheader"
                  defaultValue={brief.preheader ?? ''}
                  maxLength={250}
                  placeholder="Korte zin die in de inbox achter het onderwerp staat"
                  className="veld text-[15px]"
                />
              </div>
              <div>
                <label className="veld-label" htmlFor="afzender_naam">
                  Naam van de afzender
                </label>
                <input
                  id="afzender_naam"
                  name="afzender_naam"
                  defaultValue={brief.afzender_naam ?? ''}
                  maxLength={120}
                  placeholder="Frederiks Bedrijfskleding"
                  className="veld text-[15px]"
                />
                <p className="veld-hint">Antwoorden komen binnen op {bedrijf.email}.</p>
              </div>
              <DoelgroepKiezer begin={brief.doelgroep} branches={branches} uit={verstuurd} />
              <div>
                <button type="submit" className="knop-donker text-[15px]">
                  Opslaan
                </button>
              </div>
            </fieldset>
          </form>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">2. Testmail</h2>
          <div className="mt-4">
            <Testmail id={brief.id} standaard={bedrijf.email} />
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-5">
        <section className="panel p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">3. Versturen</h2>
          {!verstuurd && (
            <p className="mt-2 text-[14px] text-warm">
              Volgens de opgeslagen keuze ({DOELGROEP_LABELS[brief.doelgroep.soort].label.toLowerCase()}
              {brief.doelgroep.soort === 'branches' && brief.doelgroep.branches.length > 0 ? `: ${brief.doelgroep.branches.join(', ')}` : ''}) gaat
              deze nieuwsbrief naar <span className="font-bold text-ink-900">{ontvangers.length}</span>{' '}
              {ontvangers.length === 1 ? 'ontvanger' : 'ontvangers'}.
            </p>
          )}

          <div className="mt-4">
            <Verzenden
              id={brief.id}
              aantal={ontvangers.length}
              status={brief.status}
              stand={stand}
              mailKlaar={nieuwsbriefMailKlaar()}
              geenMailMelding={GEEN_MAIL_MELDING}
              probleem={controleerVerzendklaar(brief)}
            />
          </div>

          {!verstuurd && (
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-[15px] font-bold text-ink-900">Of plan hem in</h3>
              {brief.status === 'gepland' && brief.gepland_op ? (
                <div className="mt-2">
                  <p className="text-[14px] text-ink-900">
                    Ingepland op <span className="font-bold">{datumNl(brief.gepland_op)}</span>, &apos;s ochtends tussen 07:00 en 08:00.
                  </p>
                  <form action={annuleerPlanning} className="mt-3">
                    <input type="hidden" name="id" value={brief.id} />
                    <button type="submit" className="knop-stil">
                      Planning annuleren
                    </button>
                  </form>
                </div>
              ) : (
                <form action={planNieuwsbriefIn} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={brief.id} />
                  <div>
                    <label className="veld-label" htmlFor="datum">
                      Verstuur op
                    </label>
                    <input id="datum" type="date" name="datum" min={morgen} required className="veld text-[15px]" />
                  </div>
                  <button type="submit" className="knop-stil">
                    Inplannen
                  </button>
                </form>
              )}
              <p className="veld-hint">
                De nieuwsbrief wordt op de gekozen dag &apos;s ochtends tussen 07:00 en 08:00 verstuurd, naar de ontvangers die er op
                dat moment in de gekozen doelgroep staan. Vandaag nog versturen? Gebruik dan Nu versturen.
              </p>
            </div>
          )}
        </section>

        {(stand.totaal > 0 || verstuurd) && (
          <section className="panel p-5">
            <h2 className="font-display text-lg font-bold text-ink-900">Resultaat</h2>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-mist px-2 py-3">
                <dt className="text-[12px] text-warm">Ontvangers</dt>
                <dd className="text-xl font-bold tabular-nums text-ink-900">{stand.totaal}</dd>
              </div>
              <div className="rounded-lg bg-green-50 px-2 py-3">
                <dt className="text-[12px] text-green-800">Verstuurd</dt>
                <dd className="text-xl font-bold tabular-nums text-green-800">{stand.verzonden}</dd>
              </div>
              <div className={`rounded-lg px-2 py-3 ${stand.fouten ? 'bg-red-50' : 'bg-mist'}`}>
                <dt className={`text-[12px] ${stand.fouten ? 'text-red-700' : 'text-warm'}`}>Niet gelukt</dt>
                <dd className={`text-xl font-bold tabular-nums ${stand.fouten ? 'text-red-700' : 'text-ink-900'}`}>{stand.fouten}</dd>
              </div>
            </dl>
            {brief.verzonden_op && <p className="mt-3 text-[13px] text-warm">Klaar op {tijdNl(brief.verzonden_op)}.</p>}
            {ontvangerLijst.length > 0 && (
              <details className="mt-3" open={stand.fouten > 0}>
                <summary className="cursor-pointer text-[14px] font-semibold text-ink-900">Bekijk alle ontvangers</summary>
                <div className="mt-2 max-h-96 overflow-auto">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>E-mail</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ontvangerLijst.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <span className="text-ink-900">{o.email}</span>
                            {o.status === 'fout' && o.fout && !o.fout.startsWith('bezig:') && (
                              <span className="block text-[12px] text-red-700">{o.fout}</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap">
                            <span className={o.status === 'verzonden' ? 'badge-klaar' : o.status === 'fout' ? 'badge bg-red-100 text-red-800' : 'badge-rust'}>
                              {ONTVANGER_STATUS[o.status] ?? o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </section>
        )}
      </div>
    </div>
  );

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex-wrap justify-between gap-4">
        <div className="min-w-0">
          <Link href="/dashboard/nieuwsbrief" className="text-[13px] font-semibold text-warm hover:text-ink-800">
            Terug naar nieuwsbrieven
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="dash-h1 truncate">{brief.naam}</h1>
            {brief.is_template ? (
              <span className="badge-actie">Template</span>
            ) : (
              <span className={STATUS_BADGE[brief.status] ?? 'badge-rust'}>{STATUS_LABEL[brief.status]}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {webversieZichtbaar && (
            <a href={webversieUrl(brief.web_token)} target="_blank" rel="noopener" className="knop-stil">
              Webversie bekijken
            </a>
          )}
          <form action={kopieerNieuwsbriefActie}>
            <input type="hidden" name="id" value={brief.id} />
            <button type="submit" className="knop-stil">
              Kopiëren
            </button>
          </form>
          {!brief.is_template && (
            <form action={bewaarAlsTemplate}>
              <input type="hidden" name="id" value={brief.id} />
              <button type="submit" className="knop-stil" title="Bewaar dit ontwerp als template voor volgende nieuwsbrieven">
                Bewaar als template
              </button>
            </form>
          )}
        </div>
      </div>

      {bewerkbaar && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-warm hover:text-ink-800">Naam wijzigen</summary>
          <form action={hernoemNieuwsbrief} className="mt-2 flex flex-wrap gap-2">
            <input type="hidden" name="id" value={brief.id} />
            <input name="naam" defaultValue={brief.naam} required maxLength={200} className="veld w-80 text-[15px]" aria-label="Naam van de nieuwsbrief" />
            <button type="submit" className="knop-stil">
              Naam opslaan
            </button>
          </form>
          <p className="veld-hint">De naam is alleen voor jezelf, de ontvanger ziet het onderwerp.</p>
        </details>
      )}

      {meldingInfo && (
        <p
          role="status"
          className={`mt-4 rounded-lg border px-4 py-2.5 text-[14px] font-semibold ${
            meldingInfo.goed ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {meldingInfo.tekst}
        </p>
      )}
      {fout === 'template' && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[14px] font-semibold text-red-700">
          Bewaren als template is mislukt. Probeer het nog een keer.
        </p>
      )}
      {brief.status === 'gepland' && brief.gepland_op && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[14px] text-amber-800">
          Ingepland voor {datumNl(brief.gepland_op)}, &apos;s ochtends tussen 07:00 en 08:00. Wijzigingen in het ontwerp gaan gewoon mee, zolang je ze
          vóór die tijd opslaat.
        </p>
      )}

      <div className="mt-5">
        <Tabs
          initial={tab === 'versturen' ? 'versturen' : 'ontwerp'}
          tabs={[
            { id: 'ontwerp', label: 'Ontwerp', content: ontwerpTab },
            {
              id: 'versturen',
              label: brief.is_template ? 'Gebruiken' : 'Versturen',
              content: versturenTab,
              badge: brief.status === 'verzonden' ? stand.verzonden : null,
            },
          ]}
        />
      </div>

      <p className="mt-6 text-[12px] text-warm">
        Laatst bewerkt op {formatDatum(brief.updated_at)}
        {brief.is_template ? '' : ` · aangemaakt op ${formatDatum(brief.created_at)}`}
      </p>
    </main>
  );
}
