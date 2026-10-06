import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import { getSpaarInstellingenUitgebreid, listRegels, loyaliteitActief } from '@/lib/kms/sparenData';
import { synchroniseerActie, zetSparenInstellingenActie } from '../actions';
import { JaNee, Meldingen, MigratieBanner, euro2 } from '../_ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sparen: instellingen', robots: { index: false, follow: false } };

const PAD = '/dashboard/sparen/instellingen';

export default async function SparenInstellingen({ searchParams }: { searchParams: Promise<{ fout?: string; melding?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { fout, melding } = await searchParams;
  const [inst, { regels }, loyaliteit] = await Promise.all([getSpaarInstellingenUitgebreid(), listRegels(), loyaliteitActief()]);
  const basisRegel = regels.find((r) => r.soort === 'per_euro' && r.systeem) ?? regels.find((r) => r.soort === 'per_euro');
  const pct = (basisRegel?.factor ?? inst.puntenPerEuro) * inst.euroPerPunt * 100;

  return (
    <div className="pt-5">
      <Meldingen fout={fout} melding={melding} />
      <MigratieBanner toon={!loyaliteit} />

      <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <form action={zetSparenInstellingenActie} className="panel space-y-5 p-4 lg:col-span-2">
          <input type="hidden" name="terug" value={PAD} />
          <div>
            <h2 className="font-display text-base font-bold text-ink-900">Programma</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <JaNee naam="actief" label="Spaarprogramma aan" waarde={inst.actief} hint="Uit: geen nieuwe punten en niets zichtbaar in het portaal. Saldi blijven bewaard." />
              <div>
                <label className="veld-label" htmlFor="euro_per_punt">Waarde van 1 punt (euro)</label>
                <input id="euro_per_punt" name="euro_per_punt" type="number" min="0" step="0.001" defaultValue={inst.euroPerPunt} className="veld" />
                <p className="veld-hint">Gebruikt bij vrij inwisselen en voor de openstaande verplichting.</p>
              </div>
            </div>
            <p className="mt-3 rounded-md border border-line bg-mist px-3 py-2 text-[12px] text-ink-700">
              Met de basisregel van {(basisRegel?.factor ?? inst.puntenPerEuro).toLocaleString('nl-NL')} punt per euro geef je nu{' '}
              <strong>{pct.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}%</strong> terug. Bij 1.000 euro omzet is dat {euro2(10 * pct)} aan punten.{' '}
              <Link href="/dashboard/sparen/regels" className="font-semibold underline-offset-2 hover:underline">Punten per euro wijzigen</Link>
            </p>
          </div>

          <div className="border-t border-line pt-4">
            <h2 className="font-display text-base font-bold text-ink-900">Verval en niveaus</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="veld-label" htmlFor="verval">Punten vervallen na (maanden)</label>
                <input id="verval" name="verval_maanden" type="number" min="0" max="120" step="1" defaultValue={inst.vervalMaanden} className="veld" />
                <p className="veld-hint">0 is nooit. 24 maanden is gebruikelijk: lang genoeg voor bedrijven die één keer per jaar bestellen. Oudste punten vervallen eerst. Let op: dit geldt ook voor punten die er al staan; wat ouder is dan de termijn en nog niet is gebruikt, vervalt meteen.</p>
              </div>
              <div>
                <label className="veld-label" htmlFor="basis">Niveau bepalen op</label>
                <select id="basis" name="niveau_basis" defaultValue={inst.niveauBasis} className="veld">
                  <option value="omzet">Omzet in de laatste 12 maanden</option>
                  <option value="punten">Gespaarde punten in de laatste 12 maanden</option>
                </select>
                <p className="veld-hint">Omzet is het duidelijkst voor klanten. Punten telt ook reviews en aangebrachte klanten mee.</p>
              </div>
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <h2 className="font-display text-base font-bold text-ink-900">Klantportaal</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <JaNee naam="portaal_aanvragen" label="Beheerders mogen beloningen aanvragen" waarde={inst.portaalAanvragen} hint="Elke aanvraag wacht op jouw goedkeuring." />
              <div>
                <label className="veld-label" htmlFor="mail">Melding van nieuwe aanvragen naar</label>
                <input id="mail" name="melding_email" type="email" defaultValue={inst.meldingEmail} className="veld" />
                <p className="veld-hint">Lukt mailen niet (nog geen Resend), dan zie je de aanvraag gewoon onder Inwisselingen.</p>
              </div>
              <div className="sm:col-span-2">
                <label className="veld-label" htmlFor="voorwaarden">Spelregels voor de klant</label>
                <textarea
                  id="voorwaarden"
                  name="voorwaarden"
                  rows={3}
                  maxLength={2000}
                  defaultValue={inst.voorwaarden}
                  className="veld"
                  placeholder="Bijv. Punten zijn niet inwisselbaar voor geld. Korting komt op de eerstvolgende factuur."
                />
              </div>
            </div>
          </div>

          <VerzendKnop className="knop-donker">Opslaan</VerzendKnop>
        </form>

        <div className="space-y-3">
          <section className="panel p-4">
            <h2 className="font-display text-base font-bold text-ink-900">Punten bijwerken</h2>
            <p className="mt-1 text-[13px] text-warm">
              Automatische punten worden geboekt zodra je een sparenpagina opent of een klant zijn portaal bekijkt. Wil je het nu forceren, bijvoorbeeld na het aanzetten van een regel met terugwerkende kracht?
            </p>
            <form action={synchroniseerActie} className="mt-3">
              <input type="hidden" name="terug" value={PAD} />
              <VerzendKnop className="knop-stil" bezigTekst="Bijwerken">Nu bijwerken</VerzendKnop>
            </form>
          </section>
          <section className="panel p-4 text-[13px] text-ink-700">
            <h2 className="font-display text-base font-bold text-ink-900">Welke orders tellen mee</h2>
            <p className="mt-1">Alle orders met een bedrag, behalve concepten en verstuurde offertes. Gaat een order terug naar concept, dan worden de punten automatisch teruggeboekt.</p>
          </section>
          <section className="panel p-4 text-[13px] text-ink-700">
            <h2 className="font-display text-base font-bold text-ink-900">Stand van de database</h2>
            <p className="mt-1">
              {loyaliteit
                ? 'Grootboek, regels, niveaus en beloningen zijn actief.'
                : 'De migratie 20261004_sparen_loyaliteit.sql is nog niet gedraaid. Saldo wordt berekend zoals vroeger: punten per euro min inwisselingen.'}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
