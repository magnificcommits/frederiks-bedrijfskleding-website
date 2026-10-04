/**
 * Inloggen met Microsoft of Google (OAuth via Supabase Auth).
 * Gedeeld door het klantportaal en het KMS; veilig voor de browser.
 *
 * Een knop verschijnt alleen als de provider in Vercel aan staat:
 *   NEXT_PUBLIC_SSO_MICROSOFT=1  en/of  NEXT_PUBLIC_SSO_GOOGLE=1
 * Zie docs/sso-instellen.md voor het instellen bij Microsoft, Google en Supabase.
 */

export type SsoProvider = 'azure' | 'google';
export type SsoGebied = 'portaal' | 'dashboard';

// Letterlijk uitgeschreven: Next.js vult NEXT_PUBLIC_-variabelen alleen zo in de browserbundel in.
const MICROSOFT_AAN = process.env.NEXT_PUBLIC_SSO_MICROSOFT === '1';
const GOOGLE_AAN = process.env.NEXT_PUBLIC_SSO_GOOGLE === '1';

export const SSO_PROVIDERS: { id: SsoProvider; label: string; aan: boolean }[] = [
  { id: 'azure', label: 'Inloggen met Microsoft', aan: MICROSOFT_AAN },
  { id: 'google', label: 'Inloggen met Google', aan: GOOGLE_AAN },
];

export const ssoActief = MICROSOFT_AAN || GOOGLE_AAN;

/** Scopes per provider. Microsoft geeft het e-mailadres alleen mee met openid/profile erbij. */
export const SSO_SCOPES: Record<SsoProvider, string> = {
  azure: 'email openid profile',
  google: 'email',
};

/** Waar de provider na het inloggen naartoe terugstuurt (moet in Supabase bij Redirect URLs staan). */
export function ssoRedirectUrl(origin: string, gebied: SsoGebied): string {
  const pad = gebied === 'portaal' ? '/portaal' : '/dashboard';
  return `${origin}${pad}/auth/callback?next=${encodeURIComponent(pad)}`;
}

/**
 * Alleen een pad binnen het eigen gebied accepteren als doorverwijzing na het inloggen,
 * zodat ?next= niet misbruikt kan worden om naar een andere site te sturen.
 */
export function veiligVervolg(next: string | null, gebied: SsoGebied): string {
  const basis = gebied === 'portaal' ? '/portaal' : '/dashboard';
  if (!next) return basis;
  if (!next.startsWith(basis) || next.startsWith('//') || next.includes('\\') || next.includes('://')) return basis;
  const rest = next.slice(basis.length);
  if (rest && !rest.startsWith('/') && !rest.startsWith('?')) return basis;
  return next;
}
