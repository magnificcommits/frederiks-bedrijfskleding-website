'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);

/**
 * Toont de prijsindicatie alleen aan ingelogde klanten.
 *
 * Client-side opgehaald met opzet: de productpagina blijft daardoor statisch en
 * prijsloos voor zoekmachines en voor de concurrent, terwijl een klant die is
 * ingelogd toch meteen ziet waar hij aan toe is.
 */
export function PrijsBlok({ productId }: { productId: string }) {
  const [staat, setStaat] = useState<'laden' | 'uit' | 'aan'>('laden');
  const [prijs, setPrijs] = useState<{ van: number | null; tot: number | null }>({ van: null, tot: null });

  useEffect(() => {
    let weg = false;
    fetch(`/api/assortiment/prijs?id=${encodeURIComponent(productId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { toegang: boolean; van: number | null; tot: number | null } | null) => {
        if (weg) return;
        if (!d?.toegang) { setStaat('uit'); return; }
        setPrijs({ van: d.van, tot: d.tot });
        setStaat('aan');
      })
      .catch(() => { if (!weg) setStaat('uit'); });
    return () => { weg = true; };
  }, [productId]);

  if (staat === 'laden') return <div className="h-16 animate-pulse rounded-lg bg-mist" />;

  if (staat === 'uit') {
    return (
      <div className="rounded-lg border border-line bg-mist px-4 py-3 text-sm">
        <p className="font-semibold text-ink-900">Prijzen zie je als klant</p>
        <p className="mt-1 text-warm">
          Klanten van Frederiks zien hun eigen prijzen in het{' '}
          <Link href="/portaal" className="font-semibold text-amber-700 underline underline-offset-2">klantportaal</Link>. Nog geen klant?{' '}
          <Link href="/offerte" className="font-semibold text-amber-700 underline underline-offset-2">Vraag een offerte aan</Link> — dan rekenen we meteen met je aantallen en je logo.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      <p className="font-semibold text-ink-900">
        {prijs.van == null
          ? 'Prijs op aanvraag'
          : prijs.van === prijs.tot
            ? euro(prijs.van)
            : `${euro(prijs.van)} – ${euro(prijs.tot as number)}`}
      </p>
      <p className="mt-1 text-warm">
        Adviesprijs per stuk, excl. btw en bedrukking. Jouw staffelkorting en de exacte prijs per maat staan in het{' '}
        <Link href="/portaal/webshop" className="font-semibold text-amber-700 underline underline-offset-2">portaal</Link>.
      </p>
    </div>
  );
}
