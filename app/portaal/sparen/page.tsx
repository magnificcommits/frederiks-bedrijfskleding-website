import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { listBeloningen } from '@/lib/kms/sparenData';
import { berekenStanden, grootboekVan, inwisselingenVan, laadEnSynchroniseer } from '@/lib/kms/sparenGrootboek';
import { BELONING_SOORT_LABEL, niveauKleur, niveauVoordelen, type SpaarNiveau, type SpaarRegel } from '@/lib/kms/sparenTypes';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import PortaalNav from '../PortaalNav';
import { vraagBeloningAanActie } from './actions';

export const metadata: Metadata = { title: 'Sparen', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const getal = (n: number) => new Intl.NumberFormat('nl-NL').format(Math.round(n || 0));
const euro = (n: number, d: 0 | 2 = 2) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: d }).format(n || 0);
const datum = (s: string | null) =>
  s ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s)) : '';

const STATUS: Record<string, { label: string; cls: string; uitleg: string }> = {
  aangevraagd: { label: 'Aangevraagd', cls: 'border-amber-300 bg-amber-50 text-amber-800', uitleg: 'We bekijken je aanvraag.' },
  goedgekeurd: { label: 'Goedgekeurd', cls: 'border-ink-300 bg-ink-50 text-ink-800', uitleg: 'Akkoord, we regelen het.' },
  verwerkt: { label: 'Verwerkt', cls: 'border-green-300 bg-green-50 text-green-800', uitleg: 'Geregeld.' },
  afgewezen: { label: 'Afgewezen', cls: 'border-line bg-mist text-warm', uitleg: 'De punten staan weer op je saldo.' },
};

/** Wat de klant ziet onder "Zo spaar je". */
function regelTekst(r: SpaarRegel): string | null {
  if (r.omschrijving?.trim()) return r.omschrijving.trim();
  switch (r.soort) {
    case 'per_euro':
      return `${r.factor.toLocaleString('nl-NL')} ${r.factor === 1 ? 'punt' : 'punten'} per bestede euro.`;
    case 'drempel_bonus':
      return `${getal(r.punten)} punten extra bij een bestelling vanaf ${euro(r.drempelEuro ?? 0, 0)}.`;
    case 'eerste_order':
      return `${getal(r.punten)} punten extra op je eerste bestelling.`;
    case 'aanbrengen':
      return `${getal(r.punten)} punten als je een bedrijf bij ons aanbrengt dat gaat bestellen.`;
    case 'review':
      return `${getal(r.punten)} punten voor een review.`;
    case 'jubileum':
      return `${getal(r.punten)} punten voor elk jaar dat je klant bent.`;
    case 'nabestellen':
      return `${getal(r.punten)} punten extra als je binnen ${r.maanden ?? '?'} maanden opnieuw bestelt.`;
    case 'periode_actie':
      return `${r.factor.toLocaleString('nl-NL')}x punten van ${datum(r.startDatum)} tot en met ${datum(r.eindDatum)}.`;
  }
}

