'use client';
import { useState } from 'react';
import { branches } from '@/content/branches';

type Status = 'idle' | 'sending' | 'ok' | 'error';

const wensenOpties = [
  'Werkkleding', 'Werkschoenen', 'Hi-vis / veiligheid', 'Bedrukken of borduren',
  'Representatieve kleding', 'Horeca- of zorgkleding', 'Sport- of promotiekleding',
];
const aantalOpties = ['1 (zzp)', '2 tot 10', '11 tot 25', '26 tot 50', 'Meer dan 50'];

const chip = 'cursor-pointer rounded-md border-2 px-4 py-3 text-sm font-semibold transition select-none min-h-[44px]';
const field = 'mt-1 w-full rounded-md border border-line bg-white px-4 py-3 text-sm text-ink-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

export function KledingadviesWizard({ defaultBranche = '' }: { defaultBranche?: string }) {
  const [step, setStep] = useState(0);
  const [branche, setBranche] = useState(defaultBranche);
  const [wensen, setWensen] = useState<string[]>([]);
  const [aantal, setAantal] = useState('');
  const [opLocatie, setOpLocatie] = useState(true);
  const [contact, setContact] = useState({ name: '', company: '', email: '', phone: '' });
  const [consent, setConsent] = useState(false);
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
        body: JSON.stringify({ ...contact, branche, aantal, bericht, consent: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? 'Er ging iets mis. Probeer het later opnieuw.');
      }
      (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('event', 'generate_lead', { event_label: branche });
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
        <p className="mt-3 text-warm">We hebben je aanvraag binnen. We bellen je binnen een werkdag terug om je wensen door te nemen. Je krijgt ook een bevestiging in je mail.</p>
        <p className="mt-4 text-sm text-warm">Liever meteen contact? Bel of WhatsApp ons.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
      {/* Voortgang */}
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-amber-500' : 'bg-line'}`} />
        ))}
      </div>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-warm">Stap {step + 1} van {totalSteps}</p>

      {step === 0 && (
        <div className="mt-4">
          <h3 className="text-xl font-extrabold text-ink-900">In welke branche werk je?</h3>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {branches.map((b) => (
              <button key={b.slug} type="button" onClick={() => setBranche(b.navLabel)}
                className={`${chip} ${branche === b.navLabel ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-line text-ink-700 hover:border-ink-300'}`}>
                {b.navLabel}
              </button>
            ))}
            <button type="button" onClick={() => setBranche('Anders')}
              className={`${chip} ${branche === 'Anders' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-line text-ink-700 hover:border-ink-300'}`}>
              Anders
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="mt-4">
          <h3 className="text-xl font-extrabold text-ink-900">Waar zoek je naar?</h3>
          <p className="mt-1 text-sm text-warm">Meerdere antwoorden mogen.</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {wensenOpties.map((w) => (
              <button key={w} type="button" onClick={() => toggleWens(w)}
                className={`${chip} ${wensen.includes(w) ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-line text-ink-700 hover:border-ink-300'}`}>
                {w}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-4">
          <h3 className="text-xl font-extrabold text-ink-900">Voor hoeveel mensen?</h3>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {aantalOpties.map((a) => (
              <button key={a} type="button" onClick={() => setAantal(a)}
                className={`${chip} ${aantal === a ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-line text-ink-700 hover:border-ink-300'}`}>
                {a}
              </button>
            ))}
          </div>
          <label className="mt-5 flex items-center gap-3 text-sm text-ink-800">
            <input type="checkbox" checked={opLocatie} onChange={(e) => setOpLocatie(e.target.checked)}
              className="h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
            Ik wil graag dat jullie langskomen om te passen
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="mt-4">
          <h3 className="text-xl font-extrabold text-ink-900">Waar mogen we je advies naartoe sturen?</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><label className="text-sm font-medium text-ink-800">Naam *</label>
              <input className={field} value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} autoComplete="name" /></div>
            <div><label className="text-sm font-medium text-ink-800">Bedrijf</label>
              <input className={field} value={contact.company} onChange={(e) => setContact({ ...contact, company: e.target.value })} autoComplete="organization" /></div>
            <div><label className="text-sm font-medium text-ink-800">E-mail *</label>
              <input type="email" className={field} value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" /></div>
            <div><label className="text-sm font-medium text-ink-800">Telefoon</label>
              <input type="tel" className={field} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} autoComplete="tel" /></div>
          </div>
          <label className="mt-4 flex items-start gap-3 text-sm text-warm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
            Ik ga ermee akkoord dat mijn gegevens worden gebruikt om mijn aanvraag te beantwoorden.
          </label>
        </div>
      )}

      {error && <p className="mt-4 text-sm font-medium text-amber-700" role="alert">{error}</p>}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={`text-sm font-semibold text-warm hover:text-ink-800 ${step === 0 ? 'invisible' : ''}`}>
          Terug
        </button>
        {step < totalSteps - 1 ? (
          <button type="button" onClick={() => setStep((s) => s + 1)} className="btn-primary">Volgende</button>
        ) : (
          <button type="button" onClick={submit} disabled={status === 'sending'} className="btn-primary">
            {status === 'sending' ? 'Versturen' : 'Verstuur aanvraag'}
          </button>
        )}
      </div>
    </div>
  );
}
