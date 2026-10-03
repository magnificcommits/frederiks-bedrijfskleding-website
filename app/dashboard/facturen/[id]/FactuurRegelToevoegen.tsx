'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { ZoekArtikel, ZoekKleur } from '@/lib/kms/productZoeker';
import { zoekArtikelenActie, haalKleurenActie, voegRegel } from './actions';

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);

/** Getal in een invoerveld met een komma, zoals op papier. */
const getalTekst = (n: number | null) => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));

/** Invoer met komma of punt naar een getal (0 als het niet te lezen is). */
function leesGetal(s: string): number {
  const schoon = s.replace(/[^0-9.,-]/g, '').trim();
  if (!schoon) return 0;
  const n = Number(schoon.includes(',') ? schoon.replace(/\./g, '').replace(',', '.') : schoon);
  return Number.isFinite(n) ? n : 0;
}

const groot = 'veld py-2.5 text-[15px]';

/** Omschrijving: merk + naam, kleur, en maat als die gekozen is. */
function omschrijvingVoor(a: ZoekArtikel, kleur: string, maat: string): string {
  const naam = a.merk && !a.naam.toLowerCase().startsWith(a.merk.toLowerCase()) ? `${a.merk} ${a.naam}` : a.naam;
  return [naam, kleur.trim(), maat.trim() ? `maat ${maat.trim()}` : ''].filter(Boolean).join(', ');
}

/**
 * Regel toevoegen aan een factuur: artikel zoeken (server-side, over alle
 * actieve artikelen, assortiment van de klant bovenaan), kleur kiezen (alleen
 * de kleuren van dat artikel, met foto), optioneel de maat, en dan aantal,
 * stukprijs, korting en btw. Een vrije regel zonder artikel kan ook.
 */
