import Link from 'next/link';
import LegeStaat from '@/components/dashboard/overzicht/LegeStaat';
import { euro } from '@/lib/kms/leadsModel';
import type { HerkomstRij } from '@/lib/kms/leads';

/**
 * Per kanaal een gestapelde balk: gewonnen, nog open, verloren. Rechts het
 * aantal, de conversie (gewonnen van alles wat gesloten is) en de gewonnen waarde.
 * Klik op een kanaal om de leads van dat kanaal te zien.
 */
export default function Herkomst({ rijen, hrefVoor }: { rijen: HerkomstRij[]; hrefVoor: (kanaal: string) => string }) {
  if (!rijen.length) {
    return (
      <LegeStaat
        titel="Nog geen herkomst te tonen"
        tekst="Zodra er leads binnenkomen zie je hier welk kanaal de meeste aanvragen en opdrachten oplevert."
      />
    );
  }
  const max = Math.max(...rijen.map((r) => r.aantal), 1);
  const zichtbaar = rijen.slice(0, 8);
  const rest = rijen.slice(8);
  const alle = rest.length
    ? [
        ...zichtbaar,
        rest.reduce<HerkomstRij>(
          (t, r) => ({ ...t, aantal: t.aantal + r.aantal, gewonnen: t.gewonnen + r.gewonnen, verloren: t.verloren + r.verloren, open: t.open + r.open, waarde: t.waarde + r.waarde }),
          { kanaal: `Overig (${rest.length})`, aantal: 0, gewonnen: 0, verloren: 0, open: 0, conversiePct: null, waarde: 0 },
        ),
      ]
    : zichtbaar;

  return (
    <div>
      <ul className="flex flex-col gap-2.5">
        {alle.map((r) => {
          const b = (n: number) => (n / max) * 100;
          const gesloten = r.gewonnen + r.verloren;
          const conv = gesloten ? Math.round((r.gewonnen / gesloten) * 100) : null;
          const isOverig = r.kanaal.startsWith('Overig (');
          const label = (
            <span className="truncate text-[13px] font-medium text-ink-800 group-hover:text-amber-700">{r.kanaal}</span>
          );
          return (
            <li key={r.kanaal} className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
              {isOverig ? <span className="truncate text-[13px] text-warm">{r.kanaal}</span> : (
                <Link href={hrefVoor(r.kanaal)} className="group truncate" title={`Toon leads uit ${r.kanaal}`}>{label}</Link>
              )}
              <svg
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
                className="h-2.5 w-full overflow-visible"
                role="img"
                aria-label={`${r.kanaal}: ${r.aantal} leads, ${r.gewonnen} gewonnen, ${r.open} open, ${r.verloren} verloren`}
              >
                <rect x="0" y="0" width="100" height="10" rx="1.5" className="fill-mist" />
                <rect x="0" y="0" width={b(r.gewonnen)} height="10" className="fill-green-600" />
                <rect x={b(r.gewonnen)} y="0" width={b(r.open)} height="10" className="fill-ink-300" />
                <rect x={b(r.gewonnen + r.open)} y="0" width={b(r.verloren)} height="10" className="fill-ink-100" />
              </svg>
              <span className="whitespace-nowrap text-right text-[12px] tabular-nums text-warm">
                <span className="font-semibold text-ink-900">{r.aantal}</span>
                <span className="mx-1 text-ink-300">·</span>
                {conv == null ? <span title="Nog niets gesloten">geen conversie</span> : <span>{conv}% gewonnen</span>}
                {r.waarde > 0 && (
                  <>
                    <span className="mx-1 text-ink-300">·</span>
                    <span className="text-ink-700">{euro(r.waarde)}</span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-warm">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-green-600" aria-hidden />gewonnen</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-ink-300" aria-hidden />open</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-ink-100" aria-hidden />verloren</span>
        <span>Percentage = gewonnen van wat gesloten is.</span>
      </p>
    </div>
  );
}
