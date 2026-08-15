/**
 * Nagebouwd portaalscherm: geen screenshot maar HTML + Tailwind, zodat het
 * meebeweegt met de huisstijl en scherp blijft op elk scherm. Puur presentatie,
 * geen interactie en geen state. Decoratieve onderdelen (vensterknoppen,
 * zijbalk, voortgangsbalkjes) staan op aria-hidden; de kerngetallen en de
 * tabel blijven gewoon voorleesbaar.
 *
 * Het scherm staat op een lichte achtergrondvorm met een diepe schaduw, zodat
 * het als beeld genoeg gewicht heeft. Daarnaast staat PortaalFragmenten: drie
 * uitvergrote uitsnedes die elk één handeling tonen. Een druk dashboard lees je
 * niet, drie losse fragmenten wel.
 */

export type PortaalDemoStatus = 'wacht' | 'geleverd' | 'productie';

export type PortaalDemoRegel = {
  naam: string;
  functie: string;
  laatsteBestelling: string;
  /** Gebruikt deel van het jaarbudget, 0 tot 100. */
  budgetGebruik: number;
  status: PortaalDemoStatus;
};

const statusStijl: Record<PortaalDemoStatus, { label: string; klasse: string }> = {
  wacht: { label: 'wacht op jou', klasse: 'badge-actie' },
  geleverd: { label: 'geleverd', klasse: 'badge-klaar' },
  productie: { label: 'in productie', klasse: 'badge-rust' },
};

const standaardNavigatie = [
  'Overzicht',
  'Bestellen',
  'Medewerkers',
  'Budget',
  'Goedkeuringen',
  'Facturen',
  'Retour',
];

const standaardRegels: PortaalDemoRegel[] = [
  { naam: 'M. Wolters', functie: 'Timmerman', laatsteBestelling: '4 juni', budgetGebruik: 72, status: 'wacht' },
  { naam: 'J. Bruggink', functie: 'Buitendienst', laatsteBestelling: '28 mei', budgetGebruik: 48, status: 'geleverd' },
  { naam: 'H. te Loeke', functie: 'Magazijn', laatsteBestelling: '19 mei', budgetGebruik: 35, status: 'productie' },
  { naam: 'R. Eenink', functie: 'Nieuw in dienst', laatsteBestelling: '3 juni', budgetGebruik: 12, status: 'wacht' },
];

