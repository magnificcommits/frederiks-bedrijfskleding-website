import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie, getKledinglijn, getMatenMap, getVerbruik } from '@/lib/portaal/queries';
import { getMijnToegang, listTeam } from '@/lib/portaal/team';
import { getVertaler } from '@/lib/i18n/portaal/server';
import type { Sleutel } from '@/lib/i18n/portaal/nl';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import PortaalNav from '../PortaalNav';
import MedewerkersLijst, { type MedewerkerRij } from './MedewerkersLijst';
import { listMijnVerzoeken } from '@/lib/portaal/verzoeken';
import {
  nieuweMedewerker,
  verwijderMedewerkerAction,
  bewaarBudget,
  geefToegangAction,
  wijzigRolAction,
  trekToegangInAction,
} from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getVertaler();
  return { title: t('nav.medewerkers'), robots: { index: false, follow: false } };
}
export const dynamic = 'force-dynamic';

const veld =
  'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
const selectMini =
  'mt-1 rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

const meldingen: Record<string, { soort: 'ok' | 'fout'; tekst: Sleutel }> = {
  toegevoegd: { soort: 'ok', tekst: 'medewerkers.okToegevoegd' },
  verwijderd: { soort: 'ok', tekst: 'medewerkers.okVerwijderd' },
  verzoek: { soort: 'ok', tekst: 'medewerkers.okVerzoek' },
  budget: { soort: 'ok', tekst: 'medewerkers.okBudget' },
  maten: { soort: 'ok', tekst: 'medewerkers.okMaten' },
  toegang: { soort: 'ok', tekst: 'medewerkers.okToegang' },
  rol: { soort: 'ok', tekst: 'medewerkers.okRol' },
  ingetrokken: { soort: 'ok', tekst: 'medewerkers.okIngetrokken' },
  naam: { soort: 'fout', tekst: 'medewerkers.foutNaam' },
  email: { soort: 'fout', tekst: 'medewerkers.foutEmail' },
  opslaan: { soort: 'fout', tekst: 'algemeen.foutOpslaan' },
};

