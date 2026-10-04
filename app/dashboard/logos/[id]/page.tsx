import Link from 'next/link';
import { redirect } from 'next/navigation';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import EmptyState from '@/components/dashboard/EmptyState';
import { dashAuthed } from '@/lib/kms/adminClient';
import {
  LOGO_TECHNIEKEN,
  PRODUCTIE_SOORT_LABEL,
  STANDAARD_POSITIES,
  beoordeelResolutie,
  getLogo,
  logoBestanden,
  logoGebruik,
  logoKleuren,
  logoPosities,
  logoStaat,
  meetOpAfstand,
  type LogoBestand,
} from '@/lib/kms/logos';
import { DRUKPROEF_STATUS_KLASSE, DRUKPROEF_STATUS_LABEL } from '@/lib/kms/drukproeven';
import BestandPreview from '../BestandPreview';
import Melding from '../Melding';
import { LOGO_ACCEPT } from '../NieuwLogoFormulier';
import { verwijderBestandActie, verwijderLogoActie, voegBestandToeActie, werkLogoActie } from '../actions';
import { veiligTerugPad } from '../../drukproeven/terug';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Logo', robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const datum = (s: string | null) => (s ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(s)) : '-');
const fileCls =
  'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-mist file:px-3 file:py-1 file:text-xs file:font-semibold file:text-ink-700 hover:file:bg-line focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

const NIVEAU_KLASSE = { goed: 'bg-green-50 text-green-800', matig: 'bg-amber-50 text-amber-800', laag: 'bg-red-50 text-red-700' } as const;

