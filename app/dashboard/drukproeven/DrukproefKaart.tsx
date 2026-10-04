import Link from 'next/link';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import { env } from '@/lib/env';
import { DRUKPROEF_STATUS_KLASSE, DRUKPROEF_STATUS_LABEL, staatLangOpen, type Drukproef } from '@/lib/kms/drukproeven';
import DrukproefPreview from './DrukproefPreview';
import { kopieerDrukproefActie, keurGoedNamensKlantActie, markeerVerstuurdActie, verstuurDrukproefActie, verwijderDrukproefActie } from './actions';

const datum = (s: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(s));

function dagenGeleden(s: string | null | undefined): number | null {
  const t = Date.parse(s ?? '');
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : null;
}

/**
 * Eén drukproef als kaart, met de acties die erbij horen. Gedeeld door het
 * overzicht (alle klanten) en het tabblad Drukproeven op de klantkaart.
 */
export default function DrukproefKaart({
  d,
  klantNaam,
  artikelNaam,
  ordernummer,
  adressen,
  terug,
  afdrukvelForm,
}: {
  d: Drukproef;
  /** Alleen meegeven als de klant niet al uit de context blijkt. */
  klantNaam?: string | null;
  artikelNaam?: string | null;
  ordernummer?: number | null;
  adressen: { email: string; naam: string }[];
  /** Terug naar deze pagina na een actie (klantkaart). */
  terug?: string | null;
  /** Id van het formulier voor het afdrukvel; zonder id geen vinkje. */
  afdrukvelForm?: string;
}) {
  const status = { label: DRUKPROEF_STATUS_LABEL[d.status] ?? d.status, klasse: DRUKPROEF_STATUS_KLASSE[d.status] ?? 'bg-ink-100 text-ink-700' };
  const nieuw = Boolean(d.ontwerp);
  const q = terug ? `?terug=${encodeURIComponent(terug)}` : '';
  const bewerkHref = `/dashboard/drukproeven/${d.id}${q}`;
  const open = d.status === 'concept' || d.status === 'verstuurd';
  const langOpen = staatLangOpen(d);
  const bijKlant = d.status === 'verstuurd' ? dagenGeleden(d.verstuurd_op ?? d.created_at) : null;
  const lijstId = `adres-${d.id}`;

  const meta = [
    artikelNaam,
    d.product_kleur,
    d.techniek === 'bedrukken' ? 'Bedrukken' : 'Borduren',
    `aangemaakt ${datum(d.created_at)}`,
  ].filter(Boolean);

  return (
    <li className={`flex flex-col panel p-4 ${langOpen ? 'border-amber-300' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {afdrukvelForm && (
            <input type="checkbox" name="id" value={d.id} form={afdrukvelForm} className="mt-1 h-4 w-4 shrink-0 accent-amber-500" aria-label={`${d.naam} op het afdrukvel`} />
          )}
          <div className="min-w-0">
            {klantNaam && (
              <Link href={`/dashboard/klanten/${d.organisatie_id}?tab=drukproeven`} className="block truncate text-xs font-semibold uppercase tracking-wide text-amber-700 hover:text-amber-800">
                {klantNaam}
              </Link>
            )}
            <Link href={bewerkHref} className="block font-semibold text-ink-900 hover:text-amber-800">{d.naam}</Link>
            <span className="block text-xs text-warm">{meta.join(' · ')}</span>
            {d.order_id && (
              <Link href={`/dashboard/orders/${d.order_id}`} className="text-xs font-semibold text-ink-700 underline decoration-line underline-offset-2 hover:text-amber-800">
                Order {ordernummer != null ? `#${ordernummer}` : 'bekijken'}
              </Link>
            )}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.klasse}`}>{status.label}</span>
      </div>

      {bijKlant != null && (
        <p className={`mt-2 text-xs ${langOpen ? 'font-semibold text-amber-800' : 'text-warm'}`}>
          {bijKlant === 0 ? 'Vandaag naar de klant gestuurd.' : `Ligt ${bijKlant} dag${bijKlant === 1 ? '' : 'en'} bij de klant.`}
          {langOpen ? ' Even nabellen?' : ''}
        </p>
      )}

      <Link href={bewerkHref} className="mt-3 block rounded-lg border border-line bg-mist p-3 transition hover:border-amber-400" title="Bewerken">
        <div className={nieuw ? '' : 'mx-auto w-full max-w-[180px]'}>
          <DrukproefPreview
            afbeeldingUrl={d.afbeelding_url}
            achterAfbeeldingUrl={d.achter_afbeelding_url ?? null}
            ontwerp={d.ontwerp}
            formaat="mini"
            type={d.type}
            kleur={d.kleur}
            logoUrl={d.logo_url}
            positie={d.positie}
            techniek={d.techniek}
          />
        </div>
      </Link>

      {d.omschrijving && <p className="mt-2 line-clamp-3 text-xs text-warm">{d.omschrijving}</p>}

      {(d.status === 'goedgekeurd' || d.status === 'afgekeurd') && d.opmerking && (
        <p className="mt-2 rounded-lg bg-mist px-3 py-2 text-xs text-ink-700">
          <span className="font-semibold">Reactie klant:</span> {d.opmerking}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={bewerkHref} className="knop-donker">Bewerken</Link>
        <Link href={`/dashboard/drukproeven/afdrukken?org=${d.organisatie_id}&id=${d.id}`} className="knop-stil">Afdrukken</Link>
        <form action={kopieerDrukproefActie}>
          <input type="hidden" name="id" value={d.id} />
          <button type="submit" className="knop-stil" title="Kopie maken, bijvoorbeeld voor een ander kledingstuk met hetzelfde logo">Kopie maken</button>
        </form>
      </div>

      {open && (
        <div className="mt-3 border-t border-line pt-3">
          <form action={verstuurDrukproefActie}>
            <input type="hidden" name="id" value={d.id} />
            <input type="hidden" name="org_id" value={d.organisatie_id} />
            {terug && <input type="hidden" name="terug" value={terug} />}
            <label className="veld-label" htmlFor={`mail-${d.id}`}>Ter goedkeuring mailen naar</label>
            <div className="mt-1 flex gap-2">
              <input
                id={`mail-${d.id}`}
                type="email"
                name="email"
                required
                list={adressen.length > 0 ? lijstId : undefined}
                defaultValue={adressen[0]?.email ?? ''}
                placeholder="naam@bedrijf.nl"
                className="veld min-w-0 flex-1 !py-2 !text-sm"
              />
              <button type="submit" className="knop-primair shrink-0">
                {d.status === 'verstuurd' ? 'Opnieuw sturen' : 'Versturen'}
              </button>
            </div>
            {adressen.length > 0 && (
              <datalist id={lijstId}>
                {adressen.map((a) => (
                  <option key={a.email} value={a.email}>{a.naam}</option>
                ))}
              </datalist>
            )}
          </form>
          <p className="mt-1.5 break-all text-[11px] text-warm">Of deel deze link: {env.siteUrl}/drukproef/{d.token}</p>

          <div className="mt-2 flex flex-wrap items-start gap-2">
            {d.status === 'concept' && (
              <form action={markeerVerstuurdActie}>
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="org_id" value={d.organisatie_id} />
                {terug && <input type="hidden" name="terug" value={terug} />}
                <button type="submit" className="knop-stil" title="Je hebt de link zelf gestuurd, bijvoorbeeld via WhatsApp">Link gedeeld</button>
              </form>
            )}
            <details className="group">
              <summary className="knop-stil cursor-pointer list-none">Akkoord namens klant</summary>
              <form action={keurGoedNamensKlantActie} className="mt-2 flex flex-col gap-2 rounded-lg border border-line bg-mist p-3">
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="org_id" value={d.organisatie_id} />
                {terug && <input type="hidden" name="terug" value={terug} />}
                <label className="veld-label" htmlFor={`akkoord-${d.id}`}>Wie gaf akkoord, en hoe?</label>
                <input id={`akkoord-${d.id}`} name="opmerking" placeholder="Bijv. Henk, telefonisch" className="veld !py-2 !text-sm" />
                <button type="submit" className="knop-donker self-start">Goedkeuren</button>
              </form>
            </details>
          </div>
        </div>
      )}

      <form action={verwijderDrukproefActie} className="mt-3">
        <input type="hidden" name="id" value={d.id} />
        <input type="hidden" name="org_id" value={d.organisatie_id} />
        {terug && <input type="hidden" name="terug" value={terug} />}
        <ConfirmSubmit message={`Drukproef "${d.naam}" verwijderen? Dit kan niet ongedaan worden gemaakt.`} className="text-xs font-semibold text-red-600 hover:text-red-700">
          Verwijderen
        </ConfirmSubmit>
      </form>
    </li>
  );
}