export function PortaalDemo({
  bedrijfsnaam = 'Voorbeeld Techniek B.V.',
  budgetOver = '62%',
  medewerkers = 34,
  wachtOpAkkoord = 2,
  navigatie = standaardNavigatie,
  actiefItem = 'Overzicht',
  regels = standaardRegels,
  className = '',
}: {
  bedrijfsnaam?: string;
  budgetOver?: string;
  medewerkers?: number;
  wachtOpAkkoord?: number;
  navigatie?: string[];
  actiefItem?: string;
  regels?: PortaalDemoRegel[];
  className?: string;
}) {
  const kerngetallen = [
    { label: 'Budget over dit jaar', waarde: budgetOver },
    { label: 'Medewerkers', waarde: String(medewerkers) },
    { label: 'Wacht op jouw akkoord', waarde: String(wachtOpAkkoord) },
  ];

  return (
    // isolate houdt de achtergrondvorm (-z-10) binnen dit blok, zodat hij niet
    // achter de sectieachtergrond verdwijnt.
    <div className={`relative isolate ${className}`}>
      {/* Achtergrondvorm: geeft het scherm diepte zonder het te laten zweven. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-1 -bottom-3 top-8 -z-10 -rotate-[0.5deg] rounded-[1.75rem] bg-amber-100/70 sm:inset-x-5 sm:-bottom-5"
      />
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_2px_6px_rgba(28,28,28,0.06),0_36px_70px_-34px_rgba(28,28,28,0.55)] ring-1 ring-ink-900/5">
        {/* Titelbalk */}
        <div className="flex items-center gap-3 bg-ink-900 px-4 py-3 sm:px-5">
          <span className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-ink-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-ink-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-ink-600" />
          </span>
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white sm:ml-2">
            Kledingportaal <span className="text-ink-400" aria-hidden="true">—</span>{' '}
            <span className="text-ink-100">{bedrijfsnaam}</span>
          </p>
          <span className="shrink-0 rounded bg-amber-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-900">
            jouw huisstijl
          </span>
        </div>

        <div className="flex">
          {/* Navigatiekolom: decoratief, verdwijnt op mobiel */}
          <nav
            className="hidden w-44 shrink-0 bg-ink-800 p-3 md:block lg:w-48"
            aria-hidden="true"
          >
            <ul className="space-y-0.5">
              {navigatie.map((item) => {
                const actief = item === actiefItem;
                return (
                  <li key={item}>
                    <span
                      className={
                        actief
                          ? 'flex items-center justify-between rounded-md bg-amber-500 px-2.5 py-1.5 text-[13px] font-bold text-ink-900'
                          : 'flex items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] text-ink-300'
                      }
                    >
                      {item}
                      {item === 'Goedkeuringen' && wachtOpAkkoord > 0 && (
                        <span className="rounded bg-amber-500 px-1.5 text-[11px] font-bold tabular-nums text-ink-900">
                          {wachtOpAkkoord}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Werkvlak */}
          <div className="min-w-0 flex-1 bg-mist p-4 sm:p-5">
            <dl className="grid grid-cols-3 gap-2 sm:gap-3">
              {kerngetallen.map((k) => (
                <div key={k.label} className="rounded-lg border border-line bg-white p-3">
                  <dt className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-warm">{k.label}</dt>
                  <dd className="mt-1 font-display text-xl font-extrabold tabular-nums text-ink-900 sm:text-2xl">{k.waarde}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-3 overflow-hidden rounded-lg border border-line bg-white sm:mt-4">
              <table className="tbl">
                <caption className="sr-only">
                  Voorbeeld van het beheeroverzicht in het kledingportaal: laatste bestellingen per medewerker.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Medewerker</th>
                    <th scope="col" className="hidden sm:table-cell">Functie</th>
                    <th scope="col" className="hidden lg:table-cell">Laatste bestelling</th>
                    <th scope="col" className="hidden sm:table-cell">Budgetgebruik</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {regels.map((r, i) => (
                    <tr key={r.naam}>
                      <th
                        scope="row"
                        className={`px-3 py-1.5 text-left font-semibold text-ink-900 ${
                          i === regels.length - 1 ? '' : 'border-b border-line'
                        }`}
                      >
                        {r.naam}
                      </th>
                      <td className="hidden sm:table-cell">{r.functie}</td>
                      <td className="hidden lg:table-cell stil">{r.laatsteBestelling}</td>
                      <td className="hidden sm:table-cell">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
                            <span
                              className="block h-full rounded-full bg-amber-500"
                              style={{ width: `${Math.min(100, Math.max(0, r.budgetGebruik))}%` }}
                            />
                          </span>
                          <span className="tabular-nums text-warm">{r.budgetGebruik}%</span>
                        </span>
                      </td>
                      <td>
                        <span className={statusStijl[r.status].klasse}>{statusStijl[r.status].label}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Kaartje rond één uitvergrote uitsnede uit het portaal. */
function Uitsnede({
  kop,
  children,
}: {
  kop: string;
  children: React.ReactNode;
}) {
  return (
    <li className="relative rounded-xl border border-line bg-white p-4 pt-5 shadow-card sm:p-5 sm:pt-6">
      <span
        aria-hidden="true"
        className="absolute -top-2.5 left-4 rounded-[3px] border border-line bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700"
      >
        uitsnede
      </span>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-warm">{kop}</p>
      {children}
    </li>
  );
}

/**
 * Drie uitvergrote fragmenten uit hetzelfde scherm. Elk fragment toont één
 * handeling, op ware grootte leesbaar. De nagebootste knoppen en balkjes zijn
 * spans, geen buttons: het is een afbeelding van het portaal, geen portaal.
 */
export function PortaalFragmenten({ className = '' }: { className?: string }) {
  return (
    <ul className={`grid gap-5 sm:grid-cols-3 ${className}`}>
      <Uitsnede kop="Goedkeuring">
        <p className="mt-1.5 text-[15px] font-semibold leading-snug text-ink-900">
          M. Wolters vraagt een regenjas buiten zijn pakket.
        </p>
        <span className="mt-3 flex flex-wrap gap-2" aria-hidden="true">
          <span className="rounded-md bg-amber-500 px-3 py-1.5 text-[13px] font-bold text-ink-900">Akkoord</span>
          <span className="rounded-md border border-line px-3 py-1.5 text-[13px] font-semibold text-ink-700">Later</span>
        </span>
      </Uitsnede>

      <Uitsnede kop="Budget">
        <p className="mt-1.5 text-[15px] font-semibold leading-snug text-ink-900">Timmerman</p>
        <span className="mt-3 flex items-center gap-3">
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
            <span className="block h-full w-[72%] rounded-full bg-amber-500" />
          </span>
          <span className="font-display text-lg font-extrabold tabular-nums text-ink-900">72%</span>
        </span>
        <p className="mt-2 text-[13px] text-warm">van het jaarbudget gebruikt</p>
      </Uitsnede>

      <Uitsnede kop="Inloggen">
        <p className="mt-1.5 text-[15px] font-semibold leading-snug text-ink-900">
          Je collega krijgt een link per mail.
        </p>
        <span
          aria-hidden="true"
          className="mt-3 flex items-center gap-2 rounded-md border border-line bg-mist px-3 py-2 text-[12px] text-warm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M10 13.5a4 4 0 0 0 5.7.4l3-3a4 4 0 0 0-5.7-5.7l-1.1 1.1" />
            <path d="M14 10.5a4 4 0 0 0-5.7-.4l-3 3a4 4 0 0 0 5.7 5.7l1.1-1.1" />
          </svg>
          <span className="truncate">frederiksbedrijfskleding.nl/portaal</span>
        </span>
        <p className="mt-2 text-[13px] text-warm">Geen app, geen wachtwoord.</p>
      </Uitsnede>
    </ul>
  );
}
