'use client';

import { useEffect } from 'react';

/**
 * Opent het afdrukvenster zodra de pagina er staat, als je vanuit de planning op
 * Afdrukken klikt (?afdrukken=1). Even wachten zodat de logo's geladen zijn.
 */
export default function AutoAfdrukken({ aan }: { aan: boolean }) {
  useEffect(() => {
    if (!aan) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [aan]);
  return null;
}
