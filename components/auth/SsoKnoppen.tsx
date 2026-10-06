'use client';
import { useEffect, useState } from 'react';
import { createPortalBrowserClient } from '@/lib/portaal/supabaseBrowser';
import { SSO_PROVIDERS, SSO_SCOPES, ssoActief, ssoRedirectUrl, type SsoGebied, type SsoProvider } from '@/lib/sso';
import { useVertaler } from '@/lib/i18n/portaal/client';

/** Eenvoudig kantoorpand: werk- of schoolaccount (Microsoft). */
function IconWerk() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="4" y="2.75" width="12" height="14.5" rx="1.5" />
      <path d="M7.5 6h1.5M11 6h1.5M7.5 9h1.5M11 9h1.5M7.5 12h1.5M11 12h1.5M8.5 17.25v-2.5h3v2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Eenvoudig persoon-in-cirkel: persoonlijk of zakelijk Google-account. */
function IconAccount() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" />
      <circle cx="10" cy="8.25" r="2.5" />
      <path d="M5.4 15.1c1-1.6 2.7-2.6 4.6-2.6s3.6 1 4.6 2.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Knoppen "Inloggen met Microsoft/Google" met daaronder de scheidingslijn naar het
 * e-mailformulier. Toont niets als geen van beide providers aan staat.
 * De doorverwijzing gebeurt in hetzelfde venster (geen popup), zodat het ook in de
 * geïnstalleerde app werkt.
 * Teksten via de portaalvertalingen; buiten de TaalProvider (het KMS) is dat Nederlands.
 */
export default function SsoKnoppen({ gebied, className }: { gebied: SsoGebied; className?: string }) {
  const { t } = useVertaler();
  const [bezig, setBezig] = useState<SsoProvider | null>(null);
  const [fout, setFout] = useState('');

  // Terug met de knop "vorige" na het wegsturen: de knoppen weer bruikbaar maken.
  useEffect(() => {
    const herstel = () => setBezig(null);
    window.addEventListener('pageshow', herstel);
    return () => window.removeEventListener('pageshow', herstel);
  }, []);

  if (!ssoActief) return null;

  async function start(provider: SsoProvider) {
    setFout('');
    const sb = createPortalBrowserClient(gebied === 'dashboard' ? 'dashboard' : 'portaal');
    if (!sb) { setFout(t('sso.nietGeconfigureerd')); return; }
    setBezig(provider);
    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: ssoRedirectUrl(window.location.origin, gebied),
        scopes: SSO_SCOPES[provider],
        // Altijd laten kiezen welk account, handig als iemand er meerdere heeft.
        queryParams: { prompt: 'select_account' },
      },
    });
    // Bij succes navigeert de browser weg; we komen hier alleen terug bij een fout.
    if (error) {
      setBezig(null);
      setFout(t('sso.doorsturenMislukt'));
    }
  }

  return (
    <div className={className}>
      <div className="space-y-2">
        {SSO_PROVIDERS.filter((p) => p.aan).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => start(p.id)}
            disabled={bezig !== null}
            className="flex w-full items-center justify-center gap-2.5 rounded-md border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 hover:bg-mist disabled:opacity-60"
          >
            {p.id === 'azure' ? <IconWerk /> : <IconAccount />}
            <span>{bezig === p.id ? t('sso.evenGeduld') : p.id === 'azure' ? t('sso.microsoft') : t('sso.google')}</span>
          </button>
        ))}
      </div>
      {fout && <p className="mt-3 text-sm font-medium text-amber-700">{fout}</p>}
      <div className="mt-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        <span className="text-xs text-warm">{t('sso.ofEmail')}</span>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>
    </div>
  );
}
