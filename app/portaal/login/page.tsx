'use client';
import { useEffect, useState } from 'react';
import { createPortalBrowserClient } from '@/lib/portaal/supabaseBrowser';

export default function PortaalLogin() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [bezig, setBezig] = useState(false);
  const [code, setCode] = useState('');
  const [codeFout, setCodeFout] = useState('');
  const [codeBezig, setCodeBezig] = useState(false);

  useEffect(() => {
    const fout = new URLSearchParams(window.location.search).get('fout');
    if (fout === 'link') setError('De inloglink werkte niet of is verlopen. Vraag hieronder een nieuwe aan.');
    else if (fout === 'config') setError('Het portaal is nog niet volledig geconfigureerd. Neem contact op met Frederiks.');
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const sb = createPortalBrowserClient();
    if (!sb) { setError('Het portaal is nog niet geconfigureerd.'); return; }
    setBezig(true);
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/portaal/auth/callback` },
    });
    setBezig(false);
    if (!error) { setSent(true); return; }
    // Supabase-meldingen vertalen naar iets waar de klant wat mee kan.
    const m = (error.message || '').toLowerCase();
    if (m.includes('rate limit') || error.status === 429) {
      setError('Er zijn net te veel inloglinks verstuurd. Probeer het over een paar minuten opnieuw, of bel Frederiks Bedrijfskleding.');
    } else if (m.includes('signups not allowed') || m.includes('not found')) {
      setError('Dit e-mailadres heeft nog geen toegang. Vraag Frederiks Bedrijfskleding om je aan te melden.');
    } else {
      setError('Versturen lukte niet. Controleer je e-mailadres en probeer het opnieuw.');
    }
  }

  /**
   * Inloggen met de code uit de mail. Nodig voor het portaal als app op de iPhone:
   * de link in de mail opent Safari, en Safari deelt zijn sessie niet met de app.
   * Met de code ontstaat de sessie in het venster waar de klant zelf zit.
   */
  async function verifieer(e: React.FormEvent) {
    e.preventDefault();
    setCodeFout('');
    const token = code.replace(/\D/g, '');
    if (token.length < 6) { setCodeFout('Vul de code uit de mail in (6 cijfers).'); return; }
    const sb = createPortalBrowserClient();
    if (!sb) { setCodeFout('Het portaal is nog niet geconfigureerd.'); return; }
    setCodeBezig(true);
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    if (!error) {
      window.location.replace('/portaal');
      return;
    }
    setCodeBezig(false);
    const m = (error.message || '').toLowerCase();
    if (m.includes('rate limit') || error.status === 429) {
      setCodeFout('Te veel pogingen achter elkaar. Wacht een paar minuten en probeer het opnieuw.');
    } else {
      setCodeFout('Deze code klopt niet of is verlopen. Controleer de cijfers, of vraag een nieuwe mail aan.');
    }
  }

  function opnieuw() {
    setSent(false);
    setCode('');
    setCodeFout('');
  }

  return (
    <main className="container-x py-12 sm:py-20">
      <div className="mx-auto max-w-sm rounded-2xl border border-line bg-white p-6 shadow-soft sm:p-8">
        <h1 className="font-display text-2xl font-extrabold text-ink-900">Klantportaal</h1>
        <p className="mt-2 text-sm text-warm">Log in met je e-mailadres. Je ontvangt een mail met een inloglink en een code.</p>
        {sent ? (
          <>
            <div className="mt-5 rounded-md bg-green-100 px-4 py-3 text-sm text-green-800">
              <p className="font-semibold">Check je mailbox.</p>
              <p className="mt-1">We hebben een mail gestuurd naar <span className="break-all font-medium">{email}</span>. Tik op de link in de mail om in te loggen.</p>
            </div>
            <form onSubmit={verifieer} className="mt-5 border-t border-line pt-5">
              <label htmlFor="otp-code" className="block text-sm font-semibold text-ink-900">Of vul de code uit de mail in</label>
              <p className="mt-1 text-xs text-warm">Gebruik je het portaal als app op je telefoon? Vul dan de code in, dan log je direct in de app in.</p>
              <input
                id="otp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]*"
                maxLength={12}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="mt-3 w-full rounded-md border border-line bg-white px-4 py-3 text-center font-display text-xl tracking-[0.4em] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
              {codeFout && <p className="mt-3 text-sm font-medium text-amber-700">{codeFout}</p>}
              <button type="submit" disabled={codeBezig} className="btn-primary mt-3 w-full">{codeBezig ? 'Bezig met inloggen' : 'Inloggen met code'}</button>
            </form>
            <button type="button" onClick={opnieuw} className="mt-4 text-sm font-semibold text-warm hover:text-ink-800">Ander e-mailadres of nieuwe mail</button>
          </>
        ) : (
          <form onSubmit={submit} className="mt-5">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@bedrijf.nl" autoComplete="email"
              className="w-full rounded-md border border-line bg-white px-4 py-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            {error && <p className="mt-3 text-sm font-medium text-amber-700">{error}</p>}
            <button type="submit" disabled={bezig} className="btn-primary mt-3 w-full">{bezig ? 'Versturen' : 'Stuur inlogmail'}</button>
            <button
              type="button"
              onClick={() => {
                if (!email.trim().includes('@')) { setError('Vul eerst je e-mailadres in, dan kun je de code invullen.'); return; }
                setError('');
                setSent(true);
              }}
              className="mt-3 w-full text-center text-sm font-semibold text-warm hover:text-ink-800"
            >
              Ik heb al een code
            </button>
          </form>
        )}
        <p className="mt-5 text-xs text-warm">Nog geen toegang? Vraag Frederiks Bedrijfskleding om je bedrijf aan te melden.</p>
      </div>
    </main>
  );
}
