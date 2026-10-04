'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Context-bewuste inlog-ingang. Toont standaard een rustige "Inloggen"-link.
 * Is er een actieve portaalsessie, dan wordt het "Naar mijn portaal" en linkt
 * de knop direct naar het portaal. Secundair t.o.v. de oranje advies-CTA.
 */
export default function PortaalKnop({ className }: { className?: string }) {
  const [ingelogd, setIngelogd] = useState(false);

  useEffect(() => {
    // Supabase (tientallen kB) alleen laden als er een sessiecookie staat. Een
    // eerste bezoeker op de homepage heeft die nooit en hoeft dat dus ook niet
    // te downloaden; dat scheelt JavaScript op elke publieke pagina.
    if (!/(^|;\s*)sb-[^=]*-auth-token/.test(document.cookie)) return;
    let actief = true;
    import('@/lib/portaal/supabaseBrowser').then(({ createPortalBrowserClient }) => {
      const sb = createPortalBrowserClient();
      sb?.auth.getSession().then(({ data }) => {
        if (actief) setIngelogd(Boolean(data.session));
      });
    });
    return () => {
      actief = false;
    };
  }, []);

  if (ingelogd) {
    return (
      <Link href="/portaal" className={className}>
        Naar mijn portaal
      </Link>
    );
  }
  return (
    <Link href="/portaal/login" className={className}>
      Inloggen
    </Link>
  );
}
