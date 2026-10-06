'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PortaalDemo, PortaalFragmenten } from '@/components/PortaalDemo';
import { demoVideo } from '@/content/demo';
import { site } from '@/content/site';
import { track } from '@/lib/analytics';
import { getHerkomst, leesHerkomstVoorLead } from '@/lib/herkomst';

/**
 * Demo van het kledingportaal achter een kort formulier, met daarna drie
 * vragen om de behoefte te peilen. Beide stappen gaan naar /api/lead met
 * hetzelfde e-mailadres; de inname voegt de antwoorden toe aan dezelfde lead
 * (zie lib/kms/leadInname.ts: open lead met hetzelfde adres binnen 7 dagen).
 */
type Fase = 'poort' | 'kijken' | 'klaar';

const AANTALLEN = ['1 tot 10', '11 tot 25', '26 tot 50', '51 tot 100', 'Meer dan 100'];

const VRAGEN: { id: string; vraag: string; opties: string[]; meer?: boolean }[] = [
  {
    id: 'nu',
    vraag: 'Hoe regelen jullie de bedrijfskleding nu?',
    opties: ['Mail, app en lijstjes', 'Een spreadsheet', 'Een webshop of portaal van een andere leverancier', 'Iedereen koopt zelf en declareert', 'Nog niet geregeld'],
  },
  {
    id: 'tijd',
    vraag: 'Wat kost jullie de meeste tijd?',
    meer: true,
    opties: ['Maten navragen en ruilen', 'Bestellingen verzamelen', 'Budget per persoon bijhouden', 'Nieuwe collega’s aankleden', 'Uitdelen en sorteren'],
  },
  {
    id: 'start',
    vraag: 'Wanneer wil je ermee starten?',
    opties: ['Binnen een maand', 'Binnen drie maanden', 'Dit jaar nog', 'Ik oriënteer me nog'],
  },
];

const SLEUTEL = 'fb-demo-poort';

