import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar, kmsAdmin } from '@/lib/kms/adminClient';
import KpiTegel from '@/components/dashboard/overzicht/KpiTegel';
import LegeStaat from '@/components/dashboard/overzicht/LegeStaat';
import { berekenStanden, berekenStatistiek, laadEnSynchroniseer } from '@/lib/kms/sparenGrootboek';
import type { KlantSpaarStand } from '@/lib/kms/sparenTypes';
import SpaarGrafiek from './SpaarGrafiek';
import { Meldingen, MigratieBanner, NiveauBadge, NiveauVoortgang, UitBanner, datumKort, euro0, getal } from './_ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sparen', robots: { index: false, follow: false } };

async function telefoons(ids: string[]): Promise<Record<string, string>> {
  const sb = kmsAdmin();
  if (!sb || ids.length === 0) return {};
  const { data } = await sb.from('organisaties').select('id, telefoon, mobiel, contactpersoon').in('id', ids);
  const uit: Record<string, string> = {};
  ((data as { id: string; telefoon: string | null; mobiel: string | null; contactpersoon: string | null }[]) ?? []).forEach((r) => {
    const nr = r.telefoon || r.mobiel;
    if (nr) uit[r.id] = r.contactpersoon ? `${r.contactpersoon}, ${nr}` : nr;
  });
  return uit;
}

