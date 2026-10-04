import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listOrganisaties } from '@/lib/kms/logos';
import {
  DRUKPROEF_PERIODES,
  DRUKPROEF_STATUSSEN,
  DRUKPROEF_STATUS_LABEL,
  OVERZICHT_LIMIET,
  drukproefContext,
  drukproefKpis,
  listDrukproevenOverzicht,
  staatLangOpen,
} from '@/lib/kms/drukproeven';
import EmptyState from '@/components/dashboard/EmptyState';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import AutoSubmitSelect from '@/components/dashboard/AutoSubmitSelect';
import KpiTegel from '@/components/dashboard/overzicht/KpiTegel';
import DrukproefKaart from './DrukproefKaart';
import ProefMelding from './ProefMelding';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Drukproeven', robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const selectCls = 'w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

type Zoek = { org?: string; order?: string; status?: string; techniek?: string; periode?: string; q?: string; lang?: string };

export default async function DrukproevenPage({ searchParams }: { searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Database nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">De koppeling met de database ontbreekt nog. Neem contact op met Tim.</p>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
        </div>
      </main>
    );
  }

  const zp = await searchParams;
  const orgs = await listOrganisaties();
  const org = zp.org && orgs.some((o) => o.id === zp.org) ? zp.org : '';
  const orderId = zp.order && UUID.test(zp.order) ? zp.order : '';
  const status = (DRUKPROEF_STATUSSEN as readonly string[]).includes(zp.status ?? '') ? zp.status! : '';
  const techniek = zp.techniek === 'borduren' || zp.techniek === 'bedrukken' ? zp.techniek : '';
  const periode = DRUKPROEF_PERIODES.some((p) => p.waarde === zp.periode) ? zp.periode ?? '' : '';
  const q = (zp.q ?? '').slice(0, 60);
  const lang = zp.lang === '1';

  const [{ proeven: alle, perStatus, totaal }, kpis, ordernummer] = await Promise.all([
    listDrukproevenOverzicht({ org, status: lang ? 'verstuurd' : status, techniek, periode, q }),
    drukproefKpis(org || undefined),
    orderId
      ? sb.from('orders').select('ordernummer').eq('id', orderId).maybeSingle().then((r) => (r.data as { ordernummer: number | null } | null)?.ordernummer ?? null)
      : Promise.resolve(null),
  ]);
  const proeven = lang ? alle.filter(staatLangOpen) : alle;
  const ctx = await drukproefContext(proeven);
  const klantNaam = orgs.find((o) => o.id === org)?.naam ?? '';
  const nieuwHref = `/dashboard/drukproeven/nieuw${org ? `?org=${org}${orderId ? `&order=${orderId}` : ''}` : ''}`;

  // Filters die bij een andere keuze moeten blijven staan.
  const bewaar: Record<string, string> = {};
  if (org) bewaar.org = org;
  if (orderId) bewaar.order = orderId;
  if (techniek) bewaar.techniek = techniek;
  if (periode) bewaar.periode = periode;
  if (q) bewaar.q = q;
  const url = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...bewaar, ...extra });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const s = p.toString();
    return s ? `/dashboard/drukproeven?${s}` : '/dashboard/drukproeven';
  };
  const basisKpi = org ? `org=${org}&` : '';
  const filterActief = Boolean(status || techniek || periode || q || lang);

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dash-h1">Drukproeven{klantNaam ? ` van ${klantNaam}` : ''}</h1>
          <p className="dash-sub max-w-3xl">
            Zet het logo op de echte foto van het kledingstuk, stuur de proef ter goedkeuring en zie wat er nog bij klanten ligt.
          </p>
        </div>
        <Link href={nieuwHref} className="knop-primair !px-4 !py-2 !text-sm">Nieuwe drukproef</Link>
      </div>

      <Suspense fallback={null}>
        <ProefMelding />
      </Suspense>

      <section aria-label="Kerncijfers" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTegel
          label="Wachten op klant"
          waarde={String(kpis.wachtOpKlant)}
          href={`/dashboard/drukproeven?${basisKpi}status=verstuurd`}
          sub={<span className="text-warm">Verstuurd, nog geen reactie.</span>}
        />
        <KpiTegel
          label="Langer dan 3 dagen open"
          waarde={String(kpis.langerDanDrieDagen)}
          href={`/dashboard/drukproeven?${basisKpi}lang=1`}
          sub={
            <span className={kpis.langerDanDrieDagen > 0 ? 'font-semibold text-amber-800' : 'text-warm'}>
              {kpis.langerDanDrieDagen > 0 ? 'Tijd om even na te bellen.' : 'Niets blijft liggen.'}
              {!kpis.metVerstuurdOp && ' Gerekend vanaf aanmaken.'}
            </span>
          }
        />
        <KpiTegel
          label="Goedgekeurd deze maand"
          waarde={String(kpis.goedgekeurdDezeMaand)}
          href={`/dashboard/drukproeven?${basisKpi}status=goedgekeurd&periode=maand`}
          delta={{ nu: kpis.goedgekeurdDezeMaand, vorige: kpis.goedgekeurdVorigeMaand, richting: 'hoger-beter', vergelijk: 'vorige maand' }}
        />
        <KpiTegel
          label="Concepten"
          waarde={String(kpis.concepten)}
          href={`/dashboard/drukproeven?${basisKpi}status=concept`}
          sub={<span className="text-warm">Nog niet naar de klant.</span>}
        />
      </section>

      <section className="mt-6 panel p-4">
        <div className="flex flex-wrap items-end gap-3">
          <LiveZoekveld param="q" label="Zoeken" placeholder="Naam van de proef of klant" breedte="w-full sm:w-72" />
          <form action="/dashboard/drukproeven" method="get" className="flex flex-wrap items-end gap-3">
            {status && <input type="hidden" name="status" value={status} />}
            {q && <input type="hidden" name="q" value={q} />}
            {orderId && <input type="hidden" name="order" value={orderId} />}
            <label className="block min-w-[14rem]">
              <span className="veld-label">Klant</span>
              <span className="mt-1 block">
                <AutoSubmitSelect name="org" defaultValue={org} aria-label="Klant" className={selectCls} options={[{ value: '', label: 'Alle klanten' }, ...orgs.map((o) => ({ value: o.id, label: o.naam }))]} />
              </span>
            </label>
            <label className="block">
              <span className="veld-label">Techniek</span>
              <span className="mt-1 block">
                <AutoSubmitSelect
                  name="techniek"
                  defaultValue={techniek}
                  aria-label="Techniek"
                  className={selectCls}
                  options={[{ value: '', label: 'Alle technieken' }, { value: 'borduren', label: 'Borduren' }, { value: 'bedrukken', label: 'Bedrukken' }]}
                />
              </span>
            </label>
            <label className="block">
              <span className="veld-label">Periode</span>
              <span className="mt-1 block">
                <AutoSubmitSelect name="periode" defaultValue={periode} aria-label="Periode" className={selectCls} options={DRUKPROEF_PERIODES.map((p) => ({ value: p.waarde, label: p.label }))} />
              </span>
            </label>
            <noscript>
              <button type="submit" className="knop-stil">Filteren</button>
            </noscript>
          </form>
        </div>

        <div className="dash-filter mt-4 flex flex-wrap items-center gap-1.5">
          <Link href={url({})} className={`chip ${!status && !lang ? 'chip-aan' : ''}`}>
            Alle
            <span className="chip-tel">{Object.values(perStatus).reduce((n, a) => n + a, 0)}</span>
          </Link>
          {DRUKPROEF_STATUSSEN.map((s) => (
            <Link key={s} href={url({ status: s })} className={`chip ${status === s && !lang ? 'chip-aan' : ''}`}>
              {DRUKPROEF_STATUS_LABEL[s]}
              <span className="chip-tel">{perStatus[s] ?? 0}</span>
            </Link>
          ))}
          {lang && <span className="chip chip-aan">Langer dan 3 dagen open<span className="chip-tel">{proeven.length}</span></span>}
          {filterActief && (
            <Link href={org ? `/dashboard/drukproeven?org=${org}` : '/dashboard/drukproeven'} className="ml-1 text-xs font-semibold text-warm underline underline-offset-2 hover:text-ink-800">
              Filters wissen
            </Link>
          )}
        </div>

        {orderId && org && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Een nieuwe drukproef wordt gekoppeld aan order {ordernummer != null ? `#${ordernummer}` : ''}.{' '}
            <Link href={`/dashboard/orders/${orderId}`} className="font-semibold underline">Terug naar de order</Link>
          </p>
        )}
      </section>

      {proeven.length === 0 ? (
        <div className="mt-8">
          {filterActief ? (
            <EmptyState titel="Geen drukproeven met deze filters" tekst="Pas de filters aan of wis ze om alles te zien." />
          ) : (
            <EmptyState
              titel={klantNaam ? `Nog geen drukproeven voor ${klantNaam}` : 'Nog geen drukproeven'}
              tekst="Maak de eerste drukproef: kies een kledingstuk en zet het logo erop."
              actieHref={nieuwHref}
              actieLabel="Nieuwe drukproef"
            />
          )}
        </div>
      ) : (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-warm">
              {proeven.length < totaal && !lang
                ? `De nieuwste ${proeven.length} van ${totaal} drukproeven. Verfijn met de filters om oudere te vinden.`
                : `${proeven.length} drukproef${proeven.length === 1 ? '' : 'en'}`}
            </p>
            {org ? (
              <form id="afdrukvel" action="/dashboard/drukproeven/afdrukken" method="get" className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="org" value={org} />
                <span className="text-xs text-warm">Vink proeven aan om ze samen op één vel te zetten.</span>
                <button type="submit" className="knop-stil !px-4 !py-2 !text-sm">Afdrukvel maken</button>
              </form>
            ) : (
              <p className="text-xs text-warm">Kies een klant om meerdere proeven op één afdrukvel te zetten.</p>
            )}
          </div>

          <ul className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {proeven.map((d) => (
              <DrukproefKaart
                key={d.id}
                d={d}
                klantNaam={org ? null : d.organisatie_naam}
                artikelNaam={d.product_id ? ctx.artikel.get(d.product_id) ?? null : null}
                ordernummer={d.order_id ? ctx.ordernummer.get(d.order_id) ?? null : null}
                adressen={ctx.adressen.get(d.organisatie_id) ?? []}
                afdrukvelForm={org ? 'afdrukvel' : undefined}
              />
            ))}
          </ul>
          {proeven.length >= OVERZICHT_LIMIET && (
            <p className="mt-4 text-center text-xs text-warm">Er zijn meer drukproeven. Gebruik zoeken of een filter om ze te vinden.</p>
          )}
        </section>
      )}
    </main>
  );
}
