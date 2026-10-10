'use client';
import { useEffect, useState } from 'react';
import { isStandalone } from '@/lib/pwa/installatie';
import { createPortalBrowserClient } from '@/lib/portaal/supabaseBrowser';
import { controleerLinkAanvraag } from '@/app/dashboard/actions';
import { verifieerAdminCode } from '@/app/dashboard/auth/codeActions';
import SsoKnoppen from '@/components/auth/SsoKnoppen';

export default function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [bezig, setBezig] = useState(false);
  const [code, setCode] = useState('');
  const [codeFout, setCodeFout] = useState('');
  const [codeBezig, setCodeBezig] = useState(false);
  // Als app: de link in de mail opent de browser en logt je daar in, niet in de app.
  // Daarom vraagt de app om een code en is de code daarna de enige weg.
  const [app, setApp] = useState(false);
  useEffect(() => { setApp(isStandalone()); }, []);

  /** Inloggen met de code uit de mail: werkt ook in het KMS als app op de iPhone. */
  async function verifieer(e: React.FormEvent) {
    e.preventDefault();
    setCodeFout('');
    setCodeBezig(true);
    try {
      const r = await verifieerAdminCode(email, code);
      if (r.ok) {
        window.location.replace(r.naar);
        return;
      }
      setCodeFout(r.fout);
    } catch {
      setCodeFout('Er ging iets mis. Probeer het opnieuw.');
    }
    setCodeBezig(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const sb = createPortalBrowserClient('dashboard');
    if (!sb) { setError('Inloggen met e-maillink is nog niet geconfigureerd.'); return; }
    setBezig(true);
    try {
      // Eerst controleren of er niet te veel links zijn aangevraagd (beveiliging).
      const controle = await controleerLinkAanvraag(email.trim());
      if (!controle.ok) {
        setError(controle.fout ?? 'Inloggen lukt nu even niet. Probeer het over 15 minuten opnieuw.');
        return;
      }
      const { error } = await sb.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard/auth/callback`,
          shouldCreateUser: false,
        },
      });
      if (error) setError('Het versturen van de inloglink is niet gelukt. Controleer het e-mailadres of probeer het later opnieuw.');
      else setSent(true);
    } catch {
      setError('Er ging iets mis. Probeer het opnieuw.');
    } finally {
      setBezig(false);
    }
  }

  if (sent) {
    return (
      <div>
        <div className="rounded-md bg-green-100 px-4 py-3 text-sm text-green-800">
          <p className="font-semibold">Check je mailbox.</p>
          {app ? (
            <p className="mt-1">We hebben een code gemaild naar <span className="break-all font-medium">{email}</span>. Tik niet op de knop in de mail: die opent de browser, niet de app.</p>
          ) : (
            <p className="mt-1">We hebben een inloglink gestuurd naar <span className="break-all font-medium">{email}</span>.</p>
          )}
        </div>
        <form onSubmit={verifieer} className="mt-4">
          <label htmlFor="kms-otp-code" className="block text-sm font-semibold text-ink-900">{app ? 'Vul de code uit de mail in' : 'Of vul de code uit de mail in'}</label>
          {!app && <p className="mt-1 text-xs text-warm">Nodig als je het KMS als app op je telefoon gebruikt.</p>}
          <input
            id="kms-otp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus={app}
            pattern="[0-9 ]*"
            maxLength={12}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="mt-2 w-full rounded-md border border-line bg-white px-4 py-3 text-center text-lg tracking-[0.4em] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
          {codeFout && <p className="mt-3 text-sm font-medium text-amber-700">{codeFout}</p>}
          <button type="submit" disabled={codeBezig} className="btn-primary mt-3 w-full">{codeBezig ? 'Bezig met inloggen' : 'Inloggen met code'}</button>
        </form>
      </div>
    );
  }

  return (
    <>
    <SsoKnoppen gebied="dashboard" className="mb-5" />
    <form onSubmit={submit}>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@frederiks.nl" autoComplete="email"
        className="w-full rounded-md border border-line bg-white px-4 py-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
      {error && <p className="mt-3 text-sm font-medium text-amber-700">{error}</p>}
      <button type="submit" disabled={bezig} className="btn-primary mt-3 w-full">{bezig ? 'Versturen' : app ? 'Stuur mij een inlogcode' : 'Inloggen met e-maillink'}</button>
    </form>
    </>
  );
}