export function DemoPoort() {
  const [fase, setFase] = useState<Fase>('poort');
  const [gegevens, setGegevens] = useState({ name: '', company: '', email: '', phone: '' });
  const [aantal, setAantal] = useState('');
  const [consent, setConsent] = useState(false);
  const [antwoorden, setAntwoorden] = useState<Record<string, string[]>>({});
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const heeftVideo = Boolean(demoVideo.video);

  // Wie het formulier al invulde, hoeft het na herladen niet opnieuw te doen.
  useEffect(() => {
    try {
      const ruw = sessionStorage.getItem(SLEUTEL);
      if (!ruw) return;
      const g = JSON.parse(ruw) as typeof gegevens & { aantal?: string };
      if (g?.email) {
        setGegevens({ name: g.name ?? '', company: g.company ?? '', email: g.email, phone: g.phone ?? '' });
        setAantal(g.aantal ?? '');
        setFase('kijken');
      }
    } catch {
      // Geen opslag: gewoon het formulier tonen.
    }
  }, []);

  async function stuur(bericht: string, bron: string) {
    const res = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...gegevens,
        aantal,
        bericht,
        bron: `${bron} | ${getHerkomst()}`.slice(0, 400),
        consent: true,
        bron_kanaal: 'formulier',
        herkomst: leesHerkomstVoorLead(),
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new Error(j?.error ?? 'Versturen lukte niet. Probeer het opnieuw of bel ons.');
    }
  }

  async function openDemo(e: React.FormEvent) {
    e.preventDefault();
    setFout('');
    if (gegevens.name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gegevens.email.trim())) {
      setFout('Vul je naam en een geldig e-mailadres in.');
      return;
    }
    if (!consent) {
      setFout('Geef aan dat we je gegevens mogen gebruiken.');
      return;
    }
    setBezig(true);
    try {
      await stuur(
        [`Bekeek de demo van het kledingportaal.`, `Aantal medewerkers: ${aantal || 'niet opgegeven'}`].join('\n'),
        heeftVideo ? 'Demovideo kledingbeheer' : 'Demo kledingportaal',
      );
      track('generate_lead', { formulier: 'demo_kledingbeheer' });
      try {
        sessionStorage.setItem(SLEUTEL, JSON.stringify({ ...gegevens, aantal }));
      } catch {
        // niet erg
      }
      setFase('kijken');
      requestAnimationFrame(() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Versturen lukte niet.');
    } finally {
      setBezig(false);
    }
  }

  function kies(id: string, optie: string, meer?: boolean) {
    setAntwoorden((a) => {
      const nu = a[id] ?? [];
      if (!meer) return { ...a, [id]: [optie] };
      return { ...a, [id]: nu.includes(optie) ? nu.filter((x) => x !== optie) : [...nu, optie] };
    });
  }

  async function stuurAntwoorden() {
    setFout('');
    setBezig(true);
    try {
      const regels = VRAGEN.map((v) => `${v.vraag} ${(antwoorden[v.id] ?? []).join(', ') || 'niet ingevuld'}`);
      await stuur(['Antwoorden na de demo van het kledingportaal:', ...regels].join('\n'), 'Demo kledingportaal, vragenlijst');
      track('formulier_gestart', { formulier: 'demo_vragenlijst' });
      setFase('klaar');
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Versturen lukte niet.');
    } finally {
      setBezig(false);
    }
  }

  const voornaam = site.owner.split(' ')[0];
  const ingevuld = VRAGEN.every((v) => (antwoorden[v.id] ?? []).length > 0);

  if (fase === 'poort') {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-8">
        {/* Voorproef: wazig portaalbeeld met een afspeelknop, zodat je ziet wat je krijgt. */}
        <div className="relative overflow-hidden rounded-2xl bg-ink-900" aria-hidden="true">
          <div className="pointer-events-none select-none p-4 opacity-60 blur-[2px] sm:p-6">
            <PortaalDemo />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink-900/40 p-6 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500 text-ink-900 shadow-card">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </span>
            <p className="mt-4 font-display text-xl font-extrabold text-white">
              {heeftVideo ? `Demo, ${demoVideo.duur}` : 'Het portaal in je eigen tempo'}
            </p>
          </div>
        </div>

        <form onSubmit={openDemo} noValidate className="self-start rounded-2xl border border-line bg-white p-6 shadow-card sm:p-7">
          <h2 className="font-display text-2xl font-extrabold text-ink-900">{heeftVideo ? 'Bekijk de demo' : 'Bekijk het portaal'}</h2>
          <p className="mt-1 text-sm text-warm">Vier velden, daarna kijk je meteen. Geen verkooppraatje, geen verplichting.</p>
          <div className="mt-5 grid gap-4">
            <div>
              <label className="invoer-label" htmlFor="demo-naam">Naam *</label>
              <input id="demo-naam" className="invoer" autoComplete="name" value={gegevens.name} onChange={(e) => setGegevens({ ...gegevens, name: e.target.value })} />
            </div>
            <div>
              <label className="invoer-label" htmlFor="demo-bedrijf">Bedrijf</label>
              <input id="demo-bedrijf" className="invoer" autoComplete="organization" value={gegevens.company} onChange={(e) => setGegevens({ ...gegevens, company: e.target.value })} />
            </div>
            <div>
              <label className="invoer-label" htmlFor="demo-email">Zakelijk e-mailadres *</label>
              <input id="demo-email" type="email" className="invoer" autoComplete="email" value={gegevens.email} onChange={(e) => setGegevens({ ...gegevens, email: e.target.value })} />
            </div>
            <fieldset>
              <legend className="invoer-label">Hoeveel mensen kleed je?</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {AANTALLEN.map((a) => (
                  <button key={a} type="button" aria-pressed={aantal === a} onClick={() => setAantal(a)} className="keuze keuze-rij !min-h-[44px] !py-2 text-sm">
                    {a}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex items-start gap-3 text-sm text-warm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
              <span>{voornaam} mag contact met me opnemen over het kledingportaal.</span>
            </label>
          </div>
          {fout && <p className="mt-4 text-sm font-medium text-amber-700" role="alert">{fout}</p>}
          <button type="submit" disabled={bezig} className="btn-primary mt-5 w-full py-3.5 text-base">
            {bezig ? 'Even geduld…' : heeftVideo ? 'Start de demo' : 'Open het portaal'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="demo">
      <div className="overflow-hidden rounded-2xl bg-ink-900 shadow-card">
        {heeftVideo ? (
          <video className="aspect-video w-full" controls playsInline preload="metadata" poster={demoVideo.poster || undefined} src={demoVideo.video}>
            Je browser kan deze video niet afspelen.
          </video>
        ) : (
          <div className="p-4 sm:p-6">
            <PortaalDemo />
            <PortaalFragmenten className="mt-6" />
          </div>
        )}
      </div>

      {fase === 'kijken' ? (
        <div className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
          <h2 className="kop-2">Past dit bij jullie?</h2>
          <p className="mt-2 max-w-[60ch] text-warm">Drie vragen, dan weet {voornaam} waar ze op moet letten als ze je belt.</p>
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {VRAGEN.map((v) => (
              <fieldset key={v.id}>
                <legend className="font-display text-lg font-extrabold text-ink-900">{v.vraag}</legend>
                {v.meer && <p className="text-sm text-warm">Meerdere antwoorden mogen.</p>}
                <div className="mt-3 grid gap-2">
                  {v.opties.map((o) => (
                    <button key={o} type="button" aria-pressed={(antwoorden[v.id] ?? []).includes(o)} onClick={() => kies(v.id, o, v.meer)} className="keuze keuze-rij !min-h-[48px] text-sm">
                      <span className={`keuze-rond ${v.meer ? '!rounded-md' : ''}`} aria-hidden="true">✓</span>
                      {o}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          {fout && <p className="mt-4 text-sm font-medium text-amber-700" role="alert">{fout}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-mist p-4">
            <button type="button" onClick={stuurAntwoorden} disabled={bezig || !ingevuld} className="btn-primary px-8">
              {bezig ? 'Versturen…' : 'Verstuur mijn antwoorden'}
            </button>
            <p className="text-sm text-warm">{ingevuld ? `${voornaam} belt je binnen 24 uur, op werkdagen.` : 'Kies bij elke vraag een antwoord.'}</p>
          </div>
        </div>
      ) : (
        <div className="paneel-donker p-6 sm:p-8" role="status">
          <h2 className="font-display text-2xl font-extrabold text-white">Dank je, {gegevens.name.split(' ')[0] || 'we hebben het'}.</h2>
          <p className="mt-2 max-w-[60ch] text-ink-200">
            {voornaam} kijkt naar je antwoorden en belt je binnen 24 uur, op werkdagen. Liever meteen een moment vastleggen?
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/afspraak?soort=advies" className="btn-primary" data-cta="afspraak">Plan een demo van 15 minuten</Link>
            <a href={`tel:${site.phoneIntl}`} className="btn border-2 border-white/60 text-white hover:border-white hover:bg-white hover:text-ink-900" data-cta="telefoon">Bel {site.phone}</a>
          </div>
        </div>
      )}
    </div>
  );
}
