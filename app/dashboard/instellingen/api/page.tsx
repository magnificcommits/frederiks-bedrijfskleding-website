import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { site } from '@/content/site';
import { API_LIMIET_PER_MINUUT } from '@/lib/api/v1';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Instellingen: API en HR-koppeling', robots: { index: false, follow: false } };

const BASIS = `${site.url}/api/v1`;

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-md bg-ink-900 p-3 font-mono text-[12px] leading-relaxed text-white">
      <code>{children}</code>
    </pre>
  );
}

const ENDPOINTS: { methode: string; pad: string; wat: string }[] = [
  { methode: 'GET', pad: '/medewerkers', wat: 'Alle medewerkers van de klant. Filters: status=in_dienst|uit_dienst|alle, gewijzigd_sinds, limit (max 500), offset.' },
  { methode: 'GET', pad: '/medewerkers/{personeelsnummer}', wat: 'Eén medewerker.' },
  { methode: 'POST', pad: '/medewerkers', wat: 'In dienst. Bestaat het personeelsnummer of e-mailadres al, dan werken we bij in plaats van dubbel aan te maken.' },
  { methode: 'PATCH', pad: '/medewerkers/{personeelsnummer}', wat: 'Gegevens wijzigen: naam, e-mail, afdeling, functie, startdatum of een nieuw personeelsnummer.' },
  { methode: 'POST', pad: '/medewerkers/{personeelsnummer}/uitdienst', wat: 'Uit dienst per einddatum (standaard vandaag). We verwijderen niets.' },
];

const FOUTEN: { code: number; wanneer: string }[] = [
  { code: 400, wanneer: 'Geen of ongeldige JSON meegestuurd.' },
  { code: 401, wanneer: 'Geen sleutel, of de sleutel bestaat niet (meer).' },
  { code: 403, wanneer: 'De sleutel mag dit niet (bijvoorbeeld een alleen-lezen-sleutel die wil schrijven).' },
  { code: 404, wanneer: 'Geen medewerker met dit personeelsnummer bij deze klant.' },
  { code: 409, wanneer: 'Conflict, bijvoorbeeld een e-mailadres dat al bij een ander personeelsnummer hoort.' },
  { code: 422, wanneer: 'Velden kloppen niet; in details staat per veld wat er mis is.' },
  { code: 429, wanneer: `Meer dan ${API_LIMIET_PER_MINUUT} verzoeken per minuut met dezelfde sleutel. Wacht het aantal seconden uit Retry-After.` },
];

