import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import { dashAuthed } from '@/lib/kms/adminClient';
import { listOrganisaties, listLogos, logoBestanden } from '@/lib/kms/logos';
import { nieuwLogo, verwijderLogoActie } from './actions';
import NavigateSelect from '@/components/dashboard/NavigateSelect';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import BestandPreview from './BestandPreview';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Logobibliotheek', robots: { index: false, follow: false } };

const inputCls = 'veld';
const fileCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-mist file:px-3 file:py-1 file:text-xs file:font-semibold file:text-ink-700 hover:file:bg-line focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

/** PDF en vectorformaten horen er net zo goed bij als een gewone afbeelding. */
const toegestaneBestanden = 'application/pdf,image/*,.pdf,.ai,.eps,.svg,.dst,.emb';

const okBoodschap: Record<string, string> = {
  toegevoegd: 'Logo toegevoegd.',
  verwijderd: 'Logo verwijderd.',
  mislukt: 'Opslaan is niet gelukt. Probeer het nog een keer.',
  geen_klant: 'Kies eerst een klant, dan kan het logo bij de juiste bibliotheek.',
  geen_naam: 'Geef het logo eerst een naam.',
};

/**
 * Meldingen die melden dat er iets misging. Ze horen in een rood vlak: een
 * groene balk met "Opslaan is niet gelukt" leest als goed nieuws en dan klikt
 * Jessi door zonder dat het logo bewaard is.
 */
const foutMeldingen = new Set(['mislukt', 'geen_klant', 'geen_naam']);

export default async function LogosPage({ searchParams }: { searchParams: Promise<{ org?: string; ok?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { org, ok } = await searchParams;

  const orgs = await listOrganisaties();
  const gekozen = org && orgs.some((o) => o.id === org) ? org : '';
  const logos = gekozen ? await listLogos(gekozen) : [];
  const gekozenNaam = orgs.find((o) => o.id === gekozen)?.naam ?? '';

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Logobibliotheek</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="knop-tekst">Terug naar dashboard</Link>
          {/* Zonder gekozen klant weet de actie niet bij welke bibliotheek het
              logo hoort; dan is een invulformulier tonen een doodlopende weg. */}
          {gekozen ? (
          <Drawer
            knop="Nieuw logo"
            titel="Nieuw logo"
            beschrijving="Upload de bestanden, of plak een URL als alternatief."
          >
            <form action={nieuwLogo} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="orgId" value={gekozen} />
              <div>
                <label className="veld-label" htmlFor="logo-naam">Naam</label>
                <input id="logo-naam" name="naam" required placeholder="Bijv. Bedrijfslogo borst" className={inputCls} />
              </div>
              <div>
                <label className="veld-label" htmlFor="logo-bestand">Logo-bestand</label>
                <input id="logo-bestand" type="file" name="logo_bestand" accept={toegestaneBestanden} className={fileCls} />
                <input name="logo_bestand_url" placeholder="of plak een URL" className={`${inputCls} mt-2`} aria-label="URL van het logo-bestand" />
              </div>
              <div>
                <label className="veld-label" htmlFor="vector-bestand">Vectorbestand</label>
                <input id="vector-bestand" type="file" name="vectorbestand" accept={toegestaneBestanden} className={fileCls} />
                <input name="vectorbestand_url" placeholder="of plak een URL" className={`${inputCls} mt-2`} aria-label="URL van het vectorbestand" />
              </div>
              <div>
                <label className="veld-label" htmlFor="borduur-bestand">Borduurbestand</label>
                <input id="borduur-bestand" type="file" name="borduurbestand" accept={toegestaneBestanden} className={fileCls} />
                <input name="borduurbestand_url" placeholder="of plak een URL" className={`${inputCls} mt-2`} aria-label="URL van het borduurbestand" />
              </div>
              <p className="veld-hint">PDF mag ook. De originele bestandsnaam blijft bewaard, dus je krijgt hem straks onder dezelfde naam weer terug.</p>
              <div>
                <label className="veld-label" htmlFor="logo-opmerkingen">Opmerkingen</label>
                <textarea id="logo-opmerkingen" name="opmerkingen" rows={3} placeholder="Bijv. kleurcodes of plaatsing" className={inputCls} />
              </div>
              <button type="submit" className="self-start knop-donker">Logo opslaan</button>
            </form>
          </Drawer>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-sm text-warm">Per klant bewaar je hier de logo&apos;s met de bijbehorende bestanden voor bedrukken en borduren.</p>

      {ok && okBoodschap[ok] && (
        <p
          className={`mt-4 rounded-xl border px-5 py-3 text-sm font-semibold ${
            foutMeldingen.has(ok)
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-green-200 bg-green-50 text-green-800'
          }`}
        >
          {okBoodschap[ok]}
        </p>
      )}

      <section className="mt-8">
        <div className="flex flex-wrap items-end gap-3 panel p-4">
          {/* Het label omsluit de keuzelijst: NavigateSelect kent geen id, dus
              zonder deze omhulling hangt het opschrift nergens aan vast. */}
          <label className="block min-w-[16rem]">
            <span className="veld-label">Klant</span>
            <span className="mt-1 block">
              <NavigateSelect options={orgs.map((o) => ({ value: o.id, label: o.naam }))} value={gekozen} basePath="/dashboard/logos" param="org" placeholder="Kies een klant" />
            </span>
          </label>
        </div>
      </section>

      {!gekozen ? (
        <p className="mt-8 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Kies eerst een klant om de logobibliotheek te tonen.</p>
      ) : (
        <>
          <h2 className="mt-8 font-display text-xl font-bold text-ink-900">Logo&apos;s van {gekozenNaam}</h2>
          {logos.length === 0 ? (
            <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen logo&apos;s voor deze klant. Voeg er rechtsboven een toe.</p>
          ) : (
            <div className="mt-4 overflow-x-auto panel">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th>Bestanden</th>
                    <th>Opmerkingen</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {logos.map((l) => {
                    const bestanden = logoBestanden(l);
                    return (
                      <tr key={l.id} className="border-b border-line align-top">
                        <td className="font-semibold text-ink-900">{l.naam}</td>
                        <td>
                          {bestanden.length === 0 ? (
                            <span className="text-warm">Nog geen bestand bij dit logo.</span>
                          ) : (
                            <div className="flex flex-wrap gap-3 py-1">
                              {bestanden.map((b) => (
                                <BestandPreview key={b.sleutel} bestand={b} logoNaam={l.naam} />
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="text-warm">{l.opmerkingen || '-'}</td>
                        <td>
                          <form action={verwijderLogoActie}>
                            <input type="hidden" name="orgId" value={gekozen} />
                            <input type="hidden" name="logoId" value={l.id} />
                            <ConfirmSubmit message="Dit logo verwijderen?" className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">Verwijderen</ConfirmSubmit>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