export default async function LogoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ terug?: string; melding?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;
  const zp = await searchParams;
  const terug = veiligTerugPad(zp.terug);
  const logo = UUID.test(id) ? await getLogo(id) : null;
  if (!logo) {
    return (
      <main className="container-app py-6">
        <EmptyState titel="Logo niet gevonden" tekst="Dit logo bestaat niet (meer)." actieHref="/dashboard/logos?tab=bibliotheek" actieLabel="Naar de logobibliotheek" />
      </main>
    );
  }

  const terugHref = terug ?? `/dashboard/logos?tab=bibliotheek&org=${logo.organisatie_id}`;
  const staat = logoStaat(logo);
  const kleuren = logoKleuren(logo);
  const posities = logoPosities(logo);
  const breedste = posities.reduce((m, p) => Math.max(m, p.breedte_cm ?? 0), 0) || null;
  const technieken = staat.technieken;

  // Bitmaps zonder meting (van vóór deze pagina) meten we nu, alleen uit onze eigen opslag.
  const bestanden: LogoBestand[] = await Promise.all(
    logoBestanden(logo).map(async (b, i) => (b.productie === 'bitmap' && !b.meta && i < 6 ? { ...b, meta: await meetOpAfstand(b.url) } : b)),
  );
  const gebruik = await logoGebruik(logo);
  const verborgenTerug = terug ? <input type="hidden" name="terug" value={terug} /> : null;

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-mist">
            {staat.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={staat.thumb} alt="" className="max-h-full max-w-full object-contain p-1" />
            ) : null}
          </div>
          <div className="min-w-0">
            <h1 className="dash-h1 truncate">{logo.naam}</h1>
            <p className="dash-sub">
              <Link href={`/dashboard/klanten/${logo.organisatie_id}?tab=logos`} className="font-semibold text-amber-700 hover:text-amber-800">{logo.organisatie_naam ?? 'Klant'}</Link>
              {' · '}toegevoegd {datum(logo.created_at)}
              {logo.bijgewerkt_op ? ` · bijgewerkt ${datum(logo.bijgewerkt_op)}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/dashboard/drukproeven/nieuw?org=${logo.organisatie_id}`} className="knop-stil">Drukproef maken</Link>
          <Link href={terugHref} className="text-sm font-semibold text-warm hover:text-ink-800">Terug</Link>
        </div>
      </div>

      <Melding code={zp.melding} />

      {staat.waarschuwingen.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          <p className="font-semibold">Nog niet compleet voor de productie</p>
          <ul className="mt-1 list-disc pl-5">
            {staat.waarschuwingen.map((w) => (
              <li key={w}>
                {w}
                {w === 'Geen vectorbestand' && ': vraag de klant om een AI, EPS, PDF of SVG. Met alleen een plaatje wordt zeefdruk en snijfolie onscherp.'}
                {w === 'Geen borduurprogramma' && ': laat het logo punchen en zet het DST-bestand hieronder.'}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* ---------------- Bestanden ---------------- */}
        <section className="panel p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">Bestanden</h2>
          <p className="mt-1 text-[13px] text-warm">
            Vector voor drukken en snijden, een plaatje voor de drukproef en het borduurprogramma voor de machine. Bij een plaatje rekenen we uit tot hoe groot het scherp blijft
            {breedste ? `, uitgaande van de breedste positie (${breedste} cm)` : ', uitgaande van een borstlogo van 10 cm'}.
          </p>

          {bestanden.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-line bg-mist px-5 py-6 text-center text-sm text-warm">Nog geen bestanden. Voeg hieronder het eerste toe.</p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-5">
              {bestanden.map((b) => {
                const oordeel = b.meta ? beoordeelResolutie(b.meta, breedste) : null;
                return (
                  <li key={b.sleutel} className="w-44">
                    <BestandPreview bestand={{ ...b, label: `${PRODUCTIE_SOORT_LABEL[b.productie]}${b.extra ? '' : ' (vast)'}` }} logoNaam={logo.naam} />
                    {oordeel ? (
                      <p className={`mt-1.5 rounded px-2 py-1 text-[11px] leading-snug ${NIVEAU_KLASSE[oordeel.niveau]}`}>
                        {oordeel.tekst}
                        {b.meta?.dpi ? ` In het bestand staat ${b.meta.dpi} dpi.` : ''}
                      </p>
                    ) : b.productie === 'bitmap' ? (
                      <p className="mt-1.5 text-[11px] text-warm">Afmetingen onbekend (bestand van buiten onze opslag).</p>
                    ) : b.productie === 'vector' && b.extensie === 'pdf' ? (
                      <p className="mt-1.5 text-[11px] text-warm">Een PDF kan ook een plaatje bevatten. Twijfel je, open hem en zoom in.</p>
                    ) : null}
                    <form action={verwijderBestandActie} className="mt-1.5">
                      <input type="hidden" name="logoId" value={logo.id} />
                      <input type="hidden" name="sleutel" value={b.sleutel} />
                      {verborgenTerug}
                      <ConfirmSubmit message={`${b.weergaveNaam} weghalen bij dit logo?`} className="text-[11px] font-semibold text-red-600 hover:text-red-700">
                        Weghalen
                      </ConfirmSubmit>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}

          <form action={voegBestandToeActie} className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-[1fr_auto]">
            <input type="hidden" name="logoId" value={logo.id} />
            {verborgenTerug}
            <div>
              <label className="veld-label" htmlFor="nieuw-bestand">Bestand toevoegen</label>
              <input id="nieuw-bestand" type="file" name="bestand" accept={LOGO_ACCEPT} className={fileCls} />
              <input name="url" placeholder="of plak een link (https://...)" className="veld mt-2" aria-label="Link naar het bestand" />
              <p className="veld-hint">Maximaal 4 MB. Is de vaste plek voor dit soort bestand nog leeg, dan komt het daar; anders als extra bestand, bijvoorbeeld een witte variant.</p>
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="veld-label" htmlFor="nieuw-soort">Soort</label>
              <select id="nieuw-soort" name="soort" defaultValue="" className="veld">
                <option value="">Zelf herkennen</option>
                <option value="vector">Vector</option>
                <option value="bitmap">Bitmap</option>
                <option value="borduur">Borduurprogramma</option>
                <option value="overig">Overig</option>
              </select>
              <button type="submit" className="knop-donker">Toevoegen</button>
            </div>
          </form>
        </section>

        {/* ---------------- Gegevens ---------------- */}
        <section className="panel p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">Gegevens voor de productie</h2>
          <form action={werkLogoActie} className="mt-4 flex flex-col gap-5">
            <input type="hidden" name="logoId" value={logo.id} />
            {verborgenTerug}
            <div>
              <label className="veld-label" htmlFor="logo-naam">Naam</label>
              <input id="logo-naam" name="naam" required defaultValue={logo.naam} className="veld" />
            </div>

            <fieldset>
              <legend className="veld-label">Gebruikt voor</legend>
              <div className="mt-1 flex gap-5 text-sm text-ink-800">
                {LOGO_TECHNIEKEN.map((t) => (
                  <label key={t} className="flex items-center gap-2 capitalize">
                    <input type="checkbox" name="technieken" value={t} defaultChecked={technieken.includes(t)} className="h-4 w-4 accent-amber-500" /> {t}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="veld-label" htmlFor="logo-steken">Aantal steken (borduurprogramma)</label>
              <input id="logo-steken" name="steken" inputMode="numeric" defaultValue={logo.steken ?? ''} placeholder="Bijv. 8500" className="veld max-w-[12rem]" />
              <p className="veld-hint">Staat in het DST-overzicht van de puncher. Bepaalt prijs en looptijd op de machine.</p>
            </div>

            <fieldset>
              <legend className="veld-label">Kleuren</legend>
              <p className="veld-hint">Pantone voor zeefdruk, HEX voor het scherm, en de naam zoals de klant hem noemt.</p>
              <div className="mt-2 flex flex-col gap-2">
                {[...kleuren, null, null].slice(0, Math.max(kleuren.length + 2, 3)).map((k, i) => (
                  <div key={i} className="grid grid-cols-[1.25rem_1fr_1fr_6.5rem] items-center gap-2">
                    <span className="h-5 w-5 rounded border border-line" style={{ background: k?.hex ?? 'transparent' }} aria-hidden />
                    <input name="kleur_naam" defaultValue={k?.naam ?? ''} placeholder="Naam, bijv. Garage-rood" aria-label={`Kleur ${i + 1}: naam`} className="veld !py-1.5 !text-sm" />
                    <input name="kleur_pantone" defaultValue={k?.pantone ?? ''} placeholder="Pantone 485 C" aria-label={`Kleur ${i + 1}: Pantone`} className="veld !py-1.5 !text-sm" />
                    <input name="kleur_hex" defaultValue={k?.hex ?? ''} placeholder="#da291c" aria-label={`Kleur ${i + 1}: HEX`} className="veld !py-1.5 !font-mono !text-sm" />
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="veld-label">Standaardposities</legend>
              <p className="veld-hint">Waar dit logo meestal komt en hoe groot. Leeg laten mag.</p>
              <datalist id="positie-keuzes">
                {STANDAARD_POSITIES.map((p) => <option key={p} value={p} />)}
              </datalist>
              <div className="mt-2 flex flex-col gap-2">
                <div className="grid grid-cols-[1fr_5rem_5rem] gap-2 text-[11px] font-semibold uppercase tracking-wide text-warm">
                  <span>Positie</span><span>Breed cm</span><span>Hoog cm</span>
                </div>
                {[...posities, null, null].slice(0, Math.max(posities.length + 1, 2)).map((p, i) => (
                  <div key={i} className="grid grid-cols-[1fr_5rem_5rem] gap-2">
                    <input name="pos_naam" list="positie-keuzes" defaultValue={p?.positie ?? ''} placeholder="Linker borst" aria-label={`Positie ${i + 1}`} className="veld !py-1.5 !text-sm" />
                    <input name="pos_breedte" inputMode="decimal" defaultValue={p?.breedte_cm ?? ''} placeholder="9" aria-label={`Positie ${i + 1}: breedte in cm`} className="veld !py-1.5 !text-sm" />
                    <input name="pos_hoogte" inputMode="decimal" defaultValue={p?.hoogte_cm ?? ''} placeholder="4" aria-label={`Positie ${i + 1}: hoogte in cm`} className="veld !py-1.5 !text-sm" />
                  </div>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="veld-label" htmlFor="logo-opm">Opmerkingen</label>
              <textarea id="logo-opm" name="opmerkingen" rows={3} defaultValue={logo.opmerkingen ?? ''} placeholder="Bijv. op donkere stof de witte variant" className="veld" />
            </div>

            <button type="submit" className="self-start knop-donker">Opslaan</button>
          </form>
        </section>
      </div>

      {/* ---------------- Gebruik ---------------- */}
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-ink-900">Drukproeven met dit logo</h2>
            <span className="chip-tel">{gebruik.proeven.length}</span>
          </div>
          {gebruik.proeven.length === 0 ? (
            <p className="mt-3 text-sm text-warm">Nog in geen enkele drukproef gebruikt.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {gebruik.proeven.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/dashboard/drukproeven/${p.id}`} className="min-w-0 truncate font-semibold text-ink-900 hover:text-amber-800">{p.naam}</Link>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-warm">
                    {datum(p.created_at)}
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${DRUKPROEF_STATUS_KLASSE[p.status] ?? 'bg-ink-100 text-ink-700'}`}>{DRUKPROEF_STATUS_LABEL[p.status] ?? p.status}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-ink-900">Orders met dit logo</h2>
            <span className="chip-tel">{gebruik.orders.length}</span>
          </div>
          {gebruik.orders.length === 0 ? (
            <p className="mt-3 text-sm text-warm">Nog op geen werkbon gezet. Dat doe je op de order, onder Werkbon.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {gebruik.orders.map((o) => (
                <li key={o.id} className="py-2">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/dashboard/orders/${o.id}/werkbon`} className="font-semibold text-ink-900 hover:text-amber-800">Order {o.ordernummer != null ? `#${o.ordernummer}` : ''}</Link>
                    <span className="text-xs text-warm">{datum(o.besteldatum)} · {o.status.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-xs text-warm">{o.regels.map((r) => `${r.aantal}x ${r.item_naam} (${[r.techniek, r.positie].filter(Boolean).join(', ')})`).join('; ')}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <form action={verwijderLogoActie} className="mt-8">
        <input type="hidden" name="orgId" value={logo.organisatie_id} />
        <input type="hidden" name="logoId" value={logo.id} />
        <input type="hidden" name="terug" value={terug ?? `/dashboard/logos?tab=bibliotheek&org=${logo.organisatie_id}`} />
        <ConfirmSubmit
          message={`Logo "${logo.naam}" verwijderen? Op werkbonnen blijft de regel staan, maar zonder logo.`}
          className="text-sm font-semibold text-red-600 hover:text-red-700"
        >
          Logo verwijderen
        </ConfirmSubmit>
      </form>
    </main>
  );
}
