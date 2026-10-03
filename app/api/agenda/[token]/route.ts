import { kmsAdmin } from '@/lib/kms/adminClient';
import { env } from '@/lib/env';
import { persoonBijAgendaToken } from '@/lib/kms/taakPersonen';
import { takenV2Actief } from '@/lib/kms/taken';
import { isDatum, isTijd, nlNaarDate, plusDagen, plusMinuten, tijdKort, vandaagNl, STANDAARD_TIJD } from '@/app/dashboard/taken/tijd';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Agenda-abonnement per persoon (ICS), zoals de agenda-feeds van Todoist en Asana.
 * De geheime sleutel in de URL is de toegang: wie de link heeft, ziet de agenda.
 * Nieuwe link maken kan onder Taken → Instellingen (de oude werkt dan niet meer).
 *
 * Inhoud: afspraken (met begin- en eindtijd) en taken met een datum van deze
 * persoon, van 60 dagen terug tot een jaar vooruit, niet uit de prullenbak.
 * Taken zonder tijd staan als "hele dag" in de agenda en houden je niet bezet.
 */

type Rij = {
  id: string;
  titel: string;
  omschrijving: string | null;
  soort: string | null;
  status: string | null;
  werkstatus: string | null;
  vervaldatum: string | null;
  tijd: string | null;
  eind_tijd: string | null;
  locatie: string | null;
  herinnering_minuten: number | null;
  created_at: string;
  organisaties: { naam: string | null } | null;
};

function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** Regels langer dan 75 bytes vouwen (RFC 5545), zonder een teken door te knippen. */
function vouw(regel: string): string {
  const enc = new TextEncoder();
  const delen: string[] = [];
  let huidig = '';
  let bytes = 0;
  for (const teken of regel) {
    const b = enc.encode(teken).length;
    const grens = delen.length === 0 ? 75 : 74;
    if (bytes + b > grens) {
      delen.push(huidig);
      huidig = '';
      bytes = 0;
    }
    huidig += teken;
    bytes += b;
  }
  delen.push(huidig);
  return delen.join('\r\n ');
}

function utc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function datumIcs(datum: string): string {
  return datum.replace(/-/g, '');
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const schoon = String(token ?? '').replace(/\.ics$/i, '');
  const persoon = await persoonBijAgendaToken(schoon);
  const sb = kmsAdmin();
  if (!persoon || !sb || !(await takenV2Actief())) {
    return new Response('Deze agendalink bestaat niet (meer).', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const vandaag = vandaagNl();
  let q = sb
    .from('taken')
    .select('id, titel, omschrijving, soort, status, werkstatus, vervaldatum, tijd, eind_tijd, locatie, herinnering_minuten, created_at, organisaties(naam)')
    .is('verwijderd_op', null)
    .gte('vervaldatum', plusDagen(vandaag, -60))
    .lte('vervaldatum', plusDagen(vandaag, 366))
    .order('vervaldatum')
    .limit(3000);
  q = persoon.ook_zonder_persoon ? q.or(`persoon_id.eq.${persoon.id},persoon_id.is.null`) : q.eq('persoon_id', persoon.id);
  const { data } = await q;
  const rijen = (data as unknown as Rij[]) ?? [];

  const link = `${env.siteUrl.replace(/\/$/, '')}/dashboard/taken`;
  const nu = utc(new Date());
  const regels: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Frederiks Bedrijfskleding//Taken//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(`Frederiks taken (${persoon.naam})`)}`,
    'X-WR-TIMEZONE:Europe/Amsterdam',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  for (const t of rijen) {
    if (!isDatum(t.vervaldatum)) continue;
    const afspraak = t.soort === 'afspraak';
    const klaar = t.status === 'klaar';
    const tijd = tijdKort(t.tijd);
    const klant = t.organisaties?.naam && t.organisaties.naam !== t.titel ? t.organisaties.naam : '';
    const summary = `${klaar ? 'Afgerond: ' : afspraak ? '' : 'Taak: '}${t.titel}${klant ? ` (${klant})` : ''}`;
    const beschrijving = [t.omschrijving ?? '', t.werkstatus ? `Status: ${t.werkstatus}` : '', link].filter(Boolean).join('\n\n');

    regels.push('BEGIN:VEVENT');
    regels.push(`UID:taak-${t.id}@frederiksbedrijfskleding.nl`);
    regels.push(`DTSTAMP:${nu}`);
    if (isTijd(tijd)) {
      const begin = nlNaarDate(t.vervaldatum, tijd);
      const eindTijd = afspraak && isTijd(tijdKort(t.eind_tijd)) ? tijdKort(t.eind_tijd) : plusMinuten(tijd, afspraak ? 60 : 30);
      let eind = nlNaarDate(t.vervaldatum, eindTijd);
      if (eind.getTime() <= begin.getTime()) eind = new Date(begin.getTime() + 30 * 60000);
      regels.push(`DTSTART:${utc(begin)}`);
      regels.push(`DTEND:${utc(eind)}`);
    } else {
      regels.push(`DTSTART;VALUE=DATE:${datumIcs(t.vervaldatum)}`);
      regels.push(`DTEND;VALUE=DATE:${datumIcs(plusDagen(t.vervaldatum, 1))}`);
    }
    regels.push(`TRANSP:${afspraak && isTijd(tijd) ? 'OPAQUE' : 'TRANSPARENT'}`);
    regels.push(`SUMMARY:${escapeIcs(summary)}`);
    if (beschrijving) regels.push(`DESCRIPTION:${escapeIcs(beschrijving)}`);
    if (t.locatie) regels.push(`LOCATION:${escapeIcs(t.locatie)}`);
    regels.push(`URL:${link}`);
    regels.push('STATUS:CONFIRMED');
    if (!klaar && t.herinnering_minuten !== null && t.herinnering_minuten !== undefined) {
      const min = Number(t.herinnering_minuten);
      // Zonder tijd telt de herinnering vanaf 09:00; in de agenda is dat vanaf middernacht, dus schuiven.
      const vanaf = isTijd(tijd) ? min : min - (Number(STANDAARD_TIJD.slice(0, 2)) * 60);
      regels.push('BEGIN:VALARM');
      regels.push('ACTION:DISPLAY');
      regels.push(`DESCRIPTION:${escapeIcs(summary)}`);
      regels.push(`TRIGGER:${vanaf >= 0 ? '-' : ''}PT${Math.abs(vanaf)}M`);
      regels.push('END:VALARM');
    }
    regels.push('END:VEVENT');
  }
  regels.push('END:VCALENDAR');

  const body = regels.map(vouw).join('\r\n') + '\r\n';
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="frederiks-taken.ics"',
      'Cache-Control': 'private, max-age=300',
      'X-Robots-Tag': 'noindex',
    },
  });
}
