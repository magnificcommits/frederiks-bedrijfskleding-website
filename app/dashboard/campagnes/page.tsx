import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import StatusChips from '@/components/dashboard/StatusChips';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import EmptyState from '@/components/dashboard/EmptyState';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import { kmsAdmin, dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { isEmailConfigured } from '@/lib/env';
import { listCampagnes, CAMPAGNE_STATUSSEN, verzondenVandaag } from '@/lib/kms/campagnes';
import { campagneModelV2 } from '@/lib/kms/campagne-engine';
import { getCampagneInstellingen } from '@/lib/kms/campagneInstellingen';
import { CAMPAGNE_STATUS_LABEL, DOELGROEP_LABEL } from '@/lib/campagnes/flow';
import { VOORBEELDEN } from '@/lib/campagnes/voorbeelden';
import { nieuweCampagneActie, pauzeerAllesActie, dupliceerCampagneActie } from './actions';
import { CampagneStatusBadge, MiniBalken, pct } from './onderdelen';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Campagnes', robots: { index: false, follow: false } };

function NieuweCampagneFormulier() {
  return (
    <form action={nieuweCampagneActie} className="mt-4 flex flex-col gap-4">
      <div>
        <label className="veld-label" htmlFor="nc-naam">Naam (mag je later wijzigen)</label>
        <input id="nc-naam" name="naam" placeholder="Laat leeg om de naam van het voorbeeld te gebruiken" className="veld" />
      </div>
      <fieldset>
        <legend className="veld-label">Waar begin je mee?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="group relative cursor-pointer rounded-lg border border-line bg-white p-3 hover:border-ink-300 has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50">
            <input type="radio" name="voorbeeld" value="" defaultChecked className="sr-only" />
            <span className="block text-[13px] font-semibold text-ink-900">Leeg beginnen</span>
            <span className="mt-0.5 block text-[12px] leading-snug text-warm">Je bouwt de stappen zelf op.</span>
            <span className="mt-2 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-warm">Voor</span>
              <select name="doelgroep" defaultValue="prospect" className="veld w-auto py-0.5 text-[12px]">
                <option value="prospect">Prospects</option>
                <option value="lead">Leads</option>
                <option value="klant">Klanten</option>
              </select>
            </span>
          </label>
          {VOORBEELDEN.map((v) => (
            <label key={v.sleutel} className="cursor-pointer rounded-lg border border-line bg-white p-3 hover:border-ink-300 has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50">
              <input type="radio" name="voorbeeld" value={v.sleutel} className="sr-only" />
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink-900">{v.naam}</span>
                <span className="shrink-0 text-[11px] text-warm">{v.duur}</span>
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-warm">{v.korteUitleg}</span>
              <span className="mt-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">{DOELGROEP_LABEL[v.doelgroep]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="veld-hint">Een nieuwe campagne staat op concept. Er gaat niets de deur uit tot je hem zelf start.</p>
      <button type="submit" className="self-start knop-primair">Campagne maken</button>
    </form>
  );
}

export default async function CampagnesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; fout?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { status = '', q = '', fout } = await searchParams;
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-smal py-20">
        <div className="panel mx-auto max-w-xl p-8">
          <h1 className="dash-h1">Database nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen.</p>
        </div>
      </main>
    );
  }

  const [alle, inst, vandaag, v2] = await Promise.all([listCampagnes(), getCampagneInstellingen(), verzondenVandaag(), campagneModelV2()]);
  const aantallen: Record<string, number> = {};
  for (const c of alle) aantallen[c.status] = (aantallen[c.status] ?? 0) + 1;
  const woorden = q.trim().toLowerCase();
  const zichtbaar = alle.filter((c) => (!status || c.status === status) && (!woorden || `${c.naam} ${c.triggerTekst}`.toLowerCase().includes(woorden)));

  const actief = alle.filter((c) => c.status === 'actief').length;
  const inFlow = alle.reduce((n, c) => n + c.actief, 0);
  const doel = alle.reduce((n, c) => n + c.doelBereikt, 0);
  const totaal = alle.reduce((n, c) => n + c.totaal, 0);

  return (
    <main className="container-app pb-12">
      <div className="dash-kop justify-between gap-3">
        <h1 className="dash-h1">Campagnes</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/campagnes/instellingen" className="knop-tekst">Instellingen</Link>
          <form action={pauzeerAllesActie}>
            <input type="hidden" name="aan" value={inst.allesGepauzeerd ? '0' : '1'} />
            {inst.allesGepauzeerd ? (
              <button type="submit" className="knop-stil">Alles hervatten</button>
            ) : (
              <ConfirmSubmit message="Alle campagnes pauzeren? Er gaat niets meer de deur uit tot je ze hervat." className="knop-stil">
                Pauzeer alles
              </ConfirmSubmit>
            )}
          </form>
          <Drawer knop="Nieuwe campagne" titel="Nieuwe campagne" beschrijving="Begin leeg of kopieer een voorbeeld. Alles is daarna aan te passen." breedte="sm:max-w-3xl">
            <NieuweCampagneFormulier />
          </Drawer>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {fout === 'aanmaken' && <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-semibold text-red-800">Aanmaken is niet gelukt. Probeer het nog eens.</p>}
        {inst.allesGepauzeerd && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-[13px] text-amber-900">
            <strong>Alles staat op pauze.</strong> Er worden geen mails verstuurd en geen stappen uitgevoerd. Ingeschreven mensen blijven staan waar ze staan.
          </p>
        )}
        {!isEmailConfigured && (
          <p className="rounded-md border border-line bg-mist px-4 py-2 text-[13px] text-ink-700">
            <strong>Mail staat nog niet aan.</strong> Zolang Resend niet is ingesteld gaat er niets de deur uit en telt er niets als verzonden. Wie in een campagne zit, wacht bij de eerste mailstap.
          </p>
        )}
        {!v2 && (
          <p className="rounded-md border border-line bg-mist px-4 py-2 text-[13px] text-ink-700">
            De nieuwe campagnes (splitsingen, triggers, leads en klanten, tracking) werken na de migratie <code>20261004_campagnes_flow.sql</code>. Tot die tijd draaien bestaande campagnes in de oude vorm.
          </p>
        )}
      </div>

      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-warm">Actieve campagnes</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink-900">{actief}</p>
          <p className="text-[12px] text-warm">van de {alle.length}</p>
        </div>
        <div className="panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-warm">Nu in een flow</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink-900">{inFlow}</p>
          <p className="text-[12px] text-warm">{totaal} ooit ingeschreven</p>
        </div>
        <div className="panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-warm">Verzonden vandaag</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink-900">
            {vandaag}
            <span className="text-base font-semibold text-ink-400"> / {inst.dagLimiet}</span>
          </p>
          <p className="text-[12px] text-warm">daglimiet over alle campagnes</p>
        </div>
        <div className="panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-warm">Doel bereikt</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink-900">{doel}</p>
          <p className="text-[12px] text-warm">afspraak, reactie, klant of order ({pct(doel, totaal)})</p>
        </div>
      </section>

      {alle.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <StatusChips basePath="/dashboard/campagnes" huidig={status} statussen={CAMPAGNE_STATUSSEN.map((s) => s)} aantallen={aantallen} bewaar={{ q }} alleLabel="Alle" />
          <LiveZoekveld placeholder="Zoek op naam of trigger" ariaLabel="Zoek campagnes" breedte="w-full sm:w-72" />
        </div>
      )}

      {alle.length === 0 ? (
        <div className="mt-6">
          <EmptyState titel="Nog geen campagnes" tekst="Kopieer hieronder een voorbeeld of begin leeg via Nieuwe campagne." />
        </div>
      ) : zichtbaar.length === 0 ? (
        <div className="mt-6">
          <EmptyState tekst={`Geen campagnes ${status ? `met status ${CAMPAGNE_STATUS_LABEL[status]?.toLowerCase() ?? status}` : ''}${woorden ? ` die passen bij "${q}"` : ''}.`} />
        </div>
      ) : (
        <section className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {zichtbaar.map((c) => (
            <article key={c.id} className="panel flex flex-col p-4 transition-colors hover:border-ink-300">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/dashboard/campagnes/${c.id}`} className="block truncate font-display text-[15px] font-bold text-ink-900 hover:text-amber-700">
                    {c.naam}
                  </Link>
                  <p className="mt-0.5 truncate text-[12px] text-warm">{c.triggerTekst}</p>
                </div>
                <CampagneStatusBadge status={c.status} />
              </div>
              <p className="mt-2 text-[12px] text-ink-500">
                {DOELGROEP_LABEL[c.doelgroep]} · {c.aantalStappen} {c.aantalStappen === 1 ? 'stap' : 'stappen'} · {c.aantalMails} {c.aantalMails === 1 ? 'mail' : 'mails'}
              </p>
              <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-line pt-3 text-center">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-warm">In flow</dt>
                  <dd className="font-display text-lg font-bold tabular-nums text-ink-900">{c.actief}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-warm">Verzonden</dt>
                  <dd className="font-display text-lg font-bold tabular-nums text-ink-900">{c.verzonden}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-warm">Geklikt</dt>
                  <dd className="font-display text-lg font-bold tabular-nums text-ink-900">{pct(c.geklikt, c.verzonden)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-warm">Conversie</dt>
                  <dd className="font-display text-lg font-bold tabular-nums text-ink-900">{pct(c.doelBereikt, c.totaal)}</dd>
                </div>
              </dl>
              <div className="mt-3">
                <MiniBalken waarden={c.reeks} label={`Verzonden mails per dag, laatste 14 dagen: ${c.reeks.join(', ')}`} />
                <p className="mt-1 text-[11px] text-ink-400">Verzonden per dag, laatste 2 weken</p>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                <Link href={`/dashboard/campagnes/${c.id}`} className="knop-stil">Openen</Link>
                <div className="flex items-center gap-1">
                  <Link href={`/dashboard/campagnes/${c.id}?tab=rapport`} className="knop-tekst">Rapport</Link>
                  <form action={dupliceerCampagneActie}>
                    <input type="hidden" name="campagneId" value={c.id} />
                    <button type="submit" className="knop-tekst">Kopiëren</button>
                  </form>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      <details className="mt-8 group" open={alle.length === 0}>
        <summary className="cursor-pointer list-none text-[13px] font-semibold text-ink-900">
          <span className="underline-offset-2 group-hover:underline">Voorbeeldcampagnes</span>
          <span className="ml-2 font-normal text-warm">kant-en-klaar, met teksten in jouw toon</span>
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {VOORBEELDEN.map((v) => (
            <div key={v.sleutel} className="panel flex flex-col p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-[14px] font-bold text-ink-900">{v.naam}</h2>
                <span className="shrink-0 text-[11px] text-warm">{v.duur}</span>
              </div>
              <p className="mt-1 text-[12px] leading-snug text-ink-700">{v.korteUitleg}</p>
              <p className="mt-2 text-[12px] leading-snug text-warm">{v.waarom}</p>
              <form action={nieuweCampagneActie} className="mt-auto pt-3">
                <input type="hidden" name="voorbeeld" value={v.sleutel} />
                <button type="submit" className="knop-stil w-full">Kopiëren als concept</button>
              </form>
            </div>
          ))}
        </div>
      </details>
    </main>
  );
}
