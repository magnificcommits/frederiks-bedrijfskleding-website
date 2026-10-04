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

  const veld =
    'mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink-800 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
  const label = 'block text-sm font-medium text-ink-800';

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

  return (
    <div className="card" ref={wortel}>
      {titel && <h3 className="kop-3 text-ink-900">{titel}</h3>}

      {!verzetten && (
        <fieldset className={titel ? 'mt-4' : ''}>
          <legend className="text-sm font-semibold text-ink-900">1. Wat voor afspraak?</legend>
          {soorten && actieveSoorten.length === 0 ? (
            <p className="mt-3 text-sm text-warm">Online plannen staat even uit. Bel of app ons, dan prikken we samen een moment.</p>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {actieveSoorten.map((s) => {
                const info = SOORT_INFO[s];
                const aan = soort === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => kiesSoort(s)}
                    aria-pressed={aan}
                    className={`rounded-lg border p-4 text-left transition ${
                      aan ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' : 'border-line bg-white hover:border-ink-300'
                    }`}
                  >
                    <span className="block font-semibold text-ink-900">{info.label}</span>
                    <span className="mt-0.5 block text-xs font-medium uppercase tracking-wide text-amber-700">{info.duurTekst}</span>
                    <span className="mt-2 block text-sm leading-snug text-warm">{info.uitleg}</span>
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
      )}

      {(soort || verzetten) && (
        <fieldset className={verzetten ? '' : 'mt-6'}>
          <legend className="text-sm font-semibold text-ink-900">
            {verzetten ? 'Kies een nieuw moment' : soort === 'pasdag' ? '2. Voorkeursdag en -tijd' : '2. Kies een dag en tijd'}
          </legend>

          {laden && <p className="mt-3 text-sm text-warm">Vrije tijden ophalen…</p>}

          {!laden && dagen && dagen.length === 0 && (
            <p className="mt-3 text-sm text-warm">
              De komende weken is er online niets meer vrij. Bel of app ons even, dan zoeken we samen een moment.
            </p>
          )}

          {!laden && dagen && dagen.length > 0 && (
            <>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="btn-ghost shrink-0 px-3 py-2 text-sm disabled:opacity-40"
                  onClick={() => setVenster((v) => Math.max(0, v - DAGEN_PER_SCHERM))}
                  disabled={venster === 0}
                  aria-label="Eerdere dagen"
                >
                  ‹
                </button>
                <div className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {zichtbareDagen.map((d) => {
                    const aan = d.datum === datum;
                    return (
                      <button
                        key={d.datum}
                        type="button"
                        onClick={() => {
                          setDatum(d.datum);
                          setTijd(null);
                        }}
                        aria-pressed={aan}
                        className={`rounded-lg border px-2 py-2 text-center text-sm transition ${
                          aan ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-white text-ink-800 hover:border-ink-300'
                        }`}
                      >
                        <span className="block font-semibold">{datumKort(d.datum)}</span>
                        <span className={`block text-xs ${aan ? 'text-ink-200' : 'text-warm'}`}>{d.tijden.length} vrij</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="btn-ghost shrink-0 px-3 py-2 text-sm disabled:opacity-40"
                  onClick={() => setVenster((v) => v + DAGEN_PER_SCHERM)}
                  disabled={venster + DAGEN_PER_SCHERM >= (dagen?.length ?? 0)}
                  aria-label="Latere dagen"
                >
                  ›
                </button>
              </div>

              {gekozenDag && (
                <div className="mt-4">
                  <p className="text-sm text-warm">{datumLang(gekozenDag.datum)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {gekozenDag.tijden.map((t) => {
                      const aan = t === tijd;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTijd(t)}
                          aria-pressed={aan}
                          className={`rounded-md border px-3 py-1.5 text-sm font-semibold tabular-nums transition ${
                            aan ? 'border-amber-500 bg-amber-500 text-ink-900' : 'border-line bg-white text-ink-800 hover:border-ink-300'
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </fieldset>
      )}

      {melding && status !== 'ok' && (
        <p className="mt-4 rounded-md border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-ink-800" role="alert">
          {melding}
        </p>
      )}

      {soort && datum && tijd && (
        <form onSubmit={verstuur} className="mt-6 grid gap-4">
          {!verzetten && (
            <>
              <p className="text-sm font-semibold text-ink-900">3. Je gegevens</p>
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

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={status === 'bezig'} className="btn-primary">
              {status === 'bezig'
                ? 'Bezig…'
                : verzetten
                  ? `Verzet naar ${datumKort(datum)} ${tijd}`
                  : `Plan ${datumKort(datum)} om ${tijd}`}
            </button>
            <span className="text-sm text-warm">
              {SOORT_INFO[soort].label}, {datumLang(datum)} om {tijd}
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