export default async function SparenOverzicht({ searchParams }: { searchParams: Promise<{ fout?: string; melding?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { fout, melding } = await searchParams;

  const b = await laadEnSynchroniseer();
  const standen = berekenStanden(b);
  const stat = berekenStatistiek(b, standen);
  const basis = b.instellingen.niveauBasis;

  const actief = standen.filter((s) => s.aantalOrders > 0 || s.saldo !== 0);
  const top = [...actief].sort((a, c) => c.saldo - a.saldo).filter((s) => s.saldo > 0).slice(0, 6);
  const maxTop = Math.max(1, ...top.map((t) => t.saldo));
  const bijna = actief
    .filter((s) => s.niveau.volgende && s.niveau.voortgang >= 0.7)
    .sort((a, c) => a.niveau.nogTeGaan - c.niveau.nogTeGaan)
    .slice(0, 6);
  const zakt = actief
    .filter((s) => s.niveau.huidig && (s.niveau.straks?.drempel ?? -1) < s.niveau.huidig.drempel)
    .slice(0, 6);
  const vervalt = actief.filter((s) => s.vervaltBinnenkort > 0).sort((a, c) => c.vervaltBinnenkort - a.vervaltBinnenkort).slice(0, 6);
  const tel = await telefoons([...bijna, ...zakt].map((s) => s.organisatieId));

  const verdeling = b.niveaus
    .slice()
    .sort((a, c) => a.drempel - c.drempel)
    .map((n) => ({ niveau: n, aantal: actief.filter((s) => s.niveau.huidig?.id === n.id).length }));
  const totaalVerdeling = Math.max(1, verdeling.reduce((s, v) => s + v.aantal, 0));

  const sparkLabels = stat.maanden.map((m) => m.label);
  const deltaVorig = (nu: number, vorige: number) => ({ nu, vorige, richting: 'hoger-beter' as const, vergelijk: 'jaar ervoor' });

  return (
    <div className="pt-5">
      <Meldingen fout={fout} melding={melding} />
      <UitBanner actief={b.instellingen.actief} />
      <MigratieBanner toon={!b.loyaliteit} />

      {stat.openAanvragen > 0 && (
        <Link
          href="/dashboard/sparen/inwisselingen?status=aangevraagd"
          className="mt-4 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900 hover:bg-amber-100"
        >
          <span>
            <span className="font-semibold">{stat.openAanvragen} {stat.openAanvragen === 1 ? 'aanvraag wacht' : 'aanvragen wachten'}</span> op goedkeuring
          </span>
          <span aria-hidden>&rarr;</span>
        </Link>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTegel
          label="Actieve spaarders"
          waarde={getal(stat.actieveSpaarders)}
          href="/dashboard/sparen/klanten"
          delta={deltaVorig(stat.actieveSpaarders, stat.actieveSpaardersVorig)}
          sub={<span className="text-warm">Klanten die de laatste 12 maanden punten spaarden</span>}
        />
        <KpiTegel
          label="Punten uitgegeven, 12 mnd"
          waarde={getal(stat.uitgegeven12m)}
          href="/dashboard/sparen/klanten"
          delta={deltaVorig(stat.uitgegeven12m, stat.uitgegevenVorig12m)}
          spark={{ waarden: stat.maanden.map((m) => m.bijgeboekt), labels: sparkLabels, omschrijving: 'Punten gespaard per maand' }}
        />
        <KpiTegel
          label="Ingewisseld, 12 mnd"
          waarde={getal(stat.ingewisseld12m)}
          href="/dashboard/sparen/inwisselingen"
          delta={deltaVorig(stat.ingewisseld12m, stat.ingewisseldVorig12m)}
          spark={{ waarden: stat.maanden.map((m) => m.ingewisseld), labels: sparkLabels, omschrijving: 'Punten ingewisseld per maand' }}
          sub={<span className="text-warm">Samen {euro0(stat.ingewisseldEuro12m)} aan beloningen</span>}
        />
        <KpiTegel
          label="Openstaande puntenverplichting"
          waarde={euro0(stat.openEuro)}
          href="/dashboard/sparen/klanten?sort=saldo"
          sub={
            <span className="text-warm">
              {getal(stat.openSaldo)} punten nog in te wisselen
              {stat.gereserveerd > 0 && <>, waarvan {getal(stat.gereserveerd)} al aangevraagd</>}
            </span>
          }
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SpaarGrafiek maanden={stat.maanden} euroPerPunt={b.instellingen.euroPerPunt} />
        </div>
        <section className="panel flex flex-col p-4" aria-labelledby="top-spaarders">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 id="top-spaarders" className="font-display text-base font-bold text-ink-900">Grootste saldo</h2>
              <p className="mt-0.5 text-[12px] text-warm">Wie heeft het meeste nog te goed</p>
            </div>
            <Link href="/dashboard/sparen/klanten?sort=saldo" className="knop-tekst">Alle klanten</Link>
          </div>
          {top.length === 0 ? (
            <div className="mt-3 flex-1">
              <LegeStaat titel="Nog niemand met punten" tekst="Punten komen vanzelf binnen op orders met een bedrag. Je kunt ook handmatig punten bijboeken bij een klant." actieHref="/dashboard/sparen/klanten" actieLabel="Naar klanten" />
            </div>
          ) : (
            <ol className="mt-3 space-y-2.5">
              {top.map((k, i) => (
                <li key={k.organisatieId}>
                  <Link href={`/dashboard/sparen/klanten/${k.organisatieId}`} className="group -mx-2 block rounded-md px-2 py-1 hover:bg-mist">
                    <span className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="w-3 shrink-0 text-[11px] tabular-nums text-ink-400">{i + 1}</span>
                        <span className="truncate font-medium text-ink-900 group-hover:underline">{k.naam}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-ink-900">
                        {getal(k.saldo)}
                        <span className="ml-1.5 text-[11px] text-ink-400">{euro0(k.euroWaarde)}</span>
                      </span>
                    </span>
                    <span className="ml-5 mt-1 block h-1.5 overflow-hidden rounded-full bg-mist">
                      <span className={`block h-full rounded-full ${i === 0 ? 'bg-amber-500' : 'bg-ink-700'}`} style={{ width: `${Math.max(3, (k.saldo / maxTop) * 100)}%` }} />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <h2 className="mt-8 font-display text-base font-bold text-ink-900">Kansen om te bellen</h2>
      <p className="mt-0.5 text-[12px] text-warm">Een telefoontje op het juiste moment doet meer dan een mailing.</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <KansBlok
          titel="Bijna een niveau hoger"
          uitleg="Met één bestelling zijn ze er. Goed moment om te vragen of er nog iemand nieuwe kleding nodig heeft."
          leeg="Niemand zit nu vlak onder het volgende niveau."
          rijen={bijna}
          tel={tel}
          rechts={(s) => <NiveauVoortgang stand={s.niveau} basis={basis} compact />}
        />
        <KansBlok
          titel="Zakt binnenkort een niveau"
          uitleg="Over 60 dagen vallen oude orders buiten de 12 maanden. Zonder nieuwe bestelling gaan ze omlaag."
          leeg="Geen klanten die binnenkort een niveau zakken."
          rijen={zakt}
          tel={tel}
          rechts={(s) => (
            <span className="text-[11px] text-warm">
              {s.niveau.huidig?.naam} &rarr; {s.niveau.straks?.naam ?? 'geen'}
            </span>
          )}
        />
        <KansBlok
          titel="Punten vervallen binnenkort"
          uitleg="Binnen 60 dagen. Herinner ze eraan, dan worden de punten alsnog gebruikt."
          leeg={b.instellingen.vervalMaanden > 0 ? 'Er vervallen de komende 60 dagen geen punten.' : 'Punten vervallen nu niet. Stel een termijn in bij Instellingen.'}
          rijen={vervalt}
          tel={{}}
          rechts={(s) => (
            <span className="text-right text-[11px] text-warm">
              <span className="font-semibold tabular-nums text-ink-800">{getal(s.vervaltBinnenkort)}</span> op {datumKort(s.vervaltOp)}
            </span>
          )}
        />
      </div>

      <section className="panel mt-3 p-4" aria-labelledby="verdeling-kop">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 id="verdeling-kop" className="font-display text-base font-bold text-ink-900">Klanten per niveau</h2>
            <p className="mt-0.5 text-[12px] text-warm">
              Op basis van {basis === 'punten' ? 'gespaarde punten' : 'omzet'} in de laatste 12 maanden, klanten met minstens één order
            </p>
          </div>
          <Link href="/dashboard/sparen/niveaus" className="knop-tekst">Niveaus beheren</Link>
        </div>
        <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-mist" aria-hidden>
          {verdeling.map((v, i) =>
            v.aantal > 0 ? (
              <span
                key={v.niveau.id}
                className={['bg-amber-200', 'bg-ink-300', 'bg-amber-500', 'bg-ink-800', 'bg-ink-500'][i % 5]}
                style={{ width: `${(v.aantal / totaalVerdeling) * 100}%` }}
              />
            ) : null,
          )}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
          {verdeling.map((v) => (
            <li key={v.niveau.id} className="flex items-center gap-2">
              <NiveauBadge niveau={v.niveau} klein />
              <Link href={`/dashboard/sparen/klanten?niveau=${encodeURIComponent(v.niveau.naam)}`} className="tabular-nums text-ink-800 hover:underline">
                {getal(v.aantal)} {v.aantal === 1 ? 'klant' : 'klanten'}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function KansBlok({
  titel,
  uitleg,
  leeg,
  rijen,
  tel,
  rechts,
}: {
  titel: string;
  uitleg: string;
  leeg: string;
  rijen: KlantSpaarStand[];
  tel: Record<string, string>;
  rechts: (s: KlantSpaarStand) => React.ReactNode;
}) {
  return (
    <section className="panel flex flex-col p-4">
      <h3 className="text-[13px] font-semibold text-ink-900">{titel}</h3>
      <p className="mt-0.5 text-[12px] leading-snug text-warm">{uitleg}</p>
      {rijen.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-ink-200 bg-mist/60 px-3 py-3 text-[12px] text-warm">{leeg}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {rijen.map((s) => (
            <li key={s.organisatieId} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <Link href={`/dashboard/sparen/klanten/${s.organisatieId}`} className="block truncate text-[13px] font-medium text-ink-900 hover:underline">
                  {s.naam}
                </Link>
                {tel[s.organisatieId] ? (
                  <a href={`tel:${tel[s.organisatieId].replace(/^.*,\s*/, '').replace(/\s/g, '')}`} className="block truncate text-[11px] text-warm hover:text-ink-900">
                    {tel[s.organisatieId]}
                  </a>
                ) : (
                  <span className="block text-[11px] text-ink-400">{s.niveau.huidig ? s.niveau.huidig.naam : 'Geen niveau'}</span>
                )}
              </div>
              <div className="shrink-0">{rechts(s)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
