import Link from 'next/link';
import { logoBestanden, logoKleuren, logoStaat, type Logo } from '@/lib/kms/logos';

const SOORT_KORT: Record<string, string> = { vector: 'Vector', bitmap: 'Bitmap', borduur: 'DST', overig: 'Overig' };

/**
 * Logo als tegel in de bibliotheek en op de klantkaart: plaatje, wat er aan
 * bestanden is en wat er nog ontbreekt voor de productie.
 */
export default function LogoKaart({
  logo,
  klantNaam,
  gebruik,
  terug,
}: {
  logo: Logo;
  klantNaam?: string | null;
  gebruik?: { proeven: number; orders: number };
  terug?: string | null;
}) {
  const staat = logoStaat(logo);
  const bestanden = logoBestanden(logo);
  const kleuren = logoKleuren(logo);
  const soorten = [...new Set(bestanden.map((b) => b.productie))];
  const extensies = [...new Set(bestanden.map((b) => b.extensie).filter(Boolean))].slice(0, 4);
  const href = `/dashboard/logos/${logo.id}${terug ? `?terug=${encodeURIComponent(terug)}` : ''}`;
  const eersteExt = bestanden[0]?.extensie;

  return (
    <li className="group flex flex-col panel p-3 transition-colors hover:border-ink-300">
      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-line bg-[repeating-conic-gradient(#f4f1ec_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
          {staat.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={staat.thumb} alt={logo.naam} loading="lazy" className="max-h-full max-w-full object-contain p-2" />
          ) : (
            <span className="rounded bg-ink-900 px-2 py-1 text-xs font-semibold uppercase text-white">{eersteExt || 'geen bestand'}</span>
          )}
        </div>
        {klantNaam && <p className="mt-2 truncate text-[11px] font-semibold uppercase tracking-wide text-amber-700">{klantNaam}</p>}
        <p className={`${klantNaam ? 'mt-0.5' : 'mt-2'} truncate font-semibold text-ink-900 group-hover:text-amber-800`} title={logo.naam}>{logo.naam}</p>
      </Link>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {soorten.map((s) => (
          <span key={s} className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${s === 'vector' ? 'bg-green-50 text-green-800' : s === 'borduur' ? 'bg-ink-100 text-ink-800' : 'bg-mist text-ink-700'}`}>
            {SOORT_KORT[s]}
          </span>
        ))}
        {extensies.length > 0 && <span className="text-[11px] uppercase text-ink-400">{extensies.join(' ')}</span>}
      </div>

      {(kleuren.length > 0 || staat.technieken.length > 0) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-warm">
          {kleuren.slice(0, 6).map((k, i) => (
            <span
              key={i}
              title={[k.naam, k.pantone, k.hex].filter(Boolean).join(' · ')}
              className="inline-block h-3.5 w-3.5 rounded-sm border border-line"
              style={{ background: k.hex ?? '#ffffff' }}
            />
          ))}
          {staat.technieken.length > 0 && <span>{staat.technieken.join(', ')}</span>}
        </div>
      )}

      {staat.waarschuwingen.length > 0 && (
        <ul className="mt-2 flex flex-col gap-0.5">
          {staat.waarschuwingen.map((w) => (
            <li key={w} className="text-[12px] font-semibold text-amber-800">{w}</li>
          ))}
        </ul>
      )}

      {gebruik && (gebruik.proeven > 0 || gebruik.orders > 0) && (
        <p className="mt-auto pt-2 text-[11px] text-warm">
          {[gebruik.proeven ? `${gebruik.proeven} drukproef${gebruik.proeven === 1 ? '' : 'en'}` : null, gebruik.orders ? `${gebruik.orders} order${gebruik.orders === 1 ? '' : 's'}` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </li>
  );
}
