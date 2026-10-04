import Link from 'next/link';
import { niveauKleur, type SpaarNiveau, type NiveauStand } from '@/lib/kms/sparenTypes';
import { MIGRATIE_MELDING } from '@/lib/kms/sparenData';

/** Gedeelde, server-veilige bouwstenen voor de sparenpagina's. */

export const getal = (n: number) => new Intl.NumberFormat('nl-NL').format(Math.round(n || 0));
export const euro0 = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
export const euro2 = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);
export const datumKort = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** Meldingen uit de URL die de globale Toast niet kent (eigen tekst). */
export function Meldingen({ fout, melding }: { fout?: string; melding?: string }) {
  return (
    <>
      {melding && (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-2.5 text-[13px] font-medium text-green-800">{melding}</p>
      )}
      {fout && (
        <p role="alert" className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-[13px] font-medium text-amber-900">
          {fout}
        </p>
      )}
    </>
  );
}

export function MigratieBanner({ toon }: { toon: boolean }) {
  if (!toon) return null;
  return (
    <div className="mt-4 rounded-md border border-dashed border-ink-300 bg-mist px-4 py-3 text-[13px] text-ink-700">
      <p className="font-semibold text-ink-900">Nog in de oude stand</p>
      <p className="mt-0.5">{MIGRATIE_MELDING} Saldi, niveaus en historie zie je al wel.</p>
    </div>
  );
}

export function UitBanner({ actief }: { actief: boolean }) {
  if (actief) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
      <p>
        <span className="font-semibold">Het spaarprogramma staat uit.</span> Klanten zien niets in het portaal en er worden geen nieuwe punten geboekt.
      </p>
      <Link href="/dashboard/sparen/instellingen" className="knop-stil">Aanzetten</Link>
    </div>
  );
}

export function NiveauBadge({ niveau, klein = false }: { niveau: SpaarNiveau | null; klein?: boolean }) {
  if (!niveau) return <span className="text-[12px] text-ink-400">Geen niveau</span>;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ${niveauKleur(niveau)} ${
        klein ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]'
      }`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      {niveau.naam}
    </span>
  );
}

/** Voortgangsbalk naar het volgende niveau met een korte tekst. */
export function NiveauVoortgang({ stand, basis, compact = false }: { stand: NiveauStand; basis: 'omzet' | 'punten'; compact?: boolean }) {
  const pct = Math.round(stand.voortgang * 100);
  const rest = basis === 'punten' ? `${getal(stand.nogTeGaan)} punten` : euro0(stand.nogTeGaan);
  return (
    <div className={compact ? 'min-w-[140px]' : ''}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100" aria-hidden>
        <div
          className={`h-full rounded-full ${stand.volgende ? (stand.voortgang >= 0.75 ? 'bg-amber-500' : 'bg-ink-700') : 'bg-green-600'}`}
          style={{ width: `${Math.max(3, pct)}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] leading-tight text-warm">
        {stand.volgende ? (
          <>
            nog <span className="font-semibold tabular-nums text-ink-800">{rest}</span> tot {stand.volgende.naam}
          </>
        ) : (
          'Hoogste niveau'
        )}
      </p>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'aangevraagd'
      ? 'badge-actie'
      : status === 'goedgekeurd'
        ? 'badge bg-ink-800 text-white'
        : status === 'verwerkt'
          ? 'badge-klaar'
          : 'badge bg-red-50 text-red-700';
  const tekst = { aangevraagd: 'Aangevraagd', goedgekeurd: 'Goedgekeurd', verwerkt: 'Verwerkt', afgewezen: 'Afgewezen' }[status] ?? status;
  return <span className={cls}>{tekst}</span>;
}

/** Ja/nee-keuze als select, zodat een formulier zonder JS ook "uit" kan versturen. */
export function JaNee({ naam, label, waarde, hint }: { naam: string; label: string; waarde: boolean; hint?: string }) {
  return (
    <div>
      <label className="veld-label" htmlFor={`f-${naam}`}>{label}</label>
      <select id={`f-${naam}`} name={naam} defaultValue={waarde ? 'ja' : 'nee'} className="veld">
        <option value="ja">Ja</option>
        <option value="nee">Nee</option>
      </select>
      {hint && <p className="veld-hint">{hint}</p>}
    </div>
  );
}
