import type { LogoBestand } from '@/lib/kms/logos';

/**
 * Voorbeeldweergave van één logobestand in de bibliotheek.
 *
 * Afbeeldingen tonen we gewoon als plaatje. Voor een PDF gebruiken we <object>
 * met de PDF-viewer die de browser zelf al heeft: dat toont de eerste pagina
 * zonder dat we een renderbibliotheek hoeven mee te leveren. Kan de browser dat
 * niet (of blokkeert hij het insluiten), dan valt hij automatisch terug op de
 * kinderen van het element: een blokje met de extensie en de bestandsnaam.
 * Borduurbestanden (.dst, .emb) krijgen altijd dat blokje.
 */
export default function BestandPreview({ bestand, logoNaam }: { bestand: LogoBestand; logoNaam: string }) {
  const terugval = (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 text-center">
      <span className="rounded bg-ink-900 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-white">
        {bestand.extensie || 'bestand'}
      </span>
      <span className="break-all text-[11px] leading-tight text-warm">{bestand.weergaveNaam}</span>
    </div>
  );

  return (
    <div className="w-44 shrink-0">
      <div className="flex h-36 items-center justify-center overflow-hidden rounded-lg border border-line bg-mist">
        {bestand.soort === 'afbeelding' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bestand.url}
            alt={`${bestand.label} van ${logoNaam}`}
            loading="lazy"
            className="max-h-full max-w-full object-contain"
          />
        ) : bestand.soort === 'pdf' ? (
          <object
            data={`${bestand.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            type="application/pdf"
            aria-label={`Voorbeeld van ${bestand.weergaveNaam}`}
            className="h-full w-full"
          >
            {terugval}
          </object>
        ) : (
          terugval
        )}
      </div>

      <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-warm">{bestand.label}</p>
      <p className="truncate text-[12px] text-ink-800" title={bestand.weergaveNaam}>
        {bestand.weergaveNaam}
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <a
          href={bestand.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-line px-2 py-0.5 text-xs font-semibold text-amber-700 hover:bg-mist"
        >
          Openen
        </a>
        {/* download-attribuut werkt alleen bij bestanden van hetzelfde domein; de
            ?download= in downloadHref regelt de naam ook bij Supabase-opslag. */}
        <a
          href={bestand.downloadHref}
          download={bestand.weergaveNaam}
          className="rounded-md border border-line px-2 py-0.5 text-xs font-semibold text-ink-700 hover:bg-mist"
        >
          Downloaden
        </a>
      </div>
    </div>
  );
}
