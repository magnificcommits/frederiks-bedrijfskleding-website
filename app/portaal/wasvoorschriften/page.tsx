import type { Metadata } from 'next';
import { wasvoorschriften } from '@/content/portaalInfo';
import InfoPagina from '../InfoPagina';

export const metadata: Metadata = { title: 'Wasvoorschriften', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function Wasvoorschriften() {
  return (
    <InfoPagina titel="Wasvoorschriften" pad="/portaal/wasvoorschriften">
      <h2 className="font-display text-xl font-extrabold text-ink-900">{wasvoorschriften.titel}</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-800">{wasvoorschriften.intro}</p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {wasvoorschriften.blokken.map((b) => (
          <section key={b.titel} className={`rounded-2xl border bg-white p-5 shadow-soft ${b.titel === 'Belangrijk' ? 'border-amber-300 sm:col-span-2' : 'border-line'}`}>
            <h3 className="font-display text-lg font-bold text-ink-900">{b.titel}</h3>
            <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-ink-800">
              {b.regels.map((r) => (
                <li key={r} className="flex gap-2.5">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-6 font-semibold text-ink-900">{wasvoorschriften.slot}</p>
    </InfoPagina>
  );
}
