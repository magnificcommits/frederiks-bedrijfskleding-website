import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { listBeloningen } from '@/lib/kms/sparenData';
import { berekenStanden, grootboekVan, inwisselingenVan, laadEnSynchroniseer } from '@/lib/kms/sparenGrootboek';
import { niveauKleur, type SpaarNiveau, type SpaarRegel } from '@/lib/kms/sparenTypes';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import PortaalNav from '../PortaalNav';
import { vraagBeloningAanActie } from './actions';
import { getVertaler } from '@/lib/i18n/portaal/server';
import type { Sleutel } from '@/lib/i18n/portaal/nl';
import type { Vertaler } from '@/lib/i18n/portaal/kern';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getVertaler();
  return { title: t('nav.sparen'), robots: { index: false, follow: false } };
}
export const dynamic = 'force-dynamic';

const STATUS: Record<string, { cls: string; uitleg: Sleutel }> = {
  aangevraagd: { cls: 'border-amber-300 bg-amber-50 text-amber-800', uitleg: 'sparen.uitlegAangevraagd' },
  goedgekeurd: { cls: 'border-ink-300 bg-ink-50 text-ink-800', uitleg: 'sparen.uitlegGoedgekeurd' },
  verwerkt: { cls: 'border-green-300 bg-green-50 text-green-800', uitleg: 'sparen.uitlegVerwerkt' },
  afgewezen: { cls: 'border-line bg-mist text-warm', uitleg: 'sparen.uitlegAfgewezen' },
};

/** Wat de klant ziet onder "Zo spaar je". Een eigen omschrijving uit het KMS gaat voor (niet vertaald). */
function regelTekst(r: SpaarRegel, v: Vertaler): string | null {
  if (r.omschrijving?.trim()) return r.omschrijving.trim();
  const punten = () => v.tn('algemeen.punten', Math.round(r.punten || 0));
  switch (r.soort) {
    case 'per_euro':
      return v.tn('sparen.regel.perEuro', r.factor);
    case 'drempel_bonus':
      return v.t('sparen.regel.drempelBonus', { punten: punten(), bedrag: v.euro(r.drempelEuro ?? 0, 0) });
    case 'eerste_order':
      return v.t('sparen.regel.eersteOrder', { punten: punten() });
    case 'aanbrengen':
      return v.t('sparen.regel.aanbrengen', { punten: punten() });
    case 'review':
      return v.t('sparen.regel.review', { punten: punten() });
    case 'jubileum':
      return v.t('sparen.regel.jubileum', { punten: punten() });
    case 'nabestellen':
      return v.t('sparen.regel.nabestellen', { punten: punten(), maanden: r.maanden ?? '?' });
    case 'periode_actie':
      return v.t('sparen.regel.periodeActie', { factor: v.getal(r.factor), van: v.datum(r.startDatum), tot: v.datum(r.eindDatum) });
  }
}

