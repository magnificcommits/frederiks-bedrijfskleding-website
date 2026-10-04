/**
 * Eén afspraak als .ics-bestand (RFC 5545), voor de bijlage in de bevestigingsmail.
 * Met METHOD:REQUEST zet Outlook/Gmail/Apple hem met één klik in de agenda; bij een
 * verzetting gaat SEQUENCE omhoog zodat dezelfde afspraak wordt bijgewerkt, en bij
 * annuleren stuurt METHOD:CANCEL hem er weer uit.
 */

function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** Regels langer dan 75 bytes vouwen, zonder een teken door te knippen. */
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

export type IcsAfspraak = {
  id: string;
  start: Date;
  eind: Date;
  titel: string;
  beschrijving: string;
  locatie?: string | null;
  organisatorNaam: string;
  organisatorEmail: string;
  deelnemerNaam: string;
  deelnemerEmail: string;
  volgnummer: number;
  geannuleerd?: boolean;
};

export function bouwIcs(a: IcsAfspraak): string {
  const methode = a.geannuleerd ? 'CANCEL' : 'REQUEST';
  const regels = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Frederiks Bedrijfskleding//Afspraken//NL',
    'CALSCALE:GREGORIAN',
    `METHOD:${methode}`,
    'BEGIN:VEVENT',
    `UID:afspraak-${a.id}@frederiksbedrijfskleding.nl`,
    `SEQUENCE:${a.volgnummer}`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(a.start)}`,
    `DTEND:${utc(a.eind)}`,
    `SUMMARY:${escapeIcs(a.titel)}`,
    `DESCRIPTION:${escapeIcs(a.beschrijving)}`,
    ...(a.locatie ? [`LOCATION:${escapeIcs(a.locatie)}`] : []),
    `ORGANIZER;CN=${escapeIcs(a.organisatorNaam)}:mailto:${a.organisatorEmail}`,
    `ATTENDEE;CN=${escapeIcs(a.deelnemerNaam)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:${a.deelnemerEmail}`,
    `STATUS:${a.geannuleerd ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
  ];
  if (!a.geannuleerd) {
    regels.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeIcs(a.titel)}`, 'TRIGGER:-PT1H', 'END:VALARM');
  }
  regels.push('END:VEVENT', 'END:VCALENDAR');
  return regels.map(vouw).join('\r\n') + '\r\n';
}

/** Base64 voor de Resend-bijlage. */
export function icsBijlage(a: IcsAfspraak): { filename: string; content: string } {
  return {
    filename: a.geannuleerd ? 'afspraak-geannuleerd.ics' : 'afspraak-frederiks.ics',
    content: Buffer.from(bouwIcs(a), 'utf-8').toString('base64'),
  };
}
