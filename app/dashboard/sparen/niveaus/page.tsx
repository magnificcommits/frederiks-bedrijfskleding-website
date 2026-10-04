import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import Drawer from '@/components/dashboard/Drawer';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import { berekenStanden, laadEnSynchroniseer } from '@/lib/kms/sparenGrootboek';
import { niveauVoordelen, type SpaarNiveau } from '@/lib/kms/sparenTypes';
import { slaNiveauOpActie, verwijderNiveauActie } from '../actions';
import { JaNee, Meldingen, MigratieBanner, NiveauBadge, euro0, getal } from '../_ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sparen: niveaus', robots: { index: false, follow: false } };

const PAD = '/dashboard/sparen/niveaus';

function NiveauVelden({ n, basis }: { n?: SpaarNiveau; basis: 'omzet' | 'punten' }) {
  return (
    <div className="space-y-4">
      <input type="hidden" name="terug" value={PAD} />
      {n && <input type="hidden" name="id" value={n.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="veld-label">Naam</label>
          <input name="naam" required maxLength={60} defaultValue={n?.naam ?? ''} className="veld" placeholder="Bijv. Platina" />
        </div>
        <div>
          <label className="veld-label">Vanaf ({basis === 'punten' ? 'punten' : 'euro omzet'} per 12 maanden)</label>
          <input name="drempel" type="number" min="0" step="1" required defaultValue={n?.drempel ?? ''} className="veld" />
        </div>
        <div>
          <label className="veld-label">Extra korting op kleding (%)</label>
          <input name="korting_pct" type="number" min="0" max="100" step="0.5" defaultValue={n?.kortingPct ?? 0} className="veld" />
          <p className="veld-hint">Wordt niet automatisch op orders gezet. Per klant kun je de klantkorting met één klik gelijk zetten.</p>
        </div>
        <div>
          <label className="veld-label">Extra punten per euro (%)</label>
          <input name="extra_punten_pct" type="number" min="0" max="500" step="5" defaultValue={n ? Math.round((n.puntenFactor - 1) * 100) : 0} className="veld" />
          <p className="veld-hint">25 betekent 25% meer punten op elke order.</p>
        </div>
        <JaNee naam="gratis_logo" label="Gratis logo borduren of bedrukken" waarde={n?.gratisLogo ?? false} />
        <JaNee naam="gratis_passen" label="Gratis passen op locatie" waarde={n?.gratisPassen ?? false} />
        <JaNee naam="voorrang" label="Voorrang in de planning" waarde={n?.voorrang ?? false} />
        <div>
          <label className="veld-label">Kleur van de badge</label>
          <select name="kleur" defaultValue={n?.kleur ?? ''} className="veld">
            <option value="">Neutraal</option>
            <option value="brons">Brons</option>
            <option value="zilver">Zilver</option>
            <option value="goud">Goud</option>
            <option value="platina">Platina</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="veld-label">Overige voordelen</label>
          <input name="extra_voordelen" maxLength={300} defaultValue={n?.extraVoordelen ?? ''} className="veld" placeholder="Bijv. vaste contactpersoon en twee keer per jaar een bezoek op locatie" />
        </div>
      </div>
      <VerzendKnop className="knop-donker">{n ? 'Opslaan' : 'Niveau toevoegen'}</VerzendKnop>
    </div>
  );
}

export default async function SparenNiveaus({ searchParams }: { searchParams: Promise<{ fout?: string; melding?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { fout, melding } = await searchParams;
  const b = await laadEnSynchroniseer();
  const basis = b.instellingen.niveauBasis;
  const standen = berekenStanden(b).filter((s) => s.aantalOrders > 0 || s.saldo !== 0);
  const niveaus = b.niveaus.slice().sort((a, c) => a.drempel - c.drempel);
  const kanBewerken = b.loyaliteit && b.niveausUitTabel;

  return (
    <div className="pt-5">
      <Meldingen fout={fout} melding={melding} />
      <MigratieBanner toon={!b.loyaliteit} />

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-warm">
          Het niveau hangt af van de {basis === 'punten' ? 'gespaarde punten' : 'omzet'} in de laatste 12 maanden, steeds opnieuw berekend. Bestelt een klant een jaar niets,
          dan zakt hij vanzelf terug. Dat houdt het eerlijk en geeft een reden om te blijven bestellen.{' '}
          <Link href="/dashboard/sparen/instellingen" className="font-semibold text-ink-800 underline-offset-2 hover:underline">Basis wijzigen</Link>
        </p>
        {kanBewerken && (
          <Drawer knop="Niveau toevoegen" titel="Nieuw niveau" breedte="sm:max-w-xl">
            <form action={slaNiveauOpActie}>
              <NiveauVelden basis={basis} />
            </form>
          </Drawer>
        )}
      </div>

      {niveaus.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-ink-200 bg-mist/60 px-4 py-6 text-[13px] text-warm">
          Er zijn nog geen niveaus. Zonder niveaus sparen alle klanten gelijk; voeg er een paar toe om grote klanten extra te belonen.
        </p>
      ) : (
        <ol className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {niveaus.map((n, i) => {
            const klanten = standen.filter((s) => s.niveau.huidig?.id === n.id);
            const volgende = niveaus[i + 1];
            const voordelen = niveauVoordelen(n);
            return (
              <li key={n.id} className="panel flex flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <NiveauBadge niveau={n} />
                  <Link href={`/dashboard/sparen/klanten?niveau=${encodeURIComponent(n.naam)}`} className="text-[12px] text-warm hover:text-ink-900">
                    {getal(klanten.length)} {klanten.length === 1 ? 'klant' : 'klanten'}
                  </Link>
                </div>
                <p className="mt-3 font-display text-xl font-bold tabular-nums text-ink-900">
                  {n.drempel === 0 ? 'Vanaf de eerste order' : basis === 'punten' ? `Vanaf ${getal(n.drempel)} punten` : `Vanaf ${euro0(n.drempel)}`}
                </p>
                <p className="text-[12px] text-warm">
                  {volgende ? `tot ${basis === 'punten' ? `${getal(volgende.drempel)} punten` : euro0(volgende.drempel)} per 12 maanden` : 'per 12 maanden, hoogste niveau'}
                </p>
                {voordelen.length > 0 ? (
                  <ul className="mt-3 flex-1 space-y-1 text-[13px] text-ink-800">
                    {voordelen.map((v) => (
                      <li key={v} className="flex gap-2"><span aria-hidden className="text-amber-600">&bull;</span>{v}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 flex-1 text-[13px] text-warm">Basisniveau, geen extra voordelen.</p>
                )}
                {kanBewerken && (
                  <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
                    <Drawer knop="Bewerken" titel={`Niveau ${n.naam}`} knopKlasse="knop-stil" breedte="sm:max-w-xl">
                      <form action={slaNiveauOpActie}>
                        <NiveauVelden n={n} basis={basis} />
                      </form>
                    </Drawer>
                    <form action={verwijderNiveauActie} className="ml-auto">
                      <input type="hidden" name="id" value={n.id} />
                      <input type="hidden" name="terug" value={PAD} />
                      <VerzendKnop className="knop-tekst text-red-700 hover:text-red-800">Verwijderen</VerzendKnop>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <section className="panel mt-6 p-4 text-[13px] text-ink-700">
        <h2 className="font-display text-base font-bold text-ink-900">Zo kun je niveaus inzetten</h2>
        <ul className="mt-2 space-y-1.5">
          <li>Leg de drempels bij wat een gemiddeld bedrijf van 10 en van 40 man per jaar besteedt. Dan weet je zeker dat de echte vaste klanten Goud halen.</li>
          <li>Gratis passen op locatie en voorrang kosten je weinig, maar voelen voor een klant als echte service. Bewaar korting voor het hoogste niveau.</li>
          <li>Kijk op het overzicht bij &quot;Zakt binnenkort een niveau&quot;. Dat is het beste moment om te bellen.</li>
        </ul>
      </section>
    </div>
  );
}
