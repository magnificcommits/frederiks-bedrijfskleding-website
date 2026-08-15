'use client';
import { useId, useState } from 'react';
import Link from 'next/link';
import { branches } from '@/content/branches';
import { getHerkomst } from '@/lib/herkomst';
import { site } from '@/content/site';
import { useOfferteSelectie } from '@/components/OfferteSelectie';

type Status = 'idle' | 'sending' | 'ok' | 'error';

const AANTALLEN = [
  { value: '1 tot 4 medewerkers', label: '1 tot 4' },
  { value: '5 tot 14 medewerkers', label: '5 tot 14' },
  { value: '15 tot 49 medewerkers', label: '15 tot 49' },
  { value: '50 tot 99 medewerkers', label: '50 tot 99' },
  { value: '100 of meer medewerkers', label: '100 of meer' },
] as const;

const KLEIN = AANTALLEN[0].value;

const BEHOEFTEN = [
  { id: 'werkkleding', label: 'Werkkleding' },
  { id: 'veiligheidsschoenen', label: 'Veiligheidsschoenen' },
  { id: 'bedrukken', label: 'Bedrukken of borduren' },
  { id: 'kledingbeheer', label: 'Kledingbeheer en portaal' },
  { id: 'normen', label: 'Advies over normen' },
  { id: 'anders', label: 'Iets anders' },
] as const;

/**
 * Offerteaanvraag met kwalificatie. Verstuurt naar dezelfde /api/lead als LeadForm
 * en gebruikt dezelfde veldnamen. Extra antwoorden (al klant, wat nodig) gaan mee
 * in het berichtveld, omdat de API daar geen aparte velden voor kent.
 */
