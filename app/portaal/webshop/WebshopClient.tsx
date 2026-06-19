'use client';
import { useMemo, useState } from 'react';
import { plaatsBestelling, toggleFavorietActie } from './actions';
import type { WebshopProduct, WebshopMedewerker } from '@/lib/portaal/webshop';

const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);

const lijstprijs = (verkoopprijs: number | null, meerprijs: number | null) =>
  (Number(verkoopprijs) || 0) + (Number(meerprijs) || 0);

/** Nettoprijs na klantkorting, afgerond op centen. korting <= 0 geeft de lijstprijs terug. */
const nettoPrijs = (lijst: number, kortingPct: number) => {
  const pct = Number(kortingPct) || 0;
  if (pct <= 0) return lijst;
  return Math.round(lijst * (1 - Math.min(100, pct) / 100) * 100) / 100;
};

type MandItem = { variantId: string; aantal: number };

type Voorkeur = { voorkeursmaat: string | null; plus_minus_toegestaan: boolean };

type VerstrekkingType = 'budget' | 'periodiek_gratis' | 'altijd_gratis' | 'punten';
type VerstrekkingInfo = {
  type: VerstrekkingType;
  gratisPerPeriode: number | null;
  periode: string;
  resterendGratis: number | null;
};

type Props = {
  producten: WebshopProduct[];
  budgetActief: boolean;
  resterendBudget: number | null;
  budgetType: 'euro' | 'punten';
  productbudget: number | null;
  buitenBudgetToegestaan: boolean;
  voorkeursmaten: Record<string, Voorkeur>;
  toonVoorraad: boolean;
  gebruikReferentienr: boolean;
  opmerkingBijBestelling: boolean;
  minBestelbedrag: number | null;
  maxBestelbedrag: number | null;
  eigenMedewerkerNaam: string | null;
  kiesMedewerker: boolean;
  medewerkers: WebshopMedewerker[];
  verstrekkingen: Record<string, VerstrekkingInfo>;
  kortingPct: number | null;
  kleurAfbeeldingen: Record<string, Record<string, string>>;
  favorieten: string[];
};

const inputClass =
  'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

/** Toont een budgetbedrag als euro of als punten, afhankelijk van het budget_type. */
const budgetLabel = (n: number, type: 'euro' | 'punten') =>
  type === 'punten' ? `${Math.round(n)} punten` : euro(n);

/**
 * Geeft de toegestane varianten voor een product op basis van de voorkeursmaat.
 * Als plus/minus is toegestaan: de voorkeursmaat plus één maat groter en kleiner.
 * Zonder voorkeursmaat: alle varianten.
 */
function toegestaneVarianten(p: WebshopProduct, voorkeur: Voorkeur | undefined) {
  if (!voorkeur || !voorkeur.voorkeursmaat) return p.varianten;
  const maten = p.varianten.map((v) => v.maat);
  const idx = maten.findIndex((m) => m === voorkeur.voorkeursmaat);
  if (idx < 0) return p.varianten;
  if (!voorkeur.plus_minus_toegestaan) return p.varianten.filter((v) => v.maat === voorkeur.voorkeursmaat);
  // Eén maat groter of kleiner rond de voorkeursmaat (op volgorde van de variantenlijst).
  const van = Math.max(0, idx - 1);
  const tot = Math.min(p.varianten.length - 1, idx + 1);
  return p.varianten.slice(van, tot + 1);
}

