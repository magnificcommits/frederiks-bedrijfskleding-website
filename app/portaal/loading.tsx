'use client';
import { useVertaler } from '@/lib/i18n/portaal/client';

/** Laadstaat voor alle portaalpagina's: titel, menu en een paar kaarten. */
export default function Laden() {
  const { t } = useVertaler();
  return (
    <main className="container-x py-12" aria-busy="true">
      <p role="status" className="sr-only">{t('algemeen.laden')}</p>
      <span aria-hidden="true" className="skelet block h-8 w-64 max-w-full" />
      <span aria-hidden="true" className="skelet mt-3 block h-4 w-96 max-w-full" />
      <span aria-hidden="true" className="skelet mt-6 block h-11 w-full rounded-md" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} aria-hidden="true" className="skelet block h-36 rounded-xl" />
        ))}
      </div>
    </main>
  );
}
