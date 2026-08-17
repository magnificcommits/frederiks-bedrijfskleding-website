'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { OrderProduct, OrderVariant } from '@/lib/kms/orders';
import { haalArtikelen, haalVarianten, voegRegelToe } from './actions';

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);

/** Meer dan dit tegelijk tonen leest niemand, en het maakt het typen traag. */
const MAX_RESULTATEN = 24;

/** Varianten zonder kleur horen onder één noemer, anders krijg je een lege knop. */
const kleurLabel = (v: OrderVariant) => (v.kleur ?? '').trim() || 'Standaard';

/** Prijs in het invoerveld met een komma, zoals Jessi hem ook op de bon ziet. */
const prijsTekst = (n: number | null) => (n == null ? '' : String(n).replace('.', ','));

/**
 * Regel toevoegen aan een order: eerst het artikel zoeken, dan kleur en maat.
 *
 * Dit stond eerder in een <script>-blok op de serverpagina. Zo'n script draait
 * alleen bij een volledige paginalading; kwam je via een link op de orderpagina,
 * dan werd het nooit uitgevoerd en bleef de variantlijst leeg en uitgeschakeld.
 * Daarom nu gewone React-state. De catalogus haalt dit onderdeel zelf op zodra
 * het in beeld komt, en de maten volgen pas zodra er een artikel gekozen is.
 */
