import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar, getHuidigeAdmin } from '@/lib/kms/adminClient';
import { env, isEmailConfigured } from '@/lib/env';
import { getCampagneInstellingen } from '@/lib/kms/campagneInstellingen';
import { campagneModelV2 } from '@/lib/kms/campagne-engine';
import { bewaarCampagneInstellingenActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Campagne-instellingen', robots: { index: false, follow: false } };

export default async function CampagneInstellingenPagina({ searchParams }: { searchParams: Promise<{ melding?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { melding } = await searchParams;
  const [inst, v2, admin] = await Promise.all([getCampagneInstellingen(), campagneModelV2(), getHuidigeAdmin().catch(() => null)]);
  const afzenderAdres = (env.campagneFrom || env.resendFrom).match(/<([^>]+)>/)?.[1] ?? (env.campagneFrom || env.resendFrom);

  return (
    <main className="container-smal pb-16">
      <div className="dash-kop gap-3">
        <Link href="/dashboard/campagnes" className="knop-tekst px-1.5" aria-label="Terug naar campagnes">
          ←
        </Link>
        <h1 className="dash-h1">Campagne-instellingen</h1>
      </div>
      {melding && <p className="mt-3 rounded-md border border-line bg-mist px-4 py-2 text-[13px]">{melding}</p>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form action={bewaarCampagneInstellingenActie} className="panel flex flex-col gap-4 p-5">
          <div>
            <label className="veld-label" htmlFor="ci-limiet">Maximaal aantal mails per dag</label>
            <input id="ci-limiet" name="dagLimiet" type="number" min={1} max={2000} defaultValue={inst.dagLimiet} className="veld w-32" />
            <p className="veld-hint">Over alle campagnes samen. Begin laag (40 tot 60) met een nieuw afzenderdomein en bouw rustig op; zo blijf je uit de spambox. Wat over de limiet gaat, schuift door naar de volgende werkdag.</p>
          </div>
          <div>
            <label className="veld-label" htmlFor="ci-naam">Standaard afzendernaam</label>
            <input id="ci-naam" name="afzenderNaam" defaultValue={inst.afzenderNaam} className="veld" />
            <p className="veld-hint">Komt voor het adres {afzenderAdres}, tenzij een campagne een eigen afzender heeft. Een naam van een mens werkt beter dan een bedrijfsnaam.</p>
          </div>
          <div>
            <label className="veld-label" htmlFor="ci-test">Adres voor testmails</label>
            <input id="ci-test" name="testadres" type="email" defaultValue={inst.testadres} placeholder={admin?.email ?? 'jij@frederiksbedrijfskleding.nl'} className="veld" />
            <p className="veld-hint">Leeg = het adres waarmee je bent ingelogd{admin?.email ? ` (${admin.email})` : ''}.</p>
          </div>
          <div>
            <label className="veld-label" htmlFor="ci-review">Link naar je Google-reviews</label>
            <input id="ci-review" name="reviewlink" type="url" defaultValue={inst.reviewlink} placeholder="https://g.page/r/..." className="veld" />
            <p className="veld-hint">Voor {'{{reviewlink}}'} in de mail &ldquo;Review vragen na levering&rdquo;. Te vinden in je Google Bedrijfsprofiel onder &ldquo;Vraag om reviews&rdquo;.</p>
          </div>
          <label className="flex items-start gap-2 rounded-md border border-line px-3 py-2 text-[13px] text-ink-800">
            <input type="checkbox" name="allesGepauzeerd" defaultChecked={inst.allesGepauzeerd} className="mt-0.5 h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
            <span>
              <strong>Alles pauzeren.</strong> Geen mails, geen stappen, geen nieuwe inschrijvingen via triggers. Iedereen blijft staan waar hij staat.
            </span>
          </label>
          <button type="submit" className="knop-primair self-start">
            Opslaan
          </button>
        </form>

        <aside className="flex flex-col gap-4 text-[13px]">
          <div className="panel p-4">
            <h2 className="text-[14px] font-bold text-ink-900">Hoe de verzending werkt</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-ink-700">
              <li>Eén keer per werkdag, rond 11:00 (Vercel-cron, Hobby-plan). Wachttijden in uren gaan in bij de eerstvolgende run daarna.</li>
              <li>Iemand krijgt hooguit één campagnemail per dag, ook als hij in meerdere campagnes zit.</li>
              <li>Elke mail heeft onderaan je adres en een afmeldlink. Afgemelde adressen komen op de afmeldlijst en krijgen niets meer, ook geen nieuwsbrief.</li>
              <li>Antwoorden komen gewoon in je inbox. Zet de ontvanger dan op &ldquo;heeft gereageerd&rdquo;, dan stopt de campagne voor hem als dat het doel is.</li>
            </ul>
          </div>
          <div className="panel p-4">
            <h2 className="text-[14px] font-bold text-ink-900">Status</h2>
            <dl className="mt-2 space-y-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-warm">Mail (Resend)</dt>
                <dd className={isEmailConfigured ? 'font-semibold text-green-700' : 'font-semibold text-amber-800'}>{isEmailConfigured ? 'Ingesteld' : 'Nog niet ingesteld'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-warm">Cron-geheim</dt>
                <dd className={env.cronSecret ? 'font-semibold text-green-700' : 'font-semibold text-amber-800'}>{env.cronSecret ? 'Ingesteld' : 'Ontbreekt'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-warm">Database bijgewerkt</dt>
                <dd className={v2 ? 'font-semibold text-green-700' : 'font-semibold text-amber-800'}>{v2 ? 'Ja' : 'Migratie nodig'}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </main>
  );
}
