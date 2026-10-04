'use client';
import { useState } from 'react';
import Link from 'next/link';
import { site } from '@/content/site';
import { track } from '@/lib/analytics';
import { branches } from '@/content/branches';
import { getHerkomst, leesHerkomstVoorLead } from '@/lib/herkomst';

type Status = 'idle' | 'sending' | 'ok' | 'error';

/**
 * Conversiekern: offerte-/adviesaanvraag. Verstuurt naar /api/lead.
 * Honeypot-veld 'website' is verborgen voor mensen, vult bots.
 * GA4-event 'generate_lead' wordt bij succes verstuurd (indien gtag aanwezig).
 */
export function LeadForm({ defaultBranche = '', kaal = false }: { defaultBranche?: string; /** Zonder eigen kaart en inleiding: de sectie eromheen levert die al. */ kaal?: boolean }) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    setError('');
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries()) as Record<string, string>;
    payload.bron = [payload.herkomst_self, getHerkomst()].filter(Boolean).join(' | ');
    delete payload.herkomst_self;
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, bron_kanaal: 'formulier', herkomst: leesHerkomstVoorLead() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? 'Er ging iets mis. Probeer het later opnieuw.');
      }
      // GA4 key event; gaat alleen weg na toestemming (lib/analytics.ts).
      track('generate_lead', { formulier: 'contact', branche: String(payload.branche ?? '') });
      setStatus('ok');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Onbekende fout');
    }
  }

  if (status === 'ok') {
    return (
      <div className="card border-amber-200 bg-amber-50" role="status">
        <h3 className="text-lg font-semibold text-ink-800">Bedankt, je bericht is binnen</h3>
        <p className="mt-2 text-warm">
          {site.owner.split(' ')[0]} neemt {site.beloftKort} contact met je op, op werkdagen. Je krijgt ook een
          bevestiging per e-mail.
        </p>
        <p className="mt-4 text-sm text-ink-800">
          Wil je niet wachten?{' '}
          <Link href="/afspraak?soort=advies" className="font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-800" data-cta="afspraak">
            Plan meteen een belmoment met {site.owner.split(' ')[0]}
          </Link>
        </p>
      </div>
    );
  }

  const field = 'invoer';
  const label = 'invoer-label';

  return (
    <form onSubmit={onSubmit} className={`grid gap-4 ${kaal ? '' : 'card'}`} noValidate data-formulier="contact" aria-label="Contactformulier">
      {!kaal && <p className="text-sm text-warm">Alleen naam en e-mail zijn verplicht. De rest helpt ons om goed voorbereid terug te bellen.</p>}
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
        <textarea id="bericht" name="bericht" rows={3} className={field} placeholder="Bijv. werkkleding + bedrukken voor 8 monteurs" />
      </div>
      <div>
        <label className={label} htmlFor="herkomst_self">Hoe heb je ons gevonden? <span className="font-normal text-warm">(optioneel)</span></label>
        <select id="herkomst_self" name="herkomst_self" className={field}>
          <option value="">Kies...</option>
          <option>Via Google</option>
          <option>Doorverwezen door iemand</option>
          <option>Social media</option>
          <option>Advertentie</option>
          <option>Ik ken Frederiks al</option>
          <option>Anders</option>
        </select>
      </div>
      <label className="flex items-start gap-3 text-sm text-warm">
        <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
        <span>Ik ga ermee akkoord dat mijn gegevens worden gebruikt om mijn aanvraag te beantwoorden.</span>
      </label>
      {status === 'error' && <p className="text-sm text-amber-700" role="alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <button type="submit" disabled={status === 'sending'} className="btn-primary w-full px-8 py-3.5 text-base sm:w-auto">
          {status === 'sending' ? 'Versturen…' : 'Verstuur aanvraag'}
        </button>
        <p className="text-sm text-warm">Vrijblijvend. {site.belofte}.</p>
      </div>
    </form>
  );
}