function Badge({ niveau }: { niveau: SpaarNiveau | null }) {
  if (!niveau) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${niveauKleur(niveau)}`}>{niveau.naam}</span>
  );
}

function Kader({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <main className="container-x py-20">
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
        <h1 className="font-display text-2xl font-extrabold text-ink-900">{titel}</h1>
        <div className="mt-3 text-sm text-warm">{children}</div>
      </div>
    </main>
  );
}

export default async function PortaalSparen({ searchParams }: { searchParams: Promise<{ ok?: string; fout?: string; alles?: string }> }) {
  if (!isPortalConfigured) return <Kader titel="Klantportaal nog niet actief">Het portaal staat nog niet aan. Neem contact op met Frederiks Bedrijfskleding.</Kader>;
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const org = await getMijnOrganisatie();
  if (!org) {
    return (
      <Kader titel="Je account is nog niet gekoppeld">
        Je bent ingelogd als {user.email}, maar dit adres hangt nog niet aan een bedrijf. Neem contact op met Frederiks Bedrijfskleding.
      </Kader>
    );
  }
  const { ok, fout, alles } = await searchParams;
  const toegang = await getMijnToegang();

  const kop = (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Klantportaal</p>
      <h1 className="font-display text-3xl font-extrabold text-ink-900">Sparen</h1>
    </div>
  );

  const b = await laadEnSynchroniseer(org.id);
  if (!b.instellingen.actief) {
    return (
      <main className="container-x py-12">
        {kop}
        <PortaalNav rol={toegang.rol} actief="/portaal/sparen" />
        <div className="mt-8 rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
          <p className="text-sm text-warm">Het spaarprogramma staat op dit moment niet aan. Vragen? Bel of mail ons gerust.</p>
          <Link href="/portaal" className="btn-secondary mt-5 inline-block">Terug naar overzicht</Link>
        </div>
      </main>
    );
  }

  const stand = berekenStanden(b).find((s) => s.organisatieId === org.id);
  const { beloningen } = b.loyaliteit ? await listBeloningen() : { beloningen: [] };
  const zichtbareBeloningen = beloningen.filter((x) => x.actief && x.inPortaal);
  const aanvragen = inwisselingenVan(b).slice(0, 10);
  const boek = grootboekVan(b, org.id);
  const historie = alles ? boek : boek.slice(0, 15);
  const toonNiveaus = b.loyaliteit && b.niveausUitTabel && b.niveaus.length > 0;
  const niveaus = b.niveaus.slice().sort((a, c) => a.drempel - c.drempel);
  const opPunten = b.instellingen.niveauBasis === 'punten';
  const magAanvragen = b.loyaliteit && toegang.rol === 'beheerder' && b.instellingen.portaalAanvragen;
  const vandaag = new Date().toISOString().slice(0, 10);
  const spaarRegels = b.regels.filter(
    (r) => r.actief && (r.soort !== 'periode_actie' || (r.eindDatum ?? '9999') >= vandaag),
  );

  const saldo = Math.max(0, stand?.saldo ?? 0);
  const niveau = stand?.niveau;
  const voordelen = niveauVoordelen(niveau?.huidig ?? null);
  const rest = niveau ? (opPunten ? `${getal(niveau.nogTeGaan)} punten` : euro(niveau.nogTeGaan, 0)) : '';

  return (
    <main className="container-x py-12">
      {kop}
      <PortaalNav rol={toegang.rol} actief="/portaal/sparen" />

      {ok === 'aangevraagd' && (
        <p className="mt-6 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">
          Aanvraag verstuurd. Je hoort van ons zodra hij is goedgekeurd.
        </p>
      )}
      {fout && <p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800">{fout}</p>}

      <section className="mt-8 grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-ink-800 bg-ink-900 p-6 text-white shadow-soft sm:p-7 lg:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-400">Jullie saldo</p>
            {toonNiveaus && <Badge niveau={niveau?.huidig ?? null} />}
          </div>
          <p className="mt-2 font-display text-5xl font-extrabold tabular-nums">{getal(saldo)}</p>
          <p className="mt-1 text-sm text-ink-200">punten, samen {euro(stand?.euroWaarde ?? 0)} waard</p>
          {(stand?.gereserveerd ?? 0) > 0 && (
            <p className="mt-3 text-sm text-ink-200">{getal(stand!.gereserveerd)} punten zitten in een lopende aanvraag.</p>
          )}
          {(stand?.vervaltBinnenkort ?? 0) > 0 && stand?.vervaltOp && (
            <p className="mt-4 rounded-lg bg-amber-500/15 px-4 py-2.5 text-sm text-amber-200">
              Let op: {getal(stand.vervaltBinnenkort)} punten vervallen op {datum(stand.vervaltOp)}. Gebruik ze voor die tijd.
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {zichtbareBeloningen.length > 0 && <a href="#beloningen" className="btn-primary">Bekijk beloningen</a>}
            <Link href="/portaal/webshop" className="btn inline-flex border border-ink-600 text-white hover:bg-ink-800">Bestel en spaar door</Link>
          </div>
        </div>

        {toonNiveaus && niveau && (
          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft lg:col-span-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700">Jullie niveau</p>
            <p className="mt-2 font-display text-2xl font-extrabold text-ink-900">{niveau.huidig?.naam ?? 'Nog geen niveau'}</p>
            <p className="text-sm text-warm">
              {opPunten ? `${getal(niveau.waarde)} punten gespaard` : `${euro(niveau.waarde, 0)} besteld`} in de laatste 12 maanden
            </p>
            {niveau.volgende ? (
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-ink-700">{niveau.huidig?.naam ?? 'Start'}</span>
                  <span className="text-warm">{niveau.volgende.naam}</span>
                </div>
                <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-amber-100" aria-hidden>
                  <div className="h-3 rounded-full bg-amber-500" style={{ width: `${Math.max(4, Math.round(niveau.voortgang * 100))}%` }} />
                </div>
                <p className="mt-3 text-sm text-ink-700">
                  Nog <strong className="text-ink-900">{rest}</strong> tot {niveau.volgende.naam}.
                  {niveauVoordelen(niveau.volgende)[0] ? ` Dan krijg je onder meer: ${niveauVoordelen(niveau.volgende)[0].toLowerCase()}.` : ''}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink-700">Jullie zitten op het hoogste niveau. Dank voor het vertrouwen.</p>
            )}
            {voordelen.length > 0 && (
              <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm text-ink-800">
                {voordelen.map((v) => (
                  <li key={v} className="flex gap-2"><span aria-hidden className="text-amber-600">&#10003;</span>{v}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {zichtbareBeloningen.length > 0 && (
        <section id="beloningen" className="mt-12 scroll-mt-24">
          <h2 className="font-display text-xl font-extrabold text-ink-900">Beloningen</h2>
          <p className="mt-1 text-sm text-warm">
            {magAanvragen
              ? 'Kies wat jullie willen. Wij keuren de aanvraag goed en regelen de rest.'
              : toegang.rol === 'beheerder'
                ? 'Aanvragen gaat op dit moment via ons. Bel of mail gerust.'
                : 'De beheerder van jullie bedrijf kan deze beloningen aanvragen.'}
          </p>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {zichtbareBeloningen.map((x) => {
              const minNiveau = x.minNiveauId ? niveaus.find((n) => n.id === x.minNiveauId) ?? null : null;
              const niveauOk = !minNiveau || (niveau?.huidig && niveau.huidig.drempel >= minNiveau.drempel);
              const genoeg = saldo >= x.puntenPrijs;
              const op = x.voorraad != null && x.voorraad <= 0;
              const kan = magAanvragen && genoeg && niveauOk && !op;
              const pct = Math.min(100, Math.round((saldo / Math.max(1, x.puntenPrijs)) * 100));
              return (
                <li key={x.id} className="flex flex-col rounded-2xl border border-line bg-white p-5 shadow-soft">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">{BELONING_SOORT_LABEL[x.soort]}</p>
                  <p className="mt-1 font-display text-lg font-extrabold text-ink-900">{x.naam}</p>
                  {x.omschrijving && <p className="mt-1 text-sm text-warm">{x.omschrijving}</p>}
                  <p className="mt-3 font-display text-2xl font-extrabold tabular-nums text-ink-900">
                    {getal(x.puntenPrijs)} <span className="text-sm font-bold text-warm">punten</span>
                  </p>
                  {!genoeg && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-100" aria-hidden>
                        <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${Math.max(3, pct)}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-warm">Nog {getal(x.puntenPrijs - saldo)} punten nodig</p>
                    </div>
                  )}
                  {minNiveau && !niveauOk && <p className="mt-2 text-xs font-semibold text-warm">Vanaf niveau {minNiveau.naam}</p>}
                  {op && <p className="mt-2 text-xs font-semibold text-warm">Tijdelijk op</p>}
                  <div className="mt-auto pt-4">
                    {kan ? (
                      <details className="group">
                        <summary className="btn-primary inline-flex cursor-pointer list-none">Aanvragen</summary>
                        <form action={vraagBeloningAanActie} className="mt-3 space-y-3">
                          <input type="hidden" name="beloning_id" value={x.id} />
                          <label className="block text-xs font-semibold text-warm" htmlFor={`not-${x.id}`}>Opmerking (mag leeg)</label>
                          <input id={`not-${x.id}`} name="notitie" maxLength={500} className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" placeholder="Bijv. graag op de factuur van november" />
                          <VerzendKnop className="btn-secondary" bezigTekst="Versturen">Bevestig: {getal(x.puntenPrijs)} punten inwisselen</VerzendKnop>
                        </form>
                      </details>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {aanvragen.length > 0 && (
        <section id="aanvragen" className="mt-12 scroll-mt-24">
          <h2 className="font-display text-xl font-extrabold text-ink-900">Jullie aanvragen</h2>
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white shadow-soft">
            {aanvragen.map((r) => {
              const s = STATUS[r.status] ?? STATUS.verwerkt;
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">{r.beloningNaam || r.omschrijving || 'Korting'}</p>
                    <p className="text-sm text-warm">
                      {datum(r.createdAt)} · {getal(r.punten)} punten · {r.status === 'afgewezen' && r.afgewezenReden ? r.afgewezenReden : s.uitleg}
                    </p>
                  </div>
                  <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>{s.label}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-xl font-extrabold text-ink-900">Zo spaar je</h2>
          <ul className="mt-4 space-y-3">
            {spaarRegels.map((r) => {
              const t = regelTekst(r);
              if (!t) return null;
              const loopt = r.soort === 'periode_actie' && (r.startDatum ?? '') <= vandaag;
              return (
                <li key={r.id} className="flex gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-soft">
                  <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-extrabold text-amber-700">+</span>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {r.naam}
                      {r.soort === 'periode_actie' && (
                        <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-ink-900">{loopt ? 'Nu' : 'Binnenkort'}</span>
                      )}
                    </p>
                    <p className="text-sm text-warm">{t}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          {b.instellingen.vervalMaanden > 0 && (
            <p className="mt-3 text-xs text-warm">Punten blijven {b.instellingen.vervalMaanden} maanden geldig. De oudste punten gebruiken we eerst.</p>
          )}
          {b.instellingen.voorwaarden.trim() && <p className="mt-2 whitespace-pre-line text-xs text-warm">{b.instellingen.voorwaarden}</p>}
        </div>

        {toonNiveaus && (
          <div>
            <h2 className="font-display text-xl font-extrabold text-ink-900">Niveaus</h2>
            <p className="mt-1 text-sm text-warm">Op basis van {opPunten ? 'gespaarde punten' : 'wat jullie bestellen'} in de laatste 12 maanden.</p>
            <ol className="mt-4 space-y-3">
              {niveaus.map((n) => {
                const huidig = niveau?.huidig?.id === n.id;
                const lijst = niveauVoordelen(n);
                return (
                  <li key={n.id} className={`rounded-xl border bg-white px-4 py-3 shadow-soft ${huidig ? 'border-amber-400 ring-2 ring-amber-100' : 'border-line'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <Badge niveau={n} />
                      <span className="text-xs text-warm">
                        {n.drempel === 0 ? 'Vanaf de eerste bestelling' : `Vanaf ${opPunten ? `${getal(n.drempel)} punten` : euro(n.drempel, 0)}`}
                        {huidig && <strong className="ml-2 text-amber-700">Hier staan jullie</strong>}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ink-800">{lijst.length > 0 ? lijst.join(' · ') : 'Punten sparen op elke bestelling'}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-extrabold text-ink-900">Puntenhistorie</h2>
        {historie.length === 0 ? (
          <p className="mt-3 text-sm text-warm">Nog geen punten. Bij je eerste bestelling komen ze binnen.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line bg-mist text-left text-xs font-bold uppercase tracking-[0.04em] text-warm">
                  <th className="px-5 py-3">Datum</th>
                  <th className="px-5 py-3">Omschrijving</th>
                  <th className="px-5 py-3 text-right">Punten</th>
                  <th className="px-5 py-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {historie.map((r) => {
                  const afgewezen = r.soort === 'inwisseling' && r.inwisselStatus === 'afgewezen';
                  return (
                    <tr key={`${r.soort}-${r.id}`} className={afgewezen ? 'text-warm' : ''}>
                      <td className="whitespace-nowrap px-5 py-3 text-warm">{datum(r.datum)}</td>
                      <td className="px-5 py-3 text-ink-900">
                        <span className={afgewezen ? 'line-through' : ''}>{r.omschrijving}</span>
                        {r.soort === 'vervallen' && <span className="ml-2 text-xs text-warm">vervallen</span>}
                        {afgewezen && <span className="ml-2 text-xs text-warm">afgewezen, punten terug</span>}
                      </td>
                      <td className={`px-5 py-3 text-right font-semibold tabular-nums ${r.punten > 0 ? 'text-green-700' : 'text-ink-700'}`}>
                        {r.punten > 0 ? `+${getal(r.punten)}` : getal(r.punten)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-ink-900">{getal(r.saldoNa)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!alles && boek.length > historie.length && (
          <Link href="/portaal/sparen?alles=1" className="mt-3 inline-block text-sm font-semibold text-ink-800 underline-offset-2 hover:underline">
            Toon alle {getal(boek.length)} boekingen
          </Link>
        )}
      </section>
    </main>
  );
}