export function OfferteAanvraag({
  defaultBranche = '',
  defaultProduct = '',
}: {
  defaultBranche?: string;
  defaultProduct?: string;
}) {
  const uid = useId();
  const { items: gekozenArtikelen, verwijder, leegmaken } = useOfferteSelectie();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [fouten, setFouten] = useState<Record<string, string>>({});
  const [aantal, setAantal] = useState('');
  const [alKlant, setAlKlant] = useState<'' | 'ja' | 'nee'>('');
  const [behoeften, setBehoeften] = useState<string[]>([]);

  const voornaam = site.owner.split(' ')[0];

  function toggleBehoefte(label: string) {
    setBehoeften((huidig) =>
      huidig.includes(label) ? huidig.filter((b) => b !== label) : [...huidig, label],
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const lees = (k: string) => String(fd.get(k) ?? '').trim();

    const naam = lees('name');
    const email = lees('email');
    const nieuweFouten: Record<string, string> = {};
    if (naam.length < 2) nieuweFouten.name = 'Vul je naam in, zodat we je goed kunnen aanspreken.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) nieuweFouten.email = 'Vul een e-mailadres in waarop we je kunnen bereiken.';
    if (!fd.get('consent')) nieuweFouten.consent = 'Zet even een vinkje, dan mogen we je aanvraag beantwoorden.';
    setFouten(nieuweFouten);
    if (Object.keys(nieuweFouten).length > 0) {
      setStatus('error');
      setError('Er ontbreekt nog iets. Bekijk de gemarkeerde velden hieronder.');
      document.getElementById(`${uid}-${Object.keys(nieuweFouten)[0]}`)?.focus();
      return;
    }

    setStatus('sending');
    setError('');

    const extra: string[] = [];
    if (gekozenArtikelen.length > 0) {
      extra.push(
        `Gekozen artikelen (${gekozenArtikelen.length}):\n` +
          gekozenArtikelen.map((a) => `- ${[a.merk, a.naam].filter(Boolean).join(' ')}`).join('\n'),
      );
    }
    if (behoeften.length > 0) extra.push(`Nodig: ${behoeften.join(', ')}`);
    if (alKlant) extra.push(`Al klant bij Frederiks: ${alKlant}`);
    const bericht = [lees('bericht'), extra.join('\n')].filter(Boolean).join('\n\n').slice(0, 2000);

    const payload: Record<string, string> = {
      name: naam,
      company: lees('company'),
      email,
      phone: lees('phone'),
      branche: lees('branche'),
      aantal,
      bericht,
      consent: 'on',
      website: lees('website'), // honeypot
      bron: ['Offerteformulier', getHerkomst()].filter(Boolean).join(' | ').slice(0, 400),
    };

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
      (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('event', 'generate_lead', {
        event_category: 'lead', event_label: String(payload.branche ?? ''),
      });
      setStatus('ok');
      leegmaken();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Onbekende fout');
    }
  }

  if (status === 'ok') {
    return (
      <div className="card border-amber-200 bg-amber-50" role="status" aria-live="polite">
        <h2 className="font-display text-xl font-bold text-ink-900">Je aanvraag staat bij ons binnen</h2>
        <p className="mt-2 text-warm">
          Je krijgt binnen 24 uur bericht, op werkdagen. {voornaam} kijkt zelf naar je aanvraag en belt of mailt je
          om je situatie door te nemen. Je ontvangt ook meteen een bevestiging per e-mail.
        </p>
        <p className="mt-4 text-sm text-warm">
          Kan het niet wachten? Bel gerust:{' '}
          <a href={`tel:${site.phoneIntl}`} className="font-semibold text-amber-700 hover:underline">{site.phone}</a>
        </p>
      </div>
    );
  }

  const field = 'mt-1 min-h-[44px] w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink-800 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
  const label = 'block text-sm font-medium text-ink-800';
  const legend = 'text-sm font-medium text-ink-800';
  const foutTekst = 'mt-1 text-sm font-medium text-amber-700';

  return (
    <form onSubmit={onSubmit} className="card grid gap-6" noValidate>
      {/* Honeypot, verborgen voor mensen */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor={`${uid}-name`}>Naam *</label>
          <input
            id={`${uid}-name`} name="name" required minLength={2} className={field} autoComplete="name"
            aria-invalid={fouten.name ? true : undefined}
            aria-describedby={fouten.name ? `${uid}-name-fout` : undefined}
          />
          {fouten.name && <p id={`${uid}-name-fout`} className={foutTekst}>{fouten.name}</p>}
        </div>
        <div>
          <label className={label} htmlFor={`${uid}-company`}>Bedrijf</label>
          <input id={`${uid}-company`} name="company" className={field} autoComplete="organization" />
        </div>
        <div>
          <label className={label} htmlFor={`${uid}-email`}>E-mail *</label>
          <input
            id={`${uid}-email`} name="email" type="email" required className={field} autoComplete="email"
            aria-invalid={fouten.email ? true : undefined}
            aria-describedby={fouten.email ? `${uid}-email-fout` : undefined}
          />
          {fouten.email && <p id={`${uid}-email-fout`} className={foutTekst}>{fouten.email}</p>}
        </div>
        <div>
          <label className={label} htmlFor={`${uid}-phone`}>Telefoon</label>
          <input id={`${uid}-phone`} name="phone" type="tel" className={field} autoComplete="tel" />
        </div>
        <div>
          <label className={label} htmlFor={`${uid}-branche`}>Branche</label>
          <select id={`${uid}-branche`} name="branche" defaultValue={defaultBranche} className={field}>
            <option value="">Kies een branche…</option>
            {branches.map((b) => <option key={b.slug} value={b.navLabel}>{b.navLabel}</option>)}
            <option value="Anders">Anders</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor={`${uid}-aantal`}>Voor hoeveel medewerkers?</label>
          <select
            id={`${uid}-aantal`} name="aantal" className={field} value={aantal}
            onChange={(e) => setAantal(e.target.value)}
            aria-describedby={aantal === KLEIN ? `${uid}-aantal-hint` : undefined}
          >
            <option value="">Kies…</option>
            {AANTALLEN.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
      </div>

      {aantal === KLEIN && (
        <p id={`${uid}-aantal-hint`} className="seam-card text-sm text-warm">
          Ook voor een paar sets doen we ons best, daar draaien we onze hand niet voor om. Kleine aantallen regelen we
          meestal sneller even aan de telefoon dan via een offerte. Bel {voornaam} op{' '}
          <a href={`tel:${site.phoneIntl}`} className="font-semibold text-amber-700 hover:underline">{site.phone}</a>{' '}
          of vul het formulier in, allebei is prima.
        </p>
      )}

      <fieldset className="border-0 p-0">
        <legend className={legend}>Ben je al klant bij ons?</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {(['ja', 'nee'] as const).map((keuze) => (
            <label
              key={keuze}
              className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
                alKlant === keuze ? 'border-amber-400 bg-amber-50 text-ink-900' : 'border-line bg-white text-warm'
              }`}
            >
              <input
                type="radio" name="alKlant" value={keuze} checked={alKlant === keuze}
                onChange={() => setAlKlant(keuze)}
                className="h-4 w-4 border-line text-amber-500 focus:ring-amber-300"
              />
              <span>{keuze === 'ja' ? 'Ja, we werken al samen' : 'Nee, nog niet'}</span>
            </label>
          ))}
        </div>
        {alKlant === 'ja' && (
          <p className="seam-card mt-3 text-sm text-warm">
            Fijn dat je er weer bent. Ben je klant en gaat het om nabestellen, een maatwissel of een vraag over een
            lopende order? Dan ben je sneller geholpen via het{' '}
            <Link href="/portaal" className="font-semibold text-amber-700 hover:underline">klantportaal</Link>{' '}
            of even bellen naar{' '}
            <a href={`tel:${site.phoneIntl}`} className="font-semibold text-amber-700 hover:underline">{site.phone}</a>.
            Gaat het om iets nieuws, vul dan gerust dit formulier in.
          </p>
        )}
      </fieldset>

      <fieldset className="border-0 p-0">
        <legend className={legend}>Wat heb je nodig?</legend>
        <p className="mt-1 text-sm text-warm">Meerdere antwoorden mogen.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {BEHOEFTEN.map((b) => (
            <label
              key={b.id}
              className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                behoeften.includes(b.label) ? 'border-amber-400 bg-amber-50 text-ink-900' : 'border-line bg-white text-warm'
              }`}
            >
              <input
                type="checkbox" checked={behoeften.includes(b.label)} onChange={() => toggleBehoefte(b.label)}
                className="h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300"
              />
              <span>{b.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {gekozenArtikelen.length > 0 && (
        <div className="rounded-xl border border-line bg-mist p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-ink-900">
              {gekozenArtikelen.length} {gekozenArtikelen.length === 1 ? 'artikel' : 'artikelen'} in deze aanvraag
            </p>
            <button
              type="button"
              onClick={leegmaken}
              className="text-xs font-semibold text-amber-700 underline underline-offset-2"
            >
              Alles verwijderen
            </button>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {gekozenArtikelen.map((a) => (
              <li
                key={a.id}
                className="inline-flex items-center gap-2 rounded-md border border-line bg-white py-1 pl-3 pr-1 text-sm text-ink-800"
              >
                <span>{[a.merk, a.naam].filter(Boolean).join(' ')}</span>
                <button
                  type="button"
                  onClick={() => verwijder(a.id)}
                  aria-label={`${a.naam} uit de aanvraag halen`}
                  className="rounded px-1.5 text-warm hover:bg-mist hover:text-ink-900"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-warm">
            We rekenen ze allemaal door in één voorstel, met jouw staffel en bedrukking erbij.
          </p>
        </div>
      )}

      <div>
        <label className={label} htmlFor={`${uid}-bericht`}>Vertel kort waar het om gaat</label>
        <textarea
          id={`${uid}-bericht`} name="bericht" rows={4} className={field}
          defaultValue={defaultProduct ? `Interesse in: ${defaultProduct}` : ''}
          placeholder="Bijv. werkbroeken en softshells voor 12 monteurs, met ons logo op de borst"
        />
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm text-warm" htmlFor={`${uid}-consent`}>
          <input
            id={`${uid}-consent`} type="checkbox" name="consent" required
            className="mt-1 h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300"
            aria-invalid={fouten.consent ? true : undefined}
            aria-describedby={fouten.consent ? `${uid}-consent-fout` : undefined}
          />
          <span>Ik ga ermee akkoord dat mijn gegevens worden gebruikt om mijn aanvraag te beantwoorden.</span>
        </label>
        {fouten.consent && <p id={`${uid}-consent-fout`} className={foutTekst}>{fouten.consent}</p>}
      </div>

      <div aria-live="polite" className="min-h-[1.25rem]">
        {status === 'sending' && <p className="text-sm text-warm">Je aanvraag wordt verstuurd…</p>}
        {status === 'error' && <p className="text-sm font-medium text-amber-700">{error}</p>}
      </div>

      <div>
        <button type="submit" disabled={status === 'sending'} className="btn-primary w-full sm:w-auto">
          {status === 'sending' ? 'Versturen…' : 'Verstuur mijn aanvraag'}
        </button>
        <p className="mt-3 text-sm font-medium text-ink-800">
          Binnen 24 uur reactie op werkdagen. Je spreekt {voornaam} zelf, geen callcenter.
        </p>
        <p className="mt-1 text-sm text-warm">
          Liever nu meteen iemand aan de lijn?{' '}
          <a href={`tel:${site.phoneIntl}`} className="font-semibold text-amber-700 hover:underline">{site.phone}</a>
        </p>
      </div>
    </form>
  );
}
