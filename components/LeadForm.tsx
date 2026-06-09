'use client';
import { useState } from 'react';
import { branches } from '@/content/branches';

type Status = 'idle' | 'sending' | 'ok' | 'error';

/**
 * Conversiekern: offerte-/adviesaanvraag. Verstuurt naar /api/lead.
 * Honeypot-veld 'website' is verborgen voor mensen, vult bots.
 * GA4-event 'generate_lead' wordt bij succes verstuurd (indien gtag aanwezig).
 */
export function LeadForm({ defaultBranche = '' }: { defaultBranche?: string }) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    setError('');
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? 'Er ging iets mis. Probeer het later opnieuw.');
      }
      // GA4 conversie-event (optioneel, alleen als gtag geladen is).
      (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('event', 'generate_lead', {
        event_category: 'lead', event_label: String(payload.branche ?? ''),
      });
      setStatus('ok');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Onbekende fout');
    }
  }

  if (status === 'ok') {
    return (
      <div className="card border-amber-200 bg-amber-50">
        <h3 className="text-lg font-semibold text-ink-800">Bedankt voor je aanvraag!</h3>
        <p className="mt-2 text-warm">We nemen zo snel mogelijk persoonlijk contact met je op. Je ontvangt ook een bevestiging per e-mail.</p>
      </div>
    );
  }

  const field = 'mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink-800 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
  const label = 'block text-sm font-medium text-ink-800';

  return (
    <form onSubmit={onSubmit} className="card grid gap-4" noValidate>
      {/* Honeypot, verborgen voor mensen */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="name">Naam *</label>
          <input id="name" name="name" required minLength={2} className={field} autoComplete="name" />
        </div>
        <div>
          <label className={label} htmlFor="company">Bedrijf</label>
          <input id="company" name="company" className={field} autoComplete="organization" />
        </div>
        <div>
          <label className={label} htmlFor="email">E-mail *</label>
          <input id="email" name="email" type="email" required className={field} autoComplete="email" />
        </div>
        <div>
          <label className={label} htmlFor="phone">Telefoon</label>
          <input id="phone" name="phone" type="tel" className={field} autoComplete="tel" />
        </div>
        <div>
          <label className={label} htmlFor="branche">Branche</label>
          <select id="branche" name="branche" defaultValue={defaultBranche} className={field}>
            <option value="">Kies een branche…</option>
            {branches.map((b) => <option key={b.slug} value={b.navLabel}>{b.navLabel}</option>)}
            <option value="Anders">Anders</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="aantal">Aantal medewerkers</label>
          <select id="aantal" name="aantal" className={field}>
            <option value="">Kies…</option>
            <option>1 (zzp)</option><option>2 tot 10</option><option>11 tot 25</option><option>26 tot 50</option><option>50+</option>
          </select>
        </div>
      </div>
      <div>
        <label className={label} htmlFor="bericht">Waar kunnen we mee helpen?</label>
        <textarea id="bericht" name="bericht" rows={4} className={field} placeholder="Bijv. werkkleding + bedrukken voor 8 monteurs" />
      </div>
      <label className="flex items-start gap-3 text-sm text-warm">
        <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
        <span>Ik ga ermee akkoord dat mijn gegevens worden gebruikt om mijn aanvraag te beantwoorden.</span>
      </label>
      {status === 'error' && <p className="text-sm text-amber-700" role="alert">{error}</p>}
      <button type="submit" disabled={status === 'sending'} className="btn-primary w-full sm:w-auto">
        {status === 'sending' ? 'Versturen…' : 'Verstuur aanvraag'}
      </button>
      <p className="text-xs text-warm">Of bel of WhatsApp ons direct. We denken graag met je mee.</p>
    </form>
  );
}
