import { formatEuro, formatDatum } from '@/lib/format';
import { site } from '@/content/site';
import DocumentVoet from '@/components/dashboard/DocumentVoet';

/**
 * De offerte zoals de klant hem krijgt. Eén component voor twee plekken:
 * de afdruk-/PDF-weergave (server) en het live voorbeeld op de offertepagina
 * (browser). Zo kunnen voorbeeld en PDF nooit uit elkaar lopen.
 *
 * Bewust zonder serverimports (geen Supabase, geen cookies): dit bestand moet
 * ook in de browser kunnen draaien.
 */

export type OfferteDocumentRegel = {
  id: string;
  omschrijving: string | null;
  aantal: number | null;
  stukprijs: number | null;
  korting_pct: number | null;
  kleur: string | null;
  maat: string | null;
  afbeelding: string | null;
};

export type OfferteDocumentData = {
  offertenummer: number | null;
  created_at: string;
  geldig_tot: string | null;
  organisatie_naam: string | null;
  contactpersoon: string | null;
  notitie: string | null;
  btw_pct: number | null;
  regels: OfferteDocumentRegel[];
};

/**
 * Totalen voor een set regels: subtotaal (na regelkorting, excl. btw), het kortingsbedrag,
 * btw, totaal, en de marge (subtotaal min inkoopkosten, voor regels met een inkoopprijs).
 * Staat hier (en niet alleen in lib/kms/offertes.ts) zodat ook het voorbeeld in de browser
 * exact dezelfde berekening gebruikt; lib/kms/offertes.ts exporteert deze functie door.
 */
export function offerteTotalen(
  regels: { aantal: number | null; stukprijs: number | null; korting_pct?: number | null; inkoop?: number | null }[],
  btwPct: number | null | undefined,
): { subtotaal: number; korting: number; btw: number; totaal: number; marge: number } {
  let bruto = 0;
  let netto = 0;
  let kostprijs = 0;
  for (const r of regels) {
    const aantal = Number(r.aantal) || 0;
    const stuk = Number(r.stukprijs) || 0;
    const kort = Number(r.korting_pct) || 0;
    const regelBruto = aantal * stuk;
    bruto += regelBruto;
    netto += regelBruto * (1 - kort / 100);
    if (r.inkoop != null && Number.isFinite(Number(r.inkoop))) kostprijs += aantal * Number(r.inkoop);
  }
  const pct = Number(btwPct);
  const btw = netto * (Number.isFinite(pct) ? pct : 0) / 100;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    subtotaal: r2(netto),
    korting: r2(bruto - netto),
    btw: r2(btw),
    totaal: r2(netto + btw),
    marge: r2(netto - kostprijs),
  };
}

/** Alleen wat er op het klantdocument komt; inkoopprijzen e.d. blijven achter. */
export function naarDocumentData(o: OfferteDocumentData): OfferteDocumentData {
  return {
    offertenummer: o.offertenummer,
    created_at: o.created_at,
    geldig_tot: o.geldig_tot,
    organisatie_naam: o.organisatie_naam,
    contactpersoon: o.contactpersoon,
    notitie: o.notitie,
    btw_pct: o.btw_pct,
    regels: o.regels.map((r) => ({
      id: r.id,
      omschrijving: r.omschrijving,
      aantal: r.aantal,
      stukprijs: r.stukprijs,
      korting_pct: r.korting_pct,
      kleur: r.kleur,
      maat: r.maat,
      afbeelding: r.afbeelding,
    })),
  };
}

