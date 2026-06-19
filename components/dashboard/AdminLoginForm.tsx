'use client';
import { useState } from 'react';
import { createPortalBrowserClient } from '@/lib/portaal/supabaseBrowser';

export default function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [bezig, setBezig] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const sb = createPortalBrowserClient();
    if (!sb) { setError('Inloggen met e-maillink is nog niet geconfigureerd.'); return; }
    setBezig(true);
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard/auth/callback`,
        shouldCreateUser: false,
      },
    });
    setBezig(false);
    if (error) setError(error.message); else setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-md bg-green-100 px-4 py-3 text-sm text-green-800">
        <p className="font-semibold">Check je mailbox.</p>
        <p className="mt-1">We hebben een inloglink gestuurd naar <span className="break-all font-medium">{email}</span>.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@frederiks.nl" autoComplete="email"
        className="w-full rounded-md border border-line bg-white px-4 py-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
      {error && <p className="mt-3 text-sm font-medium text-amber-700">{error}</p>}
      <button type="submit" disabled={bezig} className="btn-primary mt-3 w-full">{bezig ? 'Versturen' : 'Inloggen met e-maillink'}</button>
    </form>
  );
}
