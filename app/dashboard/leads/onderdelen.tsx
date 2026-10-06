import { duurKort, datumKort, scoreNiveau, statusLabel, WACHT_GRENS_UREN, type OpvolgStand } from '@/lib/kms/leadsModel';

/**
 * Kleine bouwstenen die de pijplijn, de lijst en de detailpagina delen.
 * Geen hooks, dus bruikbaar in server- en clientcomponenten.
 */

/** Kleur per fase, van licht naar donker zoals de lead vordert. Nieuw is amber: daar moet iets gebeuren. */
export const STATUS_RAND: Record<string, string> = {
  nieuw: 'border-t-amber-500',
  contact: 'border-t-ink-300',
  afspraak: 'border-t-ink-500',
  offerte: 'border-t-ink-800',
  geaccordeerd: 'border-t-green-600',
  afgewezen: 'border-t-ink-200',
};

export const STATUS_STIP: Record<string, string> = {
  nieuw: 'bg-amber-500',
  contact: 'bg-ink-300',
  afspraak: 'bg-ink-500',
  offerte: 'bg-ink-800',
  geaccordeerd: 'bg-green-600',
  afgewezen: 'bg-ink-200',
};

export function StatusLabel({ status }: { status: string }) {
  const klasse = status === 'nieuw' ? 'badge-actie' : status === 'geaccordeerd' ? 'badge-klaar' : 'badge-rust';
  return <span className={klasse}>{statusLabel(status)}</span>;
}

export function ScoreBadge({ score, groot = false }: { score: number; groot?: boolean }) {
  const niveau = scoreNiveau(score);
  const kleur =
    niveau === 'hoog' ? 'bg-amber-500 text-ink-900' : niveau === 'midden' ? 'bg-amber-100 text-amber-800' : 'bg-ink-100 text-ink-600';
  return (
    <span
      className={`inline-flex items-center justify-center rounded font-semibold tabular-nums ${kleur} ${groot ? 'min-w-[2.75rem] px-2 py-1 text-base' : 'min-w-[1.9rem] px-1.5 py-0.5 text-[11px]'}`}
      title={`Leadscore ${score} van 100`}
    >
      <span className="sr-only">Leadscore </span>
      {score}
    </span>
  );
}

/** "Wacht 30 uur": tijd sinds binnenkomst zonder contact. Rood na 24 uur. */
export function WachtLabel({ uren, kort = false }: { uren: number | null; kort?: boolean }) {
  if (uren == null) return null;
  const te = uren >= WACHT_GRENS_UREN;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${te ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}
      title="Zo lang staat deze lead al zonder dat er contact is gelegd. Na 24 uur rood."
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${te ? 'bg-red-600' : 'bg-amber-500'}`} />
      {kort ? duurKort(uren) : `${duurKort(uren)} zonder contact`}
    </span>
  );
}

/** Volgende stap: verlopen (rood), vandaag (amber), gepland (grijs), of nog niets gepland. */
export function OpvolgLabel({ stand, datum, stap, toonGeen = true }: { stand: OpvolgStand; datum: string | null; stap?: string | null; toonGeen?: boolean }) {
  if (stand === 'geen') {
    return toonGeen ? <span className="text-[11px] text-ink-400">Geen volgende stap</span> : null;
  }
  const kleur = stand === 'verlopen' ? 'text-red-700' : stand === 'vandaag' ? 'text-amber-700' : 'text-warm';
  const wanneer = stand === 'vandaag' ? 'vandaag' : datumKort(datum);
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 text-[11px] font-medium ${kleur}`}>
      <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="1.5" y="2.5" width="9" height="8" rx="1" />
        <path d="M1.5 5h9M4 1.5v2M8 1.5v2" />
      </svg>
      <span className="truncate">
        {stand === 'verlopen' ? 'Verlopen: ' : ''}
        {wanneer}
        {stap ? `, ${stap}` : ''}
      </span>
    </span>
  );
}

/** Meldingen die de algemene Toast niet kent; die staan als ?ok= of ?fout= in de URL. */
export const LEAD_OK: Record<string, string> = {
  stap: 'Volgende stap gepland en als taak toegevoegd.',
  samengevoegd: 'Leads samengevoegd.',
  gekoppeld: 'Lead gekoppeld aan de klant.',
  klant: 'Klant aangemaakt en gekoppeld.',
};

export const LEAD_FOUT: Record<string, string> = {
  status: 'Die status bestaat niet.',
  reden: 'Kies waarom de lead verloren is.',
  opslaan: 'Opslaan is niet gelukt. Probeer het nog eens.',
  naam: 'Vul een naam in.',
  leeg: 'Schrijf eerst iets op.',
  stap: 'De volgende stap kon niet worden opgeslagen. Vul een omschrijving en datum in.',
  samenvoegen: 'Samenvoegen is niet gelukt.',
  koppelen: 'Koppelen aan de klant is niet gelukt.',
  klant: 'Er kon geen klant worden aangemaakt.',
  offerte: 'De offerte kon niet worden aangemaakt. Is de lead aan een klant gekoppeld?',
};
