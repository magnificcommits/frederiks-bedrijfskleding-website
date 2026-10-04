import Link from 'next/link';
import KpiTegel from '@/components/dashboard/overzicht/KpiTegel';
import LegeStaat from '@/components/dashboard/overzicht/LegeStaat';
import { analyseOperatie, type Telling } from '@/lib/kms/analyse';
import { periodeParams, urlMet, type Periode } from '@/lib/kms/analysePeriode';
import Balken from '../_delen/Balken';
import Blok from '../_delen/Blok';
import { aantal, dagen, euro, pct } from '../_delen/opmaak';

const NORMEN = [7, 14, 21, 28];

function Tellingen({ titel, lijst }: { titel: string; lijst: Telling[] }) {
  if (!lijst.length) return null;
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-warm">{titel}</p>
      <Balken opmaak="aantal" rijen={lijst.map((t) => ({ sleutel: t.sleutel, label: t.label, waarde: t.aantal, href: t.href }))} />
    </div>
  );
}

export default async function Operatie({ periode, norm }: { periode: Periode; norm: number }) {
  const d = await analyseOperatie(periode, norm);
  const vgl = periode.vgl?.label ?? null;
  const pp = periodeParams(periode);
  const maxDagen = Math.max(1, ...d.open.map((s) => s.gemDagen));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTegel label="Open orders" waarde={aantal(d.openTotaal)} href="/dashboard/orders" sub={<span className="text-warm">nu, alles behalve afgerond</span>} />
        <KpiTegel
          label={`Langer open dan ${norm} dagen`}
          waarde={aantal(d.teLaat.length)}
          href={`/dashboard/orders?ouder=${norm}&sort=besteldatum&dir=asc`}
          sub={<span className="text-warm">in behandeling, nog niet verzonden</span>}
        />
        <KpiTegel
          label="Retouren"
          waarde={aantal(d.retouren.aantal.nu)}
          href="/dashboard/retouren"
          delta={vgl && d.retouren.aantal.vorige !== null ? { nu: d.retouren.aantal.nu, vorige: d.retouren.aantal.vorige, richting: 'lager-beter', vergelijk: vgl } : undefined}
          sub={<span className="text-warm">{d.retouren.pct === null ? 'geen orders om tegen af te zetten' : `${pct(d.retouren.pct, 1)} van de orders`}</span>}
        />
        <KpiTegel
          label="Klachten en vragen"
          waarde={aantal(d.klachten.aantal.nu)}
          href="/dashboard/klachten"
          delta={vgl && d.klachten.aantal.vorige !== null ? { nu: d.klachten.aantal.nu, vorige: d.klachten.aantal.vorige, richting: 'lager-beter', vergelijk: vgl } : undefined}
          sub={<span className="text-warm">{d.klachten.open} nog niet afgehandeld</span>}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
        <span className="text-warm">Norm voor levertijd:</span>
        {NORMEN.map((n) => (
          <Link key={n} href={urlMet('/dashboard/analyse', { tab: 'operatie' }, pp, n === 14 ? {} : { norm: String(n) })} className={`chip ${norm === n ? 'chip-aan' : ''}`}>
            {n} dagen
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Blok titel="Open orders per status" uitleg="Hoe lang staan orders nu al open, gerekend vanaf de besteldatum. Klik voor de orders met die status.">
          {d.open.length === 0 ? (
            <LegeStaat titel="Geen open orders" tekst="Alles is afgerond. Nieuwe orders verschijnen hier per status." />
          ) : (
            <div className="-mx-4 -mb-4 overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th className="text-right">Orders</th>
                    <th>Gem. dagen open</th>
                    <th className="text-right">Oudste</th>
                    <th className="hidden text-right sm:table-cell">Waarde</th>
                  </tr>
                </thead>
                <tbody>
                  {d.open.map((s) => (
                    <tr key={s.status}>
                      <td><Link href={s.href} className="rij-link">{s.label}</Link></td>
                      <td className="num">{s.aantal}</td>
                      <td className="min-w-[140px]">
                        <span className="flex items-center gap-2">
                          <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-mist">
                            <span className={`block h-full rounded-full ${s.gemDagen > norm ? 'bg-amber-500' : 'bg-ink-700'}`} style={{ width: `${Math.max(3, (s.gemDagen / maxDagen) * 100)}%` }} />
                          </span>
                          <span className="w-16 text-right tabular-nums">{dagen(s.gemDagen)}</span>
                        </span>
                      </td>
                      <td className="num stil">{dagen(s.maxDagen)}</td>
                      <td className="num stil hidden sm:table-cell">{s.bedrag ? euro(s.bedrag) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Blok>

        <Blok titel={`Langer open dan ${norm} dagen`} uitleg="Orders die al besteld zijn maar nog niet verzonden. De oudste eerst.">
          {d.teLaat.length === 0 ? (
            <LegeStaat titel="Niets over de norm" tekst={`Geen enkele order in behandeling staat langer dan ${norm} dagen open.`} />
          ) : (
            <div className="-mx-4 -mb-4 overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Klant</th>
                    <th>Status</th>
                    <th className="text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {d.teLaat.slice(0, 15).map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`/dashboard/orders/${o.id}`} className="rij-link">#{o.ordernummer ?? '–'}</Link></td>
                      <td className="stil">{o.klant}</td>
                      <td className="stil">{o.status}</td>
                      <td className="num font-semibold text-amber-800">{dagen(o.dagen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Blok>
      </div>

      <Blok
        titel="Doorlooptijd per status"
        uitleg="Hoe lang een order gemiddeld in elke status blijft, over de statuswijzigingen in deze periode. Laat zien waar het werk blijft hangen."
      >
        {!d.historie ? (
          <LegeStaat
            titel="Statushistorie staat nog niet aan"
            tekst="Hiervoor moet het systeem bijhouden wanneer een order van status wisselt. Dat begint zodra de migratie analyse_rapportages is gedraaid; vanaf dan vult dit blok zich vanzelf."
          />
        ) : d.tijdPerStatus.length === 0 ? (
          <LegeStaat titel="Nog geen statuswijzigingen in deze periode" tekst="Zodra orders van status wisselen, zie je hier per status hoe lang ze bleven staan." />
        ) : (
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Balken
              opmaak="aantal"
              rijen={d.tijdPerStatus.map((s) => ({
                sleutel: s.status,
                label: s.label,
                waarde: Math.round(s.gemDagen * 10) / 10,
                extra: 'dagen',
                sub: `${s.n} ${s.n === 1 ? 'order' : 'orders'}`,
                href: `/dashboard/orders?status=${s.status}`,
              }))}
            />
            {d.geleverd && d.geleverd.aantal > 0 && (
              <div className="rounded-md border border-line p-3 text-[13px]">
                <p className="text-[12px] font-medium text-warm">Geleverd in deze periode</p>
                <p className="mt-1 font-display text-[22px] font-bold tabular-nums text-ink-900">{d.geleverd.aantal}</p>
                <p className="mt-1 text-warm">
                  {d.geleverd.opTijd} binnen {norm} dagen, <span className={d.geleverd.teLaat ? 'font-semibold text-amber-800' : ''}>{d.geleverd.teLaat} later</span>
                </p>
                {d.geleverd.doorloop && <p className="mt-1 text-[12px] text-warm">Mediaan {dagen(d.geleverd.doorloop.mediaan)} van besteldatum tot verzonden.</p>}
              </div>
            )}
          </div>
        )}
      </Blok>

      <div className="grid gap-4 lg:grid-cols-2">
        <Blok titel="Retouren" uitleg="Aangemeld in deze periode, per reden en status." link={{ href: '/dashboard/retouren', label: 'Alle retouren' }}>
          {d.retouren.aantal.nu === 0 ? (
            <LegeStaat titel="Geen retouren in deze periode" tekst="Retouren komen binnen via het retourportaal of zet je zelf klaar. Hier zie je dan de redenen, zodat je ziet of het om maat, kwaliteit of iets anders gaat." />
          ) : (
            <div className="space-y-4">
              <Tellingen titel="Reden" lijst={d.retouren.perReden} />
              <Tellingen titel="Status" lijst={d.retouren.perStatus} />
            </div>
          )}
        </Blok>
        <Blok titel="Klachten en vragen" uitleg="Gemeld in deze periode, per soort en status." link={{ href: '/dashboard/klachten', label: 'Alle meldingen' }}>
          {d.klachten.aantal.nu === 0 ? (
            <LegeStaat titel="Geen klachten of vragen in deze periode" tekst="Meldingen uit het portaal verschijnen hier per soort, met hoeveel er nog openstaan." />
          ) : (
            <div className="space-y-4">
              <Tellingen titel="Soort" lijst={d.klachten.perSoort} />
              <Tellingen titel="Status" lijst={d.klachten.perStatus} />
            </div>
          )}
        </Blok>
      </div>
    </div>
  );
}