export default function WebshopClient({
  producten,
  budgetActief,
  resterendBudget,
  budgetType,
  productbudget,
  buitenBudgetToegestaan,
  voorkeursmaten,
  toonVoorraad,
  gebruikReferentienr,
  opmerkingBijBestelling,
  minBestelbedrag,
  maxBestelbedrag,
  eigenMedewerkerNaam,
  kiesMedewerker,
  medewerkers,
  verstrekkingen,
  kortingPct,
  kleurAfbeeldingen,
  favorieten,
}: Props) {
  const [mand, setMand] = useState<MandItem[]>([]);
  const favorietenSet = new Set(favorieten);

  // Klantkorting van de organisatie; leeg of 0 betekent gewoon de lijstprijs.
  const korting = Number(kortingPct) || 0;
  const heeftKorting = korting > 0;
  // Nettoprijs van een variant na klantkorting (op de lijstprijs verkoopprijs + meerprijs).
  const variantNetto = (v: WebshopProduct['varianten'][number]) =>
    nettoPrijs(lijstprijs(v.verkoopprijs, v.meerprijs), korting);

  // Per product de begin-keuze: de voorkeursmaat-variant als die bestaat, anders de eerste variant.
  const beginKeuze = useMemo(() => {
    const k: Record<string, string> = {};
    for (const p of producten) {
      const voorkeur = voorkeursmaten[p.id];
      const toegestaan = toegestaneVarianten(p, voorkeur);
      const voorkeurVariant = voorkeur?.voorkeursmaat
        ? toegestaan.find((v) => v.maat === voorkeur.voorkeursmaat)
        : undefined;
      k[p.id] = voorkeurVariant?.id ?? toegestaan[0]?.id ?? '';
    }
    return k;
  }, [producten, voorkeursmaten]);

  const [keuze, setKeuze] = useState<Record<string, string>>(beginKeuze);

  const variantIndex = useMemo(() => {
    const map = new Map<string, { product: WebshopProduct; variant: WebshopProduct['varianten'][number] }>();
    for (const p of producten) for (const v of p.varianten) map.set(v.id, { product: p, variant: v });
    return map;
  }, [producten]);

  const voegToe = (variantId: string) => {
    if (!variantId) return;
    setMand((m) => {
      const bestaat = m.find((x) => x.variantId === variantId);
      if (bestaat) return m.map((x) => (x.variantId === variantId ? { ...x, aantal: x.aantal + 1 } : x));
      return [...m, { variantId, aantal: 1 }];
    });
  };

  const wijzigAantal = (variantId: string, aantal: number) => {
    if (aantal <= 0) {
      setMand((m) => m.filter((x) => x.variantId !== variantId));
      return;
    }
    setMand((m) => m.map((x) => (x.variantId === variantId ? { ...x, aantal } : x)));
  };

  const totaal = mand.reduce((sum, item) => {
    const match = variantIndex.get(item.variantId);
    if (!match) return sum;
    return sum + item.aantal * variantNetto(match.variant);
  }, 0);

  const aantalStuks = mand.reduce((sum, item) => sum + item.aantal, 0);

  // Budget-relevant deel: altijd-gratis telt niet mee, periodiek-gratis tot de resterende vrije ruimte deze periode.
  // Spiegelt verdeelVerstrekking op de server zodat het budgetslot in de winkelwagen klopt.
  const budgetTotaal = useMemo(() => {
    const restVrij: Record<string, number> = {};
    let som = 0;
    for (const item of mand) {
      const match = variantIndex.get(item.variantId);
      if (!match) continue;
      const prijs = variantNetto(match.variant);
      const info = verstrekkingen[match.product.id];
      const type = info?.type ?? 'budget';
      if (type === 'altijd_gratis') continue;
      if (type === 'periodiek_gratis') {
        if (!(match.product.id in restVrij)) restVrij[match.product.id] = info?.resterendGratis ?? 0;
        const gratis = Math.min(item.aantal, restVrij[match.product.id]);
        restVrij[match.product.id] -= gratis;
        som += (item.aantal - gratis) * prijs;
        continue;
      }
      som += item.aantal * prijs;
    }
    return som;
  }, [mand, variantIndex, verstrekkingen, korting]);

  const overBudget =
    budgetActief && !buitenBudgetToegestaan && resterendBudget != null && budgetTotaal > resterendBudget;
  const overProductbudget = productbudget != null && aantalStuks > productbudget;
  const onderMin = minBestelbedrag != null && mand.length > 0 && totaal < Number(minBestelbedrag);
  const bovenMax = maxBestelbedrag != null && totaal > Number(maxBestelbedrag);
  const leeg = mand.length === 0;
  const geblokkeerd = leeg || overBudget || overProductbudget || onderMin || bovenMax;

  return (
    <div className="mt-8 grid gap-8 pb-24 lg:grid-cols-3 lg:pb-0">
      <div className="lg:col-span-2">
        <h2 className="font-display text-xl font-extrabold text-ink-900">Producten</h2>
        {producten.length === 0 ? (
          <p className="mt-3 text-sm text-warm">Er staan nog geen producten in jullie assortiment.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {producten.map((p) => {
              const voorkeur = voorkeursmaten[p.id];
              const opties = toegestaneVarianten(p, voorkeur);
              const gekozenVariant = keuze[p.id] ?? opties[0]?.id ?? '';
              const heeftVoorkeur = Boolean(voorkeur?.voorkeursmaat);
              const kleurMap = kleurAfbeeldingen[p.id];
              const huidigeKleur = opties.find((v) => v.id === gekozenVariant)?.kleur ?? null;
              const kleurImg = kleurMap ? ((huidigeKleur && kleurMap[huidigeKleur]) || Object.values(kleurMap)[0] || null) : null;
              return (
                <div key={p.id} className="rounded-2xl border border-line bg-white p-6 shadow-soft">
                  {kleurImg && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={kleurImg} alt={p.naam} className="mb-3 h-32 w-full rounded-lg border border-line bg-mist object-contain" />
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-ink-900">{p.naam}</p>
                    <form action={toggleFavorietActie} className="shrink-0">
                      <input type="hidden" name="product_id" value={p.id} />
                      <button
                        type="submit"
                        aria-label="Favoriet"
                        title="Favoriet"
                        className={`text-lg leading-none ${favorietenSet.has(p.id) ? 'text-amber-500' : 'text-warm hover:text-amber-500'}`}
                      >
                        {favorietenSet.has(p.id) ? '♥' : '♡'}
                      </button>
                    </form>
                  </div>
                  <p className="mt-1 text-sm text-warm">
                    {[p.merk, p.categorie].filter(Boolean).join(' · ') || 'Geen details'}
                  </p>
                  {heeftKorting && (
                    <p className="mt-2 inline-block rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      {korting}% klantkorting verwerkt
                    </p>
                  )}
                  {(() => {
                    const info = verstrekkingen[p.id];
                    if (!info) return null;
                    if (info.type === 'altijd_gratis')
                      return <p className="mt-2 text-xs font-semibold text-green-700">Altijd gratis, telt niet mee in je budget</p>;
                    if (info.type === 'periodiek_gratis')
                      return (
                        <p className="mt-2 text-xs font-semibold text-green-700">
                          {info.resterendGratis != null && info.resterendGratis > 0
                            ? `Nog ${info.resterendGratis} gratis deze periode`
                            : 'Gratis aantal voor deze periode is op'}
                        </p>
                      );
                    return null;
                  })()}
                  {p.omschrijving && <p className="mt-2 text-sm text-warm">{p.omschrijving}</p>}
                  {opties.length === 0 ? (
                    <p className="mt-4 text-sm text-warm">Geen leverbare varianten.</p>
                  ) : (
                    (() => {
                      // Splits de toegestane varianten netjes in kleuren en maten.
                      // Valt terug op een simpele variant-knoppenrij als de structuur niet klopt.
                      const gekozen = opties.find((v) => v.id === gekozenVariant) ?? opties[0];
                      const heeftMaten = opties.some((v) => v.maat != null && v.maat !== '');
                      const kleuren: string[] = [];
                      for (const v of opties) {
                        const kl = v.kleur ?? '';
                        if (kl !== '' && !kleuren.includes(kl)) kleuren.push(kl);
                      }
                      const meerdereKleuren = kleuren.length > 1;
                      const activeKleur = gekozen?.kleur ?? null;

                      // Maten die horen bij de huidige kleur (of alle maten als er geen kleur is).
                      const matenVoorKleur = opties.filter(
                        (v) => activeKleur == null || (v.kleur ?? '') === (activeKleur ?? ''),
                      );

                      const kiesKleur = (kl: string) => {
                        // Behoud de huidige maat in de nieuwe kleur als die bestaat, anders de eerste leverbare.
                        const huidigeMaat = gekozen?.maat ?? null;
                        const inKleur = opties.filter((v) => (v.kleur ?? '') === kl);
                        const zelfdeMaat = inKleur.find((v) => v.maat === huidigeMaat);
                        const eerstOpVoorraad = inKleur.find(
                          (v) => !toonVoorraad || (Number(v.voorraad) || 0) > 0,
                        );
                        const doel = zelfdeMaat ?? eerstOpVoorraad ?? inKleur[0];
                        if (doel) setKeuze((k) => ({ ...k, [p.id]: doel.id }));
                      };

                      const uitVoorraad =
                        toonVoorraad && gekozen != null && (Number(gekozen.voorraad) || 0) <= 0;

                      return (
                        <div className="mt-4">
                          <p className="text-xs font-semibold text-warm">
                            Kies maat{meerdereKleuren ? ' en kleur' : ''}
                            {heeftVoorkeur && (
                              <span className="ml-1 font-normal text-amber-700">
                                (voorkeur: {voorkeur?.voorkeursmaat}
                                {voorkeur?.plus_minus_toegestaan
                                  ? ', één maat groter of kleiner mag'
                                  : ''}
                                )
                              </span>
                            )}
                          </p>

                          {meerdereKleuren && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {kleuren.map((kl) => {
                                const actief = (activeKleur ?? '') === kl;
                                const blokje = kleurMap?.[kl] ?? null;
                                return (
                                  <button
                                    key={kl}
                                    type="button"
                                    onClick={() => kiesKleur(kl)}
                                    aria-pressed={actief}
                                    className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                                      actief
                                        ? 'border-amber-500 bg-amber-50 text-amber-800'
                                        : 'border-line bg-white text-ink-900 hover:border-amber-300'
                                    }`}
                                  >
                                    {blokje ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={blokje}
                                        alt=""
                                        className="h-5 w-5 shrink-0 rounded-full border border-line object-cover"
                                      />
                                    ) : null}
                                    {kl}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {heeftMaten ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {matenVoorKleur.map((v) => {
                                const actief = v.id === gekozenVariant;
                                const geenVoorraad =
                                  toonVoorraad && (Number(v.voorraad) || 0) <= 0;
                                return (
                                  <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => setKeuze((k) => ({ ...k, [p.id]: v.id }))}
                                    disabled={geenVoorraad}
                                    aria-pressed={actief}
                                    title={
                                      geenVoorraad ? 'Niet op voorraad' : undefined
                                    }
                                    className={`min-h-[44px] min-w-[44px] rounded-lg border px-3 py-2 text-sm font-semibold ${
                                      actief
                                        ? 'border-amber-500 bg-amber-500 text-white'
                                        : 'border-line bg-white text-ink-900 hover:border-amber-300'
                                    } ${
                                      geenVoorraad
                                        ? 'cursor-not-allowed text-warm line-through opacity-50'
                                        : ''
                                    }`}
                                  >
                                    {v.maat || 'Maat'}
                                  </button>
                                );
                              })}
                            </div>
                          ) : !meerdereKleuren ? (
                            // Geen maat- en geen kleurkeuze: één variant, knoppenrij als terugval.
                            opties.length > 1 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {opties.map((v) => {
                                  const actief = v.id === gekozenVariant;
                                  const geenVoorraad =
                                    toonVoorraad && (Number(v.voorraad) || 0) <= 0;
                                  return (
                                    <button
                                      key={v.id}
                                      type="button"
                                      onClick={() => setKeuze((k) => ({ ...k, [p.id]: v.id }))}
                                      disabled={geenVoorraad}
                                      aria-pressed={actief}
                                      className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-semibold ${
                                        actief
                                          ? 'border-amber-500 bg-amber-500 text-white'
                                          : 'border-line bg-white text-ink-900 hover:border-amber-300'
                                      } ${
                                        geenVoorraad
                                          ? 'cursor-not-allowed text-warm line-through opacity-50'
                                          : ''
                                      }`}
                                    >
                                      {[v.maat, v.kleur].filter(Boolean).join(' · ') ||
                                        'Standaard'}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null
                          ) : null}

                          <div className="mt-3 flex items-baseline justify-between">
                            <span className="text-sm font-semibold text-ink-900">
                              {gekozen ? euro(variantNetto(gekozen)) : ''}
                            </span>
                            {toonVoorraad && gekozen != null && (
                              <span className="text-xs text-warm">
                                {uitVoorraad
                                  ? 'Niet op voorraad'
                                  : `${Number(gekozen.voorraad) || 0} op voorraad`}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => voegToe(gekozenVariant)}
                            disabled={uitVoorraad}
                            className="btn-primary mt-3 w-full disabled:opacity-50"
                          >
                            In winkelwagen
                          </button>
                          {uitVoorraad && (
                            <p className="mt-2 text-xs font-semibold text-warm">Niet op voorraad</p>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div id="winkelwagen" className="scroll-mt-4">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-xl font-extrabold text-ink-900">Winkelwagen</h2>

          {budgetActief && resterendBudget != null && (
            <p className="mt-2 text-sm text-warm">
              Resterend budget:{' '}
              <span className="font-semibold text-ink-900">{budgetLabel(resterendBudget, budgetType)}</span>
            </p>
          )}
          {productbudget != null && (
            <p className="mt-1 text-sm text-warm">
              Maximaal aantal stuks per bestelling:{' '}
              <span className="font-semibold text-ink-900">{productbudget}</span>
            </p>
          )}

          {leeg ? (
            <p className="mt-4 text-sm text-warm">Je winkelwagen is nog leeg.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {mand.map((item) => {
                const match = variantIndex.get(item.variantId);
                if (!match) return null;
                const lijst = lijstprijs(match.variant.verkoopprijs, match.variant.meerprijs);
                const prijs = variantNetto(match.variant);
                return (
                  <li key={item.variantId} className="border-b border-line pb-3">
                    <p className="text-sm font-semibold text-ink-900">{match.product.naam}</p>
                    <p className="text-xs text-warm">
                      {[match.variant.maat, match.variant.kleur].filter(Boolean).join(' · ') || 'Standaard'} ·{' '}
                      {heeftKorting && prijs !== lijst ? (
                        <>
                          <span className="text-warm line-through">{euro(lijst)}</span>{' '}
                          <span className="font-semibold text-ink-900">{euro(prijs)}</span>
                        </>
                      ) : (
                        euro(prijs)
                      )}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="inline-flex items-center rounded-md border border-line">
                        <button
                          type="button"
                          onClick={() => wijzigAantal(item.variantId, item.aantal - 1)}
                          aria-label="Eén minder"
                          className="flex min-h-[40px] w-11 items-center justify-center text-lg font-bold text-ink-900 hover:bg-mist"
                        >
                          &minus;
                        </button>
                        <span className="min-w-[40px] px-2 text-center text-sm font-semibold text-ink-900">
                          {item.aantal}
                        </span>
                        <button
                          type="button"
                          onClick={() => wijzigAantal(item.variantId, item.aantal + 1)}
                          aria-label="Eén meer"
                          className="flex min-h-[40px] w-11 items-center justify-center text-lg font-bold text-ink-900 hover:bg-mist"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => wijzigAantal(item.variantId, 0)}
                        className="min-h-[40px] text-xs font-semibold text-warm hover:text-ink-800"
                      >
                        Verwijder
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {heeftKorting && (
            <p className="mt-4 text-xs text-warm">Klantkorting van {korting}% is al in de prijzen verwerkt.</p>
          )}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-warm">Totaal</span>
            <span className="font-display font-extrabold text-ink-900">{euro(totaal)}</span>
          </div>
          {budgetActief && budgetTotaal !== totaal && (
            <div className="mt-1 flex items-center justify-between text-xs text-warm">
              <span>Telt mee voor je budget</span>
              <span className="font-semibold text-ink-900">{budgetLabel(budgetTotaal, budgetType)}</span>
            </div>
          )}

          {overBudget && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-ink-800">
              Het totaal is hoger dan het resterende budget. Pas de winkelwagen aan om te kunnen bestellen.
            </div>
          )}
          {overProductbudget && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-ink-800">
              Je hebt {aantalStuks} stuks gekozen, maar maximaal {productbudget} per bestelling is toegestaan.
            </div>
          )}
          {onderMin && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-ink-800">
              Het minimale bestelbedrag is {euro(Number(minBestelbedrag))}. Voeg meer toe aan je winkelwagen.
            </div>
          )}
          {bovenMax && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-ink-800">
              Het maximale bestelbedrag is {euro(Number(maxBestelbedrag))}. Haal iets uit je winkelwagen.
            </div>
          )}

          <form action={plaatsBestelling} className="mt-4">
            <input type="hidden" name="mand" value={JSON.stringify(mand)} />

            {kiesMedewerker ? (
              <div className="mb-3">
                <label htmlFor="medewerker_id" className="block text-xs font-semibold text-warm">
                  Bestellen voor medewerker
                </label>
                <select id="medewerker_id" name="medewerker_id" defaultValue="" className={inputClass}>
                  <option value="">Geen specifieke medewerker</option>
                  {medewerkers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.naam ?? ([m.voornaam, m.achternaam].filter(Boolean).join(' ') || m.email)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              eigenMedewerkerNaam && (
                <p className="mb-3 text-xs text-warm">Bestelling op naam van {eigenMedewerkerNaam}.</p>
              )
            )}

            {gebruikReferentienr && (
              <div className="mb-3">
                <label htmlFor="referentienr" className="block text-xs font-semibold text-warm">
                  Referentienummer
                </label>
                <input id="referentienr" name="referentienr" type="text" className={inputClass} />
              </div>
            )}

            {opmerkingBijBestelling && (
              <div className="mb-3">
                <label htmlFor="notitie" className="block text-xs font-semibold text-warm">
                  Opmerking (optioneel)
                </label>
                <textarea id="notitie" name="notitie" rows={2} className={inputClass} />
              </div>
            )}

            <button type="submit" disabled={geblokkeerd} className="btn-primary w-full disabled:opacity-50">
              Bestelling plaatsen
            </button>
          </form>
        </div>
      </div>

      {!leeg && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-4 py-3 shadow-soft lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-warm">
                {aantalStuks} {aantalStuks === 1 ? 'stuk' : 'stuks'}
              </p>
              <p className="font-display text-lg font-extrabold text-ink-900">{euro(totaal)}</p>
            </div>
            <button
              type="button"
              disabled={geblokkeerd}
              onClick={() =>
                document.getElementById('winkelwagen')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="btn-primary min-h-[48px] flex-1 max-w-[60%] disabled:opacity-50"
            >
              Bestellen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
