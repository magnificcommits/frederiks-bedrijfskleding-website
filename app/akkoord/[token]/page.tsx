import type { Metadata } from 'next';
import OfferteDocument, { naarDocumentData } from '@/components/dashboard/OfferteDocument';
import { akkoordStaatVoorToken } from '@/lib/kms/offerteAkkoord';
import { klantAdresVoorDocument } from '@/lib/kms/documentKlant';
import { VOORWAARDEN_OFFERTE_TEKST, VOORWAARDEN_PDF } from '@/content/algemeneVoorwaarden';
import { site } from '@/content/site';
import { keurOfferteGoedActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Offerte goedkeuren', robots: { index: false, follow: false } };

const datumTijd = (s: string) =>
  new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(s));

const FOUTEN: Record<string, string> = {
  naam: 'Vul je naam in.',
  vinkje: 'Vink aan dat je akkoord gaat met de offerte en de algemene voorwaarden.',
  email: 'Dit e-mailadres klopt niet. Laat het leeg of vul een geldig adres in.',
  'te-vaak': 'Te veel pogingen. Probeer het over een kwartier opnieuw, of bel ons.',
  opslaan: 'Het goedkeuren is niet gelukt. Probeer het nog een keer, of bel ons.',
  al: 'Deze offerte is al goedgekeurd.',
  afgewezen: 'Deze offerte staat niet meer open.',
  verlopen: 'Deze offerte is verlopen.',
  onbekend: 'Deze link werkt niet (meer).',
};

function Melding({ kleur, children }: { kleur: 'groen' | 'rood' | 'grijs'; children: React.ReactNode }) {
  const cls = kleur === 'groen' ? 'border-green-200 bg-green-50 text-green-800' : kleur === 'rood' ? 'border-red-200 bg-red-50 text-red-700' : 'border-line bg-mist text-ink-800';
  return <div className={`rounded-xl border px-5 py-4 text-[15px] ${cls}`}>{children}</div>;
}

export default async function OfferteAkkoordPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ ok?: string; fout?: string }>;
}) {
  const { token } = await params;
  const { ok, fout } = await searchParams;
  const staat = await akkoordStaatVoorToken(token);

  if (staat.staat === 'onbekend') {
    return (
      <main className="container-x sec-md">
        <div className="mx-auto max-w-md">
          <Melding kleur="grijs">
            <p className="font-display text-lg font-bold text-ink-900">Offerte niet gevonden</p>
            <p className="mt-2 text-warm">Deze link werkt niet (meer). Bel ons op {site.phone} of mail naar {site.email}.</p>
          </Melding>
        </div>
      </main>
    );
  }

  const { offerte } = staat;
  const klantAdres = await klantAdresVoorDocument(offerte.organisatie_id);
  const nummer = offerte.offertenummer != null ? `${offerte.offertenummer}` : '';

  return (
    <main className="bg-mist/60 py-10 sm:py-14">
      <div className="container-x">
        <div className="mx-auto max-w-[210mm]">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Offerte {nummer}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-ink-900">
            {staat.staat === 'goedgekeurd' ? 'Offerte goedgekeurd' : 'Offerte bekijken en goedkeuren'}
          </h1>

          <div className="mt-5 space-y-3">
            {ok === '1' && staat.staat === 'goedgekeurd' && (
              <Melding kleur="groen">
                <p className="font-semibold">Bedankt, je akkoord is ontvangen.</p>
                <p className="mt-1">Je krijgt een bevestiging per mail. We nemen contact met je op om de passessie te plannen.</p>
              </Melding>
            )}
            {staat.staat === 'goedgekeurd' && ok !== '1' && (
              <Melding kleur="groen">
                Deze offerte is goedgekeurd{staat.akkoord ? ` door ${staat.akkoord.naam} op ${datumTijd(staat.akkoord.akkoord_op)}` : ''}.
              </Melding>
            )}
            {staat.staat === 'verlopen' && (
              <Melding kleur="grijs">Deze offerte is verlopen. Bel ons op {site.phone} of mail naar {site.email}, dan maken we een nieuwe.</Melding>
            )}
            {staat.staat === 'afgewezen' && (
              <Melding kleur="grijs">Deze offerte staat niet meer open. Vragen? Bel {site.phone} of mail {site.email}.</Melding>
            )}
            {fout && FOUTEN[fout] && staat.staat === 'open' && <Melding kleur="rood">{FOUTEN[fout]}</Melding>}
          </div>

          <article className="mt-6 overflow-x-auto rounded-lg bg-white p-5 shadow-card sm:p-[14mm]">
            <div className="min-w-[640px]">
              <OfferteDocument offerte={{ ...naarDocumentData(offerte), klant_adres: klantAdres }} toonAkkoord={false} />
            </div>
          </article>

          {staat.staat === 'open' && (
            <form action={keurOfferteGoedActie} className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-soft sm:p-8">
              <input type="hidden" name="token" value={token} />
              <h2 className="font-display text-xl font-bold text-ink-900">Akkoord geven</h2>
              <p className="mt-2 text-[15px] text-warm">
                Vul je gegevens in en keur de offerte goed. Je akkoord wordt met datum en tijd vastgelegd en je krijgt een bevestiging per mail.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="naam" className="veld-label">Je naam</label>
                  <input id="naam" name="naam" required minLength={2} maxLength={120} autoComplete="name" defaultValue={offerte.contact?.naam || offerte.contactpersoon || ''} className="veld py-2.5 text-[15px]" />
                </div>
                <div>
                  <label htmlFor="functie" className="veld-label">Functie (niet verplicht)</label>
                  <input id="functie" name="functie" maxLength={120} autoComplete="organization-title" className="veld py-2.5 text-[15px]" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="email" className="veld-label">E-mail voor de bevestiging</label>
                  <input id="email" name="email" type="email" maxLength={254} autoComplete="email" defaultValue={offerte.contact?.email ?? ''} className="veld py-2.5 text-[15px]" />
                </div>
              </div>
              <label className="mt-5 flex items-start gap-3 text-[15px] text-ink-800">
                <input type="checkbox" name="akkoord" value="ja" required className="mt-1 h-5 w-5 shrink-0 accent-amber-600" />
                <span>
                  Ik ga namens {offerte.organisatie_naam || 'mijn organisatie'} akkoord met deze offerte en met de{' '}
                  <a href={VOORWAARDEN_PDF} target="_blank" rel="noreferrer" className="font-semibold text-amber-700 underline underline-offset-2">
                    algemene voorwaarden
                  </a>{' '}
                  van Frederiks Bedrijfskleding, die ik heb ontvangen.
                </span>
              </label>
              <p className="mt-3 text-[13px] text-warm">{VOORWAARDEN_OFFERTE_TEKST}</p>
              <button type="submit" className="mt-6 w-full rounded-lg bg-ink-900 px-5 py-3.5 text-[15px] font-bold text-white hover:bg-ink-800 sm:w-auto">
                Offerte goedkeuren
              </button>
              <p className="mt-4 text-[13px] text-warm">Eerst iets bespreken? Bel {site.phone} of mail {site.email}.</p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
