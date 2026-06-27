'use client';
import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Gebrande foutpagina (error boundary) voor onverwachte fouten in een route.
 * Houdt de gebruiker binnen de huisstijl en biedt een weg terug, in plaats van
 * de kale Next.js-foutmelding.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="container-x flex min-h-[50vh] flex-col items-center justify-center py-24 text-center">
      <p className="eyebrow">Er ging iets mis</p>
      <h1 className="mt-2 text-3xl font-bold">Sorry, dit werkte even niet</h1>
      <p className="mt-3 max-w-md text-warm">Probeer het opnieuw. Blijft het misgaan? Neem dan contact op, dan helpen we je verder.</p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="btn-primary">Opnieuw proberen</button>
        <Link href="/contact" className="btn-outline">Contact</Link>
      </div>
    </section>
  );
}