export default function OfferteDocument({ offerte }: { offerte: OfferteDocumentData }) {
  const { subtotaal, korting, btw, totaal } = offerteTotalen(offerte.regels, offerte.btw_pct);
  const btwPct = offerte.btw_pct ?? 21;
  const nummer = offerte.offertenummer != null ? `${offerte.offertenummer}` : 'concept';
  const heeftKorting = offerte.regels.some((r) => (Number(r.korting_pct) || 0) !== 0);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
        <div>
          <p className="font-display text-2xl font-extrabold text-ink-900">{site.name}</p>
          <p className="mt-1 text-sm text-warm">{site.address.street}</p>
          <p className="text-sm text-warm">{site.address.postalCode} {site.address.city}</p>
          <p className="mt-2 text-sm text-warm">{site.phone} · {site.email}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-extrabold text-ink-900">Offerte</p>
          <p className="mt-1 text-sm text-warm">Nummer: <span className="font-medium text-ink-900">{nummer}</span></p>
          <p className="text-sm text-warm">Datum: <span className="text-ink-900">{formatDatum(offerte.created_at) || '-'}</span></p>
          {offerte.geldig_tot && <p className="text-sm text-warm">Geldig tot: <span className="text-ink-900">{formatDatum(offerte.geldig_tot)}</span></p>}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-warm">Offerte aan</p>
        <p className="mt-1 font-semibold text-ink-900">{offerte.organisatie_naam || 'Onbekende klant'}</p>
        {offerte.contactpersoon && <p className="text-sm text-warm">T.a.v. {offerte.contactpersoon}</p>}
      </div>

      {/* Vaste kolombreedtes: koppen staan exact boven de bedragen, ook op papier. */}
      <table className="mt-6 w-full table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-14" />
          <col />
          <col className="w-16" />
          <col className="w-28" />
          {heeftKorting && <col className="w-20" />}
          <col className="w-28" />
        </colgroup>
        <thead className="border-b-2 border-ink-900 text-xs uppercase tracking-wide text-warm">
          <tr>
            <th className="py-2 pr-2"><span className="sr-only">Foto</span></th>
            <th className="py-2 pr-3 text-left">Omschrijving</th>
            <th className="py-2 pl-2 text-right">Aantal</th>
            <th className="py-2 pl-2 text-right">Stukprijs</th>
            {heeftKorting && <th className="py-2 pl-2 text-right">Korting</th>}
            <th className="py-2 pl-2 text-right">Bedrag</th>
          </tr>
        </thead>
        <tbody>
          {offerte.regels.length === 0 ? (
            <tr><td colSpan={heeftKorting ? 6 : 5} className="py-4 text-warm">Geen regels op deze offerte.</td></tr>
          ) : (
            offerte.regels.map((r) => {
              const aantal = Number(r.aantal) || 0;
              const stukprijs = Number(r.stukprijs) || 0;
              const kort = Number(r.korting_pct) || 0;
              const netto = aantal * stukprijs * (1 - kort / 100);
              const oms = (r.omschrijving || '').toLowerCase();
              // Kleur en maat apart tonen als ze niet al in de omschrijving staan.
              const extra = [
                r.kleur && !oms.includes(r.kleur.trim().toLowerCase()) ? `Kleur: ${r.kleur.trim()}` : '',
                r.maat && !oms.includes(`maat ${r.maat.trim().toLowerCase()}`) ? `Maat: ${r.maat.trim()}` : '',
              ].filter(Boolean);
              return (
                <tr key={r.id} className="break-inside-avoid border-b border-line align-middle">
                  <td className="py-2 pr-2">
                    {r.afbeelding && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={r.afbeelding} alt="" className="h-11 w-11 object-contain" />
                    )}
                  </td>
                  <td className="py-2 pr-3 text-ink-900">
                    {r.omschrijving || '-'}
                    {extra.length > 0 && <span className="block text-xs text-warm">{extra.join(' · ')}</span>}
                  </td>
                  <td className="py-2 pl-2 text-right tabular-nums text-ink-800">{String(aantal).replace('.', ',')}</td>
                  <td className="py-2 pl-2 text-right tabular-nums text-ink-800">{formatEuro(stukprijs)}</td>
                  {heeftKorting && <td className="py-2 pl-2 text-right tabular-nums text-ink-800">{kort ? `${String(kort).replace('.', ',')}%` : ''}</td>}
                  <td className="py-2 pl-2 text-right font-medium tabular-nums text-ink-900">{formatEuro(netto)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm tabular-nums">
        {korting > 0 && <div className="flex justify-between"><span className="text-warm">Korting</span><span className="text-ink-900">- {formatEuro(korting)}</span></div>}
        <div className="flex justify-between"><span className="text-warm">Subtotaal</span><span className="text-ink-900">{formatEuro(subtotaal)}</span></div>
        <div className="flex justify-between"><span className="text-warm">Btw ({String(btwPct).replace('.', ',')}%)</span><span className="text-ink-900">{formatEuro(btw)}</span></div>
        <div className="flex justify-between border-t border-line pt-1 font-extrabold text-ink-900"><span>Totaal</span><span>{formatEuro(totaal)}</span></div>
      </div>

      {offerte.notitie && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-warm">Toelichting</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-900">{offerte.notitie}</p>
        </div>
      )}

      <p className="mt-8 text-xs text-warm">
        {offerte.geldig_tot
          ? `Deze offerte is geldig tot ${formatDatum(offerte.geldig_tot)}.`
          : 'Vragen over deze offerte? Neem gerust contact met ons op.'}
        {' '}Vragen? Mail naar {site.email} of bel {site.phone}.
      </p>

      <DocumentVoet toonVoorwaarde={false} />
    </>
  );
}
