import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { env, isEmailConfigured } from '@/lib/env';
import { listTaakPersonenMetToken } from '@/lib/kms/taakPersonen';
import { listTaakStatussen, aantallenPerStatus, isTerugval } from '@/lib/kms/taakStatussen';
import { takenV2Actief } from '@/lib/kms/taken';
import InstellingenBeheer from './InstellingenBeheer';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Taken: instellingen', robots: { index: false, follow: false } };

export default async function TakenInstellingenPage() {
  if (!(await dashAuthed())) redirect('/dashboard');

  const [personen, statussen, aantallen, v2] = await Promise.all([
    listTaakPersonenMetToken(),
    listTaakStatussen(),
    aantallenPerStatus(),
    takenV2Actief(),
  ]);
  const basis = env.siteUrl.replace(/\/$/, '');
  const meldingenAan = Boolean((process.env.TAKEN_CRON_SECRET ?? '').trim());

  return (
    <main className="container-smal py-6">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/taken" className="knop-tekst" aria-label="Terug naar taken">
            ‹ Taken
          </Link>
          <h1 className="dash-h1">Instellingen voor taken</h1>
        </div>
      </div>

      {(!v2 || isTerugval(statussen)) && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-ink-800">
          De database is nog niet bijgewerkt (migratie taken v2). Personen en statussen kun je beheren zodra die update is gedraaid.
        </p>
      )}

      <section className="mt-5 rounded-lg border border-line bg-white p-4 text-[13px] text-warm">
        <p className="font-semibold text-ink-900">Meldingen per mail</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>
            Mail versturen: {isEmailConfigured ? <span className="font-semibold text-green-700">ingesteld</span> : <span className="font-semibold text-red-700">nog niet ingesteld (Resend)</span>}
          </li>
          <li>
            Automatische ronde elke 10 minuten:{' '}
            {meldingenAan ? <span className="font-semibold text-green-700">sleutel aanwezig</span> : <span className="font-semibold text-red-700">nog niet ingesteld (TAKEN_CRON_SECRET)</span>}
          </li>
          <li>Dagoverzicht elke ochtend om 7:00, weekoverzicht op maandag om 7:00. Herinneringen op het moment dat je bij een taak kiest.</li>
        </ul>
      </section>

      <InstellingenBeheer
        personen={personen.map((p) => ({
          ...p,
          agendaUrl: p.agenda_token ? `${basis}/api/agenda/${p.agenda_token}` : null,
        }))}
        statussen={statussen}
        aantallen={aantallen}
        bewerkbaar={v2 && !isTerugval(statussen)}
      />
    </main>
  );
}
