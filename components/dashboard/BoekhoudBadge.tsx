import { boekhoudWeergave, type BoekhoudVelden } from '@/lib/kms/boekhouding';

const STIJL = {
  doorgezet: { tekst: 'In Moneybird', cls: 'bg-green-100 text-green-800' },
  niet: { tekst: 'Nog niet doorgezet', cls: 'bg-ink-100 text-ink-600' },
  fout: { tekst: 'Fout', cls: 'bg-red-100 text-red-800' },
  bezig: { tekst: 'Bezig', cls: 'bg-amber-100 text-amber-800' },
} as const;

/** Boekhoudstatus van een factuur: In Moneybird / Nog niet doorgezet / Fout. */
export default function BoekhoudBadge({ factuur }: { factuur: BoekhoudVelden }) {
  const s = STIJL[boekhoudWeergave(factuur)];
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}
      title={factuur.boekhouding_fout ?? undefined}
    >
      {s.tekst}
    </span>
  );
}
