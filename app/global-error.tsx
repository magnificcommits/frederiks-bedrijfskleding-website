'use client';
import { useEffect } from 'react';

/**
 * Laatste vangnet: een fout in de root-layout zelf (dus buiten app/error.tsx).
 * Next rendert dit in plaats van de hele pagina, daarom eigen <html> en <body>
 * en alleen inline stijlen (globals.css en de lettertypes zijn er dan niet).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[site] fout in layout', error.digest ?? error.name);
  }, [error]);

  return (
    <html lang="nl">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background: '#f7f5f0', color: '#1b1b1b' }}>
        <main style={{ maxWidth: 560, margin: '0 auto', padding: '96px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#b45309' }}>
            Frederiks Bedrijfskleding
          </p>
          <h1 style={{ fontSize: 28, margin: '8px 0 0' }}>Sorry, dit werkte even niet</h1>
          <p style={{ marginTop: 12, lineHeight: 1.5 }}>
            Probeer het opnieuw. Blijft het misgaan? Bel ons op <a href="tel:+31615215029" style={{ color: '#1b1b1b' }}>06 15 21 50 29</a> of mail{' '}
            <a href="mailto:info@frederiksbedrijfskleding.nl" style={{ color: '#1b1b1b' }}>info@frederiksbedrijfskleding.nl</a>.
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={reset}
              style={{ background: '#1b1b1b', color: '#fff', border: 0, borderRadius: 8, padding: '12px 20px', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
            >
              Opnieuw proberen
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- bewust een volledige herlaadbeurt: de layout zelf is stuk */}
            <a href="/" style={{ border: '1px solid #1b1b1b', color: '#1b1b1b', borderRadius: 8, padding: '12px 20px', fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
              Naar home
            </a>
          </div>
          {error.digest ? <p style={{ marginTop: 24, fontSize: 12, color: '#666' }}>Code: {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
