import { CAMPAGNE_STATUS_LABEL, INSCHRIJVING_STATUS_LABEL } from '@/lib/campagnes/flow';

/** Kleine onderdelen die op meerdere campagnepagina's terugkomen (server-componenten). */

const STATUS_KLASSE: Record<string, string> = {
  concept: 'badge-rust',
  actief: 'badge-klaar',
  gepauzeerd: 'badge-actie',
  afgerond: 'badge-rust',
};

export function CampagneStatusBadge({ status }: { status: string }) {
  return <span className={STATUS_KLASSE[status] ?? 'badge-rust'}>{CAMPAGNE_STATUS_LABEL[status] ?? status}</span>;
}

const INS_KLASSE: Record<string, string> = {
  actief: 'badge-actie',
  klaar: 'badge-rust',
  doel: 'badge-klaar',
  afgemeld: 'badge-rust',
  gestopt: 'badge-rust',
  gebounced: 'badge bg-red-50 text-red-700',
};

export function InschrijvingBadge({ status }: { status: string }) {
  return <span className={INS_KLASSE[status] ?? 'badge-rust'}>{INSCHRIJVING_STATUS_LABEL[status] ?? status}</span>;
}

/** Staafjes per dag, zelf getekend. Leeg = een vlakke lijn. */
export function MiniBalken({ waarden, label, hoogte = 28 }: { waarden: number[]; label: string; hoogte?: number }) {
  const max = Math.max(1, ...waarden);
  const n = waarden.length;
  const breedte = 100 / n;
  return (
    <svg viewBox={`0 0 100 ${hoogte}`} preserveAspectRatio="none" className="block h-7 w-full" role="img" aria-label={label}>
      <line x1="0" x2="100" y1={hoogte - 0.5} y2={hoogte - 0.5} stroke="#e4e2e0" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {waarden.map((w, i) => {
        const h = w === 0 ? 0 : Math.max(2, (w / max) * (hoogte - 2));
        return <rect key={i} x={i * breedte + breedte * 0.18} y={hoogte - h} width={breedte * 0.64} height={h} rx="0.6" fill={i === n - 1 ? '#ec6726' : '#adadad'} />;
      })}
    </svg>
  );
}

export function pct(deel: number, geheel: number): string {
  if (!geheel) return '–';
  return `${Math.round((deel / geheel) * 100)}%`;
}

export function datumKort(iso: string | null | undefined): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short' });
}

export function datumTijd(iso: string | null | undefined): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Wanneer gaat de volgende stap ongeveer in? De cron draait op werkdagen rond 11:00. */
export function volgendeRunTekst(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  const nu = Date.now();
  if (d.getTime() <= nu + 3 * 3_600_000) return 'Bij de eerstvolgende run';
  return d.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short' });
}
