import { nieuwLogo } from './actions';

const fileCls =
  'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-mist file:px-3 file:py-1 file:text-xs file:font-semibold file:text-ink-700 hover:file:bg-line focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

/** Vector, bitmap en borduurprogramma's; PDF hoort er net zo goed bij. */
export const LOGO_ACCEPT = 'application/pdf,image/*,.pdf,.ai,.eps,.svg,.cdr,.dst,.emb,.pes,.exp,.jef,.tif,.tiff,.psd';

/**
 * Formulier voor een nieuw logo. Met een vaste klant (klantkaart) is de klant
 * verborgen ingevuld; vanuit de bibliotheek kies je hem in de lijst.
 */
export default function NieuwLogoFormulier({
  orgId,
  klanten,
  terug,
}: {
  orgId?: string;
  klanten?: { id: string; naam: string }[];
  terug?: string | null;
}) {
  const sleutel = orgId ?? 'kies';
  return (
    <form action={nieuwLogo} className="mt-4 flex flex-col gap-4">
      {terug && <input type="hidden" name="terug" value={terug} />}
      {orgId ? (
        <input type="hidden" name="orgId" value={orgId} />
      ) : (
        <div>
          <label className="veld-label" htmlFor={`logo-klant-${sleutel}`}>Klant</label>
          <select id={`logo-klant-${sleutel}`} name="orgId" required defaultValue="" className="veld">
            <option value="" disabled>Kies een klant</option>
            {(klanten ?? []).map((k) => (
              <option key={k.id} value={k.id}>{k.naam}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="veld-label" htmlFor={`logo-naam-${sleutel}`}>Naam</label>
        <input id={`logo-naam-${sleutel}`} name="naam" required placeholder="Bijv. Bedrijfslogo borst" className="veld" />
      </div>
      <fieldset>
        <legend className="veld-label">Gebruikt voor</legend>
        <div className="mt-1 flex gap-4 text-sm text-ink-800">
          <label className="flex items-center gap-2"><input type="checkbox" name="technieken" value="borduren" className="h-4 w-4 accent-amber-500" /> Borduren</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="technieken" value="bedrukken" className="h-4 w-4 accent-amber-500" /> Bedrukken</label>
        </div>
      </fieldset>
      <div>
        <label className="veld-label" htmlFor={`logo-bestand-${sleutel}`}>Logo als plaatje (PNG of JPG)</label>
        <input id={`logo-bestand-${sleutel}`} type="file" name="logo_bestand" accept={LOGO_ACCEPT} className={fileCls} />
        <input name="logo_bestand_url" placeholder="of plak een link" className="veld mt-2" aria-label="Link naar het logo-bestand" />
        <p className="veld-hint">Dit plaatje gebruik je in de drukproef. We meten meteen hoe groot het scherp gedrukt kan worden.</p>
      </div>
      <div>
        <label className="veld-label" htmlFor={`vector-bestand-${sleutel}`}>Vectorbestand (AI, EPS, PDF of SVG)</label>
        <input id={`vector-bestand-${sleutel}`} type="file" name="vectorbestand" accept={LOGO_ACCEPT} className={fileCls} />
        <input name="vectorbestand_url" placeholder="of plak een link" className="veld mt-2" aria-label="Link naar het vectorbestand" />
      </div>
      <div>
        <label className="veld-label" htmlFor={`borduur-bestand-${sleutel}`}>Borduurprogramma (DST)</label>
        <input id={`borduur-bestand-${sleutel}`} type="file" name="borduurbestand" accept={LOGO_ACCEPT} className={fileCls} />
        <input name="borduurbestand_url" placeholder="of plak een link" className="veld mt-2" aria-label="Link naar het borduurbestand" />
      </div>
      <p className="veld-hint">Samen maximaal 4 MB per keer. Meer bestanden, kleuren en posities voeg je daarna toe op de pagina van het logo.</p>
      <div>
        <label className="veld-label" htmlFor={`logo-opm-${sleutel}`}>Opmerkingen</label>
        <textarea id={`logo-opm-${sleutel}`} name="opmerkingen" rows={2} placeholder="Bijv. altijd wit op donkere stof" className="veld" />
      </div>
      <button type="submit" className="self-start knop-donker">Logo opslaan</button>
    </form>
  );
}
