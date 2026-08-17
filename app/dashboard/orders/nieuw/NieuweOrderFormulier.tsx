'use client';

import { useMemo, useState } from 'react';
import type { NieuweOrderKeuzes } from '@/lib/kms/orders';
import { nieuweOrder } from '../actions';

/** Meer klanten tegelijk tonen leest niemand, en het maakt het typen traag. */
const MAX_KLANTEN = 40;

/**
 * Aanmaakscherm voor een order. De klant kies je door te zoeken, want een
 * keuzelijst met honderden namen scrollt niemand door. Zodra de klant vaststaat
 * tonen medewerker, afdeling en vestiging alleen de rijen van diezelfde klant;
 * dat filteren gebeurt in de browser, dus zonder wachten.
 */
export default function NieuweOrderFormulier({
  keuzes,
  vandaag,
}: {
  keuzes: NieuweOrderKeuzes;
  vandaag: string;
}) {
  const [zoek, setZoek] = useState('');
  const [klantId, setKlantId] = useState('');
  const [medewerkerId, setMedewerkerId] = useState('');
  const [afdelingId, setAfdelingId] = useState('');
  const [vestigingId, setVestigingId] = useState('');

  const klant = useMemo(() => keuzes.klanten.find((k) => k.id === klantId) ?? null, [keuzes.klanten, klantId]);

  const gevonden = useMemo(() => {
    const term = zoek.trim().toLowerCase();
    if (!term) return keuzes.klanten;
    return keuzes.klanten.filter((k) =>
      `${k.naam} ${k.plaats ?? ''} ${k.klantnummer ?? ''}`.toLowerCase().includes(term),
    );
  }, [zoek, keuzes.klanten]);
  const zichtbaar = gevonden.slice(0, MAX_KLANTEN);

  const medewerkers = useMemo(
    () => keuzes.medewerkers.filter((m) => m.organisatie_id === klantId),
    [keuzes.medewerkers, klantId],
  );
  const afdelingen = useMemo(
    () => keuzes.afdelingen.filter((a) => a.organisatie_id === klantId),
    [keuzes.afdelingen, klantId],
  );
  const vestigingen = useMemo(
    () => keuzes.vestigingen.filter((v) => v.organisatie_id === klantId),
    [keuzes.vestigingen, klantId],
  );

  function kiesKlant(id: string) {
    setKlantId(id);
    // De vorige klant kan medewerkers of afdelingen hebben die bij deze klant
    // niet bestaan; die keuzes moeten dus mee terug naar leeg.
    setMedewerkerId('');
    setAfdelingId('');
    setVestigingId('');
  }

  return (
    <form action={nieuweOrder} className="space-y-5">
      <input type="hidden" name="organisatie_id" value={klantId} />

      <section className="panel p-5">
        <h2 className="font-display text-base font-bold text-ink-900">1. Voor welke klant</h2>
        {klant ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-mist px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink-900">{klant.naam}</p>
              <p className="text-[12px] text-warm">
                {[klant.plaats, klant.klantnummer ? `klantnummer ${klant.klantnummer}` : null]
                  .filter(Boolean)
                  .join(' · ') || 'Geen plaats bekend'}
              </p>
            </div>
            <button type="button" onClick={() => kiesKlant('')} className="knop-stil">
              Andere klant
            </button>
          </div>
        ) : (
          <>
            <label className="veld-label mt-3" htmlFor="klant-zoek">
              Zoek de klant
            </label>
            <input
              id="klant-zoek"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Naam, plaats of klantnummer"
              className="veld"
              autoComplete="off"
            />
            {keuzes.klanten.length === 0 ? (
              <p className="veld-hint">Er staan nog geen klanten in het systeem. Maak eerst een klant aan.</p>
            ) : (
              <>
                <div className="mt-3 grid max-h-72 gap-1.5 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                  {zichtbaar.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => kiesKlant(k.id)}
                      className="rounded-md border border-line bg-white px-3 py-2 text-left hover:border-amber-400 hover:bg-mist"
                    >
                      <span className="block text-[13px] font-semibold text-ink-900">{k.naam}</span>
                      <span className="block truncate text-[11px] text-warm">
                        {[k.plaats, k.klantnummer].filter(Boolean).join(' · ') || 'Geen plaats bekend'}
                      </span>
                    </button>
                  ))}
                </div>
                {gevonden.length === 0 ? (
                  <p className="veld-hint">Geen klant gevonden. Probeer een deel van de naam.</p>
                ) : (
                  <p className="veld-hint">
                    {gevonden.length > MAX_KLANTEN
                      ? `${gevonden.length} klanten gevonden, de eerste ${MAX_KLANTEN} staan hierboven. Typ er een woord bij om te verfijnen.`
                      : `${gevonden.length} ${gevonden.length === 1 ? 'klant' : 'klanten'} gevonden.`}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </section>

      <section className="panel p-5">
        <h2 className="font-display text-base font-bold text-ink-900">2. Voor wie en waarheen</h2>
        <p className="veld-hint mb-3">
          Alles hier is optioneel. Je kunt het later op de orderpagina nog aanvullen.
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="veld-label" htmlFor="o-medewerker">Medewerker</label>
            <select
              id="o-medewerker"
              name="medewerker_id"
              value={medewerkerId}
              onChange={(e) => setMedewerkerId(e.target.value)}
              disabled={!klantId}
              className="veld disabled:bg-mist disabled:text-warm"
            >
              <option value="">Geen medewerker</option>
              {medewerkers.map((m) => (
                <option key={m.id} value={m.id}>{m.naam}</option>
              ))}
            </select>
            {klantId && medewerkers.length === 0 && (
              <p className="veld-hint">Deze klant heeft nog geen medewerkers.</p>
            )}
          </div>
          <div>
            <label className="veld-label" htmlFor="o-afdeling">Afdeling</label>
            <select
              id="o-afdeling"
              name="afdeling_id"
              value={afdelingId}
              onChange={(e) => setAfdelingId(e.target.value)}
              disabled={!klantId}
              className="veld disabled:bg-mist disabled:text-warm"
            >
              <option value="">Geen afdeling</option>
              {afdelingen.map((a) => (
                <option key={a.id} value={a.id}>{a.naam}</option>
              ))}
            </select>
            {klantId && afdelingen.length === 0 && (
              <p className="veld-hint">Deze klant heeft nog geen afdelingen.</p>
            )}
          </div>
          <div>
            <label className="veld-label" htmlFor="o-vestiging">Vestiging (leveradres)</label>
            <select
              id="o-vestiging"
              name="vestiging_id"
              value={vestigingId}
              onChange={(e) => setVestigingId(e.target.value)}
              disabled={!klantId}
              className="veld disabled:bg-mist disabled:text-warm"
            >
              <option value="">Hoofdadres</option>
              {vestigingen.map((v) => (
                <option key={v.id} value={v.id}>{v.naam}</option>
              ))}
            </select>
            {klantId && vestigingen.length === 0 && (
              <p className="veld-hint">Deze klant heeft één adres; de levering gaat daarheen.</p>
            )}
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="font-display text-base font-bold text-ink-900">3. Gegevens van de aanvraag</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="veld-label" htmlFor="o-besteldatum">Besteldatum</label>
            <input id="o-besteldatum" name="besteldatum" type="date" defaultValue={vandaag} className="veld" />
          </div>
          <div>
            <label className="veld-label" htmlFor="o-referentie">Referentie van de klant</label>
            <input id="o-referentie" name="referentienr" placeholder="Bijv. inkoopordernummer" className="veld" />
          </div>
          <div>
            <label className="veld-label" htmlFor="o-aanvrager">Aangevraagd door</label>
            <input id="o-aanvrager" name="aangevraagd_door" placeholder="Naam van de aanvrager" className="veld" />
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="veld-label" htmlFor="o-notitie">Notitie bij de order</label>
            <textarea
              id="o-notitie"
              name="notitie"
              rows={3}
              placeholder="Bijv. logo op borst en rug, graag voor de bouwvak"
              className="veld"
            />
          </div>
          <div>
            <label className="veld-label" htmlFor="o-intern">Interne notitie</label>
            <textarea
              id="o-intern"
              name="interne_notitie"
              rows={3}
              placeholder="Alleen voor jezelf, komt niet bij de klant"
              className="veld"
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!klantId} className="knop-donker">
          Order aanmaken
        </button>
        <span className="text-[12px] text-warm">
          {klantId ? 'Daarna kom je op de orderpagina om de regels toe te voegen.' : 'Kies eerst een klant.'}
        </span>
      </div>
    </form>
  );
}