/** Voordelen van een niveau in de taal van de klant (spiegelt niveauVoordelen uit het KMS). */
function voordelenVan(n: SpaarNiveau | null, v: Vertaler): string[] {
  if (!n) return [];
  const uit: string[] = [];
  if (n.kortingPct > 0) uit.push(v.t('sparen.voordeel.korting', { pct: v.getal(n.kortingPct) }));
  if (n.puntenFactor > 1) uit.push(v.t('sparen.voordeel.meerPunten', { pct: Math.round((n.puntenFactor - 1) * 100) }));
  if (n.gratisLogo) uit.push(v.t('sparen.voordeel.gratisLogo'));
  if (n.gratisPassen) uit.push(v.t('sparen.voordeel.gratisPassen'));
  if (n.voorrang) uit.push(v.t('sparen.voordeel.voorrang'));
  if (n.extraVoordelen?.trim()) uit.push(n.extraVoordelen.trim());
  return uit;
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
  const v = await getVertaler();
  const { t, tn, rijk, euro, datum } = v;
  const getal = (n: number) => v.getal(Math.round(n || 0));
  const punten = (n: number) => tn('algemeen.punten', Math.round(n || 0));
  // Duits: zelfstandige naamwoorden houden hun hoofdletter.
  const klein = (s: string) => (v.taal === 'de' ? s : s.charAt(0).toLowerCase() + s.slice(1));
  if (!isPortalConfigured) return <Kader titel={t('algemeen.nietActiefTitel')}>{t('algemeen.nietActiefTekst')}</Kader>;
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const org = await getMijnOrganisatie();
  if (!org) {
    return (
      <Kader titel={t('algemeen.nietGekoppeldTitel')}>
        {t('algemeen.nietGekoppeldTekst', { email: user.email ?? '' })}
      </Kader>
    );
  }
  const { ok, fout, alles } = await searchParams;
  const toegang = await getMijnToegang();

  const kop = (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
      <h1 className="font-display text-3xl font-extrabold text-ink-900">{t('nav.sparen')}</h1>
    </div>
  );

  const b = await laadEnSynchroniseer(org.id);
  if (!b.instellingen.actief) {
    return (
      <main className="container-x py-12">
        {kop}
        <PortaalNav rol={toegang.rol} actief="/portaal/sparen" />
        <div className="mt-8 rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
          <p className="text-sm text-warm">{t('sparen.uitgeschakeld')}</p>
          <Link href="/portaal" className="btn-secondary mt-5 inline-block">{t('algemeen.terugNaarOverzicht')}</Link>
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
  const voordelen = voordelenVan(niveau?.huidig ?? null, v);
  const rest = niveau ? (opPunten ? punten(niveau.nogTeGaan) : euro(niveau.nogTeGaan, 0)) : '';

  return (
    <main className="container-x py-12">
      {kop}
      <PortaalNav rol={toegang.rol} actief="/portaal/sparen" />

      {ok === 'aangevraagd' && (
        <p className="mt-6 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">
          {t('sparen.aangevraagd')}
        </p>
      )}
      {fout && <p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800">{fout}</p>}

      <section className="mt-8 grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-ink-800 bg-ink-900 p-6 text-white shadow-soft sm:p-7 lg:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-400">{t('sparen.saldo')}</p>
            {toonNiveaus && <Badge niveau={niveau?.huidig ?? null} />}
          </div>
          <p className="mt-2 font-display text-5xl font-extrabold tabular-nums">{getal(saldo)}</p>
          <p className="mt-1 text-sm text-ink-200">{tn('sparen.puntenWaard', saldo, { bedrag: euro(stand?.euroWaarde ?? 0) })}</p>
          {(stand?.gereserveerd ?? 0) > 0 && (
            <p className="mt-3 text-sm text-ink-200">{t('sparen.gereserveerd', { punten: punten(stand!.gereserveerd) })}</p>
          )}
          {(stand?.vervaltBinnenkort ?? 0) > 0 && stand?.vervaltOp && (
            <p className="mt-4 rounded-lg bg-amber-500/15 px-4 py-2.5 text-sm text-amber-200">
              {t('sparen.vervalt', { punten: punten(stand.vervaltBinnenkort), datum: datum(stand.vervaltOp) })}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {zichtbareBeloningen.length > 0 && <a href="#beloningen" className="btn-primary">{t('sparen.bekijkBeloningen')}</a>}
            <Link href="/portaal/webshop" className="btn inline-flex border border-ink-600 text-white hover:bg-ink-800">{t('sparen.bestelEnSpaar')}</Link>
          </div>
        </div>

        {toonNiveaus && niveau && (
          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft lg:col-span-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700">{t('sparen.niveau')}</p>
            <p className="mt-2 font-display text-2xl font-extrabold text-ink-900">{niveau.huidig?.naam ?? t('sparen.geenNiveau')}</p>
            <p className="text-sm text-warm">
              {opPunten ? t('sparen.puntenGespaard', { punten: punten(niveau.waarde) }) : t('sparen.besteldBedrag', { bedrag: euro(niveau.waarde, 0) })}
            </p>
            {niveau.volgende ? (
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-ink-700">{niveau.huidig?.naam ?? t('sparen.start')}</span>
                  <span className="text-warm">{niveau.volgende.naam}</span>
                </div>
                <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-amber-100" aria-hidden>
                  <div className="h-3 rounded-full bg-amber-500" style={{ width: `${Math.max(4, Math.round(niveau.voortgang * 100))}%` }} />
                </div>
                <p className="mt-3 text-sm text-ink-700">
                  {rijk('sparen.nogTot', { rest: <strong className="text-ink-900">{rest}</strong>, niveau: niveau.volgende.naam })}
                  {voordelenVan(niveau.volgende, v)[0] ? ` ${t('sparen.danKrijgJe', { voordeel: klein(voordelenVan(niveau.volgende, v)[0]) })}` : ''}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink-700">{t('sparen.hoogsteNiveau')}</p>
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
          <h2 className="font-display text-xl font-extrabold text-ink-900">{t('sparen.beloningen')}</h2>
          <p className="mt-1 text-sm text-warm">
            {magAanvragen
              ? t('sparen.beloningenAanvragen')
              : toegang.rol === 'beheerder'
                ? t('sparen.beloningenViaOns')
                : t('sparen.beloningenBeheerder')}
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
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">{t(`sparen.soort.${x.soort}`)}</p>
                  <p className="mt-1 font-display text-lg font-extrabold text-ink-900">{x.naam}</p>
                  {x.omschrijving && <p className="mt-1 text-sm text-warm">{x.omschrijving}</p>}
                  <p className="mt-3 font-display text-2xl font-extrabold tabular-nums text-ink-900">
                    {getal(x.puntenPrijs)} <span className="text-sm font-bold text-warm">{tn('sparen.puntenEenheid', x.puntenPrijs)}</span>
                  </p>
                  {!genoeg && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-100" aria-hidden>
                        <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${Math.max(3, pct)}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-warm">{t('sparen.nogNodig', { punten: punten(x.puntenPrijs - saldo) })}</p>
                    </div>
                  )}
                  {minNiveau && !niveauOk && <p className="mt-2 text-xs font-semibold text-warm">{t('sparen.vanafNiveau', { niveau: minNiveau.naam })}</p>}
                  {op && <p className="mt-2 text-xs font-semibold text-warm">{t('sparen.tijdelijkOp')}</p>}
                  <div className="mt-auto pt-4">
                    {kan ? (
                      <details className="group">
                        <summary className="btn-primary inline-flex cursor-pointer list-none">{t('sparen.aanvragen')}</summary>
                        <form action={vraagBeloningAanActie} className="mt-3 space-y-3">
                          <input type="hidden" name="beloning_id" value={x.id} />
                          <label className="block text-xs font-semibold text-warm" htmlFor={`not-${x.id}`}>{t('sparen.opmerkingMagLeeg')}</label>
                          <input id={`not-${x.id}`} name="notitie" maxLength={500} className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" placeholder={t('sparen.opmerkingPlaceholder')} />
                          <VerzendKnop className="btn-secondary" bezigTekst={t('algemeen.versturen')}>{t('sparen.bevestig', { punten: punten(x.puntenPrijs) })}</VerzendKnop>
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
          <h2 className="font-display text-xl font-extrabold text-ink-900">{t('sparen.aanvragenTitel')}</h2>
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white shadow-soft">
            {aanvragen.map((r) => {
              const s = STATUS[r.status] ?? STATUS.verwerkt;
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">{r.beloningNaam || r.omschrijving || t('sparen.korting')}</p>
                    <p className="text-sm text-warm">
                      {datum(r.createdAt)} · {punten(r.punten)} · {r.status === 'afgewezen' && r.afgewezenReden ? r.afgewezenReden : t(s.uitleg)}
                    </p>
                  </div>
                  <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>{v.status('inwisseling', STATUS[r.status] ? r.status : 'verwerkt')}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-xl font-extrabold text-ink-900">{t('sparen.zoSpaarJe')}</h2>
          <ul className="mt-4 space-y-3">
            {spaarRegels.map((r) => {
              const tekst = regelTekst(r, v);
              if (!tekst) return null;
              const loopt = r.soort === 'periode_actie' && (r.startDatum ?? '') <= vandaag;
              return (
                <li key={r.id} className="flex gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-soft">
                  <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-extrabold text-amber-700">+</span>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {r.naam}
                      {r.soort === 'periode_actie' && (
                        <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-ink-900">{loopt ? t('sparen.nu') : t('sparen.binnenkort')}</span>
                      )}
                    </p>
                    <p className="text-sm text-warm">{tekst}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          {b.instellingen.vervalMaanden > 0 && (
            <p className="mt-3 text-xs text-warm">{t('sparen.geldig', { maanden: b.instellingen.vervalMaanden })}</p>
          )}
          {b.instellingen.voorwaarden.trim() && <p className="mt-2 whitespace-pre-line text-xs text-warm">{b.instellingen.voorwaarden}</p>}
        </div>

        {toonNiveaus && (
          <div>
            <h2 className="font-display text-xl font-extrabold text-ink-900">{t('sparen.niveaus')}</h2>
            <p className="mt-1 text-sm text-warm">{opPunten ? t('sparen.niveausBasisPunten') : t('sparen.niveausBasisBesteld')}</p>
            <ol className="mt-4 space-y-3">
              {niveaus.map((n) => {
                const huidig = niveau?.huidig?.id === n.id;
                const lijst = voordelenVan(n, v);
                return (
                  <li key={n.id} className={`rounded-xl border bg-white px-4 py-3 shadow-soft ${huidig ? 'border-amber-400 ring-2 ring-amber-100' : 'border-line'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <Badge niveau={n} />
                      <span className="text-xs text-warm">
                        {n.drempel === 0 ? t('sparen.vanafEerste') : t('sparen.vanaf', { drempel: opPunten ? punten(n.drempel) : euro(n.drempel, 0) })}
                        {huidig && <strong className="ml-2 text-amber-700">{t('sparen.hierStaanJullie')}</strong>}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ink-800">{lijst.length > 0 ? lijst.join(' · ') : t('sparen.puntenOpElke')}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-extrabold text-ink-900">{t('sparen.historie')}</h2>
        {historie.length === 0 ? (
          <p className="mt-3 text-sm text-warm">{t('sparen.geenPunten')}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line bg-mist text-left text-xs font-bold uppercase tracking-[0.04em] text-warm">
                  <th className="px-5 py-3">{t('algemeen.datum')}</th>
                  <th className="px-5 py-3">{t('algemeen.omschrijving')}</th>
                  <th className="px-5 py-3 text-right">{t('sparen.kolomPunten')}</th>
                  <th className="px-5 py-3 text-right">{t('sparen.kolomSaldo')}</th>
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
                        {r.soort === 'vervallen' && <span className="ml-2 text-xs text-warm">{t('sparen.vervallen')}</span>}
                        {afgewezen && <span className="ml-2 text-xs text-warm">{t('sparen.afgewezenTerug')}</span>}
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
            {t('sparen.toonAlle', { n: getal(boek.length) })}
          </Link>
        )}
      </section>
    </main>
  );
}
