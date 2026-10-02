'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDemo } from './DemoProvider';
import { Balk, StatusBadge, TijdChip, euro, kaart, knopAccent, knopStil } from './ui';

/** Interactieve delen van het overzicht: budgetten, goedkeuring, recente bestellingen en snel nabestellen. */
export default function OverzichtDemo() {
  const { data, paden, medewerkers, orders, budgetVan, medewerker, beoordeel, herbestel, drukproef } = useDemo();
  const router = useRouter();

  const perAfdeling = data.afdelingen.map((a) => {
    const leden = medewerkers.filter((m) => m.afdelingId === a.id);
    const totaal = leden.reduce((t, m) => t + m.budget, 0);
    const verbruikt = leden.reduce((t, m) => t + budgetVan(m.id).verbruikt, 0);
    return { ...a, leden: leden.length, totaal, verbruikt };
  });
  const totaalBudget = perAfdeling.reduce((t, a) => t + a.totaal, 0);
  const totaalVerbruikt = perAfdeling.reduce((t, a) => t + a.verbruikt, 0);
  const wachtend = orders.filter((o) => o.goedkeuring === 'wacht');
  const onderweg = orders.filter((o) => o.status === 'verzonden' || o.status === 'borduren' || o.status === 'bedrukken' || o.status === 'besteld');
  const recent = orders.filter((o) => o.goedkeuring !== 'wacht').slice(0, 3);
  const nabestelbaar = orders.filter((o) => o.regels.some((r) => r.artikelId) && o.goedkeuring !== 'wacht').slice(0, 2);
  const eerste = wachtend[0];

  function opnieuw(orderId: string) {
    const n = herbestel(orderId);
    if (n > 0) router.push(`${paden.portaal}/winkelmand`);
  }

  return (
    <div className="mt-8 space-y-8">
      {/* Tegels */}
      <section aria-label="Kerncijfers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-warm">Kledingbudget</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{euro(totaalBudget, true)}</p>
          <p className="text-xs text-warm">per jaar, {medewerkers.length} personen</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-warm">Nog te besteden</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{euro(totaalBudget - totaalVerbruikt, true)}</p>
          <p className="text-xs text-warm">{euro(totaalVerbruikt, true)} verbruikt</p>
        </div>
        <Link href={`${paden.portaal}/goedkeuringen`} className="rounded-2xl border border-line bg-white p-4 shadow-soft transition hover:border-ink-300 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-warm">Wacht op jou</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{wachtend.length}</p>
          <p className="text-xs text-warm">{wachtend.length === 1 ? 'goedkeuring' : 'goedkeuringen'}</p>
        </Link>
        <Link href={`${paden.portaal}/bestellingen`} className="rounded-2xl border border-line bg-white p-4 shadow-soft transition hover:border-ink-300 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-warm">Lopend</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{onderweg.length}</p>
          <p className="text-xs text-warm">{onderweg.length === 1 ? 'bestelling' : 'bestellingen'} in behandeling</p>
        </Link>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-6 lg:col-span-3">
          {/* Openstaande goedkeuring */}
          {eerste ? (
            <section className="rounded-2xl border-2 border-amber-300 bg-white p-5 shadow-soft sm:p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">Wacht op goedkeuring</p>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-extrabold text-ink-900">{medewerker(eerste.medewerkerId)?.naam ?? 'Bestelling'} vraagt kleding aan</p>
                  <p className="mt-0.5 text-sm text-warm">
                    {eerste.regels.map((r) => `${r.aantal}x ${r.naam}`).join(', ')}
                    {eerste.reden ? ` · ${eerste.reden}` : ''}
                  </p>
                </div>
                <span className="font-display text-lg font-extrabold text-ink-900">{euro(eerste.bedrag)}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => beoordeel(eerste.id, 'goedgekeurd')} className={knopAccent}>
                  Goedkeuren
                </button>
                <Link href={`${paden.portaal}/goedkeuringen`} className={knopStil}>
                  Bekijk details
                </Link>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-800">
              Alles is beoordeeld. Nieuwe aanvragen van collega&apos;s verschijnen hier vanzelf.
            </section>
          )}

          {/* Recente bestellingen */}
          <section className={kaart}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-extrabold text-ink-900">Recente bestellingen</h2>
              <Link href={`${paden.portaal}/bestellingen`} className="text-sm font-semibold text-[color:var(--demo-accent-tekst)] hover:underline">
                Alles bekijken
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {recent.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">
                      #{o.ordernummer} · {medewerker(o.medewerkerId)?.naam ?? 'Algemeen'}
                    </p>
                    <p className="text-xs text-warm">
                      {o.datumLabel} · {euro(o.bedrag)}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Budget per afdeling */}
          <section className={kaart}>
            <h2 className="font-display text-lg font-extrabold text-ink-900">Budget per afdeling</h2>
            <ul className="mt-4 space-y-4">
              {perAfdeling.map((a) => (
                <li key={a.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-semibold text-ink-900">{a.naam}</span>
                    <span className="text-warm">
                      {euro(a.verbruikt, true)} van {euro(a.totaal, true)}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Balk deel={a.verbruikt} totaal={a.totaal} label={`Budget ${a.naam} verbruikt`} />
                  </div>
                  <p className="mt-1 text-xs text-warm">{a.leden} {a.leden === 1 ? 'persoon' : 'personen'}</p>
                </li>
              ))}
            </ul>
            <TijdChip className="mt-4">elke medewerker heeft een eigen budget. Jij ziet in één oogopslag waar het geld heen gaat.</TijdChip>
          </section>

          {/* Snel nabestellen */}
          <section className={kaart}>
            <h2 className="font-display text-lg font-extrabold text-ink-900">Snel nabestellen</h2>
            <p className="mt-1 text-sm text-warm">Zelfde kleding, zelfde maten. Eén klik en het staat in de winkelmand.</p>
            <ul className="mt-3 space-y-2">
              {nabestelbaar.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{medewerker(o.medewerkerId)?.naam ?? 'Algemeen'}</p>
                    <p className="truncate text-xs text-warm">{o.regels.map((r) => `${r.aantal}x ${r.naam}`).join(', ')}</p>
                  </div>
                  <button type="button" onClick={() => opnieuw(o.id)} className="shrink-0 rounded-md border border-line px-3 py-2 text-xs font-semibold text-ink-800 hover:bg-mist">
                    Bestel opnieuw
                  </button>
                </li>
              ))}
            </ul>
            <Link href={`${paden.portaal}/medewerkers#nieuw`} className="mt-4 inline-flex text-sm font-semibold text-[color:var(--demo-accent-tekst)] hover:underline">
              Nieuwe collega? Voeg toe en bestel meteen
            </Link>
          </section>

          {data.drukproef && drukproef.status === 'wacht' && (
            <Link href={`${paden.portaal}/drukproeven`} className="block rounded-2xl border border-line bg-white p-5 shadow-soft transition hover:border-ink-300">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">Drukproef klaar</p>
              <p className="mt-1 font-semibold text-ink-900">{data.drukproef.naam}</p>
              <p className="mt-0.5 text-sm text-warm">Bekijk hoe jullie logo erop komt en keur hem goed.</p>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
