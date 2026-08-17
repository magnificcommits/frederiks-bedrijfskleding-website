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
import AdressenKopieren from './AdressenKopieren';
import { zetAfgemeldActie } from './actions';

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

export default async function NieuwsbriefPage({
  searchParams,
}: {
  searchParams: Promise<{ branche?: string; zoek?: string; ok?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');

  const { branche, zoek, ok } = await searchParams;
  const brancheFilter = (branche ?? '').trim();
  const zoekTerm = (zoek ?? '').trim();

  const { adressen, zonderAdres, afmeldenMogelijk } = await getNieuwsbriefOverzicht();
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
    const z = next.zoek !== undefined ? next.zoek : zoekTerm;
    const b = next.branche !== undefined ? next.branche : brancheFilter;
    if (z) p.set('zoek', z);
    if (b) p.set('branche', b);
    const qs = p.toString();
    return qs ? `/dashboard/nieuwsbrief?${qs}` : '/dashboard/nieuwsbrief';
  }

  return (
    <main className="container-app py-6">
      <div className="dash-kop justify-between gap-4">
        <div className="flex items-baseline gap-2.5">
          <h1 className="dash-h1">Nieuwsbrief</h1>
          <span className="text-[13px] tabular-nums text-warm">
            {heeftFilter ? `${mailbaar.length} van ${totaal}` : totaal}
          </span>
        </div>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">
          Terug naar dashboard
        </Link>
      </div>

      <p className="dash-sub mt-2 max-w-3xl">
        Alle algemene e-mailadressen van klanten, met bedrijf en branche erbij, plus de aanmeldingen
        via het formulier op de site. De lijst wordt live opgebouwd uit de klantkaarten, dus een
        nieuwe klant staat er meteen in zodra het algemene e-mailadres is ingevuld. Kies een branche,
        kopieer de adressen en plak ze in het bcc-veld van je mailprogramma.
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
        <form method="get" className="flex items-center gap-2">
          {brancheFilter && <input type="hidden" name="branche" value={brancheFilter} />}
          <input
            name="zoek"
            defaultValue={zoekTerm}
            placeholder="Zoek op bedrijf of e-mailadres"
            aria-label="Zoeken in de nieuwsbrieflijst"
            className="veld w-72"
          />
          <button type="submit" className="knop-stil">
            Zoeken
          </button>
        </form>

        {brancheFilter && (
          <Link href={url({ branche: '' })} className="chip chip-aan" title="Filter op branche wissen">
            {brancheFilter}
            <span aria-hidden="true">×</span>
            <span className="sr-only">wissen</span>
          </Link>
        )}
        {zoekTerm && (
          <Link href={url({ zoek: '' })} className="chip" title="Zoekterm wissen">
            “{zoekTerm}” <span aria-hidden="true">×</span>
          </Link>
        )}
        {heeftFilter && (
          <Link href="/dashboard/nieuwsbrief" className="knop-tekst">
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
    </main>
  );
}
