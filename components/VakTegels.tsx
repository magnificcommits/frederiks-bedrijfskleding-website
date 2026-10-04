import Link from 'next/link';
import { vakgebieden } from '@/content/vakgebieden';
import { VakIcoon } from '@/components/VakIcoon';

/** Eerste zin van de intro: op een tegel is dat genoeg om te kiezen. */
function eersteZin(tekst: string): string {
  const m = tekst.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : tekst).trim();
}

/**
 * De vakgebieden als aanklikbare tegels: donker icoonvlak, naam, de normen die in
 * dat vak spelen en een pijl in de hoek. `uitgebreid` toont er de eerste zin over
 * het werk bij (overzichtspagina); zonder is het een compacte tegel (homepage).
 */
export function VakTegels({ uitgebreid = false, className = '' }: { uitgebreid?: boolean; className?: string }) {
  return (
    <ul className={`grid gap-3 sm:grid-cols-2 ${uitgebreid ? 'xl:grid-cols-3' : ''} ${className}`}>
      {vakgebieden.map((v) => (
        <li key={v.slug}>
          <Link
            href={`/voor/${v.slug}`}
            className="group flex h-full items-start gap-4 rounded-xl border-2 border-ink-200 bg-white p-4 transition duration-150 hover:-translate-y-0.5 hover:border-ink-900 hover:shadow-card"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-white transition-colors group-hover:bg-amber-500 group-hover:text-ink-900">
              <VakIcoon slug={v.slug} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[1.0625rem] font-extrabold leading-snug text-ink-900">{v.naam}</span>
              {uitgebreid && <span className="mt-1 block text-sm leading-snug text-warm">{eersteZin(v.intro)}</span>}
              <span className="mt-2 flex flex-wrap gap-1.5">
                {v.normen.slice(0, 3).map((n) => (
                  <span key={n.slug} className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold text-ink-700">{n.code}</span>
                ))}
              </span>
            </span>
            <svg className="mt-1 h-5 w-5 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-900" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5" /></svg>
          </Link>
        </li>
      ))}
    </ul>
  );
}
