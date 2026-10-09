import QRCode from 'qrcode';
import { formatEuro } from '@/lib/format';
import { bedrijf } from '@/content/bedrijf';
import { factuurTotalen, regelBedrag } from '@/lib/kms/facturen';
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
 * De factuur zoals de klant hem krijgt, in dezelfde stijl als de offerte.
 * Gebruikt op de factuurpagina (voorbeeld onderaan en afdruk/PDF).
 * Serveronderdeel: rekent met factuurTotalen uit lib/kms/facturen, zodat scherm,
 * afdruk en mail altijd dezelfde btw-optelling tonen.
 */

export type FactuurDocumentRegel = {
  id: string;
  omschrijving: string | null;
  aantal: number | null;
  stukprijs: number | null;
  btw_pct: number | null;
  korting_pct?: number | null;
  kleur?: string | null;
  maat?: string | null;
  afbeelding?: string | null;
};

export type FactuurDocumentData = {
  factuurnummer: string | null;
  factuurdatum: string | null;
  /** Al ingevuld: bij een concept de vervaldatum die bij verzenden wordt gezet. */
  vervaldatum: string | null;
  status: string;
  betaaldatum: string | null;
  toegepaste_prijsafspraken: string | null;
  organisatie: {
    naam: string | null;
    adres: string | null;
    postcode: string | null;
    plaats: string | null;
    btw_nummer: string | null;
    klantnummer: string | null;
  } | null;
  regels: FactuurDocumentRegel[];
};

/** IBAN zonder spaties, in hoofdletters. */
function ibanKaal(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase();
}

