import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { getBoekhouderEmail } from '@/lib/kms/facturen';
import { zetBoekhouderActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Instellingen', robots: { index: false, follow: false } };

const inputCls = 'veld';

/** Elk onderdeel met eigen instellingen heeft een eigen pagina; hier staan ze bij elkaar. */
const INSTELLING_KAARTEN = [
  { titel: 'Boekhouding', tekst: 'Koppeling met Moneybird: facturen doorzetten, betalingen terughalen, standaard grootboek. Plus export naar andere pakketten.', href: '/dashboard/instellingen/boekhouding', knop: 'Naar boekhouding' },
  { titel: 'Maten en kleuren', tekst: 'De vaste lijst met kleuren (met kleurcode en aliassen) en maatreeksen, plus de tool om afwijkende waarden op te schonen.', href: '/dashboard/instellingen/varianten', knop: 'Naar maten en kleuren' },
  { titel: 'Service: retouren en klachten', tekst: 'Retourtermijn (ook per klant), voorwaarden, retouradres, retourredenen, reparaties, klachtcategorieën en streefreactietijden.', href: '/dashboard/instellingen/service', knop: 'Naar service' },
  { titel: 'API en HR-koppeling', tekst: 'Klanten laten hun HR-systeem nieuwe en vertrokken medewerkers doorgeven. Uitleg, voorbeelden en foutcodes; sleutels maak je per klant onder Koppelingen.', href: '/dashboard/instellingen/api', knop: 'Naar de uitleg' },
  { titel: 'Taken en afspraken', tekst: 'Statussen, personen en de dag- en weekoverzichten per mail.', href: '/dashboard/taken/instellingen', knop: 'Naar taken' },
  { titel: 'Campagnes', tekst: 'Daglimiet voor mails, testadres, reviewlink en alles pauzeren.', href: '/dashboard/campagnes/instellingen', knop: 'Naar campagnes' },
  { titel: 'Sparen', tekst: 'Puntwaarde, vervaltermijn en de standaardinstellingen van het spaarprogramma.', href: '/dashboard/sparen/instellingen', knop: 'Naar sparen' },
  { titel: 'Beheerders', tekst: 'Wie mag inloggen in het dashboard, met welke rol.', href: '/dashboard/admins', knop: 'Naar beheerders' },
  { titel: 'Beveiliging', tekst: 'Tweestapsverificatie met een app op je telefoon en hoe lang je nog ingelogd bent.', href: '/dashboard/beveiliging', knop: 'Naar beveiliging' },
  { titel: 'Logboek', tekst: 'Wie wat heeft gewijzigd, met de oude en de nieuwe waarde.', href: '/dashboard/audit', knop: 'Naar het logboek' },
  { titel: 'KMS als app', tekst: 'Het KMS op je telefoon, tablet of computer zetten, en de uitleglink voor klanten die het portaal als app willen.', href: '/dashboard/app', knop: 'Naar de uitleg' },
];

export default async function InstellingenPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();

  const { ok } = await searchParams;
  const boekhouderEmail = await getBoekhouderEmail();

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Instellingen</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Hier beheer je de instellingen die over meerdere modules verspreid stonden, op één plek bij elkaar.</p>

      {ok === 'boekhouder' && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">E-mailadres van de boekhouder opgeslagen.</p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Boekhouder */}
        <div className="panel p-4">
          <h2 className="font-display text-lg font-bold text-ink-900">Boekhouder</h2>
          <p className="mt-1 text-xs text-warm">Facturen worden naar dit adres gemaild.</p>
          <form action={zetBoekhouderActie} className="mt-4 flex flex-col gap-3">
            <div>
              <label htmlFor="boekhouder_email" className="block text-xs font-semibold text-warm">E-mailadres boekhouder</label>
              <input
                id="boekhouder_email"
                name="email"
                type="email"
                defaultValue={boekhouderEmail}
                placeholder="boekhouder@voorbeeld.nl"
                className={inputCls}
              />
            </div>
            <button type="submit" className="self-start knop-donker">Opslaan</button>
          </form>
        </div>

        <div className="lg:col-span-2">
          <h2 className="mt-2 font-display text-lg font-bold text-ink-900">Vaste lijsten en onderdelen</h2>
          <p className="mt-1 text-xs text-warm">Instellingen die het hele systeem gebruikt. Zo blijft de data overal hetzelfde.</p>
        </div>
        {INSTELLING_KAARTEN.map((k) => (
          <div key={k.href} className="panel flex flex-col p-4">
            <h3 className="font-display text-base font-bold text-ink-900">{k.titel}</h3>
            <p className="mt-1 flex-1 text-xs text-warm">{k.tekst}</p>
            <Link href={k.href} className="mt-4 inline-block self-start knop-donker">{k.knop}</Link>
          </div>
        ))}
      </div>
    </main>
  );
}
