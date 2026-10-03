import Link from 'next/link';
import Sparkline from './Sparkline';

export type Richting = 'hoger-beter' | 'lager-beter' | 'neutraal';

/**
 * Verschil met de vorige periode als pijl plus percentage. Groen of rood hangt af
 * van wat goed nieuws is: meer omzet is goed, meer openstaande facturen niet.
 */
export type DeltaProps = {
  nu: number;
  vorige: number;
  richting: Richting;
  vergelijk: string;
  /** Tekst vóór de pijl, als het verschil over iets anders gaat dan het grote getal ("2 nieuw"). */
  voorvoegsel?: string;
};

export function Delta({ nu, vorige, richting, vergelijk, voorvoegsel }: DeltaProps) {
  if (nu === 0 && vorige === 0) {
    return <span className="text-[11px] text-ink-400">{voorvoegsel ? `${voorvoegsel}, ` : ''}gelijk aan {vergelijk}</span>;
  }
  const omhoog = nu > vorige;
  const gelijk = nu === vorige;
  const goed = richting === 'neutraal' || gelijk ? null : richting === 'hoger-beter' ? omhoog : !omhoog;
  const kleur = goed === null ? 'bg-ink-50 text-ink-600' : goed ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700';
  const pijl = gelijk ? '–' : omhoog ? '↑' : '↓';
  const tekst = vorige === 0 ? 'nieuw' : `${Math.abs(((nu - vorige) / vorige) * 100).toFixed(0)}%`;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-[11px]">
      {voorvoegsel && <span className="font-semibold text-ink-700">{voorvoegsel}</span>}
      <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-semibold tabular-nums ${kleur}`}>
        {!gelijk && <span aria-hidden>{pijl}</span>}
        {!gelijk && <span className="sr-only">{omhoog ? 'gestegen' : 'gedaald'}</span>}
        {gelijk ? 'gelijk' : tekst}
      </span>
      <span className="text-ink-400">t.o.v. {vergelijk}</span>
    </span>
  );
}

export default function KpiTegel({
  label,
  waarde,
  href,
  delta,
  sub,
  spark,
}: {
  label: string;
  waarde: string;
  href: string;
  delta?: DeltaProps;
  sub?: React.ReactNode;
  spark?: { waarden: number[]; labels: string[]; opmaak?: 'aantal' | 'euro'; omschrijving: string };
}) {
  return (
    <Link
      href={href}
      className="group panel flex min-w-0 flex-col gap-3 p-4 transition-colors hover:border-ink-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      <div className="min-w-0">
        <p className="flex items-center justify-between gap-2 text-[12px] font-medium text-warm">
          <span className="truncate">{label}</span>
          <span aria-hidden className="text-ink-300 transition-colors group-hover:text-amber-600">&rarr;</span>
        </p>
        <p className="mt-1.5 truncate font-display text-[26px] font-bold leading-none tracking-tight tabular-nums text-ink-900">{waarde}</p>
        <div className="mt-2 min-h-[20px]">{delta && <Delta {...delta} />}</div>
      </div>
      {spark && <Sparkline {...spark} />}
      {sub && <div className="mt-auto border-t border-line pt-2 text-[12px] leading-snug">{sub}</div>}
    </Link>
  );
}
