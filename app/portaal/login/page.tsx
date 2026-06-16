'use client';
import { useEffect, useState } from 'react';
import { createPortalBrowserClient } from '@/lib/portaal/supabaseBrowser';

export default function PortaalLogin() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [bezig, setBezig] = useState(false);

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
    if (error) setError(error.message); else setSent(true);
  }

  return (
    <main className="container-x py-20">
      <div className="mx-auto max-w-sm rounded-2xl border border-line bg-white p-8 shadow-soft">
        <h1 className="font-display text-2xl font-extrabold text-ink-900">Klantportaal</h1>
        <p className="mt-2 text-sm text-warm">Log in met je e-mailadres. Je ontvangt een inloglink in je mailbox.</p>
        {sent ? (
          <p className="mt-5 rounded-md bg-green-100 px-3 py-3 text-sm font-medium text-green-800">Check je mailbox. We hebben je een inloglink gestuurd naar {email}.</p>
        ) : (
          <form onSubmit={submit} className="mt-5">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@bedrijf.nl" autoComplete="email"
              className="w-full rounded-md border border-line bg-white px-4 py-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            {error && <p className="mt-3 text-sm font-medium text-amber-700">{error}</p>}
            <button type="submit" disabled={bezig} className="btn-primary mt-3 w-full">{bezig ? 'Versturen' : 'Stuur inloglink'}</button>
          </form>
        )}
        <p className="mt-5 text-xs text-warm">Nog geen toegang? Vraag Frederiks Bedrijfskleding om je bedrijf aan te melden.</p>
      </div>
    </main>
  );
}