export default async function Medewerkers({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; fout?: string }>;
}) {
  const { t, euro } = await getVertaler();
  const formatEuro = (n: number) => euro(n, 0);
  if (!isPortalConfigured) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">{t('algemeen.nietActiefTitel')}</h1>
          <p className="mt-3 text-sm text-warm">{t('algemeen.nietActiefTekst')}</p>
        </div>
      </main>
    );
  }

  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const org = await getMijnOrganisatie();
  if (!org) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">{t('algemeen.nietGekoppeldTitel')}</h1>
          <p className="mt-3 text-sm text-warm">{t('algemeen.nietGekoppeldTekst', { email: user.email ?? '' })}</p>
        </div>
      </main>
    );
  }

  const toegang = await getMijnToegang();
  const magBeheren = toegang.rol === 'beheerder' || toegang.rol === 'leidinggevende';
  const magToegang = toegang.rol === 'beheerder';
  if (!magBeheren) {
    return (
      <main className="container-x py-12">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
        <h1 className="font-display text-3xl font-extrabold text-ink-900">{t('nav.medewerkers')}</h1>
        <PortaalNav rol={toegang.rol} actief="/portaal/medewerkers" />
        <div className="mt-8 max-w-xl rounded-2xl border border-line bg-white p-6 shadow-soft">
          <p className="text-sm text-warm">{t('medewerkers.alleenBeheer')}</p>
          <Link href="/portaal" className="mt-4 inline-block text-sm font-semibold text-warm hover:text-ink-800">
            {t('algemeen.terugNaarOverzicht')}
          </Link>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const melding = sp?.ok ? meldingen[sp.ok] : sp?.fout ? meldingen[sp.fout] : null;

  const [team, items, verbruik, verzoeken] = await Promise.all([
    listTeam(),
    getKledinglijn(),
    getVerbruik(),
    listMijnVerzoeken(),
  ]);
  const matenPer: Record<string, Record<string, string>> = Object.fromEntries(
    await Promise.all(team.map(async (m) => [m.medewerkerId, await getMatenMap(m.medewerkerId)] as const)),
  );

  const rijen: MedewerkerRij[] = team.map((m) => {
    const v = verbruik[m.medewerkerId] ?? 0;
    const restant = m.budget != null ? Number(m.budget) - v : null;
    const budgetRestantLabel = restant != null ? t('medewerkers.restantLabel', { bedrag: formatEuro(restant) }) : '';
    const loginLabel = m.toegang
      ? t('medewerkers.kanInloggen', { rol: t(`rol.${m.toegang.rol}`) })
      : t('medewerkers.geenLogin');

    const detail = (
      <>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {magToegang && (
            <Link
              href={`/portaal/team/${m.medewerkerId}`}
              className="inline-block rounded-md border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist"
            >
              {t('medewerkers.instellingen')}
            </Link>
          )}
          <form action={verwijderMedewerkerAction}>
            <input type="hidden" name="id" value={m.medewerkerId} />
            <input type="hidden" name="naam" value={m.naam} />
            <input type="hidden" name="email" value={m.email ?? ''} />
            <ConfirmSubmit
              message={t('medewerkers.bevestigVerwijderen', { naam: m.naam })}
              className="py-1 text-xs font-semibold text-warm hover:text-amber-800"
            >
              {t('medewerkers.verwijderingAanvragen')}
            </ConfirmSubmit>
          </form>
        </div>

        {/* Budget */}
        <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-line pt-4">
          <form action={bewaarBudget} className="flex items-end gap-2">
            <input type="hidden" name="medewerker_id" value={m.medewerkerId} />
            <div>
              <label className="block text-xs font-semibold text-warm">{t('medewerkers.jaarbudget')}</label>
              <input
                name="budget"
                defaultValue={m.budget ?? ''}
                inputMode="decimal"
                placeholder={t('medewerkers.budgetPlaceholder')}
                className="mt-1 w-28 rounded-md border border-line bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <button className="rounded-md border border-line bg-white px-2.5 py-2 text-xs font-semibold text-ink-700 hover:bg-mist">
              {t('algemeen.opslaan')}
            </button>
          </form>
          <div className="py-1 text-sm">
            <p className="text-warm">
              {t('medewerkers.verbruikt')} <span className="font-semibold text-ink-900">{formatEuro(v)}</span>
            </p>
            {restant != null && (
              <p className={`font-semibold ${restant < 0 ? 'text-amber-700' : 'text-ink-700'}`}>
                {t('medewerkers.restant')} {formatEuro(restant)}
              </p>
            )}
          </div>
        </div>

        {/* Maten: alleen-lezen. Frederiks legt de maten vast bij het passen. */}
        {items.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-warm">{t('medewerkers.maten')}</p>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {items.map((it) => (
                <div key={it.id} className="flex justify-between gap-3 border-b border-line/60 py-1">
                  <dt className="text-warm">{it.naam}</dt>
                  <dd className="font-semibold text-ink-900">{matenPer[m.medewerkerId]?.[it.id] || <span className="font-normal text-warm">{t('medewerkers.nogNietGepast')}</span>}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-warm">{t('medewerkers.matenDoorFrederiks')}</p>
          </div>
        )}

        {/* Toegang, alleen voor de beheerder */}
        {magToegang && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-warm">{t('medewerkers.toegangPortaal')}</p>
            {m.toegang ? (
              <div className="flex flex-wrap items-end gap-3">
                <form action={wijzigRolAction} className="flex items-end gap-2">
                  <input type="hidden" name="email" value={m.toegang.email} />
                  <div>
                    <label className="block text-xs font-semibold text-warm">{t('medewerkers.rol')}</label>
                    <select name="rol" defaultValue={m.toegang.rol} className={selectMini}>
                      <option value="medewerker">{t('rol.medewerker')}</option>
                      <option value="leidinggevende">{t('rol.leidinggevende')}</option>
                      <option value="beheerder">{t('rol.beheerder')}</option>
                    </select>
                  </div>
                  <button className="rounded-md border border-line bg-white px-2.5 py-2 text-xs font-semibold text-ink-700 hover:bg-mist">
                    {t('medewerkers.rolOpslaan')}
                  </button>
                </form>
                <form action={trekToegangInAction}>
                  <input type="hidden" name="email" value={m.toegang.email} />
                  <ConfirmSubmit
                    message={t('medewerkers.bevestigIntrekken', { naam: m.naam })}
                    className="py-2 text-xs font-semibold text-warm hover:text-amber-800"
                  >
                    {t('medewerkers.toegangIntrekken')}
                  </ConfirmSubmit>
                </form>
              </div>
            ) : m.email ? (
              <form action={geefToegangAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="medewerker_id" value={m.medewerkerId} />
                <input type="hidden" name="naam" value={m.naam} />
                <input type="hidden" name="email" value={m.email} />
                <div>
                  <label className="block text-xs font-semibold text-warm">{t('medewerkers.geefToegangAls')}</label>
                  <select name="rol" defaultValue="medewerker" className={selectMini}>
                    <option value="medewerker">{t('rol.medewerker')}</option>
                    <option value="leidinggevende">{t('rol.leidinggevende')}</option>
                    <option value="beheerder">{t('rol.beheerder')}</option>
                  </select>
                </div>
                <button className="rounded-md bg-ink-900 px-3 py-2 text-xs font-semibold text-white hover:bg-ink-800">
                  {t('medewerkers.toegangGeven')}
                </button>
              </form>
            ) : (
              <p className="text-xs text-warm">
                {t('medewerkers.geenEmail')}
              </p>
            )}
          </div>
        )}
      </>
    );

    return {
      id: m.medewerkerId,
      naam: m.naam,
      functie: m.functie ?? '',
      loginLabel,
      heeftLogin: Boolean(m.toegang),
      budgetRestantLabel,
      detail,
    };
  });

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{t('nav.medewerkers')}</h1>
        </div>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/medewerkers" />

      <p className="mt-6 max-w-2xl text-sm text-warm">
        {t('medewerkers.intro')}
        {magToegang
          ? ` ${t('medewerkers.introBeheerder')}`
          : ` ${t('medewerkers.introLeidinggevende')}`}
      </p>

      {melding && (
        <div
          className={`mt-6 rounded-xl border p-4 text-sm ${
            melding.soort === 'ok'
              ? 'border-green-300 bg-green-50 text-green-800'
              : 'border-amber-300 bg-amber-50 text-ink-800'
          }`}
        >
          {t(melding.tekst)}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MedewerkersLijst rijen={rijen} />
        </div>

        <div>
          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900">{t('medewerkers.aanvragenTitel')}</h2>
            <p className="mt-1 text-xs text-warm">
              {t('medewerkers.aanvragenUitleg')}
            </p>
            <form action={nieuweMedewerker} className="mt-4">
              <label className="block text-sm font-semibold text-ink-900">{t('medewerkers.naam')}</label>
              <input name="naam" required placeholder={t('medewerkers.naam')} className={veld} />
              <label className="mt-3 block text-sm font-semibold text-ink-900">{t('medewerkers.functieOptioneel')}</label>
              <input name="functie" placeholder={t('medewerkers.functiePlaceholder')} className={veld} />
              <label className="mt-3 block text-sm font-semibold text-ink-900">{t('medewerkers.emailOptioneel')}</label>
              <input name="email" type="email" placeholder={t('login.emailPlaceholder')} className={veld} />
              <label className="mt-3 block text-sm font-semibold text-ink-900">{t('medewerkers.jaarbudgetOptioneel')}</label>
              <input name="budget" inputMode="decimal" placeholder={t('medewerkers.budgetPlaceholder')} className={veld} />
              <button className="btn-primary mt-4 w-full justify-center">{t('medewerkers.verzoekIndienen')}</button>
            </form>
          </div>

          <div className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900">{t('medewerkers.wijzigingsverzoeken')}</h2>
            <p className="mt-1 text-xs text-warm">
              {t('medewerkers.verzoekenUitleg')}
            </p>
            {verzoeken.length === 0 ? (
              <p className="mt-4 text-sm text-warm">{t('medewerkers.geenVerzoeken')}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {verzoeken.map((v) => {
                  const typeLabel = v.type === 'toevoegen' ? t('medewerkers.typeToevoegen') : t('medewerkers.typeVerwijderen');
                  const statusLabel =
                    v.status === 'goedgekeurd'
                      ? t('status.verzoek.goedgekeurd')
                      : v.status === 'afgewezen'
                        ? t('status.verzoek.afgewezen')
                        : t('status.verzoek.wacht');
                  const badge =
                    v.status === 'goedgekeurd'
                      ? 'border-green-300 bg-green-50 text-green-800'
                      : v.status === 'afgewezen'
                        ? 'border-amber-300 bg-amber-50 text-amber-700'
                        : 'border-line bg-mist text-warm';
                  return (
                    <li
                      key={v.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{v.naam ?? t('algemeen.onbekend')}</p>
                        <p className="text-xs text-warm">{typeLabel}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badge}`}>
                        {statusLabel}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
