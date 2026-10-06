'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import type { NieuweOrderKeuzes } from '@/lib/kms/orders';
import PersoonKiezer from '@/components/dashboard/PersoonKiezer';
import { nieuweOrder } from '../actions';
import { haalKlantPersonenActie, contactAlsWerknemerActie, type KlantPersonen } from './actions';

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
  // Werknemers, afdelingen en contactpersonen van de gekozen klant, vers opgehaald.
  const [personen, setPersonen] = useState<KlantPersonen | null>(null);
  const [personenLaden, setPersonenLaden] = useState(false);
  const [omzetMelding, setOmzetMelding] = useState<{ ok: boolean; tekst: string } | null>(null);
  const [omzetten, startOmzetten] = useTransition();

  useEffect(() => {
    if (!klantId) {
      setPersonen(null);
      return;
    }
    let levend = true;
    setPersonenLaden(true);
    haalKlantPersonenActie(klantId)
      .then((p) => {
        if (levend) setPersonen(p);
      })
      .catch(() => {
        if (levend) setPersonen(null);
      })
      .finally(() => {
        if (levend) setPersonenLaden(false);
      });
    return () => {
      levend = false;
    };
  }, [klantId]);

  const klant = useMemo(() => keuzes.klanten.find((k) => k.id === klantId) ?? null, [keuzes.klanten, klantId]);

  const gevonden = useMemo(() => {
    const term = zoek.trim().toLowerCase();
    if (!term) return keuzes.klanten;
    return keuzes.klanten.filter((k) =>
      `${k.naam} ${k.plaats ?? ''} ${k.klantnummer ?? ''}`.toLowerCase().includes(term),
    );
  }, [zoek, keuzes.klanten]);
  const zichtbaar = gevonden.slice(0, MAX_KLANTEN);

  // Zolang de verse lijst nog laadt, gebruiken we wat al met de pagina meekwam.
  const medewerkers = useMemo(
    () =>
      personen
        ? personen.werknemers
        : keuzes.medewerkers
            .filter((m) => m.organisatie_id === klantId)
            .map((m) => ({ id: m.id, naam: m.naam, afdeling_id: null, vestiging_id: null })),
    [personen, keuzes.medewerkers, klantId],
  );
  const afdelingen = useMemo(
    () => personen?.afdelingen ?? keuzes.afdelingen.filter((a) => a.organisatie_id === klantId),
    [personen, keuzes.afdelingen, klantId],
  );
  const vestigingen = useMemo(
    () => personen?.vestigingen ?? keuzes.vestigingen.filter((v) => v.organisatie_id === klantId),
    [personen, keuzes.vestigingen, klantId],
  );
  // Contactpersonen die nog geen werknemer zijn: die kun je als werknemer kiezen.
  const contactKeuzes = useMemo(() => {
    if (!personen) return [];
    const bekend = new Set(
      personen.werknemers.map((w) => w.naam.trim().toLowerCase()),
    );
    return personen.contactpersonen.filter((c) => !bekend.has(c.naam.trim().toLowerCase()));
  }, [personen]);

  function kiesMedewerker(waarde: string) {
    setOmzetMelding(null);
    if (!waarde.startsWith('contact:')) {
      setMedewerkerId(waarde);
      // Heeft de werknemer een afdeling of vestiging, vul die alvast in.
      const w = medewerkers.find((m) => m.id === waarde);
      if (w?.afdeling_id && !afdelingId) setAfdelingId(w.afdeling_id);
      if (w?.vestiging_id && !vestigingId) setVestigingId(w.vestiging_id);
      return;
    }
    const contactId = waarde.slice('contact:'.length);
    startOmzetten(async () => {
      const antwoord = await contactAlsWerknemerActie({ orgId: klantId, contactId });
      setOmzetMelding({ ok: antwoord.ok, tekst: antwoord.melding });
      if (antwoord.ok && antwoord.id) {
        const nieuw = { id: antwoord.id, naam: antwoord.naam ?? 'Werknemer', afdeling_id: null, vestiging_id: null };
        setPersonen((p) =>
          p
            ? { ...p, werknemers: p.werknemers.some((w) => w.id === nieuw.id) ? p.werknemers : [...p.werknemers, nieuw] }
            : p,
        );
        setMedewerkerId(antwoord.id);
      }
    });
  }

  function kiesKlant(id: string) {
    setKlantId(id);
    // De vorige klant kan medewerkers of afdelingen hebben die bij deze klant
    // niet bestaan; die keuzes moeten dus mee terug naar leeg.
    setMedewerkerId('');
    setAfdelingId('');
    setVestigingId('');
    setOmzetMelding(null);
    // Anders staan de werknemers van de vorige klant in de lijst tot de nieuwe binnen zijn.
    setPersonen(null);
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
                <div className="mt-3 grid grid-cols-1 max-h-72 gap-1.5 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="veld-label" htmlFor="o-medewerker">Werknemer</label>
            <select
              id="o-medewerker"
              name="medewerker_id"
              value={medewerkerId}
              onChange={(e) => kiesMedewerker(e.target.value)}
              disabled={!klantId || omzetten}
              className="veld disabled:bg-mist disabled:text-warm"
            >
              <option value="">Geen werknemer</option>
              {medewerkers.length > 0 && (
                <optgroup label="Werknemers">
                  {medewerkers.map((m) => (
                    <option key={m.id} value={m.id}>{m.naam}</option>
                  ))}
                </optgroup>
              )}
              {contactKeuzes.length > 0 && (
                <optgroup label="Contactpersonen (wordt werknemer)">
                  {contactKeuzes.map((c) => (
                    <option key={c.id} value={`contact:${c.id}`}>{c.naam}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {omzetten && <p className="veld-hint">Werknemer aanmaken...</p>}
            {omzetMelding && (
              <p className={`veld-hint font-semibold ${omzetMelding.ok ? 'text-green-700' : 'text-red-700'}`}>
                {omzetMelding.tekst}
              </p>
            )}
            {klantId && !personenLaden && medewerkers.length === 0 && (
              <p className="veld-hint">
                Deze klant heeft nog geen werknemers.
                {contactKeuzes.length > 0
                  ? ' Kies hierboven een contactpersoon, dan wordt die meteen als werknemer aangemaakt. Of '
                  : ' '}
                <Link href={`/dashboard/klanten/${klantId}?tab=werknemers`} className="font-semibold text-amber-700 hover:text-amber-800">
                  {contactKeuzes.length > 0 ? 'voeg een werknemer toe' : 'Werknemer toevoegen'}
                </Link>
                .
              </p>
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
            {klantId && !personenLaden && afdelingen.length === 0 && (
              <p className="veld-hint">
                Deze klant heeft nog geen afdelingen.{' '}
                <Link href={`/dashboard/klanten/${klantId}?tab=afdelingen`} className="font-semibold text-amber-700 hover:text-amber-800">
                  Afdeling toevoegen
                </Link>
              </p>
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
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="veld-label" htmlFor="o-besteldatum">Besteldatum</label>
            <input id="o-besteldatum" name="besteldatum" type="date" defaultValue={vandaag} className="veld" />
          </div>
          <div>
            <label className="veld-label" htmlFor="o-referentie">Referentie van de klant</label>
            <input id="o-referentie" name="referentienr" placeholder="Bijv. inkoopordernummer" className="veld" />
          </div>
          <div>
            {/* Altijd een bestaande contactpersoon of werknemer, zodat je later op aanvrager kunt filteren. */}
            <PersoonKiezer
              naam="aangevraagd_door"
              label="Aangevraagd door"
              bron="klant"
              orgId={klantId || null}
              soorten={['contact', 'medewerker']}
              nieuw={['contact']}
              hint="Contactpersoon of werknemer van deze klant."
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
