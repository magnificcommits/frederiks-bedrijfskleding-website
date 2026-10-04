'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { branches } from '@/content/branches';
import { getHerkomst, leesHerkomstVoorLead } from '@/lib/herkomst';
import { datumKort, datumLang } from '@/app/dashboard/taken/tijd';
import { AFSPRAAK_SOORTEN, SOORT_INFO, type AfspraakSoort, type VrijeDag } from '@/lib/afspraken/soorten';

type SoortStand = Record<AfspraakSoort, { actief: boolean; duurMin: number }>;

type Props = {
  /** Welke soort al aangevinkt staat. */
  standaardSoort?: AfspraakSoort;
  /** Vooraf gekozen branche in het formulier (branchepagina). */
  defaultBranche?: string;
  /** Waar de kiezer staat, gaat mee als herkomst van de lead (bv. "Regiopagina Doetinchem"). */
  bron?: string;
  /** Verzetten van een bestaande afspraak: alleen dag en tijd kiezen. */
  verzetToken?: string;
  /** Na verzetten (de beheerpagina ververst dan). */
  naVerzet?: () => void;
  /** Optionele kop boven de kiezer; laat leeg als de pagina zelf al een kop heeft. */
  titel?: string;
};

const DAGEN_PER_SCHERM = 7;

/**
 * Online een afspraak plannen: kies wat voor afspraak, dan dag en tijd, dan je
 * gegevens. Vrije tijden komen uit /api/afspraak/beschikbaar (werkdagen,
 * tijdvakken, buffer en de agenda van Jessi), boeken via /api/afspraak.
 * Herbruikbaar op /afspraak, contact, branche- en regiopagina's.
 */