export default function FactuurRegelToevoegen({
  factuurId,
  organisatieId,
  klantKorting,
}: {
  factuurId: string;
  organisatieId: string | null;
  /** Kortingspercentage van de klant (webshop), alleen als hint; wordt niet automatisch toegepast. */
  klantKorting: number | null;
}) {
  const [zoek, setZoek] = useState('');
  const [resultaten, setResultaten] = useState<ZoekArtikel[]>([]);
  const [meer, setMeer] = useState(false);
  const [zoekStand, setZoekStand] = useState<'laden' | 'klaar' | 'mislukt'>('laden');
  const [artikel, setArtikel] = useState<ZoekArtikel | null>(null);
  const [vrijeRegel, setVrijeRegel] = useState(false);
  const [kleuren, setKleuren] = useState<ZoekKleur[]>([]);
  const [kleurStand, setKleurStand] = useState<'geen' | 'laden' | 'klaar'>('geen');
  const [kleurIdx, setKleurIdx] = useState<number | null>(null);
  const [maat, setMaat] = useState('');
  const [omschrijving, setOmschrijving] = useState('');
  const [omschrijvingZelf, setOmschrijvingZelf] = useState(false);
  const [aantal, setAantal] = useState('1');
  const [prijs, setPrijs] = useState('');
  const [korting, setKorting] = useState('0');
  const [btw, setBtw] = useState('21');
  const [bezig, start] = useTransition();
  const zoekTeller = useRef(0);
  const laatsteArtikel = useRef('');

  const toonZoeker = !artikel && !vrijeRegel;

  // Typeahead: 250 ms na de laatste toetsaanslag zoeken. Alleen het antwoord op
  // de laatste vraag telt, zodat een trage oude vraag de lijst niet overschrijft.
  useEffect(() => {
    if (!toonZoeker) return;
    const nr = ++zoekTeller.current;
    setZoekStand((s) => (s === 'mislukt' ? 'laden' : s));
    const t = setTimeout(() => {
      zoekArtikelenActie(zoek, organisatieId)
        .then((r) => {
          if (nr !== zoekTeller.current) return;
          setResultaten(r.artikelen);
          setMeer(r.meer);
          setZoekStand('klaar');
        })
        .catch(() => {
          if (nr === zoekTeller.current) setZoekStand('mislukt');
        });
    }, zoek ? 250 : 0);
    return () => clearTimeout(t);
  }, [zoek, organisatieId, toonZoeker]);

  const kleur = kleurIdx != null ? kleuren[kleurIdx] ?? null : null;
  const toonbareMaten = kleur?.maten.filter((m) => m.maat) ?? [];

  /** Omschrijving en prijs bijwerken na een keuze. */
  function vulIn(a: ZoekArtikel, k: ZoekKleur | null, m: string) {
    if (!omschrijvingZelf) setOmschrijving(omschrijvingVoor(a, k?.kleur ?? '', m));
    const maatRij = k?.maten.find((x) => x.maat === m) ?? null;
    const p = maatRij ? maatRij.prijs : k?.prijs ?? null;
    setPrijs(getalTekst(p));
  }

  function kiesKleur(idx: number, lijst: ZoekKleur[] = kleuren, a: ZoekArtikel | null = artikel) {
    setKleurIdx(idx);
    const k = lijst[idx] ?? null;
    // Eén maat in deze kleur: dan is die maat de keuze.
    const enigeMaat = k && k.maten.length === 1 && k.maten[0].maat ? k.maten[0].maat : '';
    setMaat(enigeMaat);
    if (a) vulIn(a, k, enigeMaat);
  }

  function kiesMaat(m: string) {
    setMaat(m);
    if (artikel) vulIn(artikel, kleur, m);
  }

  function kiesArtikel(a: ZoekArtikel) {
    setArtikel(a);
    setVrijeRegel(false);
    setOmschrijvingZelf(false);
    setOmschrijving(omschrijvingVoor(a, '', ''));
    setKleuren([]);
    setKleurIdx(null);
    setMaat('');
    setPrijs('');
    setBtw(getalTekst(a.btw));
    setKleurStand('laden');
    laatsteArtikel.current = a.id;
    start(async () => {
      try {
        const lijst = await haalKleurenActie(a.id);
        if (laatsteArtikel.current !== a.id) return;
        setKleuren(lijst);
        setKleurStand('klaar');
        // Vaste kleur uit het assortiment van de klant voorselecteren; anders de enige kleur.
        const vast = a.assortimentKleur ? lijst.findIndex((k) => k.kleur.toLowerCase() === a.assortimentKleur!.toLowerCase()) : -1;
        if (vast >= 0) kiesKleur(vast, lijst, a);
        else if (lijst.length === 1) kiesKleur(0, lijst, a);
      } catch {
        if (laatsteArtikel.current !== a.id) return;
        setKleuren([]);
        setKleurStand('klaar');
      }
    });
  }

  function leegmaken() {
    laatsteArtikel.current = '';
    setArtikel(null);
    setVrijeRegel(false);
    setKleuren([]);
    setKleurStand('geen');
    setKleurIdx(null);
    setMaat('');
    setOmschrijving('');
    setOmschrijvingZelf(false);
    setAantal('1');
    setPrijs('');
    setKorting('0');
    setBtw('21');
  }

  const kleurVerplicht = !!artikel && kleurStand === 'klaar' && kleuren.length > 1;
  const magToevoegen = !!omschrijving.trim() && !bezig && (!kleurVerplicht || kleur != null);
  const foto = kleur?.afbeelding ?? artikel?.afbeelding ?? null;
  const regelTotaal = leesGetal(aantal) * leesGetal(prijs) * (1 - Math.min(100, Math.max(0, leesGetal(korting))) / 100);
  const heeftAssortiment = resultaten.some((a) => a.inAssortiment);

  return (
    <div className="panel p-5">
      <h3 className="font-display text-lg font-bold text-ink-900">Regel toevoegen</h3>
      <p className="mt-1 text-[13px] text-warm">Zoek het artikel, kies de kleur en eventueel de maat. Alleen de gekozen kleur komt op de factuur.</p>

      <form action={voegRegel} className="mt-4 space-y-5">
        <input type="hidden" name="factuurId" value={factuurId} />
        <input type="hidden" name="product_id" value={artikel?.id ?? ''} />
        <input type="hidden" name="kleur" value={kleur?.kleur ?? ''} />
        <input type="hidden" name="maat" value={maat} />

        {/* Stap 1: artikel */}
        {toonZoeker ? (
          <div>
            <label className="veld-label" htmlFor="factuur-artikel-zoek">1. Artikel</label>
            <input
              id="factuur-artikel-zoek"
              type="search"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoek op naam, merk, categorie of artikelnummer, bijvoorbeeld: polo tricorp"
              className={groot}
              autoComplete="off"
            />
            {zoekStand === 'laden' && <p className="veld-hint">Artikelen zoeken...</p>}
            {zoekStand === 'mislukt' && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                Zoeken lukte niet. Probeer het nog eens, of typ een vrije regel.
              </p>
            )}
            {zoekStand === 'klaar' && (
              <>
                {resultaten.length > 0 && (
                  <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                    {resultaten.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => kiesArtikel(p)}
                        className="flex items-center gap-3 rounded-md border border-line bg-white p-2 text-left hover:border-amber-400 hover:bg-mist"
                      >
                        {p.afbeelding ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={p.afbeelding} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded border border-line object-contain" />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-line bg-mist text-[10px] text-warm">geen foto</span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold text-ink-900">{p.naam}</span>
                          <span className="block truncate text-[12px] text-warm">
                            {[p.merk, p.categorie, p.sku].filter(Boolean).join(' · ') || 'Geen merk bekend'}
                          </span>
                          {p.inAssortiment && (
                            <span className="mt-0.5 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                              in assortiment klant{p.assortimentKleur ? ` · ${p.assortimentKleur}` : ''}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="veld-hint">
                  {resultaten.length === 0
                    ? zoek.trim()
                      ? 'Geen artikel gevonden. Probeer een deel van de naam, het merk of het artikelnummer.'
                      : 'Er staan nog geen actieve artikelen in de catalogus.'
                    : meer
                      ? `De eerste ${resultaten.length} treffers staan hierboven. Typ er een woord bij om te verfijnen.`
                      : `${resultaten.length} ${resultaten.length === 1 ? 'artikel' : 'artikelen'} gevonden.`}
                  {heeftAssortiment ? ' Artikelen uit het assortiment van deze klant staan bovenaan.' : ''}
                </p>
              </>
            )}
            <button type="button" onClick={() => setVrijeRegel(true)} className="knop-tekst mt-2">
              Of typ een vrije regel
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-mist px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              {artikel &&
                (foto ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={foto} alt="" className="h-14 w-14 shrink-0 rounded border border-line bg-white object-contain" />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-line bg-white text-[10px] text-warm">geen foto</span>
                ))}
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-ink-900">{artikel ? artikel.naam : 'Vrije regel zonder artikel'}</p>
                <p className="truncate text-[12px] text-warm">
                  {artikel
                    ? [artikel.merk, kleur?.kleur, maat ? `maat ${maat}` : ''].filter(Boolean).join(' · ') || 'Geen merk bekend'
                    : 'Omschrijving en prijs typ je zelf'}
                </p>
              </div>
            </div>
            <button type="button" onClick={leegmaken} className="knop-stil">
              {artikel ? 'Ander artikel' : 'Toch een artikel zoeken'}
            </button>
          </div>
        )}

        {/* Stap 2: kleur */}
        {artikel && kleurStand === 'laden' && <p className="text-[13px] text-warm">Kleuren laden...</p>}
        {artikel && kleurStand === 'klaar' && kleuren.length > 0 && (kleuren.length > 1 || kleuren[0].kleur) && (
          <fieldset>
            <legend className="veld-label">2. Kleur</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {kleuren.map((k, i) => {
                const gekozen = i === kleurIdx;
                const vast = !!artikel.assortimentKleur && k.kleur.toLowerCase() === artikel.assortimentKleur.toLowerCase();
                return (
                  <button
                    key={`${k.kleur}-${i}`}
                    type="button"
                    onClick={() => kiesKleur(i)}
                    aria-pressed={gekozen}
                    className={`flex flex-col items-center gap-1.5 rounded-md border p-2 text-center transition-colors ${
                      gekozen ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' : 'border-line bg-white hover:border-amber-400 hover:bg-mist'
                    }`}
                  >
                    {k.afbeelding ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={k.afbeelding} alt="" loading="lazy" className="h-16 w-16 rounded object-contain" />
                    ) : (
                      <span className="flex h-16 w-16 items-center justify-center rounded bg-mist text-[10px] text-warm">geen foto</span>
                    )}
                    <span className="text-[13px] font-semibold leading-tight text-ink-900">{k.kleur || 'Standaard'}</span>
                    {vast && <span className="text-[11px] font-semibold text-green-800">vaste kleur klant</span>}
                  </button>
                );
              })}
            </div>
            {kleurVerplicht && kleur == null && <p className="veld-hint">Kies een kleur. Alleen die kleur komt op de factuur.</p>}
          </fieldset>
        )}
        {artikel && kleurStand === 'klaar' && kleuren.length === 0 && (
          <p className="veld-hint">Bij dit artikel staan nog geen kleuren, maten of prijs in het systeem. Vul de omschrijving en prijs hieronder zelf in.</p>
        )}

        {/* Stap 3: maat (optioneel) */}
        {artikel && kleur && toonbareMaten.length > 1 && (
          <div className="max-w-sm">
            <label className="veld-label" htmlFor="factuur-maat">3. Maat (niet verplicht)</label>
            <select id="factuur-maat" value={maat} onChange={(e) => kiesMaat(e.target.value)} className={groot}>
              <option value="">Geen maat / verschillende maten</option>
              {toonbareMaten.map((m) => (
                <option key={m.variantId} value={m.maat}>
                  {m.maat}
                  {kleur.prijsVerschiltPerMaat && m.prijs != null ? ` (${euro(m.prijs)})` : ''}
                </option>
              ))}
            </select>
            {!maat && kleur.prijsVerschiltPerMaat && kleur.prijs != null && (
              <p className="veld-hint">De prijs verschilt per maat. Zonder maat vullen we de laagste prijs in ({euro(kleur.prijs)}).</p>
            )}
          </div>
        )}

        {/* Stap 4: omschrijving, aantal, prijs, korting, btw */}
        {(artikel || vrijeRegel) && (
          <div className="space-y-4">
            <div>
              <label className="veld-label" htmlFor="factuur-omschrijving">Omschrijving op de factuur</label>
              <input
                id="factuur-omschrijving"
                name="omschrijving"
                required
                value={omschrijving}
                onChange={(e) => {
                  setOmschrijving(e.target.value);
                  setOmschrijvingZelf(true);
                }}
                placeholder="Bijv. Borduren logo op borst"
                className={groot}
              />
              {artikel && <p className="veld-hint">Wordt automatisch merk, naam, kleur en maat. Je mag hem aanpassen.</p>}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:max-w-2xl sm:grid-cols-4">
              <div>
                <label className="veld-label" htmlFor="factuur-aantal">Aantal</label>
                <input id="factuur-aantal" name="aantal" inputMode="decimal" value={aantal} onChange={(e) => setAantal(e.target.value)} className={`${groot} text-right tabular-nums`} />
              </div>
              <div>
                <label className="veld-label" htmlFor="factuur-prijs">Stukprijs (€)</label>
                <input id="factuur-prijs" name="stukprijs" inputMode="decimal" value={prijs} onChange={(e) => setPrijs(e.target.value)} placeholder="0,00" className={`${groot} text-right tabular-nums`} />
              </div>
              <div>
                <label className="veld-label" htmlFor="factuur-korting">Korting %</label>
                <input id="factuur-korting" name="korting_pct" inputMode="decimal" value={korting} onChange={(e) => setKorting(e.target.value)} className={`${groot} text-right tabular-nums`} />
              </div>
              <div>
                <label className="veld-label" htmlFor="factuur-btw">Btw %</label>
                <input id="factuur-btw" name="btw_pct" inputMode="decimal" value={btw} onChange={(e) => setBtw(e.target.value)} className={`${groot} text-right tabular-nums`} />
              </div>
            </div>
            {klantKorting != null && leesGetal(korting) !== klantKorting && (
              <p className="veld-hint">
                Deze klant heeft {getalTekst(klantKorting)}% korting in de webshop.{' '}
                <button type="button" onClick={() => setKorting(getalTekst(klantKorting))} className="font-semibold text-amber-700 hover:text-amber-800">
                  Ook hier toepassen
                </button>
              </p>
            )}
            {artikel && prijs === '' && kleurStand === 'klaar' && (kleur != null || kleuren.length === 0) && (
              <p className="veld-hint">Bij dit artikel staat geen verkoopprijs. Vul de stukprijs zelf in.</p>
            )}
          </div>
        )}

        {(artikel || vrijeRegel) && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!magToevoegen} className="knop-donker px-5 py-2.5 text-[15px] disabled:opacity-50">
              Regel toevoegen
            </button>
            <button type="button" onClick={leegmaken} className="knop-tekst">
              Annuleren
            </button>
            <span className="ml-auto text-[13px] text-warm">
              Regeltotaal excl. btw <span className="font-semibold tabular-nums text-ink-900">{euro(Math.round(regelTotaal * 100) / 100)}</span>
            </span>
          </div>
        )}
      </form>
    </div>
  );
}
