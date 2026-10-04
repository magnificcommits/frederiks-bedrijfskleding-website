'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LEAD_FOUT, LEAD_OK } from './onderdelen';

/**
 * Toont de leads-specifieke meldingen (?ok=stap, ?fout=reden …). De algemene
 * Toast in de shell pakt de bekende codes (opgeslagen, status, toegevoegd); deze
 * alleen de rest, zodat er nooit twee meldingen tegelijk staan.
 */
export default function LeadMelding() {
  const sp = useSearchParams();
  const router = useRouter();
  const pad = usePathname();
  const ok = sp.get('ok');
  const fout = sp.get('fout');
  const [bericht, setBericht] = useState<{ tekst: string; soort: 'ok' | 'fout' } | null>(null);

  useEffect(() => {
    const tekst = fout ? LEAD_FOUT[fout] : ok ? LEAD_OK[ok] : undefined;
    if (!tekst) return;
    setBericht({ tekst, soort: fout ? 'fout' : 'ok' });
    const p = new URLSearchParams(sp.toString());
    p.delete('ok');
    p.delete('fout');
    router.replace(p.toString() ? `${pad}?${p}` : pad, { scroll: false });
    const t = setTimeout(() => setBericht(null), fout ? 7000 : 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, fout]);

  if (!bericht) return null;
  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0">
      <div
        role={bericht.soort === 'fout' ? 'alert' : 'status'}
        className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold shadow-card ${
          bericht.soort === 'fout' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'
        }`}
      >
        <span>{bericht.tekst}</span>
        <button type="button" onClick={() => setBericht(null)} aria-label="Sluiten" className="opacity-60 hover:opacity-100">
          ✕
        </button>
      </div>
    </div>
  );
}
