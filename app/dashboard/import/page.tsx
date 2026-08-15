import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { listOrganisaties } from '@/lib/kms/functies';
import { medewerkersImport, productenImport, productenLijstImport } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bulk-import', robots: { index: false, follow: false } };

const inputCls = 'veld';
const textareaCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 font-mono text-xs focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

type Zoek = {
  soort?: string;
  aangemaakt?: string;
  overgeslagen?: string;
  fouten?: string;
  prod_hergebruikt?: string;
  varianten?: string;
};

export default async function ImportPage({ searchParams }: { searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
        </div>
      </main>
    );
  }

  const { soort, aangemaakt, overgeslagen, fouten, prod_hergebruikt, varianten } = await searchParams;
  const orgs = await listOrganisaties();
  const foutLijst = fouten ? fouten.split('||').filter(Boolean) : [];
  const heeftResultaat = soort && (aangemaakt !== undefined || overgeslagen !== undefined);
  const isLijst = soort === 'lijst';

  const resultaatLabel = soort === 'medewerkers' ? 'Medewerkers' : soort === 'producten' ? 'Producten' : soort === 'lijst' ? 'Productenlijst' : '';

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Bulk-import</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Plak een CSV-lijst om medewerkers of producten in één keer toe te voegen. Scheidingsteken mag puntkomma of komma zijn. De eerste regel zijn de kolomkoppen.</p>

      {heeftResultaat && (
        <div className="mt-6 panel p-4">
          <h2 className="font-display text-lg font-bold text-ink-900">Resultaat import {resultaatLabel.toLowerCase()}</h2>
          {isLijst ? (
            <p className="mt-2 text-sm text-warm">
              <span className="font-semibold text-green-800">{aangemaakt ?? 0} producten aangemaakt</span>
              {', '}
              <span className="font-semibold text-ink-700">{prod_hergebruikt ?? 0} bestaande producten aangevuld</span>
              {', '}
              <span className="font-semibold text-green-800">{varianten ?? 0} varianten toegevoegd</span>
              {', '}
              <span className="font-semibold text-ink-700">{overgeslagen ?? 0} regels overgeslagen</span>
              {'.'}
            </p>
          ) : (
            <p className="mt-2 text-sm text-warm">
              <span className="font-semibold text-green-800">{aangemaakt ?? 0} aangemaakt</span>
              {', '}
              <span className="font-semibold text-ink-700">{overgeslagen ?? 0} overgeslagen</span>
              {'.'}
            </p>
          )}
          {foutLijst.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-warm">Meldingen</p>
              <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-warm">
                {foutLijst.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="panel p-4">
          <h2 className="font-display text-lg font-bold text-ink-900">Medewerkers importeren</h2>
          <p className="mt-1 text-xs text-warm">Kies eerst de klant. Verwachte kolommen: <code>naam;email;functie;personeelsnummer</code>. De volgorde mag anders, zolang de koppen kloppen. Staat er alleen een naam, dan splitsen we die zelf in voornaam en achternaam.</p>
          <form action={medewerkersImport} className="mt-4 flex flex-col gap-3">
            <div>
              <label className="veld-label">Klant</label>
              <select name="organisatie_id" required className={inputCls}>
                <option value="">Kies een klant</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.naam}</option>)}
              </select>
            </div>
            <div>
              <label className="veld-label">CSV plakken</label>
              <textarea
                name="csv"
                required
                rows={10}
                placeholder={'naam;email;functie;personeelsnummer\nJan Jansen;jan@bedrijf.nl;Monteur;1001\nPiet de Vries;piet@bedrijf.nl;Voorman;1002'}
                className={textareaCls}
              />
            </div>
            <button type="submit" className="self-start knop-donker">Medewerkers importeren</button>
          </form>
        </div>

        <div className="panel p-4">
          <h2 className="font-display text-lg font-bold text-ink-900">Producten importeren</h2>
          <p className="mt-1 text-xs text-warm">Verwachte kolommen: <code>naam;merk;categorie;sku</code>. Btw staat standaard op 21 procent. De volgorde mag anders, zolang de koppen kloppen.</p>
          <form action={productenImport} className="mt-4 flex flex-col gap-3">
            <div>
              <label className="veld-label">CSV plakken</label>
              <textarea
                name="csv"
                required
                rows={10}
                placeholder={'naam;merk;categorie;sku\nSoftshell jas;Tricorp;Jassen;SS-001\nWerkbroek;Mascot;Broeken;WB-220'}
                className={textareaCls}
              />
            </div>
            <button type="submit" className="self-start knop-donker">Producten importeren</button>
          </form>
        </div>
      </div>

      <div className="mt-8 panel p-4">
        <h2 className="font-display text-lg font-bold text-ink-900">Productenlijst importeren (CSV)</h2>
        <p className="mt-1 text-xs text-warm">
          Voor leverancierslijsten zoals die van FHB, geexporteerd uit Odoo. Elke regel is een variant (een maat) van een artikel. We groeperen per <code>Artikelnr.</code> zodat een artikel een product wordt met meerdere varianten. Exporteer de Excel eerst naar CSV en plak die hieronder, of upload het bestand.
        </p>
        <p className="mt-2 text-xs text-warm">
          Herkende kolommen: <code>Interne referentie, Merk, Artikelnr., Naam, Variant waardes, Verkoopprijs ex btw, Inkoopprijs ex btw, Basis Kleur, Barcode, Productcategorie, Btw Inkoop, Btw Verkoop, Omschrijving, Afbeelding, Voorraad</code>. De volgorde mag anders, zolang de koppen kloppen. Scheidingsteken mag puntkomma of komma zijn.
        </p>
        <form action={productenLijstImport} className="mt-4 flex flex-col gap-3">
          <div>
            <label className="veld-label">CSV plakken</label>
            <textarea
              name="csv"
              rows={10}
              placeholder={'Interne referentie;Merk;Artikelnr.;Naam;Variant waardes;Verkoopprijs ex btw;Inkoopprijs ex btw;Basis Kleur;Barcode;Productcategorie;Btw Verkoop;Omschrijving;Voorraad'}
              className={textareaCls}
            />
          </div>
          <div>
            <label className="veld-label">Of upload een CSV-bestand</label>
            <input
              type="file"
              name="bestand"
              accept=".csv,text/csv"
              className="mt-1 block w-full text-sm text-warm file:mr-3 file:rounded-md file:border-0 file:bg-mist file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink-800 hover:file:bg-ink-100"
            />
            <p className="mt-1 text-xs text-warm">Als beide gevuld zijn, gebruiken we het tekstveld.</p>
          </div>
          <button type="submit" className="self-start knop-donker">Productenlijst importeren</button>
        </form>
      </div>
    </main>
  );
}
