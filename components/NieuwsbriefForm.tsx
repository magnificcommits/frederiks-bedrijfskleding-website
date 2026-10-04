'use client';

import { useState } from 'react';

/**
 * Compact nieuwsbrief-inschrijfformulier: donker voor de footer, licht voor de
 * pagina /nieuwsbrief. Stuurt naar /api/nieuwsbrief, dat een bevestigingsmail
 * stuurt (double opt-in). Honeypot-veld 'website' vangt simpele bots.
 */
export function NieuwsbriefForm({ licht = false, bron = 'footer' }: { licht?: boolean; bron?: string } = {}) {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<'idle' | 'bezig' | 'ok' | 'fout'>('idle');
  const [melding, setMelding] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'bezig') return;
    setStatus('bezig');
    setMelding('');
    try {
      const res = await fetch('/api/nieuwsbrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, bron, website }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && data?.ok) {
        setStatus('ok');
        setMelding('Bijna klaar. Check je inbox en klik op de link in de mail om je aanmelding te bevestigen.');
        setEmail('');
      } else {
        setStatus('fout');
        setMelding(data?.error || 'Inschrijven lukte niet. Probeer het later opnieuw.');
      }
    } catch {
      setStatus('fout');
      setMelding('Inschrijven lukte niet. Probeer het later opnieuw.');
    }
  }

  if (status === 'ok') {
    return (
      <p
        className={`mt-4 rounded-md border px-3 py-2 text-sm ${
          licht ? 'border-amber-300 bg-amber-50 text-ink-800' : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
        }`}
        role="status"
      >
        {melding}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4" noValidate data-formulier="nieuwsbrief">
      <label htmlFor="nieuwsbrief-email" className="sr-only">E-mailadres</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="nieuwsbrief-email"
          type="email"
          name="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jouw@e-mailadres.nl"
          autoComplete="email"
          className={
            licht
              ? 'w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200'
              : 'w-full rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white placeholder:text-ink-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40'
          }
        />
        <button
          type="submit"
          disabled={status === 'bezig'}
          className="shrink-0 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'bezig' ? 'Bezig…' : 'Inschrijven'}
        </button>
      </div>
      {/* Honeypot: verborgen voor mensen, ingevuld door bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        aria-hidden="true"
      />
      {status === 'fout' && (
        <p className={`mt-2 text-sm ${licht ? 'text-amber-800' : 'text-amber-300'}`} role="alert">{melding}</p>
      )}
    </form>
  );
}
