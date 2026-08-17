'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import type { Periode, VerstrekkingType } from '@/lib/kms/assortiment';
import type { ArtikelKeuze } from '@/lib/kms/producten';
import { haalArtikelenActie, voegAssortimentToeActie } from './actions';
import { PERIODE_OPTIES, VERSTREKKING_OPTIES, euro } from './verstrekkingOpties';

/** Meer dan dit tegelijk tonen leest niemand, en het maakt het typen traag. */
const MAX_RESULTATEN = 60;

type Zoekregel = { artikel: ArtikelKeuze; tekst: string };

/**
 * Apart venster om een artikel uit de catalogus te zoeken en meteen met kleur en
 * verstrekking aan het assortiment van een klant toe te voegen.
 *
 * De hele catalogus wordt één keer opgehaald zodra dit venster opengaat en
 * daarna in de browser gefilterd. Bij 549 artikelen kost filteren minder dan een
 * milliseconde, dus de lijst loopt precies gelijk met wat Jessi typt. Een
 * serveractie per toetsaanslag zou elke keer een netwerkrondje kosten en
 * gestotter geven op een tablet met een matige verbinding.
 */
export default function ArtikelKiezer({
  orgId,
  catalogus,
  onCatalogus,
  alGekozenIds,
  onSluiten,
  onToegevoegd,
}: {
  orgId: string;
  catalogus: ArtikelKeuze[] | null;
  onCatalogus: (lijst: ArtikelKeuze[]) => void;
  alGekozenIds: string[];
  onSluiten: () => void;
  onToegevoegd: () => void;
}) {
  const [laden, setLaden] = useState(catalogus === null);
  const [mislukt, setMislukt] = useState(false);
  const [zoek, setZoek] = useState('');
  const [merk, setMerk] = useState('');
  const [categorie, setCategorie] = useState('');
  const [gekozen, setGekozen] = useState<ArtikelKeuze | null>(null);
  const [kleur, setKleur] = useState('');
  const [type, setType] = useState<VerstrekkingType>('budget');
  const [aantal, setAantal] = useState('1');
  const [periode, setPeriode] = useState<Periode>('jaar');
  const [melding, setMelding] = useState<{
    ok: boolean;
    tekst: string;
    waarschuwing?: string;
  } | null>(null);
  const [bezig, start] = useTransition();

  // Catalogus één keer ophalen. Blijft daarna in de klantpagina hangen, dus het
  // venster opnieuw openen gaat zonder wachten.
  useEffect(() => {
    if (catalogus !== null) return;
    let levend = true;
    setLaden(true);
    setMislukt(false);
    haalArtikelenActie()
      .then((lijst) => {
        if (!levend) return;
        onCatalogus(lijst);
        setLaden(false);
      })
      .catch(() => {
        if (!levend) return;
        setMislukt(true);
        setLaden(false);
      });
    return () => {
      levend = false;
    };
  }, [catalogus, onCatalogus]);

  useEffect(() => {
    const opToets = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSluiten();
    };
    window.addEventListener('keydown', opToets);
    return () => window.removeEventListener('keydown', opToets);
  }, [onSluiten]);

  // Zoektekst één keer per artikel klaarzetten in plaats van bij elke toetsaanslag
  // 549 keer opnieuw samenstellen.
  const regels = useMemo<Zoekregel[]>(
    () =>
      (catalogus ?? []).map((artikel) => ({
        artikel,
        tekst: [
          artikel.naam,
          artikel.merk ?? '',
          artikel.sku ?? '',
          artikel.art_nr_leverancier ?? '',
          artikel.categorie ?? '',
        ]
          .join(' ')
          .toLowerCase(),
      })),
    [catalogus],
  );

  const merken = useMemo(
    () =>
      [...new Set((catalogus ?? []).map((a) => a.merk).filter((m): m is string => Boolean(m)))].sort(
        (a, b) => a.localeCompare(b, 'nl'),
      ),
    [catalogus],
  );

  const categorieen = useMemo(
    () =>
      [
        ...new Set((catalogus ?? []).map((a) => a.categorie).filter((c): c is string => Boolean(c))),
      ].sort((a, b) => a.localeCompare(b, 'nl')),
    [catalogus],
  );

  const gevonden = useMemo(() => {
    // Losse woorden mogen in willekeurige volgorde: "snickers jas" vindt ook
    // "AllroundWork jas" van Snickers.
    const delen = zoek.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return regels
      .filter(({ artikel, tekst }) => {
        if (merk && artikel.merk !== merk) return false;
        if (categorie && artikel.categorie !== categorie) return false;
        return delen.every((d) => tekst.includes(d));
      })
      .map((r) => r.artikel);
  }, [regels, zoek, merk, categorie]);

  const zichtbaar = gevonden.slice(0, MAX_RESULTATEN);
  const staatErAl = (id: string) => alGekozenIds.includes(id);

  function kiesArtikel(artikel: ArtikelKeuze) {
    setGekozen(artikel);
    setMelding(null);
    // Eén kleur betekent geen keuze; die vullen we alvast in.
    setKleur(artikel.kleuren.length === 1 ? artikel.kleuren[0] : '');
    setType('budget');
    setAantal('1');
    setPeriode('jaar');
  }

  function terugNaarLijst() {
    setGekozen(null);
    setKleur('');
  }

  function toevoegen() {
    if (!gekozen || bezig) return;
    const artikel = gekozen;
    start(async () => {
      const antwoord = await voegAssortimentToeActie({
        orgId,
        productId: artikel.id,
        artikelNaam: artikel.naam,
        kleur: kleur || null,
        verstrekking_type: type,
        gratis_per_periode: type === 'periodiek_gratis' ? Math.max(0, Number(aantal) || 0) : null,
        periode,
      });
      setMelding({ ok: antwoord.ok, tekst: antwoord.melding, waarschuwing: antwoord.waarschuwing });
      if (antwoord.ok) {
        terugNaarLijst();
        onToegevoegd();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-900/40 p-3 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSluiten();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Artikel zoeken en toevoegen"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">Artikel zoeken en toevoegen</h2>
            <p className="mt-0.5 text-[13px] text-warm">
              Zoek op naam, merk, artikelnummer of sku. Kies daarna de kleur en hoe de klant het krijgt.
            </p>
          </div>
          <button type="button" onClick={onSluiten} className="knop-stil shrink-0">
            Sluiten
          </button>
        </div>

        {melding && (
          <div
            className={`border-b px-5 py-2.5 text-[13px] ${
              melding.ok && !melding.waarschuwing
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            <p className="font-semibold">{melding.tekst}</p>
            {melding.waarschuwing && <p className="mt-0.5">{melding.waarschuwing}</p>}
          </div>
        )}

        {gekozen ? (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <button type="button" onClick={terugNaarLijst} className="knop-tekst">
              Terug naar de zoeklijst
            </button>

            <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-mist p-3">
              {gekozen.afbeelding ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={gekozen.afbeelding}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-md border border-line bg-white object-contain"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-line bg-white text-[10px] text-warm">
                  geen foto
                </span>
              )}
              <div className="min-w-0">
                <p className="font-display text-base font-bold text-ink-900">{gekozen.naam}</p>
                <p className="text-[13px] text-warm">
                  {[gekozen.merk, gekozen.categorie].filter(Boolean).join(' · ') || 'Geen merk bekend'}
                </p>
                <p className="text-[13px] text-warm">
                  {gekozen.vanafprijs != null ? `Vanaf ${euro(gekozen.vanafprijs)}` : 'Nog geen prijs bekend'}
                  {gekozen.sku ? ` · sku ${gekozen.sku}` : ''}
                  {gekozen.art_nr_leverancier ? ` · artikelnummer ${gekozen.art_nr_leverancier}` : ''}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="veld-label" htmlFor="kiezer-kleur">
                  Kleur
                </label>
                <select
                  id="kiezer-kleur"
                  value={kleur}
                  onChange={(e) => setKleur(e.target.value)}
                  className="veld"
                >
                  <option value="">Alle kleuren van dit artikel</option>
                  {gekozen.kleuren.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <p className="veld-hint">
                  {gekozen.kleuren.length === 0
                    ? 'Bij dit artikel staan nog geen kleuren in het systeem.'
                    : 'Laat je dit op alle kleuren staan, dan kiest de klant zelf uit de hele reeks.'}
                </p>
              </div>

              <div>
                <label className="veld-label" htmlFor="kiezer-verstrekking">
                  Hoe krijgt de klant dit
                </label>
                <select
                  id="kiezer-verstrekking"
                  value={type}
                  onChange={(e) => setType(e.target.value as VerstrekkingType)}
                  className="veld"
                >
                  {VERSTREKKING_OPTIES.map((o) => (
                    <option key={o.waarde} value={o.waarde}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {type === 'periodiek_gratis' && (
                <>
                  <div>
                    <label className="veld-label" htmlFor="kiezer-aantal">
                      Aantal gratis
                    </label>
                    <input
                      id="kiezer-aantal"
                      type="number"
                      min="0"
                      step="1"
                      value={aantal}
                      onChange={(e) => setAantal(e.target.value)}
                      className="veld"
                    />
                  </div>
                  <div>
                    <label className="veld-label" htmlFor="kiezer-periode">
                      Per periode
                    </label>
                    <select
                      id="kiezer-periode"
                      value={periode}
                      onChange={(e) => setPeriode(e.target.value as Periode)}
                      className="veld"
                    >
                      {PERIODE_OPTIES.map((o) => (
                        <option key={o.waarde} value={o.waarde}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" onClick={toevoegen} disabled={bezig} className="knop-donker">
                {bezig ? 'Bezig met toevoegen...' : 'Toevoegen aan assortiment'}
              </button>
              <span className="text-[12px] text-warm">Je kunt hierna meteen het volgende artikel zoeken.</span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-3">
              <div className="min-w-[16rem] flex-1">
                <label className="veld-label" htmlFor="kiezer-zoek">
                  Zoeken
                </label>
                <input
                  id="kiezer-zoek"
                  value={zoek}
                  onChange={(e) => setZoek(e.target.value)}
                  placeholder="Bijv. softshell, Snickers, 1148"
                  autoComplete="off"
                  autoFocus
                  className="veld"
                />
              </div>
              <div className="w-48">
                <label className="veld-label" htmlFor="kiezer-merk">
                  Merk
                </label>
                <select
                  id="kiezer-merk"
                  value={merk}
                  onChange={(e) => setMerk(e.target.value)}
                  className="veld"
                >
                  <option value="">Alle merken</option>
                  {merken.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-48">
                <label className="veld-label" htmlFor="kiezer-categorie">
                  Categorie
                </label>
                <select
                  id="kiezer-categorie"
                  value={categorie}
                  onChange={(e) => setCategorie(e.target.value)}
                  className="veld"
                >
                  <option value="">Alle categorieën</option>
                  {categorieen.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {laden ? (
                <p className="text-[13px] text-warm">Artikelen laden...</p>
              ) : mislukt ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[13px] text-amber-800">
                  De artikelen konden niet worden opgehaald. Sluit dit venster en probeer het opnieuw.
                </p>
              ) : gevonden.length === 0 ? (
                <p className="rounded-xl border border-line bg-mist px-5 py-4 text-[13px] text-warm">
                  {regels.length === 0
                    ? 'Er staan nog geen actieve artikelen in de catalogus.'
                    : 'Geen artikel gevonden. Probeer een deel van de naam, het merk of het artikelnummer.'}
                </p>
              ) : (
                <>
                  <p className="text-[12px] text-warm">
                    {gevonden.length > MAX_RESULTATEN
                      ? `${gevonden.length} artikelen gevonden, de eerste ${MAX_RESULTATEN} staan hieronder. Typ er een woord bij om te verfijnen.`
                      : `${gevonden.length} ${gevonden.length === 1 ? 'artikel' : 'artikelen'} gevonden.`}
                  </p>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {zichtbaar.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => kiesArtikel(a)}
                          className="flex w-full items-center gap-3 rounded-lg border border-line bg-white p-2 text-left hover:border-amber-400 hover:bg-mist"
                        >
                          {a.afbeelding ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={a.afbeelding}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded border border-line object-contain"
                            />
                          ) : (
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-line bg-mist text-[10px] text-warm">
                              geen foto
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-ink-900">{a.naam}</span>
                            <span className="block truncate text-[11px] text-warm">
                              {a.merk || 'Geen merk bekend'}
                              {a.art_nr_leverancier ? ` · ${a.art_nr_leverancier}` : ''}
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-ink-800">
                                {a.vanafprijs != null ? `vanaf ${euro(a.vanafprijs)}` : 'prijs onbekend'}
                              </span>
                              {staatErAl(a.id) && <span className="badge-rust">staat er al in</span>}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
