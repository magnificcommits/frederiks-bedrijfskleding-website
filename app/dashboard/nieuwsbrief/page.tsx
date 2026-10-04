import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { formatDatum } from '@/lib/format';
import {
  getNieuwsbriefOverzicht,
  filterAdressen,
  tellPerBranche,
  teMailen,
  alsMailregel,
  alsCsv,
} from '@/lib/kms/nieuwsbrief';
import Drawer from '@/components/dashboard/Drawer';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import EmptyState from '@/components/dashboard/EmptyState';
import { ensureBasisTemplate, listNieuwsbrieven, webversieUrl, STATUS_LABEL, type NieuwsbriefKop } from '@/lib/nieuwsbrief/opslag';
import AdressenKopieren from './AdressenKopieren';
import BevestigKnop from './BevestigKnop';
import { kopieerNieuwsbriefActie, nieuweNieuwsbriefActie, verwijderNieuwsbriefActie, zetAfgemeldActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nieuwsbrief', robots: { index: false, follow: false } };

const okBoodschap: Record<string, string> = {
  afgemeld: 'Dit adres krijgt de nieuwsbrief niet meer.',
  aangemeld: 'Dit adres staat weer in de lijst.',
  mislukt: 'Er is niets gewijzigd. Probeer het nog een keer.',
  'nog-niet-klaar':
    'Wel of niet mailen kan nog niet worden vastgelegd, de database mist daar nog een veld voor. De lijst zelf klopt gewoon.',
};

/** Meldingen die geen succes zijn en dus niet in een groen balkje horen. */
const foutMeldingen = new Set(['mislukt', 'nog-niet-klaar']);

/** Bestandsnaam van de export, met de branche en de datum erin. */
function csvNaam(branche: string): string {
  const datum = new Date().toISOString().slice(0, 10);
  const deel =
    branche
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'alle-branches';
  return `nieuwsbrief-${deel}-${datum}.csv`;
}

/** Tabblad Adressen: de bestaande lijst om te kopiëren en te exporteren. */
async function AdressenTab({ branche, zoek, ok }: { branche?: string; zoek?: string; ok?: string }) {
  const brancheFilter = (branche ?? '').trim();
  const zoekTerm = (zoek ?? '').trim();

  const { adressen, zonderAdres, afmeldenMogelijk, wachtOpBevestiging } = await getNieuwsbriefOverzicht();
  // De tellers op de chips gaan over de zoekterm die nu actief is. Tellen over
  // de hele lijst zou een chip "Bouw 42" laten zien terwijl je er na het
  // aanklikken 3 overhoudt, en dan klopt het getal dat je kopieert niet.
  const branches = tellPerBranche(filterAdressen(adressen, { zoek: zoekTerm }));
  const zichtbaar = filterAdressen(adressen, { branche: brancheFilter, zoek: zoekTerm });
  const mailbaar = teMailen(zichtbaar);
  const aantalAfgemeld = zichtbaar.length - mailbaar.length;
  const totaal = teMailen(adressen).length;
  const heeftFilter = Boolean(brancheFilter || zoekTerm);

  /** URL met de andere filters intact. */
  function url(next: { zoek?: string; branche?: string }) {
    const p = new URLSearchParams();
    p.set('tab', 'adressen');
    const z = next.zoek !== undefined ? next.zoek : zoekTerm;
    const b = next.branche !== undefined ? next.branche : brancheFilter;
    if (z) p.set('zoek', z);
    if (b) p.set('branche', b);
    return `/dashboard/nieuwsbrief?${p.toString()}`;
  }

  return (
    <>
      <p className="text-[13px] text-warm">
        <span className="font-semibold tabular-nums text-ink-900">{heeftFilter ? `${mailbaar.length} van ${totaal}` : totaal}</span>{' '}
        adressen in de lijst
      </p>
      <p className="dash-sub mt-2 max-w-3xl">
        Alle algemene e-mailadressen van klanten, met bedrijf en branche erbij, plus de aanmeldingen
        via het formulier op de site. De lijst wordt live opgebouwd uit de klantkaarten, dus een
        nieuwe klant staat er meteen in zodra het algemene e-mailadres is ingevuld. Kies een branche,
        kopieer de adressen en plak ze in het bcc-veld van je mailprogramma. Versturen vanuit het programma zelf
        doe je op het tabblad Nieuwsbrieven; daar wordt dezelfde lijst gebruikt.
      </p>

      {ok && okBoodschap[ok] && (
        <p
          className={`mt-4 rounded-lg border px-4 py-2.5 text-[13px] font-semibold ${
            foutMeldingen.has(ok)
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-green-200 bg-green-50 text-green-800'
          }`}
        >
          {okBoodschap[ok]}
        </p>
      )}

      <div className="dash-filter flex flex-wrap items-center gap-2">
        <LiveZoekveld
          param="zoek"
          vast={{ tab: 'adressen' }}
          placeholder="Zoek op bedrijf, naam of e-mailadres"
          ariaLabel="Zoeken in de nieuwsbrieflijst"
        />

        {brancheFilter && (
          <Link href={url({ branche: '' })} className="chip chip-aan" title="Filter op branche wissen">
            {brancheFilter}
            <span aria-hidden="true">×</span>
            <span className="sr-only">wissen</span>
          </Link>
        )}
        {heeftFilter && (
          <Link href="/dashboard/nieuwsbrief?tab=adressen" className="knop-tekst">
            Alles wissen
          </Link>
        )}
      </div>

      {!brancheFilter && branches.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {branches.map((b) => (
            <Link key={b.branche} href={url({ branche: b.branche })} className="chip">
              {b.branche}
              <span className="chip-tel">{b.aantal}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-lg border border-line bg-mist px-4 py-3">
        <p className="text-[13px] text-warm">
          <span className="font-semibold text-ink-900">{mailbaar.length}</span>{' '}
          {mailbaar.length === 1 ? 'adres' : 'adressen'} klaar om te versturen
          {brancheFilter && (
            <>
              {' '}
              in de branche <span className="font-semibold text-ink-900">{brancheFilter}</span>
            </>
          )}
          {aantalAfgemeld > 0 && (
            <>
              {' '}· {aantalAfgemeld} {aantalAfgemeld === 1 ? 'adres staat' : 'adressen staan'} op
              niet mailen en {aantalAfgemeld === 1 ? 'gaat' : 'gaan'} niet mee
            </>
          )}
          .
        </p>
        <div className="mt-2.5">
          <AdressenKopieren
            mailregel={alsMailregel(zichtbaar)}
            csv={alsCsv(zichtbaar)}
            aantal={mailbaar.length}
            bestandsnaam={csvNaam(brancheFilter)}
          />
        </div>
      </div>

      {!afmeldenMogelijk && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800">
          Een adres op niet mailen zetten kan nog niet. De database mist daar nog een veld voor, dus
          die knop staat uit tot dat is bijgewerkt. Zoeken, filteren, kopiëren en exporteren werken
          gewoon.
        </p>
      )}

      {(wachtOpBevestiging ?? 0) > 0 && (
        <p className="mt-4 text-[13px] text-warm">
          {wachtOpBevestiging === 1 ? 'Eén aanmelding' : `${wachtOpBevestiging} aanmeldingen`} via de site{' '}
          {wachtOpBevestiging === 1 ? 'wacht' : 'wachten'} nog op de klik in de bevestigingsmail. Die adressen staan pas in de lijst als ze
          bevestigd zijn (AVG).
        </p>
      )}

      <div className="panel mt-4">
        {zichtbaar.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-warm">
            {heeftFilter
              ? 'Geen adressen met deze filters.'
              : 'Er staan nog geen adressen in de lijst. Vul op een klantkaart het algemene e-mailadres in, dan verschijnt die klant hier vanzelf.'}
          </p>
        ) : (
          <table className="tbl">
            <thead className="thead-sticky-filter">
              <tr>
                <th>E-mail</th>
                <th>Bedrijf</th>
                <th>Branche</th>
                <th>Herkomst</th>
                <th>In de lijst sinds</th>
                {afmeldenMogelijk && (
                  <th className="w-28">
                    <span className="sr-only">Wel of niet mailen</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {zichtbaar.map((a) => (
                <tr key={a.email} className={a.afgemeld ? 'opacity-60' : undefined}>
                  <td>
                    <span className={a.afgemeld ? 'text-warm line-through' : 'text-ink-900'}>{a.email}</span>
                    {a.afgemeld && <span className="badge-rust ml-2">niet mailen</span>}
                  </td>
                  <td>
                    {a.organisatie_id && a.bedrijf ? (
                      <Link href={`/dashboard/klanten/${a.organisatie_id}`} className="rij-link">
                        {a.bedrijf}
                      </Link>
                    ) : (
                      <span className="stil">{a.bedrijf || a.naam || '—'}</span>
                    )}
                  </td>
                  <td className="stil">{a.branche || '—'}</td>
                  <td className="stil">{a.bron === 'klant' ? 'Klant' : 'Aanmelding via de site'}</td>
                  <td className="stil whitespace-nowrap">{a.sinds ? formatDatum(a.sinds) : '—'}</td>
                  {afmeldenMogelijk && (
                    <td className="text-right">
                      <form action={zetAfgemeldActie}>
                        <input type="hidden" name="email" value={a.email} />
                        <input type="hidden" name="afgemeld" value={a.afgemeld ? '0' : '1'} />
                        <input type="hidden" name="organisatie_id" value={a.organisatie_id ?? ''} />
                        <input type="hidden" name="zoek" value={zoekTerm} />
                        <input type="hidden" name="branche" value={brancheFilter} />
                        <button type="submit" className="knop-tekst">
                          {a.afgemeld ? 'Weer mailen' : 'Niet mailen'}
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {zonderAdres.length > 0 && (
        <details className="panel mt-6 p-4">
          <summary className="cursor-pointer font-display text-base font-bold text-ink-900">
            Klanten zonder algemeen e-mailadres ({zonderAdres.length})
          </summary>
          <p className="mt-2 max-w-3xl text-[13px] text-warm">
            Deze klanten staan nog niet in de nieuwsbrieflijst, omdat het veld Algemeen e-mailadres
            op hun klantkaart leeg is. Vul dat in en ze staan er de volgende keer bij. Staat er een
            adres van de contactpersoon bij, dan is dat een suggestie die je kunt overnemen. Neem hem
            niet blind over: dat is een persoon en geen bedrijfsadres.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Klant</th>
                  <th>Branche</th>
                  <th>Adres van de contactpersoon</th>
                </tr>
              </thead>
              <tbody>
                {zonderAdres.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <Link href={`/dashboard/klanten/${k.id}`} className="rij-link">
                        {k.naam}
                      </Link>
                    </td>
                    <td className="stil">{k.branche || '—'}</td>
                    <td className="stil">{k.suggestie || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  );
}

const FOUTEN: Record<string, string> = {
  nieuwsbrief: 'Er kon geen nieuwe nieuwsbrief worden gemaakt. Probeer het nog een keer.',
  'niet-verwijderen': 'Een verzonden of ingeplande nieuwsbrief kun je niet verwijderen.',
};

function tijdNl(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(
    new Date(iso),
  );
}

function dagNl(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' }).format(new Date(iso));
}

function KopieerKnop({ id, label = 'Kopiëren' }: { id: string; label?: string }) {
  return (
    <form action={kopieerNieuwsbriefActie}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="knop-tekst">
        {label}
      </button>
    </form>
  );
}

function VerwijderKnop({ brief }: { brief: NieuwsbriefKop }) {
  return (
    <form action={verwijderNieuwsbriefActie}>
      <input type="hidden" name="id" value={brief.id} />
      <BevestigKnop vraag={`"${brief.naam}" verwijderen? Dit kan niet ongedaan worden gemaakt.`}>Verwijderen</BevestigKnop>
    </form>
  );
}

/** Tabblad Nieuwsbrieven: concepten, ingepland, verzonden en templates. */
async function BrievenTab({ fout }: { fout?: string }) {
  const templateId = await ensureBasisTemplate();
  const alle = await listNieuwsbrieven();
  const templates = alle.filter((b) => b.is_template);
  const brieven = alle.filter((b) => !b.is_template);
  const concepten = brieven.filter((b) => b.status === 'concept' || b.status === 'mislukt');
  const gepland = brieven
    .filter((b) => b.status === 'gepland' || b.status === 'verzenden')
    .sort((a, b) => (a.gepland_op ?? '').localeCompare(b.gepland_op ?? ''));
  const verzonden = brieven
    .filter((b) => b.status === 'verzonden')
    .sort((a, b) => (b.verzonden_op ?? '').localeCompare(a.verzonden_op ?? ''));

  return (
    <div className="flex flex-col gap-6">
      {fout && FOUTEN[fout] && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[14px] font-semibold text-red-700">{FOUTEN[fout]}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Drawer
          knop="Nieuwe nieuwsbrief"
          titel="Nieuwe nieuwsbrief"
          beschrijving="Begin met de basistemplate (header, footer en de vaste opbouw), of met een kopie van een eerdere nieuwsbrief."
        >
          <form action={nieuweNieuwsbriefActie} className="mt-4 flex flex-col gap-4">
            <div>
              <label className="veld-label" htmlFor="nb-naam">
                Naam (alleen voor jezelf)
              </label>
              <input id="nb-naam" name="naam" placeholder="Bijv. Nieuwsbrief november" className="veld text-[15px]" />
            </div>
            <div>
              <label className="veld-label" htmlFor="nb-van">
                Begin met
              </label>
              <select id="nb-van" name="van" defaultValue={templateId ?? ''} className="veld text-[15px]">
                {templates.length > 0 && (
                  <optgroup label="Templates">
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.naam}
                      </option>
                    ))}
                  </optgroup>
                )}
                {brieven.length > 0 && (
                  <optgroup label="Kopie van een eerdere nieuwsbrief">
                    {brieven.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.naam}
                        {b.verzonden_op ? ` (verzonden ${formatDatum(b.verzonden_op)})` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div>
              <button type="submit" className="knop-primair text-[15px]">
                Maken en openen
              </button>
            </div>
          </form>
        </Drawer>
        {templateId && (
          <Link href={`/dashboard/nieuwsbrief/${templateId}`} className="knop-stil">
            Template beheren
          </Link>
        )}
      </div>

      <section>
        <h2 className="font-display text-lg font-bold text-ink-900">Concepten</h2>
        {concepten.length === 0 ? (
          <div className="mt-2">
            <EmptyState tekst="Er staan geen concepten klaar. Klik op Nieuwe nieuwsbrief om er een te maken." />
          </div>
        ) : (
          <div className="panel mt-2 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Naam</th>
                  <th>Onderwerp</th>
                  <th>Laatst bewerkt</th>
                  <th>
                    <span className="sr-only">Acties</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {concepten.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/dashboard/nieuwsbrief/${b.id}`} className="rij-link">
                        {b.naam}
                      </Link>
                      {b.status === 'mislukt' && <span className="badge ml-2 bg-red-100 text-red-800">{STATUS_LABEL.mislukt}</span>}
                    </td>
                    <td className="stil">{b.onderwerp || '—'}</td>
                    <td className="stil whitespace-nowrap">{tijdNl(b.updated_at)}</td>
                    <td>
                      <div className="flex justify-end gap-3">
                        <Link href={`/dashboard/nieuwsbrief/${b.id}`} className="knop-tekst">
                          Openen
                        </Link>
                        <KopieerKnop id={b.id} />
                        <VerwijderKnop brief={b} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {gepland.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold text-ink-900">Ingepland en bezig</h2>
          <div className="panel mt-2 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Naam</th>
                  <th>Onderwerp</th>
                  <th>Wanneer</th>
                  <th>
                    <span className="sr-only">Acties</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {gepland.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/dashboard/nieuwsbrief/${b.id}`} className="rij-link">
                        {b.naam}
                      </Link>
                    </td>
                    <td className="stil">{b.onderwerp || '—'}</td>
                    <td className="whitespace-nowrap">
                      {b.status === 'verzenden' ? (
                        <span className="badge-actie">
                          Wordt verstuurd ({b.aantal_verzonden} van {b.aantal_ontvangers ?? '?'})
                        </span>
                      ) : (
                        <span>{dagNl(b.gepland_op)}, &apos;s ochtends tussen 07:00 en 08:00</span>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-3">
                        <Link href={`/dashboard/nieuwsbrief/${b.id}?tab=versturen`} className="knop-tekst">
                          Openen
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-lg font-bold text-ink-900">Verzonden</h2>
        {verzonden.length === 0 ? (
          <p className="mt-2 text-[14px] text-warm">Nog geen nieuwsbrieven verstuurd vanuit het programma.</p>
        ) : (
          <div className="panel mt-2 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Naam</th>
                  <th>Onderwerp</th>
                  <th>Verzonden op</th>
                  <th className="text-right">Ontvangers</th>
                  <th className="text-right">Verstuurd</th>
                  <th className="text-right">Niet gelukt</th>
                  <th>
                    <span className="sr-only">Acties</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {verzonden.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/dashboard/nieuwsbrief/${b.id}?tab=versturen`} className="rij-link">
                        {b.naam}
                      </Link>
                    </td>
                    <td className="stil">{b.onderwerp || '—'}</td>
                    <td className="stil whitespace-nowrap">{tijdNl(b.verzonden_op)}</td>
                    <td className="text-right tabular-nums">{b.aantal_ontvangers ?? 0}</td>
                    <td className="text-right tabular-nums">{b.aantal_verzonden}</td>
                    <td className={`text-right tabular-nums ${b.aantal_fouten ? 'font-semibold text-red-700' : ''}`}>{b.aantal_fouten}</td>
                    <td>
                      <div className="flex justify-end gap-3">
                        <a href={webversieUrl(b.web_token)} target="_blank" rel="noopener" className="knop-tekst">
                          Webversie
                        </a>
                        <KopieerKnop id={b.id} label="Kopieer als nieuwe" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-ink-900">Templates</h2>
        <p className="mt-1 max-w-3xl text-[14px] text-warm">
          Een template is de basis waar elke nieuwe nieuwsbrief mee begint: de vaste header, footer en opbouw. Pas de
          template aan als je iets voor alle volgende nieuwsbrieven wilt veranderen.
        </p>
        <div className="panel mt-2 overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Naam</th>
                <th>Laatst bewerkt</th>
                <th>
                  <span className="sr-only">Acties</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/dashboard/nieuwsbrief/${t.id}`} className="rij-link">
                      {t.naam}
                    </Link>
                  </td>
                  <td className="stil whitespace-nowrap">{tijdNl(t.updated_at)}</td>
                  <td>
                    <div className="flex justify-end gap-3">
                      <form action={nieuweNieuwsbriefActie}>
                        <input type="hidden" name="van" value={t.id} />
                        <button type="submit" className="knop-tekst">
                          Nieuwe nieuwsbrief hiervan
                        </button>
                      </form>
                      <Link href={`/dashboard/nieuwsbrief/${t.id}`} className="knop-tekst">
                        Bewerken
                      </Link>
                      <KopieerKnop id={t.id} />
                      {templates.length > 1 && <VerwijderKnop brief={t} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default async function NieuwsbriefPage({
  searchParams,
}: {
  searchParams: Promise<{ branche?: string; zoek?: string; ok?: string; tab?: string; fout?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');

  const { branche, zoek, ok, tab, fout } = await searchParams;
  // Filters of een melding over een adres horen bij het tabblad Adressen.
  const adressenActief = tab === 'adressen' || Boolean(branche || zoek || (ok && ok in okBoodschap));

  return (
    <main className="container-app py-6">
      <div className="dash-kop justify-between gap-4">
        <h1 className="dash-h1">Nieuwsbrief</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">
          Terug naar dashboard
        </Link>
      </div>

      <nav className="mt-4 flex flex-wrap gap-1 border-b border-line" aria-label="Onderdelen nieuwsbrief">
        {[
          { id: 'brieven', label: 'Nieuwsbrieven', href: '/dashboard/nieuwsbrief', aan: !adressenActief },
          { id: 'adressen', label: 'Adressen', href: '/dashboard/nieuwsbrief?tab=adressen', aan: adressenActief },
        ].map((t) => (
          <Link
            key={t.id}
            href={t.href}
            aria-current={t.aan ? 'page' : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              t.aan ? 'border-amber-600 text-ink-900' : 'border-transparent text-warm hover:text-ink-800'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="pt-6">{adressenActief ? <AdressenTab branche={branche} zoek={zoek} ok={ok} /> : <BrievenTab fout={fout} />}</div>
    </main>
  );
}
