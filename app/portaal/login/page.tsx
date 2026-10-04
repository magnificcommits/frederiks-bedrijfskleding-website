'use client';
import { useEffect, useState } from 'react';
import { createPortalBrowserClient } from '@/lib/portaal/supabaseBrowser';
import { useVertaler } from '@/lib/i18n/portaal/client';
import SsoKnoppen from '@/components/auth/SsoKnoppen';

export default function PortaalLogin() {
  const { t, rijk } = useVertaler();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [bezig, setBezig] = useState(false);
  const [code, setCode] = useState('');
  const [codeFout, setCodeFout] = useState('');
  const [codeBezig, setCodeBezig] = useState(false);

  useEffect(() => {
    const fout = new URLSearchParams(window.location.search).get('fout');
    if (fout === 'link') setError(t('login.foutLink'));
    else if (fout === 'config') setError(t('login.foutConfig'));
    else if (fout === 'geen-toegang') setError(t('login.foutGeenToegang'));
    else if (fout === 'sso') setError(t('login.foutSso'));
    else if (fout === 'sso-geannuleerd') setError(t('login.foutSsoGeannuleerd'));
  }, [t]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const sb = createPortalBrowserClient();
    if (!sb) { setError(t('algemeen.nietGeconfigureerd')); return; }
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
      setError(t('login.teVeelLinks'));
    } else if (m.includes('signups not allowed') || m.includes('not found')) {
      setError(t('login.geenToegang'));
    } else {
      setError(t('login.versturenMislukt'));
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
    if (token.length < 6) { setCodeFout(t('login.codeTeKort')); return; }
    const sb = createPortalBrowserClient();
    if (!sb) { setCodeFout(t('algemeen.nietGeconfigureerd')); return; }
    setCodeBezig(true);
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    if (!error) {
      window.location.replace('/portaal');
      return;
    }
    setCodeBezig(false);
    const m = (error.message || '').toLowerCase();
    if (m.includes('rate limit') || error.status === 429) {
      setCodeFout(t('login.teVeelPogingen'));
    } else {
      setCodeFout(t('login.codeFout'));
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
        <h1 className="font-display text-2xl font-extrabold text-ink-900">{t('algemeen.klantportaal')}</h1>
        <p className="mt-2 text-sm text-warm">{t('login.intro')}</p>
        {sent ? (
          <>
            <div className="mt-5 rounded-md bg-green-100 px-4 py-3 text-sm text-green-800">
              <p className="font-semibold">{t('login.checkMail')}</p>
              <p className="mt-1">{rijk('login.mailGestuurd', { email: <span className="break-all font-medium">{email}</span> })}</p>
            </div>
            <form onSubmit={verifieer} className="mt-5 border-t border-line pt-5">
              <label htmlFor="otp-code" className="block text-sm font-semibold text-ink-900">{t('login.codeLabel')}</label>
              <p className="mt-1 text-xs text-warm">{t('login.codeUitleg')}</p>
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
              <button type="submit" disabled={codeBezig} className="btn-primary mt-3 w-full">{codeBezig ? t('login.bezigInloggen') : t('login.inloggenMetCode')}</button>
            </form>
            <button type="button" onClick={opnieuw} className="mt-4 text-sm font-semibold text-warm hover:text-ink-800">{t('login.anderAdres')}</button>
          </>
        ) : (
          <>
          <SsoKnoppen gebied="portaal" className="mt-5" />
          <form onSubmit={submit} className="mt-5">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('login.emailPlaceholder')} autoComplete="email"
              className="w-full rounded-md border border-line bg-white px-4 py-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            {error && <p className="mt-3 text-sm font-medium text-amber-700">{error}</p>}
            <button type="submit" disabled={bezig} className="btn-primary mt-3 w-full">{bezig ? t('login.bezigVersturen') : t('login.stuurMail')}</button>
            <button
              type="button"
              onClick={() => {
                if (!email.trim().includes('@')) { setError(t('login.eerstEmail')); return; }
                setError('');
                setSent(true);
              }}
              className="mt-3 w-full text-center text-sm font-semibold text-warm hover:text-ink-800"
            >
              {t('login.alCode')}
            </button>
          </form>
          </>
        )}
        <p className="mt-5 text-xs text-warm">{t('login.nogGeenToegang')}</p>
      </div>
    </main>
  );
}
