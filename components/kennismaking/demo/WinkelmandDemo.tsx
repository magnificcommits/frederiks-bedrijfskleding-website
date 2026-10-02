'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useDemo, type MandRegel } from './DemoProvider';
import VoorbeeldModal from './VoorbeeldModal';
import { Balk, TijdChip, euro, kaart, knopAccent, veld } from './ui';

/** Winkelmand met budgetcheck per medewerker. Plaatsen opent een voorbeeldmelding. */
export default function WinkelmandDemo() {
  const { data, paden, mand, medewerker, budgetVan, leidinggevendeVan, wijzigAantal, plaatsBestelling, geladen } = useDemo();
  const [modal, setModal] = useState<{ open: boolean; wacht: boolean }>({ open: false, wacht: false });
  const [referentie, setReferentie] = useState('');
  const sluit = useCallback(() => setModal((m) => ({ ...m, open: false })), []);

  const groepen = new Map<string, MandRegel[]>();
  for (const r of mand) {
    const k = r.medewerkerId ?? '';
    groepen.set(k, [...(groepen.get(k) ?? []), r]);
  }
  const artikel = (id: string) => data.artikelen.find((a) => a.id === id);
  const regelBedrag = (r: MandRegel) => (artikel(r.artikelId)?.prijs ?? 0) * r.aantal;
  const totaal = mand.reduce((t, r) => t + regelBedrag(r), 0);
  const afdelingNaam = (id: string) => data.afdelingen.find((a) => a.id === id)?.naam ?? '';

  function plaats() {
    const nieuw = plaatsBestelling();
    setReferentie('');
    setModal({ open: true, wacht: nieuw.some((o) => o.goedkeuring === 'wacht') });
  }

  const modalEl = (
    <VoorbeeldModal
      open={modal.open}
      onSluit={sluit}
      pasdagHref={paden.pasdag}
      bestellingenHref={modal.wacht ? `${paden.portaal}/goedkeuringen` : `${paden.portaal}/bestellingen`}
      wachtOpGoedkeuring={modal.wacht}
    />
  );

  if (mand.length === 0) {
    return (
      <>
        <div className="mt-8 rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
          <p className="text-sm text-warm">{geladen ? 'Je winkelmand is nog leeg.' : 'Winkelmand laden…'}</p>
          <Link href={`${paden.portaal}/webshop`} className={`${knopAccent} mt-5`}>
            Kleding bestellen
          </Link>
        </div>
        {modalEl}
      </>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="min-w-0 space-y-5 lg:col-span-2">
        {[...groepen.entries()].map(([mwId, regels]) => {
          const mw = medewerker(mwId || null);
          const sub = regels.reduce((t, r) => t + regelBedrag(r), 0);
          const b = mw ? budgetVan(mw.id) : null;
          const naBestelling = b ? b.restant - sub : null;
          const boven = naBestelling != null && naBestelling < 0;
          const leid = mw ? leidinggevendeVan(mw.id) : null;
          return (
            <section key={mwId || 'algemeen'} className={kaart}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-extrabold text-ink-900">{mw ? `Voor ${mw.naam}` : 'Zonder medewerker'}</h2>
                  <p className="text-xs text-warm">{mw ? `${mw.functie} · ${afdelingNaam(mw.afdelingId)}` : 'Algemene bestelling, telt niet mee in een persoonlijk budget'}</p>
                </div>
                <span className="font-display text-lg font-extrabold text-ink-900">{euro(sub)}</span>
              </div>

              <ul className="mt-4 divide-y divide-line">
                {regels.map((r) => {
                  const a = artikel(r.artikelId);
                  if (!a) return null;
                  return (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink-900">{a.naam}</p>
                        <p className="text-xs text-warm">
                          Maat {r.maat}
                          {a.kleur ? ` · ${a.kleur}` : ''} · {euro(a.prijs)} per stuk
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="inline-flex items-center rounded-md border border-line">
                          <button
                            type="button"
                            onClick={() => wijzigAantal(r.id, r.aantal - 1)}
                            aria-label={`Eén ${a.naam} minder`}
                            className="flex min-h-[40px] w-10 items-center justify-center text-lg font-bold text-ink-900 hover:bg-mist"
                          >
                            &minus;
                          </button>
                          <span className="min-w-[32px] text-center text-sm font-semibold text-ink-900" aria-live="polite">
                            {r.aantal}
                          </span>
                          <button
                            type="button"
                            onClick={() => wijzigAantal(r.id, r.aantal + 1)}
                            aria-label={`Eén ${a.naam} meer`}
                            className="flex min-h-[40px] w-10 items-center justify-center text-lg font-bold text-ink-900 hover:bg-mist"
                          >
                            +
                          </button>
                        </div>
                        <button type="button" onClick={() => wijzigAantal(r.id, 0)} className="min-h-[40px] text-xs font-semibold text-warm hover:text-ink-800">
                          Verwijder
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {mw && b && naBestelling != null && (
                <div className={`mt-3 rounded-xl p-4 ${boven ? 'border border-amber-300 bg-amber-50' : 'bg-mist'}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="font-semibold text-ink-900">Budgetcheck</span>
                    <span className="text-warm">
                      {euro(b.verbruikt + b.inAanvraag + sub, true)} van {euro(b.budget, true)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <Balk deel={b.verbruikt + b.inAanvraag + sub} totaal={b.budget} label={`Budget ${mw.naam} na deze bestelling`} />
                  </div>
                  <p className={`mt-2 text-sm ${boven ? 'text-amber-800' : 'text-ink-700'}`}>
                    {boven
                      ? `Dit is ${euro(-naBestelling)} boven het budget. De bestelling gaat eerst ter goedkeuring naar ${leid && leid.id !== mw.id ? leid.naam : 'de leidinggevende'}.`
                      : `Past binnen het budget. Daarna is er nog ${euro(naBestelling, true)} over.`}
                  </p>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className={kaart}>
          <h2 className="font-display text-lg font-extrabold text-ink-900">Bestelling</h2>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-warm">Totaal ex btw</span>
            <span className="font-display text-xl font-extrabold text-ink-900">{euro(totaal)}</span>
          </div>
          <label htmlFor="referentie" className="mt-4 block text-sm font-semibold text-ink-900">
            Referentie of projectnummer <span className="font-normal text-warm">(optioneel)</span>
          </label>
          <input
            id="referentie"
            value={referentie}
            onChange={(e) => setReferentie(e.target.value)}
            maxLength={40}
            placeholder="bijv. project Lochem"
            className={veld}
          />
          <button type="button" onClick={plaats} className={`${knopAccent} mt-4 w-full`}>
            Bestelling plaatsen
          </button>
          <p className="mt-2 text-xs text-warm">Voorbeeld: er wordt niets echt besteld of verstuurd.</p>
          <TijdChip className="mt-4">
            budget per persoon. Past het, dan gaat de bestelling meteen door. Past het niet, dan beslist de leidinggevende.
          </TijdChip>
        </div>
      </aside>
      {modalEl}
    </div>
  );
}
