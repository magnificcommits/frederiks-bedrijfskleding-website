import Link from 'next/link';
import type { Metadata } from 'next';
import { zoWerktHet } from '@/content/portaalInfo';
import InfoPagina from '../InfoPagina';

export const metadata: Metadata = { title: 'Zo werkt het', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function ZoWerktHet() {
  return (
    <InfoPagina titel="Zo werkt het" pad="/portaal/zo-werkt-het">
      <h2 className="font-display text-xl font-extrabold text-ink-900">{zoWerktHet.titel}</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-800">{zoWerktHet.intro}</p>
      <ol className="mt-6 space-y-4">
        {zoWerktHet.stappen.map((s, i) => (
          <li key={s.titel} className="flex items-start gap-4 rounded-2xl border border-line bg-white p-5 shadow-soft">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 font-display text-base font-extrabold text-amber-700" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold text-ink-900">
                Stap {i + 1}: {s.titel}
              </p>
              <p className="mt-1 text-[15px] leading-relaxed text-warm">{s.tekst}</p>
              {i === 1 && (
                <Link href="/portaal/webshop#maatwijziging" className="mt-2 inline-block text-sm font-semibold text-amber-700 hover:text-amber-800">
                  Maatwijziging aanvragen
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 font-semibold text-ink-900">{zoWerktHet.slot}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/portaal/webshop" className="btn-primary">Kleding bestellen</Link>
        <Link href="/portaal/wasvoorschriften" className="btn-secondary">Wasvoorschriften</Link>
      </div>
    </InfoPagina>
  );
}
