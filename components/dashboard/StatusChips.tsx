import Link from 'next/link';

/**
 * Statusfilter als chips met aantallen, in plaats van een keuzelijst.
 * Je ziet zo in één blik waar het werk ligt ("wacht op goedkeuring 3") zonder
 * eerst een dropdown open te klappen.
 *
 * `bewaar` houdt de overige queryparameters vast (sortering, zoekterm) zodat
 * filteren je huidige weergave niet weggooit. De paginering wordt bewust wél
 * gereset: na een filterwissel is pagina 4 zelden nog waar je wilt zijn.
 */
export default function StatusChips({
  basePath,
  param = 'status',
  huidig,
  statussen,
  aantallen,
  bewaar,
  alleLabel = 'Alle',
}: {
  basePath: string;
  param?: string;
  huidig: string;
  statussen: readonly string[];
  aantallen: Record<string, number>;
  bewaar?: Record<string, string | undefined>;
  alleLabel?: string;
}) {
  const totaal = Object.values(aantallen).reduce((n, a) => n + a, 0);

  function url(waarde: string) {
    const p = new URLSearchParams();
    Object.entries(bewaar ?? {}).forEach(([k, v]) => {
      if (v) p.set(k, v);
    });
    if (waarde) p.set(param, waarde);
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <div className="dash-filter flex flex-wrap items-center gap-1.5">
      <Link href={url('')} className={`chip ${huidig ? '' : 'chip-aan'}`}>
        {alleLabel}
        <span className="chip-tel">{totaal}</span>
      </Link>
      {statussen.map((s) => (
        <Link key={s} href={url(s)} className={`chip ${huidig === s ? 'chip-aan' : ''}`}>
          {s.replace(/_/g, ' ')}
          <span className="chip-tel">{aantallen[s] ?? 0}</span>
        </Link>
      ))}
    </div>
  );
}