/** Aantal dagen tussen twee datums (JJJJ-MM-DD), of null als dat niet te zeggen is. */
function dagenTussen(van: string | null, tot: string | null): number | null {
  if (!van || !tot) return null;
  const a = Date.parse(`${van.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${tot.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Inhoud van een EPC-QR-code (SEPA-overboeking, EPC069-12 versie 002).
 * De bank-app vult daarmee rekeningnummer, naam, bedrag en omschrijving in.
 * Null als er niets te betalen valt of het bedrag buiten de norm valt.
 */
export function epcTekst({ naam, iban, bedrag, omschrijving }: { naam: string; iban: string; bedrag: number; omschrijving: string }): string | null {
  if (!(bedrag >= 0.01 && bedrag <= 999_999_999.99)) return null;
  return [
    'BCD',
    '002',
    '1', // UTF-8
    'SCT',
    '', // BIC: optioneel binnen de EER
    naam.slice(0, 70),
    ibanKaal(iban),
    `EUR${bedrag.toFixed(2)}`,
    '', // doelcode
    '', // gestructureerd kenmerk
    omschrijving.slice(0, 140),
  ].join('\n');
}

/** QR-code als inline SVG: geen plaatje om te laden, scherp op papier. */
function QrCode({ tekst, className = '' }: { tekst: string; className?: string }) {
  let pad = '';
  let maat = 0;
  try {
    const qr = QRCode.create(tekst, { errorCorrectionLevel: 'M' });
    maat = qr.modules.size;
    const delen: string[] = [];
    for (let rij = 0; rij < maat; rij++) {
      for (let kol = 0; kol < maat; kol++) {
        if (qr.modules.get(rij, kol)) delen.push(`M${kol + 2} ${rij + 2}h1v1h-1z`);
      }
    }
    pad = delen.join('');
  } catch {
    return null;
  }
  const vak = maat + 4; // stille zone van twee modules rondom
  return (
    <svg viewBox={`0 0 ${vak} ${vak}`} shapeRendering="crispEdges" role="img" aria-label="QR-code om te betalen" className={className}>
      <rect width={vak} height={vak} fill="#ffffff" />
      <path d={pad} fill="#1c1c1c" />
    </svg>
  );
}

export default function FactuurDocument({ factuur }: { factuur: FactuurDocumentData }) {
  const org = factuur.organisatie;
  const nummer = factuur.factuurnummer || 'concept';
  const totalen = factuurTotalen(factuur.regels);
  const heeftKorting = factuur.regels.some((r) => (Number(r.korting_pct) || 0) !== 0);
  const heeftFoto = factuur.regels.some((r) => !!r.afbeelding);
  const kolommen = 5 + (heeftFoto ? 1 : 0) + (heeftKorting ? 1 : 0);
  const plaatsRegel = [org?.postcode, org?.plaats].filter(Boolean).join('  ');
  const termijn = dagenTussen(factuur.factuurdatum, factuur.vervaldatum) ?? bedrijf.betaaltermijnDagen;
  const betaald = factuur.status === 'betaald';
  const teBetalen = totalen.incl;
  const kenmerk = [factuur.factuurnummer, org?.klantnummer ? `deb. ${org.klantnummer}` : null].filter(Boolean).join(' / ');
  const qrTekst =
    !betaald && factuur.factuurnummer
      ? epcTekst({ naam: bedrijf.naam, iban: bedrijf.iban, bedrag: teBetalen, omschrijving: `Factuur ${kenmerk}` })
      : null;
  // Eén tarief: één regel. Meerdere tarieven: per tarief met de grondslag erbij.
  const btwRijen = totalen.perTarief.length > 0 ? totalen.perTarief : [{ pct: 21, grondslag: totalen.excl, btw: 0 }];

  return (
    <div className="font-sans text-[13px] leading-normal text-ink-800">
      <DocKop soort="Factuur" nummer={nummer} />

      <section className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] gap-8 break-inside-avoid">
        <div>
          <Label>Factuur aan</Label>
          <p className="mt-1.5 font-display text-[17px] font-bold leading-snug text-ink-900">{org?.naam || 'Onbekende klant'}</p>
          {org?.adres && <p className="text-warm">{org.adres}</p>}
          {plaatsRegel && <p className="text-warm">{plaatsRegel}</p>}
          {org?.btw_nummer && <p className="mt-1 text-[12px] text-warm">Btw-nummer {org.btw_nummer}</p>}
        </div>
        <Kenmerken
          rijen={[
            { label: 'Factuurnummer', waarde: nummer },
            { label: 'Factuurdatum', waarde: datumLang(factuur.factuurdatum) || '-' },
            { label: 'Vervaldatum', waarde: datumLang(factuur.vervaldatum) || '-', nadruk: !betaald },
            { label: 'Betaaltermijn', waarde: `${termijn} dagen` },
            ...(org?.klantnummer ? [{ label: 'Debiteurnummer', waarde: org.klantnummer }] : []),
          ]}
        />
      </section>

      <table className="mt-8 w-full table-fixed border-collapse text-left">
        <colgroup>
          {heeftFoto && <col className="w-[60px]" />}
          <col />
          <col className="w-[54px]" />
          <col className="w-[84px]" />
          {heeftKorting && <col className="w-[62px]" />}
          <col className="w-[46px]" />
          <col className="w-[92px]" />
        </colgroup>
        <thead>
          <tr className="bg-mist text-[10px] font-bold uppercase tracking-[0.12em] text-warm">
            {heeftFoto && (
              <th className="rounded-l py-2 pl-2">
                <span className="sr-only">Foto</span>
              </th>
            )}
            <th className={`py-2 pr-3 ${heeftFoto ? '' : 'rounded-l pl-2'}`}>Omschrijving</th>
            <th className="py-2 pl-2 text-right">Aantal</th>
            <th className="py-2 pl-2 text-right">Stukprijs</th>
            {heeftKorting && <th className="py-2 pl-2 text-right">Korting</th>}
            <th className="py-2 pl-2 text-right">Btw</th>
            <th className="rounded-r py-2 pl-2 pr-2 text-right">Bedrag</th>
          </tr>
        </thead>
        <tbody>
          {factuur.regels.length === 0 ? (
            <tr>
              <td colSpan={kolommen} className="border-b border-line px-2 py-5 text-warm">
                Nog geen regels op deze factuur.
              </td>
            </tr>
          ) : (
            factuur.regels.map((r) => {
              const kort = Number(r.korting_pct) || 0;
              const kenmerken = regelKenmerken(r);
              return (
                <tr key={r.id} className="break-inside-avoid border-b border-line align-middle">
                  {heeftFoto && (
                    <td className="py-2 pl-1 pr-2">
                      <RegelFoto src={r.afbeelding} />
                    </td>
                  )}
                  <td className={`py-2 pr-3 ${heeftFoto ? '' : 'pl-2'}`}>
                    <p className="break-words font-semibold leading-snug text-ink-900">{r.omschrijving || '-'}</p>
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
                  <td className="py-2 pl-2 text-right tabular-nums text-ink-800">{getalNL(r.aantal)}</td>
                  <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums text-ink-800">{formatEuro(Number(r.stukprijs) || 0)}</td>
                  {heeftKorting && (
                    <td className="py-2 pl-2 text-right tabular-nums text-amber-700">{kort ? `-${getalNL(kort)}%` : ''}</td>
                  )}
                  <td className="py-2 pl-2 text-right tabular-nums text-warm">{getalNL(r.btw_pct ?? 21)}%</td>
                  <td className="whitespace-nowrap py-2 pl-2 pr-2 text-right font-semibold tabular-nums text-ink-900">{formatEuro(regelBedrag(r))}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Btw-specificatie links, totalen rechts. */}
      <section className="mt-6 grid grid-cols-[minmax(0,1fr)_290px] items-start gap-8 break-inside-avoid">
        <div>
          <Label grijs>Btw-specificatie</Label>
          <table className="mt-2 w-full max-w-[300px] text-[11.5px] tabular-nums">
            <thead>
              <tr className="text-warm">
                <th className="pb-1 text-left font-normal">Tarief</th>
                <th className="pb-1 text-right font-normal">Grondslag</th>
                <th className="pb-1 text-right font-normal">Btw</th>
              </tr>
            </thead>
            <tbody>
              {btwRijen.map((t) => (
                <tr key={t.pct} className="border-t border-line">
                  <td className="py-1 text-ink-800">{getalNL(t.pct)}%</td>
                  <td className="py-1 text-right text-ink-800">{formatEuro(t.grondslag)}</td>
                  <td className="py-1 text-right text-ink-800">{formatEuro(t.btw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tabular-nums">
          <dl className="space-y-1 px-1 text-[12.5px]">
            {heeftKorting && totalen.korting > 0 && (
              <div className="flex justify-between">
                <dt className="text-warm">Waarvan korting</dt>
                <dd className="text-amber-700">- {formatEuro(totalen.korting)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-warm">Subtotaal excl. btw</dt>
              <dd className="text-ink-900">{formatEuro(totalen.excl)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-warm">Btw</dt>
              <dd className="text-ink-900">{formatEuro(totalen.btw)}</dd>
            </div>
          </dl>
          <div className="mt-2.5 flex items-baseline justify-between rounded-md bg-ink-900 px-4 py-3 text-white">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em]">Totaal incl. btw</span>
            <span className="font-display text-[21px] font-extrabold">{formatEuro(totalen.incl)}</span>
          </div>
        </div>
      </section>

      {/* Te betalen: het blok waar de klant naar zoekt. */}
      <section className="mt-6 break-inside-avoid">
        {betaald ? (
          <div className="rounded-md border-2 border-ink-900 px-5 py-4">
            <Label>Betaald</Label>
            <p className="mt-1 text-[14px] text-ink-900">
              Deze factuur is betaald{factuur.betaaldatum ? <> op <strong>{datumLang(factuur.betaaldatum)}</strong></> : null}. Bedankt!
            </p>
          </div>
        ) : teBetalen <= 0 ? (
          <div className="rounded-md border-2 border-ink-900 px-5 py-4">
            <Label>Te betalen</Label>
            <p className="mt-1 text-[14px] text-ink-900">Op deze factuur staat geen bedrag om over te maken.</p>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 rounded-md border-2 border-ink-900 px-5 py-4">
            <div>
              <Label>Te betalen</Label>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <span className="font-display text-[28px] font-extrabold leading-tight tabular-nums text-ink-900">{formatEuro(teBetalen)}</span>
                {factuur.vervaldatum && (
                  <span className="text-[13px] text-ink-800">
                    vóór <strong>{datumLang(factuur.vervaldatum)}</strong>
                  </span>
                )}
              </p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-[12.5px]">
                <dt className="text-warm">IBAN</dt>
                <dd className="font-semibold tracking-wide text-ink-900">{bedrijf.iban}</dd>
                <dt className="text-warm">Ten name van</dt>
                <dd className="text-ink-900">{bedrijf.naam}</dd>
                <dt className="text-warm">Kenmerk</dt>
                <dd className="font-semibold text-ink-900">{kenmerk || nummer}</dd>
              </dl>
            </div>
            {qrTekst && (
              <figure className="w-[30mm] text-center">
                <QrCode tekst={qrTekst} className="h-[30mm] w-[30mm]" />
                <figcaption className="mt-1 text-[9.5px] leading-tight text-warm">Scan met de app van je bank</figcaption>
              </figure>
            )}
          </div>
        )}
      </section>

      {factuur.toegepaste_prijsafspraken && (
        <p className="mt-6 whitespace-pre-wrap rounded bg-mist px-3 py-2 text-[11.5px] text-warm break-inside-avoid">{factuur.toegepaste_prijsafspraken}</p>
      )}

      <DocVoet voorwaarde={`${bedrijf.betaalvoorwaarde} Vragen over deze factuur? Mail naar ${bedrijf.email} of bel ${bedrijf.telefoon}.`} />
    </div>
  );
}
