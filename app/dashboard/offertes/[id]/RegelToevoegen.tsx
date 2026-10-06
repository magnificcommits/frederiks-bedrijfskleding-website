'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { OfferteArtikel, OfferteKleur } from '@/lib/kms/offertes';
import { haalArtikelenActie, haalKleurenActie, voegRegelActie } from './actions';

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);

/** Prijs in het invoerveld met een komma, zoals Jessi hem ook op papier ziet. */
const prijsTekst = (n: number | null) => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));

/** Meer dan dit tegelijk tonen leest niemand, en het maakt het typen traag. */
const MAX_RESULTATEN = 24;

const groot = 'veld py-2.5 text-[15px]';

function omschrijvingVoor(a: OfferteArtikel, kleur: string, maat: string): string {
  const naam = a.merk && !a.naam.toLowerCase().startsWith(a.merk.toLowerCase()) ? `${a.merk} ${a.naam}` : a.naam;
  return [naam, kleur.trim(), maat.trim() ? `maat ${maat.trim()}` : ''].filter(Boolean).join(', ');
}

/**
 * Regel toevoegen aan een offerte in vier stappen: artikel zoeken, kleur kiezen
 * (alleen de kleuren die dit artikel echt heeft, met foto), optioneel een maat,
 * en dan aantal, prijs en korting. Op de offerte komt alleen de gekozen kleur,
 * niet de hele lijst kleuren en maten van het artikel.
 */
