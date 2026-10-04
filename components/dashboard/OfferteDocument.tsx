import { formatEuro } from '@/lib/format';
import { bedrijf } from '@/content/bedrijf';
import {
  DocKop,
  DocVoet,
  Kenmerken,
  Label,
  RegelFoto,
  datumLang,
  getalNL,
  regelKenmerken,
} from '@/components/dashboard/DocumentOnderdelen';

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

/** Postadres van de klant voor het blok "Offerte voor". Optioneel. */
export type OfferteKlantAdres = { adres: string | null; postcode: string | null; plaats: string | null };

export type OfferteDocumentData = {
  offertenummer: number | null;
  created_at: string;
  geldig_tot: string | null;
  organisatie_naam: string | null;
  contactpersoon: string | null;
  notitie: string | null;
  btw_pct: number | null;
  regels: OfferteDocumentRegel[];
  /** Ontbreekt bij oudere aanroepers; dan staat alleen de naam in het adresblok. */
  klant_adres?: OfferteKlantAdres | null;
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
    klant_adres: o.klant_adres ?? null,
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

/** De stappen na akkoord. Kort gehouden; de uitgebreide versie staat in content/werkwijze.ts. */
const VERVOLG = [
  { titel: 'Akkoord', tekst: 'Teken hiernaast, of laat het ons even weten.' },
  { titel: 'Passen op locatie', tekst: 'We passen bij jullie op de zaak, zodat elke maat klopt.' },
  { titel: 'Logo aanbrengen', tekst: 'Bedrukt of geborduurd, in eigen huis.' },
  { titel: 'Levering', tekst: 'Alles compleet geleverd. Nabestellen kan daarna in een paar dagen.' },
];

export default function OfferteDocument({
  offerte,
  toonVervolg = true,
  toonAkkoord = true,
}: {
  offerte: OfferteDocumentData;
  /** Blok "Zo werkt het verder". */
  toonVervolg?: boolean;
  /** Akkoordvak met handtekening. */
  toonAkkoord?: boolean;
}) {
  const { subtotaal, korting, btw, totaal } = offerteTotalen(offerte.regels, offerte.btw_pct);
  const btwPct = offerte.btw_pct ?? 21;
  const nummer = offerte.offertenummer != null ? `${offerte.offertenummer}` : 'concept';
  const heeftKorting = offerte.regels.some((r) => (Number(r.korting_pct) || 0) !== 0);
  const heeftFoto = offerte.regels.some((r) => !!r.afbeelding);
  const kolommen = 4 + (heeftFoto ? 1 : 0) + (heeftKorting ? 1 : 0);
  const adres = offerte.klant_adres;
  const plaatsRegel = [adres?.postcode, adres?.plaats].filter(Boolean).join('  ');
  const voornaam = offerte.contactpersoon?.trim() || '';

  return (
    <div className="font-sans text-[13px] leading-normal text-ink-800">
      <DocKop soort="Offerte" nummer={nummer} />

      {/* Klant links, kenmerken rechts. */}
      <section className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] gap-8 break-inside-avoid">
        <div>
          <Label>Offerte voor</Label>
          <p className="mt-1.5 font-display text-[17px] font-bold leading-snug text-ink-900">{offerte.organisatie_naam || 'Nog geen klant gekozen'}</p>
          {voornaam && <p className="text-ink-800">t.a.v. {voornaam}</p>}
          {adres?.adres && <p className="text-warm">{adres.adres}</p>}
          {plaatsRegel && <p className="text-warm">{plaatsRegel}</p>}
        </div>
        <Kenmerken
          rijen={[
            { label: 'Offertenummer', waarde: nummer },
            { label: 'Datum', waarde: datumLang(offerte.created_at) || '-' },
            ...(offerte.geldig_tot ? [{ label: 'Geldig tot', waarde: datumLang(offerte.geldig_tot), nadruk: true }] : []),
            { label: 'Contact', waarde: bedrijf.telefoon },
          ]}
        />
      </section>

      {/* Persoonlijke inleiding: de notitie als die er is, anders een korte standaardzin. */}
      <section className="mt-6 max-w-[75ch] break-inside-avoid">
        {voornaam && <p className="text-ink-900">Beste {voornaam},</p>}
        {offerte.notitie ? (
          <p className={`whitespace-pre-wrap text-ink-800 ${voornaam ? 'mt-2' : ''}`}>{offerte.notitie}</p>
        ) : (
          <p className={`text-ink-800 ${voornaam ? 'mt-2' : ''}`}>
            Bedankt voor je aanvraag. Hieronder staat wat we voor je hebben samengesteld. De prijzen zijn per stuk en exclusief btw.
          </p>
        )}
      </section>

      {/* Vaste kolombreedtes: koppen staan exact boven de bedragen, ook op papier. */}
      <table className="mt-5 w-full table-fixed border-collapse text-left">
        <colgroup>
          {heeftFoto && <col className="w-[60px]" />}
          <col />
          <col className="w-[58px]" />
          <col className="w-[88px]" />
          {heeftKorting && <col className="w-[66px]" />}
          <col className="w-[96px]" />
        </colgroup>
        <thead>
          <tr className="bg-mist text-[10px] font-bold uppercase tracking-[0.12em] text-warm">
            {heeftFoto && (
              <th className="rounded-l py-2 pl-2">
                <span className="sr-only">Foto</span>
              </th>
            )}
            <th className={`py-2 pr-3 ${heeftFoto ? '' : 'rounded-l pl-2'}`}>Artikel</th>
            <th className="py-2 pl-2 text-right">Aantal</th>
            <th className="py-2 pl-2 text-right">Stukprijs</th>
            {heeftKorting && <th className="py-2 pl-2 text-right">Korting</th>}
            <th className="rounded-r py-2 pl-2 pr-2 text-right">Bedrag</th>
          </tr>
        </thead>
        <tbody>
          {offerte.regels.length === 0 ? (
            <tr>
              <td colSpan={kolommen} className="border-b border-line px-2 py-5 text-warm">
                Nog geen regels op deze offerte.
              </td>
            </tr>
          ) : (
            offerte.regels.map((r) => {
              const aantal = Number(r.aantal) || 0;
              const stukprijs = Number(r.stukprijs) || 0;
              const kort = Number(r.korting_pct) || 0;
              const netto = aantal * stukprijs * (1 - kort / 100);
              const kenmerken = regelKenmerken(r);
              return (
                <tr key={r.id} className="break-inside-avoid border-b border-line align-middle">
                  {heeftFoto && (
                    <td className="py-2 pl-1 pr-2">
                      <RegelFoto src={r.afbeelding} />
                    </td>
                  )}
                  <td className={`py-2 pr-3 ${heeftFoto ? '' : 'pl-2'}`}>
                    <p className="font-semibold leading-snug text-ink-900">{r.omschrijving || '-'}</p>
                    {kenmerken.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {kenmerken.map((k) => (
                          <span key={k.label} className="rounded bg-mist px-1.5 py-px text-[11px] text-warm">
                            {k.label} <span className="font-semibold text-ink-800">{k.waarde}</span>
                          </span>
                        ))}
                      </p>
                    )}
                  </td>
                  <td className="py-2 pl-2 text-right tabular-nums text-ink-800">{getalNL(aantal)}</td>
                  <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums text-ink-800">{formatEuro(stukprijs)}</td>
                  {heeftKorting && (
                    <td className="py-2 pl-2 text-right tabular-nums text-amber-700">{kort ? `-${getalNL(kort)}%` : ''}</td>
                  )}
                  <td className="whitespace-nowrap py-2 pl-2 pr-2 text-right font-semibold tabular-nums text-ink-900">{formatEuro(netto)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Geldigheid links, totalen rechts. */}
      <section className="mt-5 grid grid-cols-[minmax(0,1fr)_290px] items-start gap-8 break-inside-avoid">
        <div className="pt-1 text-[12px] text-warm">
          {offerte.geldig_tot ? (
            <p>
              Deze offerte is geldig tot en met <span className="font-semibold text-ink-900">{datumLang(offerte.geldig_tot)}</span>.
            </p>
          ) : (
            <p>Vragen over deze offerte? Bel of mail ons gerust.</p>
          )}
          <p className="mt-1">Bedragen in euro&apos;s. Stukprijzen zijn exclusief btw.</p>
        </div>
        <div className="tabular-nums">
          <dl className="space-y-1 px-1 text-[12.5px]">
            {korting > 0 && (
              <div className="flex justify-between">
                <dt className="text-warm">Korting</dt>
                <dd className="text-amber-700">- {formatEuro(korting)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-warm">Subtotaal excl. btw</dt>
              <dd className="text-ink-900">{formatEuro(subtotaal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-warm">Btw {getalNL(btwPct)}%</dt>
              <dd className="text-ink-900">{formatEuro(btw)}</dd>
            </div>
          </dl>
          <div className="mt-2.5 flex items-baseline justify-between rounded-md bg-ink-900 px-4 py-3 text-white">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em]">Totaal incl. btw</span>
            <span className="font-display text-[21px] font-extrabold">{formatEuro(totaal)}</span>
          </div>
        </div>
      </section>

      {/* Vervolgstappen en akkoord naast elkaar: zo past een gewone offerte op één A4. */}
      {(toonVervolg || toonAkkoord) && (
        <section className={`mt-7 grid items-stretch gap-8 break-inside-avoid ${toonVervolg && toonAkkoord ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {toonVervolg && (
            <div>
              <Label>Zo werkt het verder</Label>
              <ol className="mt-2.5 space-y-2 border-l-2 border-dashed border-amber-300 pl-3.5">
                {VERVOLG.map((s, i) => (
                  <li key={s.titel} className="text-[11.5px] leading-snug text-warm">
                    <span className="mr-1.5 font-display text-[13px] font-extrabold text-amber-600">{i + 1}</span>
                    <span className="font-semibold text-ink-900">{s.titel}.</span> {s.tekst}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {toonAkkoord && (
            <div className="flex flex-col rounded-md border border-line px-4 py-3.5">
              <p className="font-display text-[14px] font-bold text-ink-900">Voor akkoord</p>
              <p className="mt-0.5 text-[11px] leading-snug text-warm">
                Teken en stuur hem terug, of bel {bedrijf.telefoon}.
              </p>
              <div className="mt-auto grid grid-cols-[1.3fr_1fr] gap-x-5 gap-y-1 pt-3 text-[9.5px] uppercase tracking-[0.12em] text-warm">
                {['Naam', 'Datum'].map((veld) => (
                  <div key={veld}>
                    <div className="h-7 border-b border-ink-300" />
                    <p className="mt-1">{veld}</p>
                  </div>
                ))}
                <div className="col-span-2">
                  <div className="h-9 border-b border-ink-300" />
                  <p className="mt-1">Handtekening</p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      <DocVoet />
    </div>
  );
}
