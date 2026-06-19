'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createPortalBrowserClient } from '@/lib/portaal/supabaseBrowser';

/**
 * Context-bewuste inlog-ingang. Toont standaard een rustige "Inloggen"-link.
 * Is er een actieve portaalsessie, dan wordt het "Naar mijn portaal" en linkt
 * de knop direct naar het portaal. Secundair t.o.v. de oranje advies-CTA.
 */
export default function PortaalKnop({ className }: { className?: string }) {
  const [ingelogd, setIngelogd] = useState(false);

  useEffect(() => {
    const sb = createPortalBrowserClient();
    if (sb) {
      sb.auth.getSession().then(({ data }) => setIngelogd(Boolean(data.session)));
    }
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
