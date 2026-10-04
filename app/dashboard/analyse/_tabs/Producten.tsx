import KpiTegel from '@/components/dashboard/overzicht/KpiTegel';
import LegeStaat from '@/components/dashboard/overzicht/LegeStaat';
import { analyseProducten, type ProductGroep } from '@/lib/kms/analyse';
import { lijstFilter, periodeParams, urlMet, type Periode } from '@/lib/kms/analysePeriode';
import Balken from '../_delen/Balken';
import Blok from '../_delen/Blok';
import { aantal, euro, pct } from '../_delen/opmaak';

function margeTekst(g: ProductGroep): string | undefined {
  if (g.margePct === null) return undefined;
  const deels = g.dekking < 0.999 ? ` over ${pct(g.dekking)} van de omzet` : '';
  return `marge ${pct(g.margePct)}${deels}`;
}

const rijen = (lijst: ProductGroep[]) =>
  lijst.map((g) => ({
    sleutel: g.sleutel,
    label: g.label,
    waarde: g.stuks,
    extra: euro(g.omzet),
    sub: margeTekst(g),
    href: g.href,
    gedimd: g.label === 'Vrije regel' || g.label.endsWith('(vrije regel)'),
  }));

/** Staafjes per maat, van klein naar groot. */
function MaatGrafiek({ maten }: { maten: ProductGroep[] }) {
  const max = Math.max(1, ...maten.map((m) => m.stuks));
  const totaal = maten.reduce((t, m) => t + m.stuks, 0);
  const H = 140;
  const B = Math.max(320, maten.length * 46);
  const band = B / maten.length;
  const staaf = Math.min(30, band * 0.6);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${B} ${H + 34}`} width="100%" style={{ minWidth: Math.min(B, 640) }} role="img"
        aria-label={`Verkochte stuks per maat: ${maten.map((m) => `${m.label} ${m.stuks}`).join(', ')}`}>
        <line x1={0} x2={B} y1={H} y2={H} className="stroke-ink-200" />
        {maten.map((m, i) => {
          const h = (m.stuks / max) * (H - 18);
          const x = band * i + (band - staaf) / 2;
          return (
            <g key={m.sleutel}>
              <rect x={x} y={H - h} width={staaf} height={Math.max(1, h)} rx={2}
                className={m.stuks === max ? 'fill-amber-500' : m.label === 'Geen maat' ? 'fill-ink-200' : 'fill-ink-700'}>
                <title>{`${m.label}: ${m.stuks} stuks (${pct(totaal ? m.stuks / totaal : 0)})`}</title>
              </rect>
              <text x={x + staaf / 2} y={H - h - 4} textAnchor="middle" className="fill-ink-700 text-[10px] tabular-nums">{m.stuks}</text>
              <text x={x + staaf / 2} y={H + 14} textAnchor="middle" className="fill-ink-900 text-[11px] font-semibold">{m.label}</text>
              <text x={x + staaf / 2} y={H + 27} textAnchor="middle" className="fill-ink-400 text-[10px] tabular-nums">{pct(totaal ? m.stuks / totaal : 0)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default async function Producten({ periode }: { periode: Periode }) {
  const d = await analyseProducten(periode);
  const vgl = periode.vgl?.label ?? null;
  const pp = periodeParams(periode);
  const delta = (nu: number, vorige: number | null) => (vgl && vorige !== null ? { nu, vorige, richting: 'hoger-beter' as const, vergelijk: vgl } : undefined);

  if (d.regels === 0) {
    return (
      <LegeStaat
        titel="Geen verkochte artikelen in deze periode"
        tekst="Hier zie je straks per categorie, merk, product, kleur en maat wat er de deur uit gaat. Dat komt uit de orderregels van geplaatste orders (geen concepten). Kies een langere periode of voeg regels toe aan een order."
        actieHref="/dashboard/orders"
        actieLabel="Naar orders"
      />
    );
  }

  const topMaat = [...d.perMaat].filter((m) => m.label !== 'Geen maat').sort((a, b) => b.stuks - a.stuks)[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTegel label="Verkochte stuks" waarde={aantal(d.stuks.nu)} href={urlMet('/dashboard/orders', lijstFilter(periode))} delta={delta(d.stuks.nu, d.stuks.vorige)} />
        <KpiTegel
          label="Omzet uit orderregels"
          waarde={euro(d.omzet.nu)}
          href={urlMet('/dashboard/rapportages/omzet-categorie', pp)}
          delta={delta(d.omzet.nu, d.omzet.vorige)}
          sub={<span className="text-warm">aantal × stukprijs, op besteldatum</span>}
        />
        <KpiTegel
          label="Brutomarge"
          waarde={d.marge.pct === null ? '–' : pct(d.marge.pct)}
          href={urlMet('/dashboard/rapportages/omzet-merk', pp)}
          sub={
            <span className="text-warm">
              {d.marge.pct === null
                ? 'Nog geen inkoopprijzen bij de verkochte artikelen.'
                : `${euro(d.marge.bedrag)}, berekend over ${pct(d.marge.dekking)} van de omzet met bekende inkoopprijs`}
            </span>
          }
        />
        <KpiTegel
          label="Vrije regels"
          waarde={`${d.vrijeRegels} van ${d.regels}`}
          href={urlMet('/dashboard/orders', lijstFilter(periode))}
          sub={
            <span className="text-warm">
              {d.vrijeRegels ? 'Getypt zonder artikel uit de catalogus, dus zonder merk en inkoopprijs.' : 'Alle regels hangen aan een artikel.'}
            </span>
          }
        />
      </div>

      <Blok
        titel="Maatverdeling"
        uitleg={topMaat ? `${topMaat.label} loopt het best. Handig voor de inkoop: zo leg je de goede maten op voorraad.` : 'Verkochte stuks per maat.'}
      >
        <MaatGrafiek maten={d.perMaat} />
        {d.maatMatrix.rijen.length > 1 && (
          <div className="-mx-4 -mb-4 mt-3 overflow-x-auto border-t border-line">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Categorie</th>
                  {d.maatMatrix.maten.map((m) => <th key={m} className="text-right">{m}</th>)}
                  <th className="text-right">Totaal</th>
                </tr>
              </thead>
              <tbody>
                {d.maatMatrix.rijen.map((r) => (
                  <tr key={r.categorie}>
                    <td className="font-medium text-ink-900">{r.categorie}</td>
                    {d.maatMatrix.maten.map((m) => (
                      <td key={m} className="num">{r.perMaat[m] ? r.perMaat[m] : <span className="text-ink-300">·</span>}</td>
                    ))}
                    <td className="num font-semibold">{r.totaal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Blok>

      <div className="grid gap-4 lg:grid-cols-2">
        <Blok titel="Per categorie" uitleg="Stuks, met omzet rechts." link={{ href: urlMet('/dashboard/rapportages/omzet-categorie', pp), label: 'Rapport' }}>
          <Balken opmaak="aantal" maxRijen={10} rijen={rijen(d.perCategorie)} />
        </Blok>
        <Blok
          titel="Per merk"
          uitleg="Merk van het artikel, of van de variant als de regel geen artikel heeft. Klik voor de artikelen van dat merk."
          link={{ href: urlMet('/dashboard/rapportages/omzet-merk', pp), label: 'Rapport' }}
        >
          <Balken opmaak="aantal" maxRijen={10} rijen={rijen(d.perMerk)} />
        </Blok>
        <Blok titel="Best verkochte artikelen" uitleg="Top 15 op stuks. Klik voor het artikel.">
          <Balken opmaak="aantal" maxRijen={15} rijen={rijen(d.perProduct)} />
        </Blok>
        <Blok titel="Per kleur" uitleg="Kleurnaam zoals op de orderregel.">
          <Balken opmaak="aantal" maxRijen={12} rijen={rijen(d.perKleur)} />
        </Blok>
      </div>
    </div>
  );
}