export default function RegelToevoegen({ orderId }: { orderId: string }) {
  const [producten, setProducten] = useState<OrderProduct[]>([]);
  const [catalogus, setCatalogus] = useState<'laden' | 'klaar' | 'mislukt'>('laden');
  const [zoek, setZoek] = useState('');
  const [artikel, setArtikel] = useState<OrderProduct | null>(null);
  const [vrijeRegel, setVrijeRegel] = useState(false);
  const [varianten, setVarianten] = useState<OrderVariant[]>([]);
  const [variantStand, setVariantStand] = useState<'geen' | 'laden' | 'klaar'>('geen');
  const [kleur, setKleur] = useState('');
  const [variantId, setVariantId] = useState('');
  const [itemNaam, setItemNaam] = useState('');
  const [losseMaat, setLosseMaat] = useState('');
  const [losseKleur, setLosseKleur] = useState('');
  const [lengte, setLengte] = useState('');
  const [aantal, setAantal] = useState('1');
  const [prijs, setPrijs] = useState('');
  const [bezig, start] = useTransition();
  // Klik je snel twee artikelen aan, dan kan het eerste antwoord na het tweede
  // binnenkomen; zonder deze controle staan de maten van het verkeerde artikel klaar.
  const laatsteAanvraag = useRef('');

  useEffect(() => {
    let levend = true;
    haalArtikelen()
      .then((lijst) => {
        if (!levend) return;
        setProducten(lijst);
        setCatalogus('klaar');
      })
      .catch(() => {
        // Mislukt het ophalen, dan blijft de vrije regel over. Beter dan een
        // zoeklijst die eeuwig leeg blijft zonder uitleg.
        if (!levend) return;
        setCatalogus('mislukt');
      });
    return () => {
      levend = false;
    };
  }, []);

  const gevonden = useMemo(() => {
    // Losse woorden mogen in willekeurige volgorde: "snickers jas" vindt ook
    // "AllroundWork jas" van Snickers.
    const delen = zoek.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (delen.length === 0) return producten;
    return producten.filter((p) => {
      const tekst = `${p.naam} ${p.merk ?? ''} ${p.categorie ?? ''}`.toLowerCase();
      return delen.every((d) => tekst.includes(d));
    });
  }, [zoek, producten]);
  const zichtbaar = gevonden.slice(0, MAX_RESULTATEN);

  const kleuren = useMemo(() => {
    const namen: string[] = [];
    for (const v of varianten) {
      const label = kleurLabel(v);
      if (!namen.includes(label)) namen.push(label);
    }
    return namen;
  }, [varianten]);

  // Zonder gekozen kleur tonen we alle maten met de kleur erbij. Een maatlijst
  // die pas opengaat na een andere keuze voelt als een dichte deur.
  const maten = useMemo(
    () => (kleur ? varianten.filter((v) => kleurLabel(v) === kleur) : varianten),
    [varianten, kleur],
  );
  const variant = useMemo(() => varianten.find((v) => v.id === variantId) ?? null, [varianten, variantId]);

  function kiesVariant(id: string) {
    setVariantId(id);
    const gekozen = varianten.find((v) => v.id === id) ?? null;
    if (!gekozen) return;
    setPrijs(prijsTekst(gekozen.prijs));
    // Koos je meteen een maat, dan volgt de kleurkeuze mee.
    setKleur(kleurLabel(gekozen));
  }

  function kiesKleur(nieuw: string) {
    setKleur(nieuw);
    setVariantId('');
    // Eén maat in deze kleur: dan is doorklikken alleen maar een extra handeling.
    const bij = varianten.filter((v) => kleurLabel(v) === nieuw);
    if (bij.length === 1) kiesVariant(bij[0].id);
  }

  function kiesArtikel(p: OrderProduct) {
    setArtikel(p);
    setVrijeRegel(false);
    setItemNaam(p.naam);
    setVarianten([]);
    setKleur('');
    setVariantId('');
    setPrijs('');
    setLengte('');
    setVariantStand('laden');
    laatsteAanvraag.current = p.id;
    start(async () => {
      try {
        const lijst = await haalVarianten(p.id);
        if (laatsteAanvraag.current !== p.id) return;
        setVarianten(lijst);
        setVariantStand('klaar');
        const eersteKleur = lijst.length ? ((lijst[0].kleur ?? '').trim() || 'Standaard') : '';
        const uniek = new Set(lijst.map((v) => (v.kleur ?? '').trim() || 'Standaard'));
        if (uniek.size === 1 && eersteKleur) {
          setKleur(eersteKleur);
          if (lijst.length === 1) {
            setVariantId(lijst[0].id);
            setPrijs(prijsTekst(lijst[0].prijs));
          }
        }
      } catch {
        // Netwerkfout: dan liever handmatig maat en kleur intypen dan een
        // dropdown die blijft draaien.
        if (laatsteAanvraag.current !== p.id) return;
        setVarianten([]);
        setVariantStand('klaar');
      }
    });
  }

  function leegmaken() {
    laatsteAanvraag.current = '';
    setArtikel(null);
    setVrijeRegel(false);
    setZoek('');
    setVarianten([]);
    setVariantStand('geen');
    setKleur('');
    setVariantId('');
    setItemNaam('');
    setLosseMaat('');
    setLosseKleur('');
    setLengte('');
    setAantal('1');
    setPrijs('');
  }

  // Zonder artikel, of bij een artikel waarvan geen enkele maat in het systeem
  // staat, typ je maat en kleur zelf.
  const handmatig = vrijeRegel || (artikel !== null && variantStand === 'klaar' && varianten.length === 0);
  const toonKiezer = !artikel && !vrijeRegel;
  const foto = variant?.afbeelding ?? artikel?.afbeelding ?? null;

  return (
    <form action={voegRegelToe} className="mt-4 space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="product_id" value={artikel?.id ?? ''} />
      <input type="hidden" name="variant_id" value={handmatig ? '' : variantId} />
      {!handmatig && <input type="hidden" name="maat" value={variant?.maat ?? ''} />}
      {!handmatig && <input type="hidden" name="kleur" value={variant?.kleur ?? ''} />}

      {toonKiezer ? (
        <div>
          <label className="veld-label" htmlFor="artikel-zoek">Artikel</label>
          <input
            id="artikel-zoek"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek op naam, merk of categorie"
            className="veld disabled:bg-mist disabled:text-warm"
            autoComplete="off"
            disabled={catalogus !== 'klaar'}
          />

          {catalogus === 'laden' && <p className="veld-hint">Artikelen laden...</p>}

          {catalogus === 'mislukt' && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              De artikelen konden niet worden opgehaald. Herlaad de pagina, of typ hieronder een vrije regel.
            </p>
          )}

          {catalogus === 'klaar' && (
            <>
              <div className="mt-3 grid max-h-64 gap-1.5 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                {zichtbaar.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => kiesArtikel(p)}
                    className="flex items-center gap-2.5 rounded-md border border-line bg-white p-1.5 text-left hover:border-amber-400 hover:bg-mist"
                  >
                    {p.afbeelding ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={p.afbeelding} alt="" className="h-10 w-10 shrink-0 rounded border border-line object-contain" />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-line bg-mist text-[10px] text-warm">
                        geen foto
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ink-900">{p.naam}</span>
                      <span className="block truncate text-[11px] text-warm">
                        {[p.merk, p.categorie].filter(Boolean).join(' · ') || 'Geen merk bekend'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {gevonden.length === 0 ? (
                <p className="veld-hint">
                  {producten.length === 0
                    ? 'Er staan nog geen actieve artikelen in de catalogus.'
                    : 'Geen artikel gevonden. Probeer een deel van de naam of het merk.'}
                </p>
              ) : (
                <p className="veld-hint">
                  {gevonden.length > MAX_RESULTATEN
                    ? `${gevonden.length} artikelen gevonden, de eerste ${MAX_RESULTATEN} staan hierboven. Typ er een woord bij om te verfijnen.`
                    : `${gevonden.length} ${gevonden.length === 1 ? 'artikel' : 'artikelen'} gevonden.`}
                </p>
              )}
            </>
          )}

          <button type="button" onClick={() => setVrijeRegel(true)} className="knop-tekst mt-2">
            Of typ een vrije regel zonder artikel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-mist px-3 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            {foto ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={foto} alt="" className="h-10 w-10 shrink-0 rounded border border-line bg-white object-contain" />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-line bg-white text-[10px] text-warm">
                geen foto
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink-900">
                {artikel ? artikel.naam : 'Vrije regel zonder artikel'}
              </p>
              <p className="truncate text-[11px] text-warm">
                {artikel ? [artikel.merk, artikel.categorie].filter(Boolean).join(' · ') || 'Geen merk bekend' : 'Maat en kleur typ je zelf'}
              </p>
            </div>
          </div>
          <button type="button" onClick={leegmaken} className="knop-stil">Ander artikel</button>
        </div>
      )}

      {artikel && variantStand === 'laden' && (
        <p className="text-[13px] text-warm">Maten en kleuren laden...</p>
      )}

      {artikel && variantStand === 'klaar' && varianten.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="veld-label" htmlFor="regel-kleur">Kleur</label>
            <select
              id="regel-kleur"
              value={kleur}
              onChange={(e) => kiesKleur(e.target.value)}
              className="veld"
            >
              <option value="">Kies een kleur</option>
              {kleuren.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="veld-label" htmlFor="regel-maat">Maat</label>
            <select
              id="regel-maat"
              value={variantId}
              onChange={(e) => kiesVariant(e.target.value)}
              className="veld"
            >
              <option value="">Kies een maat</option>
              {maten.map((v) => (
                <option key={v.id} value={v.id}>
                  {(v.maat ?? '').trim() || 'Eén maat'}
                  {kleur ? '' : ` · ${kleurLabel(v)}`}
                  {v.voorraad > 0 ? ` (${v.voorraad} op voorraad)` : ' (niet op voorraad)'}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {artikel && variantStand === 'klaar' && varianten.length === 0 && (
        <p className="veld-hint">
          Bij dit artikel staan nog geen maten in het systeem. Vul maat en kleur hieronder zelf in.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className={handmatig ? '' : 'xl:col-span-2'}>
          <label className="veld-label" htmlFor="regel-item">Itemnaam</label>
          <input
            id="regel-item"
            name="item_naam"
            required
            value={itemNaam}
            onChange={(e) => setItemNaam(e.target.value)}
            placeholder="Naam van het item"
            className="veld"
          />
        </div>
        {handmatig && (
          <>
            <div>
              <label className="veld-label" htmlFor="regel-maat-vrij">Maat</label>
              <input
                id="regel-maat-vrij"
                name="maat"
                value={losseMaat}
                onChange={(e) => setLosseMaat(e.target.value)}
                placeholder="Bijv. XL of 52"
                className="veld"
              />
            </div>
            <div>
              <label className="veld-label" htmlFor="regel-kleur-vrij">Kleur</label>
              <input
                id="regel-kleur-vrij"
                name="kleur"
                value={losseKleur}
                onChange={(e) => setLosseKleur(e.target.value)}
                placeholder="Bijv. marine"
                className="veld"
              />
            </div>
          </>
        )}
        <div>
          <label className="veld-label" htmlFor="regel-aantal">Aantal</label>
          <input
            id="regel-aantal"
            name="aantal"
            type="number"
            min="1"
            value={aantal}
            onChange={(e) => setAantal(e.target.value)}
            className="veld"
          />
        </div>
        <div>
          <label className="veld-label" htmlFor="regel-prijs">Stukprijs</label>
          <input
            id="regel-prijs"
            name="stukprijs"
            inputMode="decimal"
            value={prijs}
            onChange={(e) => setPrijs(e.target.value)}
            placeholder="Bedrag"
            className="veld"
          />
        </div>
        {artikel?.maatwerk_lengte && (
          <div>
            <label className="veld-label" htmlFor="regel-lengte">Broeklengte</label>
            <input
              id="regel-lengte"
              name="lengte"
              type="number"
              min="1"
              value={lengte}
              onChange={(e) => setLengte(e.target.value)}
              placeholder="In centimeters"
              className="veld"
            />
            <p className="veld-hint">Dit artikel kan op lengte worden gemaakt. Laat leeg voor de standaardlengte.</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={bezig || !itemNaam.trim()} className="knop-donker">
          Regel toevoegen
        </button>
        {(artikel || vrijeRegel) && (
          <button type="button" onClick={leegmaken} className="knop-tekst">Leegmaken</button>
        )}
        {variant?.prijs != null && (
          <span className="text-[12px] text-warm">
            Catalogusprijs {euro(variant.prijs)}
          </span>
        )}
      </div>
    </form>
  );
}
