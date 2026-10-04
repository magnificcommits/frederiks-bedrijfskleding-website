import { bedrijf } from '@/content/bedrijf';
import { LOGO_VIEWBOX, LOGO_DONKER, LOGO_ORANJE, LOGO_PAD_DONKER, LOGO_PAD_ORANJE } from './frederiksLogoPaden';

/**
 * Bouwstenen die offerte en factuur delen: logo, kop, stiksellijn, voet en de
 * afdrukinstellingen. Zo zien beide documenten er hetzelfde uit en staan de
 * bedrijfsgegevens maar op één plek (content/bedrijf.ts).
 *
 * Geen serverimports: de offerte draait ook in de browser (live voorbeeld).
 */

/** Het logo als vector: scherp op elk formaat, ook op papier. */
export function FrederiksLogo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox={LOGO_VIEWBOX} role="img" aria-label={bedrijf.naam} className={className}>
      <path fill={LOGO_DONKER} fillRule="evenodd" d={LOGO_PAD_DONKER} />
      <path fill={LOGO_ORANJE} fillRule="evenodd" d={LOGO_PAD_ORANJE} />
    </svg>
  );
}

/** Getal met komma, zonder overbodige nullen (2,5 en niet 2,50). */
export function getalNL(n: number | null | undefined): string {
  return String(Number(n) || 0).replace('.', ',');
}

/** Datum voluit, bijvoorbeeld 5 oktober 2026. Altijd in Nederlandse tijd. */
export function datumLang(d: string | null | undefined): string {
  if (!d) return '';
  const dt = new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00Z` : d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' });
}

/**
 * Kleur en maat als losse kenmerken, alleen als ze nog niet in de omschrijving staan.
 * Veel omschrijvingen bevatten ze al ("T-shirt Duo, maat XS, Antraciet/Zwart 1220").
 */
export function regelKenmerken(r: { omschrijving: string | null; kleur?: string | null; maat?: string | null }): { label: string; waarde: string }[] {
  const oms = (r.omschrijving || '').toLowerCase();
  const uit: { label: string; waarde: string }[] = [];
  const kleur = r.kleur?.trim();
  const maat = r.maat?.trim();
  if (kleur && !oms.includes(kleur.toLowerCase())) uit.push({ label: 'Kleur', waarde: kleur });
  if (maat && !oms.includes(`maat ${maat.toLowerCase()}`)) uit.push({ label: 'Maat', waarde: maat });
  return uit;
}

/** Klein kopje boven een blok: kapitalen, ruim gespatieerd. */
export function Label({ children, grijs = false, className = '' }: { children: React.ReactNode; grijs?: boolean; className?: string }) {
  return <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${grijs ? 'text-warm' : 'text-amber-700'} ${className}`}>{children}</p>;
}

/** Gestikte lijn: het naadje uit de werkkleding, ook gebruikt in de mails. */
export function Stiksel({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`border-t-2 border-dashed border-amber-500 ${className}`} />;
}

/** Kop van het document: logo links, soort en nummer rechts. */
export function DocKop({ soort, nummer }: { soort: string; nummer: string }) {
  return (
    <header className="break-inside-avoid">
      <div className="flex items-end justify-between gap-8">
        <FrederiksLogo className="h-[50px] w-auto shrink-0" />
        <div className="text-right">
          <p className="font-display text-[34px] font-extrabold leading-none tracking-tight text-ink-900">{soort}</p>
          <p className="mt-2 text-[13px] text-warm">
            nr. <span className="font-semibold tabular-nums text-ink-900">{nummer}</span>
          </p>
        </div>
      </div>
      <Stiksel className="mt-4" />
    </header>
  );
}

