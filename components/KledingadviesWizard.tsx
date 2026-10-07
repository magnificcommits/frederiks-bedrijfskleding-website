'use client';
import { useState } from 'react';
import { site } from '@/content/site';
import { track } from '@/lib/analytics';
import Link from 'next/link';
import { branches } from '@/content/branches';
import { getHerkomst, leesHerkomstVoorLead } from '@/lib/herkomst';

type Status = 'idle' | 'sending' | 'ok' | 'error';

const wensenOpties = [
  'Werkkleding', 'Werkschoenen', 'Hi-vis / veiligheid', 'Bedrukken of borduren',
  'Representatieve kleding', 'Horeca- of zorgkleding', 'Sport- of promotiekleding',
];
const aantalOpties = ['1 (zzp)', '2 tot 10', '11 tot 25', '26 tot 50', 'Meer dan 50'];


export function KledingadviesWizard({ defaultBranche = '' }: { defaultBranche?: string }) {
  const [step, setStep] = useState(0);
  const [branche, setBranche] = useState(defaultBranche);
  const [wensen, setWensen] = useState<string[]>([]);
  const [aantal, setAantal] = useState('');
  const [opLocatie, setOpLocatie] = useState(true);
  const [contact, setContact] = useState({ name: '', company: '', email: '', phone: '' });
  const [consent, setConsent] = useState(false);
  const [bevestigd, setBevestigd] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const totalSteps = 4;
  const toggleWens = (w: string) => setWensen((p) => (p.includes(w) ? p.filter((x) => x !== w) : [...p, w]));

  async function submit() {
    if (!contact.name || !contact.email || !consent) {
      setError('Vul je naam en e-mailadres in en geef toestemming.');
      return;
    }
    setStatus('sending');
    setError('');
    const bericht = [
      `Kledingadvies aangevraagd via de website.`,
      `Branche: ${branche || 'niet opgegeven'}`,
      `Zoekt: ${wensen.length ? wensen.join(', ') : 'niet opgegeven'}`,
      `Aantal medewerkers: ${aantal || 'niet opgegeven'}`,
      `Passen op locatie gewenst: ${opLocatie ? 'ja' : 'nee'}`,
    ].join('\n');
    try {
      const res = await fetch('/api/lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contact, branche, aantal, bericht, bron: getHerkomst(), consent: true, bron_kanaal: 'formulier', herkomst: leesHerkomstVoorLead() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? 'Er ging iets mis. Probeer het later opnieuw.');
      }
      const j = (await res.json().catch(() => null)) as { bevestigd?: boolean } | null;
      setBevestigd(Boolean(j?.bevestigd));
      track('generate_lead', { formulier: 'kledingadvies', branche });
      setStatus('ok');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Onbekende fout');
    }
  }

  if (status === 'ok') {
    return (
      <div className="rounded-2xl border-2 border-amber-500 bg-white p-8 shadow-card">
        <p className="font-display text-2xl font-extrabold text-ink-900">Bedankt, {contact.name.split(' ')[0]}.</p>
        <p className="mt-3 text-warm">We hebben je aanvraag binnen. We bellen je {site.beloftKort} terug (op werkdagen) om je wensen door te nemen.{bevestigd ? ' Je krijgt ook een bevestiging in je mail.' : ''}</p>
        <p className="mt-4 text-sm text-warm">
          Liever meteen een moment vastleggen?{' '}
          <Link href="/afspraak" className="font-semibold text-amber-700 underline underline-offset-2" data-cta="afspraak">Plan een adviesgesprek</Link>
          {' '}of bel <a href={`tel:${site.phoneIntl}`} className="font-semibold text-amber-700 underline underline-offset-2">{site.phone}</a>.
        </p>
      </div>
    );
  }

  const stapNamen = ['Branche', 'Kleding', 'Aantal', 'Contact'];
  const naarVolgende = () => {
    if (step === 0) track('formulier_gestart', { formulier: 'kledingadvies', branche });
    setStep((s) => Math.min(totalSteps - 1, s + 1));
  };
  const gekozen = step === 0 ? Boolean(branche) : step === 1 ? wensen.length > 0 : step === 2 ? Boolean(aantal) : true;
  const kopKlas = 'font-display text-2xl font-extrabold text-ink-900';

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      {/* Stappenbalk met namen: je ziet waar je bent en hoe kort het is. */}
      <ol className="grid grid-cols-4 border-b border-line bg-ink-900">
        {stapNamen.map((naam, i) => {
          const stand = i < step ? 'klaar' : i === step ? 'nu' : 'straks';
          return (
            <li key={naam} className={`relative px-2 py-3 text-center sm:px-4 ${i > 0 ? 'border-l border-white/10' : ''}`} aria-current={stand === 'nu' ? 'step' : undefined}>
              <span className={`block text-[11px] font-semibold tabular-nums ${stand === 'straks' ? 'text-ink-400' : 'text-amber-400'}`}>
                {stand === 'klaar' ? 'Klaar' : `Stap ${i + 1}`}
              </span>
              <span className={`block text-sm font-semibold ${stand === 'straks' ? 'text-ink-400' : 'text-white'}`}>{naam}</span>
              <span className={`absolute inset-x-0 bottom-0 h-1 ${stand === 'straks' ? 'bg-transparent' : 'bg-amber-500'}`} aria-hidden="true" />
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">Stap {step + 1} van {totalSteps}</p>

      <div className="p-5 sm:p-7">
      {step === 0 && (
        <div>
          <h3 className={kopKlas}>In welke branche werk je?</h3>
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {[...branches.map((b) => b.navLabel), 'Anders'].map((naam) => (
              <button
                key={naam}
                type="button"
                aria-pressed={branche === naam}
                className="keuze keuze-rij"
                onClick={() => {
                  setBranche(naam);
                  // Eén keuze, dus meteen door: scheelt een klik op "Volgende".
                  track('formulier_gestart', { formulier: 'kledingadvies', branche: naam });
                  setStep(1);
                }}
              >
                <span className="keuze-rond" aria-hidden="true">✓</span>
                <span className="min-w-0">{naam}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <h3 className={kopKlas}>Waar zoek je naar?</h3>
          <p className="mt-1 text-sm text-warm">Meerdere antwoorden mogen.</p>
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {wensenOpties.map((w) => (
              <button key={w} type="button" onClick={() => toggleWens(w)} aria-pressed={wensen.includes(w)} className="keuze keuze-rij">
                <span className="keuze-rond !rounded-md" aria-hidden="true">✓</span>
                {w}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 className={kopKlas}>Voor hoeveel mensen?</h3>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
            {aantalOpties.map((a) => (
              <button key={a} type="button" onClick={() => setAantal(a)} aria-pressed={aantal === a} className="keuze keuze-rij">
                <span className="keuze-rond" aria-hidden="true">✓</span>
                {a}
              </button>
            ))}
          </div>
          <label className="mt-5 flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl bg-mist px-4 py-3 text-[15px] font-semibold text-ink-900">
            <input type="checkbox" checked={opLocatie} onChange={(e) => setOpLocatie(e.target.checked)}
              className="h-5 w-5 rounded border-ink-300 text-amber-500 focus:ring-amber-300" />
            Kom bij ons langs om te passen
          </label>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 className={kopKlas}>Hoe bereiken we je met het advies?</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label htmlFor="wiz-naam" className="invoer-label">Naam *</label>
              <input id="wiz-naam" required aria-required="true" className="invoer" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} autoComplete="name" /></div>
            <div><label htmlFor="wiz-bedrijf" className="invoer-label">Bedrijf</label>
              <input id="wiz-bedrijf" className="invoer" value={contact.company} onChange={(e) => setContact({ ...contact, company: e.target.value })} autoComplete="organization" /></div>
            <div><label htmlFor="wiz-email" className="invoer-label">E-mail *</label>
              <input id="wiz-email" type="email" required aria-required="true" className="invoer" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" /></div>
            <div><label htmlFor="wiz-telefoon" className="invoer-label">Telefoon <span className="font-normal text-warm">(dan bellen we je)</span></label>
              <input id="wiz-telefoon" type="tel" className="invoer" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} autoComplete="tel" /></div>
          </div>
          <label className="mt-4 flex items-start gap-3 text-sm text-warm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
            Ik ga ermee akkoord dat mijn gegevens worden gebruikt om mijn aanvraag te beantwoorden.
          </label>
        </div>
      )}

      {error && <p className="mt-4 text-sm font-medium text-amber-700" role="alert">{error}</p>}

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5">
        {step > 0 ? (
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} className="btn-ghost px-3">
            Terug
          </button>
        ) : (
          <p className="text-sm text-warm">Kies je branche om te beginnen.</p>
        )}
        {step === 0 ? (
          branche ? <button type="button" onClick={naarVolgende} className="btn-primary px-8">Volgende</button> : null
        ) : step < totalSteps - 1 ? (
          <button type="button" onClick={naarVolgende} className={gekozen ? 'btn-primary px-8' : 'btn-outline px-8'}>
            {gekozen ? 'Volgende' : 'Sla over'}
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={status === 'sending'} className="btn-primary px-8 py-3.5 text-base">
            {status === 'sending' ? 'Versturen' : 'Stuur mij advies'}
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