export default async function ApiInstellingenPage() {
  if (!(await dashAuthed())) redirect('/dashboard');

  return (
    <main className="container-smal py-6">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/instellingen" className="knop-tekst" aria-label="Terug naar instellingen">‹ Instellingen</Link>
          <h1 className="dash-h1">API en HR-koppeling</h1>
        </div>
        <Link href="/dashboard/klanten" className="knop-stil">Naar klanten</Link>
      </div>

      <section className="panel mt-6 p-5">
        <h2 className="font-display text-lg font-bold text-ink-900">Waarvoor</h2>
        <p className="mt-2 max-w-3xl text-[13px] text-ink-800">
          Grotere klanten (vanaf zo&apos;n 75 medewerkers) kunnen hun HR-systeem nieuwe en vertrokken medewerkers automatisch laten doorgeven.
          Dan klopt het kledingpakket en het budget meteen, zonder dat iemand een lijstje hoeft te mailen. Bij elke in- of uitdienst komt er
          een taak voor Jessi (&ldquo;Nieuwe medewerker bij &hellip;: pakket klaarzetten&rdquo; of &ldquo;Uit dienst: kleding innemen&rdquo;).
        </p>
        <ol className="mt-3 max-w-3xl list-decimal space-y-1 pl-5 text-[13px] text-ink-800">
          <li>Open de klant en ga naar het tabblad <span className="font-semibold">Koppelingen</span>.</li>
          <li>Maak een sleutel aan met een herkenbare naam (bijvoorbeeld &ldquo;AFAS HR&rdquo;). Je ziet hem één keer: kopieer hem en geef hem veilig door.</li>
          <li>De klant of hun HR-leverancier zet de sleutel in de koppeling. Elke sleutel hoort bij precies één klant en ziet alleen diens medewerkers.</li>
          <li>Klopt er iets niet of vertrekt de leverancier: trek de sleutel in. Hij werkt dan direct niet meer.</li>
        </ol>
        <p className="mt-3 text-[13px] text-warm">Geen koppeling? Op hetzelfde tabblad importeer je een CSV-bestand met dezelfde kolommen, met eerst een voorvertoning.</p>
      </section>

      <section className="panel mt-6 p-5">
        <h2 className="font-display text-lg font-bold text-ink-900">Voor de ontwikkelaar</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-[10rem_1fr]">
          <dt className="font-semibold text-ink-900">Basis-URL</dt>
          <dd><code className="break-all font-mono text-[12px]">{BASIS}</code></dd>
          <dt className="font-semibold text-ink-900">Inloggen</dt>
          <dd>Header <code className="font-mono text-[12px]">Authorization: Bearer fb_live_…</code>. We bewaren alleen een hash van de sleutel.</dd>
          <dt className="font-semibold text-ink-900">Formaat</dt>
          <dd>JSON in en uit, UTF-8. Datums als <code className="font-mono text-[12px]">JJJJ-MM-DD</code>.</dd>
          <dt className="font-semibold text-ink-900">Limiet</dt>
          <dd>{API_LIMIET_PER_MINUUT} verzoeken per minuut per sleutel. Elk verzoek komt in het logboek van de klant.</dd>
          <dt className="font-semibold text-ink-900">Sleutel van</dt>
          <dd>Het personeelsnummer. Zonder personeelsnummer werkt aanmelden ook met alleen een e-mailadres, maar wijzigen en uit dienst gaan via het nummer.</dd>
        </dl>

        <h3 className="mt-5 font-display text-base font-bold text-ink-900">Endpoints</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Methode</th><th>Pad</th><th>Wat</th></tr></thead>
            <tbody>
              {ENDPOINTS.map((e) => (
                <tr key={`${e.methode}${e.pad}`}>
                  <td className="whitespace-nowrap font-mono text-[12px] font-semibold">{e.methode}</td>
                  <td className="whitespace-nowrap font-mono text-[12px]">{e.pad}</td>
                  <td className="text-[13px]">{e.wat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-5 font-display text-base font-bold text-ink-900">Nieuwe medewerker in dienst</h3>
        <Code>{`curl -X POST ${BASIS}/medewerkers \\
  -H "Authorization: Bearer fb_live_JOUW_SLEUTEL" \\
  -H "Content-Type: application/json" \\
  -d '{
    "naam": "Sanne de Vries",
    "email": "sanne.devries@klant.nl",
    "personeelsnummer": "1001",
    "afdeling": "Werkplaats",
    "functie": "Monteur",
    "startdatum": "2026-11-01"
  }'`}</Code>
        <p className="mt-2 text-[13px] text-warm">
          Antwoord <code className="font-mono">201</code> bij een nieuwe medewerker, <code className="font-mono">200</code> als hij al bestond (dan staat in
          <code className="font-mono"> resultaat</code> &ldquo;bijgewerkt&rdquo;, &ldquo;ongewijzigd&rdquo; of &ldquo;weer_in_dienst&rdquo;). Hetzelfde verzoek twee keer sturen is dus veilig.
          Een afdeling die bij ons nog niet bestaat, staat als waarschuwing in het antwoord.
        </p>
        <Code>{`{
  "resultaat": "aangemaakt",
  "medewerker": {
    "personeelsnummer": "1001",
    "naam": "Sanne de Vries",
    "email": "sanne.devries@klant.nl",
    "afdeling": "Werkplaats",
    "functie": "Monteur",
    "startdatum": "2026-11-01",
    "einddatum": null,
    "status": "in_dienst",
    "bron": "api",
    "bijgewerkt_op": "2026-10-05T08:12:44.120Z"
  }
}`}</Code>

        <h3 className="mt-5 font-display text-base font-bold text-ink-900">Gegevens wijzigen</h3>
        <Code>{`curl -X PATCH ${BASIS}/medewerkers/1001 \\
  -H "Authorization: Bearer fb_live_JOUW_SLEUTEL" \\
  -H "Content-Type: application/json" \\
  -d '{ "afdeling": "Buitendienst", "functie": "Servicemonteur" }'`}</Code>

        <h3 className="mt-5 font-display text-base font-bold text-ink-900">Uit dienst</h3>
        <Code>{`curl -X POST ${BASIS}/medewerkers/1001/uitdienst \\
  -H "Authorization: Bearer fb_live_JOUW_SLEUTEL" \\
  -H "Content-Type: application/json" \\
  -d '{ "einddatum": "2026-12-31" }'`}</Code>
        <p className="mt-2 text-[13px] text-warm">
          Tot de einddatum heeft de medewerker de status <code className="font-mono">uit_dienst_gepland</code>; daarna <code className="font-mono">uit_dienst</code> en staat hij op niet-actief.
        </p>

        <h3 className="mt-5 font-display text-base font-bold text-ink-900">Lijst opvragen</h3>
        <Code>{`curl "${BASIS}/medewerkers?status=in_dienst&limit=100&offset=0" \\
  -H "Authorization: Bearer fb_live_JOUW_SLEUTEL"`}</Code>

        <h3 className="mt-5 font-display text-base font-bold text-ink-900">Fouten</h3>
        <p className="mt-1 text-[13px] text-warm">Altijd in dezelfde vorm:</p>
        <Code>{`{
  "fout": {
    "code": "ongeldige_invoer",
    "bericht": "Niet alle velden kloppen.",
    "details": [{ "veld": "startdatum", "bericht": "Gebruik het formaat JJJJ-MM-DD, bijvoorbeeld 2026-11-01." }]
  }
}`}</Code>
        <div className="mt-2 overflow-x-auto">
          <table className="tbl">
            <thead><tr><th className="num">Status</th><th>Wanneer</th></tr></thead>
            <tbody>
              {FOUTEN.map((f) => (
                <tr key={f.code}><td className="num font-mono text-[12px]">{f.code}</td><td className="text-[13px]">{f.wanneer}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