/** Rijtje label/waarde rechts naast het adresblok. */
export function Kenmerken({ rijen }: { rijen: { label: string; waarde: React.ReactNode; nadruk?: boolean }[] }) {
  return (
    <dl className="grid grid-cols-[auto_auto] justify-end gap-x-5 gap-y-1 text-[12.5px]">
      {rijen.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-warm">{r.label}</dt>
          <dd className={`text-right tabular-nums ${r.nadruk ? 'font-bold text-ink-900' : 'text-ink-900'}`}>{r.waarde}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Productfoto in een vast vakje; zonder foto een leeg vakje zodat de kolom recht blijft. */
export function RegelFoto({ src }: { src: string | null | undefined }) {
  return (
    // Zonder foto een leeg vak zonder rand: een leeg kader leest als een kapot plaatje.
    <div className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded ${src ? 'border border-line bg-white' : ''}`}>
      {src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={src} alt="" className="h-full w-full object-contain p-0.5" />
      ) : null}
    </div>
  );
}

/**
 * Voet met de vaste bedrijfsgegevens. Tekst, geen plaatje: selecteerbaar in de
 * PDF en scherp op papier.
 */
export function DocVoet({ voorwaarde }: { voorwaarde?: string }) {
  return (
    <footer className="mt-7 break-inside-avoid">
      {voorwaarde && <p className="mb-4 text-[11px] leading-relaxed text-warm">{voorwaarde}</p>}
      <div className="grid grid-cols-[1fr_1.3fr_1fr_1.2fr] gap-4 border-t border-line pt-3.5 text-[10px] leading-[1.6] text-warm">
        <div>
          <p className="font-semibold text-ink-900">{bedrijf.naam}</p>
          <p>{bedrijf.adres}</p>
          <p>
            {bedrijf.postcode} {bedrijf.plaats}
          </p>
        </div>
        <div>
          <p>{bedrijf.telefoon}</p>
          <p className="whitespace-nowrap">{bedrijf.email}</p>
          <p>{bedrijf.website}</p>
        </div>
        <div>
          <p>KvK {bedrijf.kvk}</p>
          <p>Btw {bedrijf.btw}</p>
        </div>
        <div>
          <p className="whitespace-nowrap">IBAN {bedrijf.iban}</p>
          <p>t.n.v. {bedrijf.naam}</p>
        </div>
      </div>
    </footer>
  );
}

/** Element-id van het vel papier op de afdrukpagina's. */
export const DOCUMENT_ID = 'fb-document';

/**
 * Afdrukinstellingen voor offerte en factuur.
 *
 * - A4 met 14 mm marge; onderaan een paginanummer (Chrome 131+; andere browsers
 *   slaan dat stil over).
 * - Alleen het document gaat op papier: alles wat het document niet bevat en er
 *   niet in staat (menu, knoppen, de rest van de pagina) valt weg, en de ouders van
 *   het document verliezen hun opmaak. Het document blijft in de gewone stroom, dus
 *   Chrome herhaalt de tabelkop op pagina 2 en breekt niet midden in een regel.
 * - Achtergrondkleuren blijven behouden.
 */
export function DocumentAfdrukStijl({ voetLabel }: { voetLabel?: string }) {
  const id = `#${DOCUMENT_ID}`;
  const label = (voetLabel ?? bedrijf.naam).replace(/["\\\n\r]/g, ' ');
  const css = `
@page {
  size: A4;
  margin: 14mm 14mm 16mm;
  @bottom-left { content: "${label}"; font: 8pt Arial, sans-serif; color: #828282; }
  @bottom-right { content: "Pagina " counter(page) " van " counter(pages); font: 8pt Arial, sans-serif; color: #828282; }
}
@media print {
  html, body { background: #fff !important; }
  body *:not(:has(${id})):not(${id}):not(${id} *) { display: none !important; }
  body *:has(${id}) {
    display: block !important; position: static !important; float: none !important;
    margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important;
    background: transparent !important; width: auto !important; max-width: none !important;
    min-height: 0 !important; min-width: 0 !important; height: auto !important; overflow: visible !important; transform: none !important;
  }
  ${id} { width: auto !important; max-width: none !important; min-width: 0 !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; }
  ${id} thead { display: table-header-group; }
  ${id} tr, ${id} .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
  ${id}, ${id} * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
