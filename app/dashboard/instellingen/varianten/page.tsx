import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar, kmsAdmin } from '@/lib/kms/adminClient';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import { beoordeelWaarden, laadVariantLijsten, variantMigratieStatus, variantWaarden } from '@/lib/kms/varianten';
import { KLEURGROEPEN, kleurSleutel, maatSleutel } from '@/lib/kms/variantenStandaard';
import { KleurStaal } from '@/app/dashboard/producten/VariantKiezer';
import OpschoonTool from './OpschoonTool';
import {
  eigenschapToevoegenActie,
  eigenschapVerwijderActie,
  kleurAliasToevoegenActie,
  kleurAliasVerwijderActie,
  kleurNieuwActie,
  kleurOpslaanActie,
  kleurVerwijderActie,
  maatAliasToevoegenActie,
  maatAliasVerwijderActie,
  maatVerwijderActie,
  matenToevoegenActie,
  reeksNieuwActie,
  reeksOpslaanActie,
  reeksVerwijderActie,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vaste varianten', robots: { index: false, follow: false } };

const TABS = [
  { id: 'opschonen', label: 'Opschonen' },
  { id: 'kleuren', label: 'Kleuren' },
  { id: 'maten', label: 'Maten' },
  { id: 'overig', label: 'Lengte en pasvorm' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const nl = (n: number) => n.toLocaleString('nl-NL');

export default async function VariantenPage({ searchParams }: { searchParams: Promise<{ tab?: string; melding?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { tab: tabParam, melding } = await searchParams;
  const tab: Tab = (TABS.find((t) => t.id === tabParam)?.id ?? 'opschonen') as Tab;

  if (!kmsAdmin()) {
    return (
      <main className="container-app py-6">
        <h1 className="dash-h1">Vaste varianten</h1>
        <p className="mt-3 text-sm text-warm">De database is nog niet gekoppeld.</p>
      </main>
    );
  }

  const [lijst, waarden, status] = await Promise.all([laadVariantLijsten(), variantWaarden(), variantMigratieStatus()]);
  const beheer = lijst.bron === 'database';
  const rijen = beoordeelWaarden(waarden, lijst);
  const teDoen = rijen.filter((r) => r.status !== 'goed').length;
  const gebruik = new Map(waarden.map((w) => [`${w.veld}\u0000${w.waarde}`, w.varianten]));
  const aantalMaten = new Set(lijst.reeksen.flatMap((r) => r.maten.map((m) => m.maat))).size;
  const badges: Record<Tab, number | null> = {
    opschonen: teDoen,
    kleuren: lijst.kleuren.length,
    maten: aantalMaten,
    overig: lijst.eigenschappen.length,
  };

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Vaste varianten</h1>
        <Link href="/dashboard/instellingen" className="knop-tekst">Terug naar instellingen</Link>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-warm">
        Eén lijst met maten en kleuren voor het hele systeem. Leveranciers schrijven hetzelfde op tien manieren (&lsquo;Black&rsquo;,
        &lsquo;ZWART&rsquo;, &lsquo;0400 - Black&rsquo;); hier leg je vast hoe het bij ons heet. Aliassen zorgen dat een nieuwe import
        vanzelf de juiste naam krijgt.
      </p>

      {!beheer && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          De migratie <code>20261004_varianten_en_fotocontrole.sql</code> is nog niet gedraaid. Je ziet nu de standaardlijst uit de
          code en wat er zou veranderen; aanpassen en omzetten kan pas na de migratie.
          {!status.omzetten && ' Ook de kolommen voor de oorspronkelijke leverancierswaarde ontbreken nog.'}
        </p>
      )}
      {melding && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-800">
          {melding}
        </p>
      )}

      <nav className="mt-5 flex flex-wrap gap-1 border-b border-line" aria-label="Onderdelen">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`?tab=${t.id}`}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold ${
              tab === t.id ? 'border-amber-600 text-ink-900' : 'border-transparent text-warm hover:text-ink-800'
            }`}
          >
            {t.label}
            {badges[t.id] != null && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tab === t.id ? 'bg-amber-100 text-amber-800' : 'bg-mist text-warm'}`}>
                {nl(badges[t.id] ?? 0)}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="mt-5">
        {tab === 'opschonen' && <OpschoonTool rijen={rijen} lijst={lijst} kanOpslaan={beheer && status.omzetten} />}

        {tab === 'kleuren' && (
          <div className="space-y-6">
            {beheer && (
              <form action={kleurNieuwActie} className="panel flex flex-wrap items-end gap-3 p-4">
                <div className="w-52">
                  <label className="veld-label" htmlFor="nieuw-naam">Nieuwe kleur</label>
                  <input id="nieuw-naam" name="naam" required placeholder="Bijv. Petrol/zwart" className="veld" />
                </div>
                <div>
                  <label className="veld-label" htmlFor="nieuw-hex">Kleur</label>
                  <input id="nieuw-hex" name="hex" type="color" defaultValue="#1f2a44" className="h-8 w-12 cursor-pointer rounded border border-line" />
                </div>
                <label className="flex items-center gap-1.5 pb-1.5 text-[13px] text-ink-700">
                  <input type="checkbox" name="tweekleurig" /> tweede kleur
                  <input name="hex2" type="color" defaultValue="#1b1b1b" aria-label="Tweede kleur" className="h-8 w-12 cursor-pointer rounded border border-line" />
                </label>
                <div className="w-40">
                  <label className="veld-label" htmlFor="nieuw-groep">Kleurgroep</label>
                  <select id="nieuw-groep" name="groep" className="veld" defaultValue="blauw">
                    {KLEURGROEPEN.map((g) => <option key={g.id} value={g.id}>{g.naam}</option>)}
                  </select>
                </div>
                <button type="submit" className="knop-donker">Toevoegen</button>
              </form>
            )}
            {KLEURGROEPEN.map((g) => {
              const kleuren = lijst.kleuren.filter((k) => k.groep === g.id).sort((a, b) => a.volgorde - b.volgorde);
              if (kleuren.length === 0) return null;
              return (
                <section key={g.id}>
                  <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink-900">
                    <KleurStaal hex={g.hex} /> {g.naam}
                    <span className="text-[12px] font-normal text-warm">{kleuren.length}</span>
                  </h2>
                  <div className="panel mt-2 divide-y divide-line">
                    {kleuren.map((k) => {
                      const n = gebruik.get(`kleur\u0000${k.naam}`) ?? 0;
                      return (
                        <div key={k.id ?? k.naam} className={`px-3 py-2.5 ${k.actief === false ? 'bg-mist/60' : ''}`}>
                          <form action={kleurOpslaanActie} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="id" value={k.id ?? ''} />
                            <KleurStaal hex={k.hex} hex2={k.hex2} className="h-6 w-6" />
                            <input name="naam" defaultValue={k.naam} aria-label="Naam" className="veld w-48 font-semibold" disabled={!beheer} />
                            <input name="hex" type="color" defaultValue={k.hex} aria-label="Kleur" className="h-8 w-10 cursor-pointer rounded border border-line" disabled={!beheer} />
                            <label className="flex items-center gap-1 text-[12px] text-warm">
                              <input type="checkbox" name="tweekleurig" defaultChecked={!!k.hex2} disabled={!beheer} /> 2e
                              <input name="hex2" type="color" defaultValue={k.hex2 ?? '#1b1b1b'} aria-label="Tweede kleur" className="h-8 w-10 cursor-pointer rounded border border-line" disabled={!beheer} />
                            </label>
                            <select name="groep" defaultValue={k.groep} aria-label="Kleurgroep" className="veld w-32" disabled={!beheer}>
                              {KLEURGROEPEN.map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}
                            </select>
                            <input name="volgorde" type="number" defaultValue={k.volgorde} aria-label="Volgorde" title="Volgorde in keuzelijsten" className="veld w-20" disabled={!beheer} />
                            <label className="flex items-center gap-1 text-[12px] text-ink-700">
                              <input type="checkbox" name="actief" defaultChecked={k.actief !== false} disabled={!beheer} /> actief
                            </label>
                            <span className="text-[12px] tabular-nums text-warm">{n ? `${nl(n)} varianten` : 'niet in gebruik'}</span>
                            {beheer && <button type="submit" className="knop-stil ml-auto">Opslaan</button>}
                          </form>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-8">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-warm">Aliassen</span>
                            {k.aliassen.length === 0 && <span className="text-[12px] text-warm">geen</span>}
                            {k.aliassen.map((a) => (
                              <form key={a} action={kleurAliasVerwijderActie} className="inline-flex">
                                <input type="hidden" name="sleutel" value={kleurSleutel(a)} />
                                <span className="inline-flex items-center gap-1 rounded border border-line bg-white px-1.5 py-0.5 text-[12px] text-ink-700">
                                  {a}
                                  {beheer && (
                                    <button type="submit" aria-label={`Alias ${a} weghalen`} className="text-warm hover:text-red-700">×</button>
                                  )}
                                </span>
                              </form>
                            ))}
                            {beheer && k.id && (
                              <form action={kleurAliasToevoegenActie} className="inline-flex items-center gap-1">
                                <input type="hidden" name="kleur_id" value={k.id} />
                                <input name="alias" placeholder="alias toevoegen" aria-label={`Alias voor ${k.naam}`} className="veld h-7 w-36 py-0.5 text-[12px]" />
                                <button type="submit" className="knop-tekst text-[12px]">Toevoegen</button>
                              </form>
                            )}
                            {beheer && k.id && n === 0 && (
                              <form action={kleurVerwijderActie} className="ml-auto">
                                <input type="hidden" name="id" value={k.id} />
                                <ConfirmSubmit message={`${k.naam} verwijderen?`} className="text-[12px] font-semibold text-red-700 hover:text-red-800">Verwijderen</ConfirmSubmit>
                              </form>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {tab === 'maten' && (
          <div className="space-y-6">
            <p className="max-w-3xl text-[13px] text-warm">
              Een maat mag in meer reeksen staan (44 is een broekmaat en een schoenmaat). De volgorde bepaalt hoe maten in keuzelijsten
              en op de site gesorteerd worden.
            </p>
            {[...lijst.reeksen].sort((a, b) => a.volgorde - b.volgorde).map((r) => (
              <section key={r.id ?? r.naam} className="panel p-4">
                <form action={reeksOpslaanActie} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={r.id ?? ''} />
                  <div className="w-64">
                    <label className="veld-label">Maatreeks</label>
                    <input name="naam" defaultValue={r.naam} className="veld font-semibold" disabled={!beheer} />
                  </div>
                  <div className="w-24">
                    <label className="veld-label">Volgorde</label>
                    <input name="volgorde" type="number" defaultValue={r.volgorde} className="veld" disabled={!beheer} />
                  </div>
                  <div className="min-w-[16rem] flex-1">
                    <label className="veld-label">Maten in deze volgorde</label>
                    <input name="maten_volgorde" defaultValue={r.maten.map((m) => m.maat).join(', ')} className="veld font-mono text-[12px]" disabled={!beheer} />
                  </div>
                  {beheer && <button type="submit" className="knop-stil">Opslaan</button>}
                </form>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.maten.map((m) => {
                    const n = gebruik.get(`maat\u0000${m.maat}`) ?? 0;
                    return (
                      <form key={m.id ?? m.maat} action={maatVerwijderActie} className="inline-flex">
                        <input type="hidden" name="id" value={m.id ?? ''} />
                        <span className="inline-flex items-center gap-1.5 rounded border border-line bg-white px-2 py-0.5 text-[13px] text-ink-900" title={m.aliassen.length ? `Aliassen: ${m.aliassen.join(', ')}` : undefined}>
                          {m.maat}
                          <span className="text-[11px] tabular-nums text-warm">{n ? nl(n) : ''}</span>
                          {beheer && m.id && (
                            <button type="submit" aria-label={`Maat ${m.maat} weghalen uit ${r.naam}`} className="text-warm hover:text-red-700">×</button>
                          )}
                        </span>
                      </form>
                    );
                  })}
                </div>
                {beheer && r.id && (
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                    <form action={matenToevoegenActie} className="flex items-end gap-2">
                      <input type="hidden" name="reeks_id" value={r.id} />
                      <div className="w-64">
                        <label className="veld-label">Maten toevoegen</label>
                        <input name="maten" placeholder="Bijv. 44-64 of S, M, L" className="veld" />
                      </div>
                      <button type="submit" className="knop-stil">Toevoegen</button>
                    </form>
                    <form action={reeksVerwijderActie}>
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmSubmit message={`Maatreeks ${r.naam} met alle maten verwijderen? Varianten blijven zoals ze zijn.`} className="text-[12px] font-semibold text-red-700 hover:text-red-800">
                        Reeks verwijderen
                      </ConfirmSubmit>
                    </form>
                  </div>
                )}
              </section>
            ))}
            {beheer && (
              <form action={reeksNieuwActie} className="flex items-end gap-2">
                <div className="w-64">
                  <label className="veld-label" htmlFor="reeks-nieuw">Nieuwe maatreeks</label>
                  <input id="reeks-nieuw" name="naam" required placeholder="Bijv. Broekmaten kort (S)" className="veld" />
                </div>
                <button type="submit" className="knop-donker">Toevoegen</button>
              </form>
            )}

            <section className="panel p-4">
              <h2 className="font-display text-base font-bold text-ink-900">Maataliassen</h2>
              <p className="mt-1 text-[13px] text-warm">Schrijfwijzen die automatisch naar een standaardmaat gaan. Regels als &lsquo;56 NL (50 FR)&rsquo; wordt &lsquo;56&rsquo; zitten al in de code.</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {lijst.reeksen.flatMap((r) => r.maten.flatMap((m) => m.aliassen.map((a) => ({ a, maat: m.maat })))).filter((x, i, arr) => arr.findIndex((y) => y.a === x.a) === i).map(({ a, maat }) => (
                  <form key={a} action={maatAliasVerwijderActie} className="inline-flex">
                    <input type="hidden" name="sleutel" value={maatSleutel(a)} />
                    <span className="inline-flex items-center gap-1 rounded border border-line bg-white px-1.5 py-0.5 text-[12px] text-ink-700">
                      {a} <span className="text-warm">→</span> <strong className="font-semibold text-ink-900">{maat}</strong>
                      {beheer && <button type="submit" aria-label={`Alias ${a} weghalen`} className="text-warm hover:text-red-700">×</button>}
                    </span>
                  </form>
                ))}
              </div>
              {beheer && (
                <form action={maatAliasToevoegenActie} className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="w-40">
                    <label className="veld-label" htmlFor="maatalias">Schrijfwijze</label>
                    <input id="maatalias" name="alias" required placeholder="Bijv. XXL" className="veld" />
                  </div>
                  <div className="w-40">
                    <label className="veld-label" htmlFor="maatalias-doel">Wordt</label>
                    <input id="maatalias-doel" name="maat" required list="alle-maten" placeholder="Bijv. 2XL" className="veld" />
                    <datalist id="alle-maten">
                      {[...new Set(lijst.reeksen.flatMap((r) => r.maten.map((m) => m.maat)))].map((m) => <option key={m} value={m} />)}
                    </datalist>
                  </div>
                  <button type="submit" className="knop-stil">Toevoegen</button>
                </form>
              )}
            </section>
          </div>
        )}

        {tab === 'overig' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {(['lengte', 'pasvorm'] as const).map((soort) => (
              <section key={soort} className="panel p-4">
                <h2 className="font-display text-base font-bold text-ink-900">{soort === 'lengte' ? 'Lengte' : 'Pasvorm'}</h2>
                <p className="mt-1 text-[13px] text-warm">
                  {soort === 'lengte'
                    ? 'Voor broeken en jassen in kort, normaal of lang. Varianten hebben nog geen eigen lengteveld; deze lijst is klaar voor als dat komt.'
                    : 'Bijvoorbeeld regular of slim fit. Ook hier: klaar voor gebruik zodra varianten een pasvorm krijgen.'}
                </p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {lijst.eigenschappen.filter((e) => e.soort === soort).map((e) => (
                    <li key={e.id ?? e.waarde}>
                      <form action={eigenschapVerwijderActie} className="inline-flex">
                        <input type="hidden" name="id" value={e.id ?? ''} />
                        <span className="inline-flex items-center gap-1 rounded border border-line bg-white px-2 py-0.5 text-[13px] text-ink-900">
                          {e.waarde}
                          {beheer && e.id && <button type="submit" aria-label={`${e.waarde} weghalen`} className="text-warm hover:text-red-700">×</button>}
                        </span>
                      </form>
                    </li>
                  ))}
                </ul>
                {beheer && (
                  <form action={eigenschapToevoegenActie} className="mt-3 flex items-end gap-2">
                    <input type="hidden" name="soort" value={soort} />
                    <input name="waarde" required aria-label={`Nieuwe ${soort}`} placeholder={soort === 'lengte' ? 'Bijv. Extra kort' : 'Bijv. Comfort fit'} className="veld w-48" />
                    <button type="submit" className="knop-stil">Toevoegen</button>
                  </form>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