export function AfspraakKiezer({ standaardSoort, defaultBranche = '', bron, verzetToken, naVerzet, titel }: Props) {
  const verzetten = Boolean(verzetToken);
  const [soorten, setSoorten] = useState<SoortStand | null>(null);
  const [soort, setSoort] = useState<AfspraakSoort | null>(standaardSoort ?? null);
  const [dagen, setDagen] = useState<VrijeDag[] | null>(null);
  const [laden, setLaden] = useState(false);
  const [venster, setVenster] = useState(0);
  const [datum, setDatum] = useState<string | null>(null);
  const [tijd, setTijd] = useState<string | null>(null);
  const [vorm, setVorm] = useState<'bellen' | 'video'>('bellen');
  const [status, setStatus] = useState<'idle' | 'bezig' | 'ok' | 'fout'>('idle');
  const [melding, setMelding] = useState('');
  const [geboekt, setGeboekt] = useState<{ datum: string; tijd: string } | null>(null);

  const haalTijden = useCallback(
    async (s: AfspraakSoort | null) => {
      setLaden(true);
      setDagen(null);
      try {
        const q = verzetToken ? `token=${encodeURIComponent(verzetToken)}` : s ? `soort=${s}` : '';
        const res = await fetch(`/api/afspraak/beschikbaar?${q}`, { cache: 'no-store' });
        const json = (await res.json().catch(() => null)) as { soorten?: SoortStand; dagen?: VrijeDag[]; soort?: AfspraakSoort; error?: string } | null;
        if (!res.ok || !json) throw new Error(json?.error || 'Tijden ophalen lukte niet.');
        if (json.soorten) setSoorten(json.soorten);
        if (json.soort && verzetToken) setSoort(json.soort);
        setDagen(json.dagen ?? null);
      } catch (e) {
        setDagen([]);
        setMelding(e instanceof Error ? e.message : 'Tijden ophalen lukte niet.');
      } finally {
        setLaden(false);
      }
    },
    [verzetToken],
  );

  // Pas ophalen als de kiezer bijna in beeld is. Op branche-, regio- en contactpagina's
  // staat hij onderaan: zonder dit kost elke paginaweergave een API-aanroep en een
  // databasequery, en loopt een kantoor achter één IP-adres tegen de limiet aan.
  const wortel = useRef<HTMLDivElement>(null);
  const [inBeeld, setInBeeld] = useState(false);
  useEffect(() => {
    const el = wortel.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInBeeld(true);
      return;
    }
    const io = new IntersectionObserver(
      (items) => {
        if (items.some((i) => i.isIntersecting)) {
          setInBeeld(true);
          io.disconnect();
        }
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inBeeld) return;
    void haalTijden(verzetToken ? null : soort);
    // Alleen bij het in beeld komen en bij een andere soort opnieuw ophalen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soort, verzetToken, inBeeld]);

  // Een uitgeschakelde soort niet voorgeselecteerd laten staan.
  useEffect(() => {
    if (soorten && soort && !soorten[soort]?.actief && !verzetten) setSoort(null);
  }, [soorten, soort, verzetten]);

  const zichtbareDagen = useMemo(() => (dagen ?? []).slice(venster, venster + DAGEN_PER_SCHERM), [dagen, venster]);
  const gekozenDag = (dagen ?? []).find((d) => d.datum === datum) ?? null;

  function kiesSoort(s: AfspraakSoort) {
    setSoort(s);
    setDatum(null);
    setTijd(null);
    setVenster(0);
    setMelding('');
    setStatus('idle');
  }

  async function bezetOpnieuw(boodschap: string) {
    setMelding(boodschap);
    setTijd(null);
    await haalTijden(soort);
  }

  async function verstuur(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!soort || !datum || !tijd || status === 'bezig') return;
    setStatus('bezig');
    setMelding('');
    try {
      if (verzetToken) {
        const res = await fetch('/api/afspraak/verzet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: verzetToken, datum, tijd }),
        });
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        if (res.status === 409) {
          setStatus('fout');
          await bezetOpnieuw(json?.error || 'Dit moment is net bezet.');
          return;
        }
        if (!res.ok) throw new Error(json?.error || 'Verzetten lukte niet.');
        setGeboekt({ datum, tijd });
        setStatus('ok');
        naVerzet?.();
        return;
      }
      const fd = new FormData(e.currentTarget);
      const payload = Object.fromEntries(fd.entries()) as Record<string, string>;
      const res = await fetch('/api/afspraak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          soort,
          datum,
          tijd,
          vorm: soort === 'advies' ? vorm : undefined,
          bron: [bron, getHerkomst()].filter(Boolean).join(' | '),
          herkomst: leesHerkomstVoorLead(),
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 409) {
        setStatus('fout');
        await bezetOpnieuw(json?.error || 'Dit moment is net bezet.');
        return;
      }
      if (!res.ok) throw new Error(json?.error || 'Er ging iets mis. Probeer het opnieuw of bel ons.');
      (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('event', 'generate_lead', {
        event_category: 'afspraak',
        event_label: soort,
      });
      setGeboekt({ datum, tijd });
      setStatus('ok');
    } catch (err) {
      setStatus('fout');
      setMelding(err instanceof Error ? err.message : 'Er ging iets mis.');
    }
  }

  const veld = 'invoer';
  const label = 'invoer-label';

  if (status === 'ok' && geboekt && soort) {
    return (
      <div className="card border-amber-200 bg-amber-50" role="status">
        <p className="eyebrow">{verzetten ? 'Verzet' : 'Staat in de agenda'}</p>
        <h3 className="mt-2 text-xl font-bold text-ink-900">
          {SOORT_INFO[soort].label} op {datumLang(geboekt.datum)} om {geboekt.tijd}
        </h3>
        <p className="mt-3 text-warm">
          Je krijgt zo een mail met de afspraak als agenda-uitnodiging. Daarin staat ook een link om te verzetten of te annuleren.
          {soort === 'pasdag' && ' Jessi belt je vooraf om de pasdag samen af te stemmen.'}
        </p>
      </div>
    );
  }

  const actieveSoorten = AFSPRAAK_SOORTEN.filter((s) => !soorten || soorten[s].actief);
  const stapNu = !soort && !verzetten ? 1 : !(datum && tijd) ? 2 : 3;
  const stappen = verzetten ? [] : ['Soort', soort === 'pasdag' ? 'Voorkeur' : 'Dag en tijd', 'Gegevens'];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card" ref={wortel}>
      {/* Stappenbalk: je ziet vanaf het begin dat het drie korte stappen zijn. */}
      {stappen.length > 0 && (
        <ol className="grid grid-cols-3 border-b border-line bg-mist">
          {stappen.map((naam, i) => {
            const stand = i + 1 < stapNu ? 'klaar' : i + 1 === stapNu ? 'nu' : 'straks';
            return (
              <li key={naam} className={`flex items-center gap-2.5 px-3 py-3 sm:px-5 ${i > 0 ? 'border-l border-line' : ''}`} aria-current={stand === 'nu' ? 'step' : undefined}>
                <span className="stap-nr" data-stand={stand} aria-hidden="true">
                  {stand === 'klaar' ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.2 3.2L13 5" /></svg>
                  ) : i + 1}
                </span>
                <span className={`text-[13px] font-semibold leading-tight sm:text-sm ${stand === 'straks' ? 'text-ink-400' : 'text-ink-900'}`}>
                  <span className="sr-only">Stap {i + 1}: </span>{naam}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="p-5 sm:p-7">
      {titel && <h3 className="kop-3 mb-4 text-ink-900">{titel}</h3>}

      {!verzetten && (
        <fieldset>
          <legend className="font-display text-xl font-extrabold text-ink-900">Wat voor afspraak wil je?</legend>
          {soorten && actieveSoorten.length === 0 ? (
            <p className="mt-3 text-sm text-warm">Online plannen staat even uit. Bel of app ons, dan prikken we samen een moment.</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {actieveSoorten.map((s) => {
                const info = SOORT_INFO[s];
                const aan = soort === s;
                return (
                  <button key={s} type="button" onClick={() => kiesSoort(s)} aria-pressed={aan} className="keuze">
                    <span className="flex items-start justify-between gap-3">
                      <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${aan ? 'bg-amber-500 text-ink-900' : 'bg-ink-900 text-white'}`} aria-hidden="true">
                        <SoortIcoon soort={s} />
                      </span>
                      <span className="keuze-rond" aria-hidden="true">✓</span>
                    </span>
                    <span className="mt-3 block font-display text-lg font-extrabold leading-snug text-ink-900">{info.label}</span>
                    <span className="mt-1 inline-block self-start rounded bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-700">{info.duurTekst}</span>
                    <span className="mt-2.5 block flex-1 text-sm leading-snug text-warm">{info.uitleg}</span>
                    <span className={`mt-4 hidden min-h-[40px] items-center justify-center rounded-md px-4 text-sm font-semibold md:inline-flex ${aan ? 'bg-amber-500 text-ink-900' : 'bg-ink-900 text-white'}`}>
                      {aan ? 'Gekozen' : 'Kies dit'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
      )}

      {/* Nog niets gekozen: laat zien wat er komt, in plaats van een lege kaart. */}
      {!soort && !verzetten && actieveSoorten.length > 0 && (
        <div className="mt-6 flex items-center gap-4 rounded-xl border-2 border-dashed border-ink-200 px-5 py-5 text-sm text-warm">
          <svg className="h-8 w-8 shrink-0 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
          <p>Kies hierboven een soort afspraak. Daarna zie je hier meteen de vrije dagen en tijden van Jessi.</p>
        </div>
      )}

      {(soort || verzetten) && (
        <fieldset className={verzetten ? '' : 'mt-8 border-t border-line pt-7'}>
          <legend className="float-left w-full font-display text-xl font-extrabold text-ink-900">
            {verzetten ? 'Kies een nieuw moment' : soort === 'pasdag' ? 'Welke dag heeft je voorkeur?' : 'Wanneer komt het uit?'}
          </legend>

          {laden && (
            <div className="clear-both grid grid-cols-3 gap-2 pt-4 sm:grid-cols-4 lg:grid-cols-7" role="status" aria-label="Vrije tijden ophalen">
              {Array.from({ length: 7 }).map((_, i) => <span key={i} className="h-[4.25rem] animate-pulse rounded-xl bg-ink-100" />)}
            </div>
          )}

          {!laden && dagen && dagen.length === 0 && (
            <p className="clear-both pt-3 text-sm text-warm">
              De komende weken is er online niets meer vrij. Bel of app ons even, dan zoeken we samen een moment.
            </p>
          )}

          {!laden && dagen && dagen.length > 0 && (
            <div className="clear-both pt-4">
              {/* Telefoon: alle dagen in één strook om doorheen te vegen, zonder pijltjes. */}
              <div className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-2 sm:hidden">
                  {(dagen ?? []).map((d) => {
                    const aan = d.datum === datum;
                    const [weekdag, ...rest] = datumKort(d.datum).split(' ');
                    return (
                      <button
                        key={d.datum}
                        type="button"
                        onClick={() => {
                          setDatum(d.datum);
                          setTijd(null);
                        }}
                        aria-pressed={aan}
                        className={`w-[4.75rem] shrink-0 snap-start whitespace-nowrap rounded-xl border-2 px-2 py-2.5 text-center transition ${
                          aan ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-900 hover:border-ink-900'
                        }`}
                      >
                        <span className={`block text-xs font-semibold ${aan ? 'text-amber-400' : 'text-warm'}`}>{weekdag}</span>
                        <span className="block font-display text-base font-extrabold">{rest.join(' ')}</span>
                        <span className={`block text-[11px] ${aan ? 'text-ink-200' : 'text-warm'}`}>{d.tijden.length} vrij</span>
                      </button>
                    );
                  })}
              </div>
              <div className="hidden items-stretch gap-2 sm:flex">
                <button
                  type="button"
                  className="flex w-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink-200 text-xl text-ink-900 transition hover:border-ink-900 disabled:opacity-30 disabled:hover:border-ink-200"
                  onClick={() => setVenster((v) => Math.max(0, v - DAGEN_PER_SCHERM))}
                  disabled={venster === 0}
                  aria-label="Eerdere dagen"
                >
                  ‹
                </button>
                <div className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {zichtbareDagen.map((d) => {
                    const aan = d.datum === datum;
                    const [weekdag, ...rest] = datumKort(d.datum).split(' ');
                    return (
                      <button
                        key={d.datum}
                        type="button"
                        onClick={() => {
                          setDatum(d.datum);
                          setTijd(null);
                        }}
                        aria-pressed={aan}
                        className={`rounded-xl border-2 px-2 py-2.5 text-center transition ${
                          aan ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-900 hover:border-ink-900'
                        }`}
                      >
                        <span className={`block text-xs font-semibold ${aan ? 'text-amber-400' : 'text-warm'}`}>{weekdag}</span>
                        <span className="block font-display text-base font-extrabold">{rest.join(' ')}</span>
                        <span className={`block text-[11px] ${aan ? 'text-ink-200' : 'text-warm'}`}>{d.tijden.length} vrij</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="flex w-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink-200 text-xl text-ink-900 transition hover:border-ink-900 disabled:opacity-30 disabled:hover:border-ink-200"
                  onClick={() => setVenster((v) => v + DAGEN_PER_SCHERM)}
                  disabled={venster + DAGEN_PER_SCHERM >= (dagen?.length ?? 0)}
                  aria-label="Latere dagen"
                >
                  ›
                </button>
              </div>

              {gekozenDag ? (
                <div className="mt-5">
                  <p className="text-sm font-semibold text-ink-900">Vrije tijden op {datumLang(gekozenDag.datum)}</p>
                  <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                    {gekozenDag.tijden.map((t) => {
                      const aan = t === tijd;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTijd(t)}
                          aria-pressed={aan}
                          className={`min-h-[44px] rounded-lg border-2 text-[15px] font-semibold tabular-nums transition ${
                            aan ? 'border-amber-500 bg-amber-500 text-ink-900' : 'border-ink-200 bg-white text-ink-900 hover:border-ink-900'
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-warm">Kies een dag, dan zie je de vrije tijden.</p>
              )}
            </div>
          )}
        </fieldset>
      )}

      {melding && status !== 'ok' && (
        <p className="mt-4 rounded-md border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-ink-800" role="alert">
          {melding}
        </p>
      )}

      {soort && datum && tijd && (
        <form onSubmit={verstuur} className="mt-8 grid gap-4 border-t border-line pt-7">
          {!verzetten && (
            <>
              <p className="font-display text-xl font-extrabold text-ink-900">Waar bereiken we je?</p>
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={label} htmlFor="afs-naam">Naam *</label>
                  <input id="afs-naam" name="naam" required minLength={2} className={veld} autoComplete="name" />
                </div>
                <div>
                  <label className={label} htmlFor="afs-bedrijf">Bedrijf</label>
                  <input id="afs-bedrijf" name="bedrijf" className={veld} autoComplete="organization" />
                </div>
                <div>
                  <label className={label} htmlFor="afs-email">E-mail *</label>
                  <input id="afs-email" name="email" type="email" required className={veld} autoComplete="email" />
                </div>
                <div>
                  <label className={label} htmlFor="afs-telefoon">Telefoon{soort !== 'showroom' ? ' *' : ''}</label>
                  <input id="afs-telefoon" name="telefoon" type="tel" required={soort !== 'showroom'} className={veld} autoComplete="tel" />
                </div>
                <div>
                  <label className={label} htmlFor="afs-aantal">Aantal medewerkers</label>
                  <select id="afs-aantal" name="aantal" className={veld} defaultValue="">
                    <option value="">Kies…</option>
                    <option>1 (zzp)</option>
                    <option>2 tot 10</option>
                    <option>11 tot 25</option>
                    <option>26 tot 50</option>
                    <option>50+</option>
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="afs-branche">Branche</label>
                  <select id="afs-branche" name="branche" defaultValue={defaultBranche} className={veld}>
                    <option value="">Kies een branche…</option>
                    {branches.map((b) => (
                      <option key={b.slug} value={b.navLabel}>{b.navLabel}</option>
                    ))}
                    <option value="Anders">Anders</option>
                  </select>
                </div>
              </div>

              {soort === 'advies' && (
                <fieldset>
                  <legend className={label}>Hoe wil je praten?</legend>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-ink-800">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="vorm-keuze" checked={vorm === 'bellen'} onChange={() => setVorm('bellen')} /> Bellen
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="vorm-keuze" checked={vorm === 'video'} onChange={() => setVorm('video')} /> Video (je krijgt vooraf een link)
                    </label>
                  </div>
                </fieldset>
              )}

              {soort === 'pasdag' && (
                <div>
                  <label className={label} htmlFor="afs-locatie">Adres of plaats van de pasdag *</label>
                  <input id="afs-locatie" name="locatie" required className={veld} placeholder="Bijv. Industrieweg 4, Doetinchem" autoComplete="street-address" />
                </div>
              )}

              <div>
                <label className={label} htmlFor="afs-opmerking">Opmerking</label>
                <textarea
                  id="afs-opmerking"
                  name="opmerking"
                  rows={3}
                  className={veld}
                  placeholder={soort === 'pasdag' ? 'Bijv. 12 monteurs, jassen en broeken, we hebben een kantine waar we kunnen passen' : 'Bijv. we zoeken zomer- en winterkleding voor 6 hoveniers'}
                />
              </div>
              <label className="flex items-start gap-3 text-sm text-warm">
                <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
                <span>Ik ga ermee akkoord dat mijn gegevens worden gebruikt om deze afspraak te plannen en voor te bereiden.</span>
              </label>
            </>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-mist p-4">
            <button type="submit" disabled={status === 'bezig'} className="btn-primary w-full px-8 py-3.5 text-base sm:w-auto">
              {status === 'bezig' ? 'Bezig…' : verzetten ? 'Verzet de afspraak' : 'Leg de afspraak vast'}
            </button>
            <span className="text-sm text-ink-900">
              <strong>{SOORT_INFO[soort].label}</strong>
              <br />
              {datumLang(datum)} om {tijd}
            </span>
          </div>
        </form>
      )}
      </div>
    </div>
  );
}

function SoortIcoon({ soort }: { soort: AfspraakSoort }) {
  const p = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (soort === 'advies') {
    return <svg {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>;
  }
  if (soort === 'showroom') {
    return <svg {...p}><path d="M3 9l1.5-5h15L21 9M4 9v11h16V9M3 9h18M9 20v-6h6v6" /></svg>;
  }
  return <svg {...p}><path d="M8 3l-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z" /></svg>;
}
