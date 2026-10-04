'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { AanDeSlagStap } from '@/lib/kms/aanDeSlag';

/** Zelfde naam als AAN_DE_SLAG_COOKIE in lib/kms/aanDeSlag.ts (die module hoort niet in de browserbundel). */
const AAN_DE_SLAG_COOKIE = 'fb_aandeslag';

/**
 * Checklist voor de eerste weken: wat moet er staan voordat het KMS echt
 * werkt. Stappen vinken zichzelf af zodra het in de database staat; als alles
 * klaar is, toont de startpagina dit blok niet meer. Wie het eerder kwijt wil,
 * kan het verbergen (onthouden in een cookie, dus ook na herladen weg).
 */
export default function AanDeSlag({ stappen }: { stappen: AanDeSlagStap[] }) {
  const [weg, setWeg] = useState(false);
  if (weg) return null;
  const klaar = stappen.filter((s) => s.klaar).length;
  const volgende = stappen.find((s) => !s.klaar)?.sleutel;

  function verberg() {
    document.cookie = `${AAN_DE_SLAG_COOKIE}=verborgen; path=/dashboard; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setWeg(true);
  }

  return (
    <section aria-labelledby="aandeslag-kop" className="panel mt-4 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 id="aandeslag-kop" className="font-display text-base font-bold text-ink-900">Aan de slag</h2>
          <p className="mt-0.5 text-[12px] text-warm">
            {klaar} van {stappen.length} klaar. Vinkt vanzelf af zodra het erin staat.
          </p>
          <div
            className="mt-2 h-1.5 w-48 max-w-full overflow-hidden rounded-full bg-ink-100"
            role="progressbar"
            aria-label="Voortgang aan de slag"
            aria-valuemin={0}
            aria-valuemax={stappen.length}
            aria-valuenow={klaar}
          >
            <span className="block h-full rounded-full bg-amber-500" style={{ width: `${(klaar / stappen.length) * 100}%` }} />
          </div>
        </div>
        <button type="button" onClick={verberg} className="knop-tekst">
          Verbergen
        </button>
      </div>
      <ol className="divide-y divide-line">
        {stappen.map((s, i) => (
          <li key={s.sleutel} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${s.sleutel === volgende ? 'bg-amber-50/50' : ''}`}>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                s.klaar ? 'bg-green-100 text-green-800' : 'border border-ink-200 bg-white text-ink-600'
              }`}
            >
              {s.klaar ? <span aria-hidden="true">&#10003;</span> : <span aria-hidden="true">{i + 1}</span>}
              <span className="sr-only">{s.klaar ? 'Klaar:' : 'Nog te doen:'}</span>
            </span>
            <div className="min-w-0 flex-1 basis-56">
              <p className={`text-[13px] font-semibold ${s.klaar ? 'text-warm line-through decoration-ink-300' : 'text-ink-900'}`}>{s.titel}</p>
              {!s.klaar && <p className="mt-0.5 text-[12.5px] leading-snug text-warm">{s.uitleg}</p>}
            </div>
            {!s.klaar && (
              <Link href={s.href} className={s.sleutel === volgende ? 'knop-primair' : 'knop-stil'}>
                {s.knop}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
