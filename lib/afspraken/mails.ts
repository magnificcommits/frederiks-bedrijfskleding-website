import { emailLayout, escapeHtml, sendEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { site } from '@/content/site';
import { datumLang, nlDelen } from '@/app/dashboard/taken/tijd';
import { SOORT_INFO, type AfspraakSoort } from '@/lib/afspraken/soorten';
import { icsBijlage } from '@/lib/afspraken/ics';

/**
 * Mails rond een online afspraak: bevestiging (met .ics), herinnering, verzet,
 * annulering, en een seintje aan Jessi. Best effort: een mislukte mail laat de
 * boeking nooit mislukken.
 */

export type MailAfspraak = {
  id: string;
  soort: AfspraakSoort;
  start: Date;
  eind: Date;
  naam: string;
  bedrijf: string | null;
  email: string;
  telefoon: string | null;
  aantal_medewerkers: string | null;
  branche: string | null;
  opmerking: string | null;
  locatie: string | null;
  bron: string | null;
  token: string;
  ics_volgnummer: number;
};

function basis(): string {
  return env.siteUrl.replace(/\/$/, '');
}

export function beheerUrl(token: string): string {
  return `${basis()}/afspraak/beheer/${encodeURIComponent(token)}`;
}

/** "dinsdag 7 oktober om 10:00" in Nederlandse tijd. */
export function momentTekst(start: Date): string {
  const d = nlDelen(start);
  return `${datumLang(d.datum)} om ${d.tijd}`;
}

function eindTijd(eind: Date): string {
  return nlDelen(eind).tijd;
}

function knop(tekst: string, href: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background-color:#ec6726;color:#ffffff;font-weight:700;text-decoration:none;padding:11px 18px;border-radius:8px;">${escapeHtml(tekst)}</a>`;
}

function waarTekst(a: MailAfspraak): string {
  if (a.soort === 'showroom') return `Showroom Frederiks, ${site.address.street}, ${site.address.postalCode} ${site.address.city} (in de Brouwersmolen)`;
  if (a.soort === 'pasdag') return a.locatie ? `Bij jou op locatie: ${a.locatie}` : 'Bij jou op locatie';
  return a.locatie === 'Videogesprek' ? 'Videogesprek (je krijgt vooraf een link)' : `Jessi belt je op ${a.telefoon || 'het nummer dat je opgaf'}`;
}

function watNuTekst(soort: AfspraakSoort): string {
  if (soort === 'pasdag') {
    return 'Jessi belt je vooraf om de details af te stemmen: hoeveel mensen er passen, welke kleding en waar we kunnen staan. Daarna zetten we de definitieve tijd vast.';
  }
  if (soort === 'showroom') {
    return 'Je vindt de showroom in de Brouwersmolen aan de Kruisbergseweg. Heb je een logo? Neem het mee of stuur het vooraf, dan liggen er alvast voorbeelden klaar.';
  }
  return 'Denk alvast na over hoeveel mensen kleding nodig hebben en wat voor werk ze doen. Meer voorbereiding is niet nodig.';
}

function ics(a: MailAfspraak, geannuleerd = false) {
  const info = SOORT_INFO[a.soort];
  return icsBijlage({
    id: a.id,
    start: a.start,
    eind: a.eind,
    titel: `${info.label} met Frederiks Bedrijfskleding`,
    beschrijving: `${info.label} met Jessi Frederiks.\n\nVerzetten of annuleren: ${beheerUrl(a.token)}\nVragen? Bel of app ${site.phone}.`,
    locatie: a.soort === 'showroom' ? `${site.address.street}, ${site.address.postalCode} ${site.address.city}` : a.locatie,
    organisatorNaam: 'Jessi Frederiks',
    organisatorEmail: site.email,
    deelnemerNaam: a.naam,
    deelnemerEmail: a.email,
    volgnummer: a.ics_volgnummer,
    geannuleerd,
  });
}

function details(a: MailAfspraak): string {
  const info = SOORT_INFO[a.soort];
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 0;width:100%;border:1px solid #e4e2e0;border-radius:10px;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0;font-weight:700;color:#1c1c1c;">${escapeHtml(info.label)}</p>
        <p style="margin:6px 0 0;">${escapeHtml(momentTekst(a.start))} tot ${escapeHtml(eindTijd(a.eind))}${a.soort === 'pasdag' ? ' (voorkeur, we stemmen het samen af)' : ''}</p>
        <p style="margin:6px 0 0;">${escapeHtml(waarTekst(a))}</p>
      </td></tr>
    </table>`;
}

export async function mailBevestiging(a: MailAfspraak, verzet = false): Promise<boolean> {
  const info = SOORT_INFO[a.soort];
  const html = emailLayout({
    heading: verzet ? 'Je afspraak is verzet' : 'Je afspraak staat',
    preheader: `${info.label} op ${momentTekst(a.start)}.`,
    bodyHtml: `
      <p style="margin:0;">Hoi ${escapeHtml(a.naam.split(' ')[0] || a.naam)},</p>
      <p style="margin:14px 0 0;">${verzet ? 'Je afspraak is verplaatst. Dit is het nieuwe moment:' : 'Fijn dat je een afspraak hebt gemaakt. Dit staat er in de agenda:'}</p>
      ${details(a)}
      <p style="margin:16px 0 0;">${escapeHtml(watNuTekst(a.soort))}</p>
      <p style="margin:16px 0 0;">In de bijlage zit de afspraak voor je agenda. Komt het toch niet uit? Verzet of annuleer hem met de knop hieronder.</p>
      <p style="margin:18px 0 0;">${knop('Verzetten of annuleren', beheerUrl(a.token))}</p>
      <p style="margin:18px 0 0;">Tot dan!<br/>Jessi Frederiks<br/>${escapeHtml(site.phone)}</p>
    `,
  });
  const res = await sendEmail({
    to: a.email,
    replyTo: site.email,
    subject: `${verzet ? 'Verzet: ' : ''}${info.label} op ${momentTekst(a.start)}`,
    html,
    attachments: [ics(a)],
  }).catch(() => ({ sent: false }));
  return res.sent;
}

export async function mailHerinnering(a: MailAfspraak): Promise<boolean> {
  const info = SOORT_INFO[a.soort];
  const html = emailLayout({
    heading: 'Morgen zien of spreken we elkaar',
    preheader: `${info.label} morgen om ${nlDelen(a.start).tijd}.`,
    bodyHtml: `
      <p style="margin:0;">Hoi ${escapeHtml(a.naam.split(' ')[0] || a.naam)},</p>
      <p style="margin:14px 0 0;">Even een geheugensteuntje voor morgen:</p>
      ${details(a)}
      <p style="margin:16px 0 0;">${escapeHtml(watNuTekst(a.soort))}</p>
      <p style="margin:18px 0 0;">${knop('Verzetten of annuleren', beheerUrl(a.token))}</p>
      <p style="margin:18px 0 0;">Groet,<br/>Jessi Frederiks<br/>${escapeHtml(site.phone)}</p>
    `,
  });
  const res = await sendEmail({
    to: a.email,
    replyTo: site.email,
    subject: `Morgen: ${info.label.toLowerCase()} om ${nlDelen(a.start).tijd}`,
    html,
  }).catch(() => ({ sent: false }));
  return res.sent;
}

export async function mailAnnulering(a: MailAfspraak, doorKlant: boolean): Promise<boolean> {
  const info = SOORT_INFO[a.soort];
  const html = emailLayout({
    heading: 'Je afspraak is geannuleerd',
    preheader: `${info.label} op ${momentTekst(a.start)} gaat niet door.`,
    bodyHtml: `
      <p style="margin:0;">Hoi ${escapeHtml(a.naam.split(' ')[0] || a.naam)},</p>
      <p style="margin:14px 0 0;">${
        doorKlant
          ? `Je hebt de afspraak van ${escapeHtml(momentTekst(a.start))} geannuleerd. Hij is uit onze agenda gehaald.`
          : `De afspraak van ${escapeHtml(momentTekst(a.start))} kan helaas niet doorgaan. Jessi neemt contact met je op voor een nieuw moment.`
      }</p>
      <p style="margin:14px 0 0;">Wil je toch een ander moment? Dat prik je zo: ${knop('Nieuwe afspraak maken', `${basis()}/afspraak`)}</p>
      <p style="margin:18px 0 0;">Groet,<br/>Jessi Frederiks<br/>${escapeHtml(site.phone)}</p>
    `,
  });
  const res = await sendEmail({
    to: a.email,
    replyTo: site.email,
    subject: `Geannuleerd: ${info.label.toLowerCase()} op ${momentTekst(a.start)}`,
    html,
    attachments: [ics(a, true)],
  }).catch(() => ({ sent: false }));
  return res.sent;
}

/** Seintje aan Jessi (meldadres) bij een nieuwe, verzette of geannuleerde afspraak. */
export async function mailJessi(a: MailAfspraak, wat: 'nieuw' | 'verzet' | 'geannuleerd', oudeStart?: Date): Promise<boolean> {
  const info = SOORT_INFO[a.soort];
  const kop = wat === 'nieuw' ? 'Nieuwe afspraak via de website' : wat === 'verzet' ? 'Afspraak verzet door de klant' : 'Afspraak geannuleerd door de klant';
  const regel = (label: string, waarde: string | null) =>
    waarde ? `<p style="margin:6px 0 0;"><strong style="color:#1c1c1c;">${label}:</strong> ${escapeHtml(waarde)}</p>` : '';
  const html = emailLayout({
    heading: kop,
    preheader: `${info.label}, ${momentTekst(a.start)}, ${a.bedrijf || a.naam}`,
    bodyHtml: `
      ${regel('Soort', info.label)}
      ${regel('Wanneer', `${momentTekst(a.start)} tot ${eindTijd(a.eind)}`)}
      ${oudeStart ? regel('Was', momentTekst(oudeStart)) : ''}
      ${regel('Waar', a.locatie)}
      ${regel('Naam', a.naam)}
      ${regel('Bedrijf', a.bedrijf)}
      ${regel('E-mail', a.email)}
      ${regel('Telefoon', a.telefoon)}
      ${regel('Medewerkers', a.aantal_medewerkers)}
      ${regel('Branche', a.branche)}
      ${a.opmerking ? `<p style="margin:10px 0 0;"><strong style="color:#1c1c1c;">Opmerking:</strong><br/>${escapeHtml(a.opmerking).replace(/\n/g, '<br/>')}</p>` : ''}
      ${regel('Herkomst', a.bron)}
      <p style="margin:18px 0 0;">${knop('Open de afspraken', `${basis()}/dashboard/afspraken`)}</p>
    `,
  });
  const res = await sendEmail({
    to: env.notifyEmail,
    replyTo: a.email,
    subject: `${wat === 'nieuw' ? 'Afspraak' : wat === 'verzet' ? 'Verzet' : 'Geannuleerd'}: ${info.label.toLowerCase()} ${momentTekst(a.start)} (${a.bedrijf || a.naam})`,
    html,
  }).catch(() => ({ sent: false }));
  return res.sent;
}