export default function RegelToevoegen({ offerteId, organisatieId }: { offerteId: string; organisatieId: string | null }) {
  const [artikelen, setArtikelen] = useState<OfferteArtikel[]>([]);
  const [catalogus, setCatalogus] = useState<'laden' | 'klaar' | 'mislukt'>('laden');
  const [zoek, setZoek] = useState('');
  const [artikel, setArtikel] = useState<OfferteArtikel | null>(null);
  const [vrijeRegel, setVrijeRegel] = useState(false);
  const [kleuren, setKleuren] = useState<OfferteKleur[]>([]);
  const [kleurStand, setKleurStand] = useState<'geen' | 'laden' | 'klaar'>('geen');
  const [kleurIdx, setKleurIdx] = useState<number | null>(null);
  const [maat, setMaat] = useState('');
  const [omschrijving, setOmschrijving] = useState('');
  const [omschrijvingZelf, setOmschrijvingZelf] = useState(false);
  const [aantal, setAantal] = useState('1');
  const [prijs, setPrijs] = useState('');
  const [korting, setKorting] = useState('0');
  const [inkoop, setInkoop] = useState('');
  const [bezig, start] = useTransition();
  const laatsteAanvraag = useRef('');

  useEffect(() => {
    let levend = true;
    haalArtikelenActie(organisatieId)
      .then((lijst) => {
        if (!levend) return;
        setArtikelen(lijst);
        setCatalogus('klaar');
      })
      .catch(() => {
        if (levend) setCatalogus('mislukt');
      });
    return () => {
      levend = false;
    };
  }, [organisatieId]);

  const gevonden = useMemo(() => {
    const delen = zoek.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (delen.length === 0) return artikelen;
    return artikelen.filter((p) => {
      const tekst = `${p.naam} ${p.merk ?? ''} ${p.categorie ?? ''}`.toLowerCase();
      return delen.every((d) => tekst.includes(d));
    });
  }, [zoek, artikelen]);
  const zichtbaar = gevonden.slice(0, MAX_RESULTATEN);
  const heeftAssortiment = artikelen.some((a) => a.inAssortiment);

  const kleur = kleurIdx != null ? kleuren[kleurIdx] ?? null : null;
  const gekozenMaat = kleur?.maten.find((m) => m.maat === maat) ?? null;
  const toonbareMaten = kleur?.maten.filter((m) => m.maat) ?? [];

  /** Omschrijving, prijs en inkoop bijwerken na een keuze. */
  function vulIn(a: OfferteArtikel, k: OfferteKleur | null, m: string) {
    if (!omschrijvingZelf) setOmschrijving(omschrijvingVoor(a, k?.kleur ?? '', m));
    const maatRij = k?.maten.find((x) => x.maat === m) ?? null;
    const p = maatRij ? maatRij.prijs : k?.prijs ?? null;
    const i = maatRij ? maatRij.inkoop : k?.inkoop ?? null;
    setPrijs(prijsTekst(p));
    setInkoop(i != null ? String(i) : '');
  }

  function kiesKleur(idx: number, lijst: OfferteKleur[] = kleuren, a: OfferteArtikel | null = artikel) {
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

  function kiesArtikel(a: OfferteArtikel) {
    setArtikel(a);
    setVrijeRegel(false);
    setOmschrijvingZelf(false);
    setOmschrijving(omschrijvingVoor(a, '', ''));
    setKleuren([]);
    setKleurIdx(null);
    setMaat('');
    setPrijs('');
    setInkoop('');
    setKleurStand('laden');
    laatsteAanvraag.current = a.id;
    start(async () => {
      try {
        const lijst = await haalKleurenActie(a.id);
        if (laatsteAanvraag.current !== a.id) return;
        setKleuren(lijst);
        setKleurStand('klaar');
        if (lijst.length === 1) kiesKleur(0, lijst, a);
      } catch {
        if (laatsteAanvraag.current !== a.id) return;
        setKleuren([]);
        setKleurStand('klaar');
      }
    });
  }

  function leegmaken() {
    laatsteAanvraag.current = '';
    setArtikel(null);
    setVrijeRegel(false);
    setZoek('');
    setKleuren([]);
    setKleurStand('geen');
    setKleurIdx(null);
    setMaat('');
    setOmschrijving('');
    setOmschrijvingZelf(false);
    setAantal('1');
    setPrijs('');
    setKorting('0');
    setInkoop('');
  }

  const toonZoeker = !artikel && !vrijeRegel;
  const kleurVerplicht = !!artikel && kleurStand === 'klaar' && kleuren.length > 1;
  const magToevoegen = !!omschrijving.trim() && !bezig && (!kleurVerplicht || kleur != null);
  const foto = kleur?.afbeelding ?? artikel?.afbeelding ?? null;

  return (
    <div className="panel p-5">
      <h3 className="font-display text-lg font-bold text-ink-900">Regel toevoegen</h3>
      <p className="mt-1 text-[13px] text-warm">
        Zoek het artikel, kies de kleur en eventueel de maat. Alleen de gekozen kleur komt op de offerte.
      </p>

      <form action={voegRegelActie} className="mt-4 space-y-5">
        <input type="hidden" name="offerteId" value={offerteId} />
        <input type="hidden" name="product_id" value={artikel?.id ?? ''} />
        <input type="hidden" name="kleur" value={kleur?.kleur ?? ''} />
        <input type="hidden" name="maat" value={maat} />
        <input type="hidden" name="inkoop" value={inkoop} />

        {/* Stap 1: artikel */}
        {toonZoeker ? (
          <div>
            <label className="veld-label" htmlFor="offerte-artikel-zoek">1. Artikel</label>
            <input
              id="offerte-artikel-zoek"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoek op naam, merk of categorie, bijvoorbeeld: polo tricorp"
              className={`${groot} disabled:bg-mist disabled:text-warm`}
              autoComplete="off"
              disabled={catalogus !== 'klaar'}
            />
            {catalogus === 'laden' && <p className="veld-hint">Artikelen laden...</p>}
            {catalogus === 'mislukt' && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                De artikelen konden niet worden opgehaald. Herlaad de pagina, of typ een vrije regel.
              </p>
            )}
            {catalogus === 'klaar' && (
              <>
                <div className="mt-3 grid grid-cols-1 max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                  {zichtbaar.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => kiesArtikel(p)}
                      className="flex items-center gap-3 rounded-md border border-line bg-white p-2 text-left hover:border-amber-400 hover:bg-mist"
                    >
                      {p.afbeelding ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={p.afbeelding} alt="" className="h-12 w-12 shrink-0 rounded border border-line object-contain" />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-line bg-mist text-[10px] text-warm">geen foto</span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-ink-900">{p.naam}</span>
                        <span className="block truncate text-[12px] text-warm">
                          {[p.merk, p.categorie].filter(Boolean).join(' · ') || 'Geen merk bekend'}
                        </span>
                        {p.inAssortiment && (
                          <span className="mt-0.5 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                            in assortiment klant
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
                {gevonden.length === 0 ? (
                  <p className="veld-hint">
                    {artikelen.length === 0 ? 'Er staan nog geen actieve artikelen in de catalogus.' : 'Geen artikel gevonden. Probeer een deel van de naam of het merk.'}
                  </p>
                ) : (
                  <p className="veld-hint">
                    {gevonden.length > MAX_RESULTATEN
                      ? `${gevonden.length} artikelen gevonden, de eerste ${MAX_RESULTATEN} staan hierboven. Typ er een woord bij om te verfijnen.`
                      : `${gevonden.length} ${gevonden.length === 1 ? 'artikel' : 'artikelen'} gevonden.`}
                    {heeftAssortiment && !zoek.trim() ? ' Artikelen uit het assortiment van deze klant staan bovenaan.' : ''}
                  </p>
                )}
              </>
            )}
            <button type="button" onClick={() => setVrijeRegel(true)} className="knop-tekst mt-2">
              Of typ een vrije regel zonder artikel
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
              Ander artikel
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
                      <img src={k.afbeelding} alt="" className="h-16 w-16 rounded object-contain" />
                    ) : (
                      <span className="flex h-16 w-16 items-center justify-center rounded bg-mist text-[10px] text-warm">geen foto</span>
                    )}
                    <span className="text-[13px] font-semibold leading-tight text-ink-900">{k.kleur || 'Standaard'}</span>
                  </button>
                );
              })}
            </div>
            {kleurVerplicht && kleur == null && <p className="veld-hint">Kies een kleur. Alleen die kleur komt op de offerte.</p>}
          </fieldset>
        )}
        {artikel && kleurStand === 'klaar' && kleuren.length === 0 && (
          <p className="veld-hint">Bij dit artikel staan nog geen kleuren of maten in het systeem. Vul de omschrijving en prijs hieronder zelf in.</p>
        )}

        {/* Stap 3: maat (optioneel) */}
        {artikel && kleur && toonbareMaten.length > 1 && (
          <div className="max-w-sm">
            <label className="veld-label" htmlFor="offerte-maat">3. Maat (niet verplicht)</label>
            <select id="offerte-maat" value={maat} onChange={(e) => kiesMaat(e.target.value)} className={groot}>
              <option value="">Maat nog niet bekend / verschillende maten</option>
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

        {/* Stap 4: omschrijving, aantal, prijs, korting */}
        {(artikel || vrijeRegel) && (
          <div className="space-y-4">
            <div>
              <label className="veld-label" htmlFor="offerte-omschrijving">Omschrijving op de offerte</label>
              <input
                id="offerte-omschrijving"
                name="omschrijving"
                required
                value={omschrijving}
                onChange={(e) => {
                  setOmschrijving(e.target.value);
                  setOmschrijvingZelf(true);
                }}
                placeholder="Bijv. Softshell jas met logo"
                className={groot}
              />
              {artikel && <p className="veld-hint">Wordt automatisch merk, naam, kleur en maat. Je mag hem aanpassen.</p>}
            </div>
            <div className="grid grid-cols-3 gap-4 sm:max-w-xl">
              <div>
                <label className="veld-label" htmlFor="offerte-aantal">Aantal</label>
                <input id="offerte-aantal" name="aantal" inputMode="decimal" value={aantal} onChange={(e) => setAantal(e.target.value)} className={`${groot} text-right tabular-nums`} />
              </div>
              <div>
                <label className="veld-label" htmlFor="offerte-prijs">Stukprijs (€)</label>
                <input id="offerte-prijs" name="stukprijs" inputMode="decimal" value={prijs} onChange={(e) => setPrijs(e.target.value)} placeholder="0,00" className={`${groot} text-right tabular-nums`} />
              </div>
              <div>
                <label className="veld-label" htmlFor="offerte-korting">Korting %</label>
                <input id="offerte-korting" name="korting_pct" inputMode="decimal" value={korting} onChange={(e) => setKorting(e.target.value)} className={`${groot} text-right tabular-nums`} />
              </div>
            </div>
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
            {gekozenMaat?.prijs != null && <span className="text-[12px] text-warm">Catalogusprijs {euro(gekozenMaat.prijs)}</span>}
          </div>
        )}
      </form>
    </div>
  );
}
