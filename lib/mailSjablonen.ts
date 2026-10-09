import { emailGegevens, emailKader, emailKnop, emailLayout, escapeHtml } from '@/lib/email';
import { site } from '@/content/site';

/**
 * HTML van de mails die vanuit een route handler of server action worden
 * verstuurd. Die bestanden mogen geen losse (synchrone) functies exporteren,
 * dus staan de sjablonen hier: puur, zonder database of netwerk, en daardoor
 * ook te bekijken in een test.
 */

const INK = '#1c1c1c';
const P = 'margin:14px 0 0;';

/** Meerregelige tekst van een bezoeker: ge-escaped, regeleinden blijven staan. */
function tekstMetRegels(s: string | null | undefined): string {
  return escapeHtml(s ?? '').replace(/\r?\n/g, '<br/>');
}

function telLink(tel: string | null | undefined): string {
  const t = String(tel ?? '').trim();
  if (!t) return '';
  return `<a href="tel:${escapeHtml(t.replace(/[^0-9+]/g, ''))}" style="color:${INK};font-weight:700;text-decoration:none;white-space:nowrap;">${escapeHtml(t)}</a>`;
}

function mailLink(email: string | null | undefined): string {
  const e = String(email ?? '').trim();
  if (!e) return '';
  return `<a href="mailto:${escapeHtml(e)}" style="color:${INK};">${escapeHtml(e)}</a>`;
}

/** Lijst met artikelen: naam vet, details eronder, aantal rechts. */
function artikelTabel(regels: { naam: string; detail?: string | null; aantal?: string | number | null }[]): string {
  if (regels.length === 0) return '';
  const rijen = regels
    .map(
      (r) => `<tr>
  <td valign="top" style="padding:10px 12px 10px 0;border-bottom:1px solid #eeeceb;">
    <div style="font-size:14px;font-weight:700;color:${INK};line-height:1.4;">${escapeHtml(r.naam)}</div>
    ${r.detail ? `<div style="margin-top:2px;font-size:13px;color:#52504e;line-height:1.45;">${escapeHtml(r.detail)}</div>` : ''}
  </td>
  <td valign="top" align="right" style="padding:10px 0;border-bottom:1px solid #eeeceb;font-size:14px;font-weight:700;color:${INK};white-space:nowrap;">${r.aantal != null && r.aantal !== '' ? `${escapeHtml(r.aantal)}x` : ''}</td>
</tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 0;border-collapse:collapse;border-top:2px solid ${INK};">${rijen}</table>`;
}

function kopje(tekst: string): string {
  return `<p style="margin:24px 0 0;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${INK};">${escapeHtml(tekst)}</p>`;
}

/* ------------------------------------------------------------------ */
/* Offerte-/adviesaanvraag (app/api/lead)                              */
/* ------------------------------------------------------------------ */

export type LeadMeldingInvoer = {
  dbFout: boolean;
  fout?: string | null;
  waarschuwingen: string[];
  kmsLink: string | null;
  taak?: { persoon: string | null; datum: string; tijd: string } | null;
  offerte?: { nummer: number | null } | null;
  ingang: string;
  name: string;
  company?: string | null;
  email: string;
  phone?: string | null;
  branche?: string | null;
  aantal?: string | null;
  bron?: string | null;
  landingspagina?: string | null;
  paginasBekeken?: number | null;
  bericht?: string | null;
  regels: { omschrijving: string; kleur: string | null; maat: string | null; aantal: number | null; opmerking: string | null }[];
};

export function leadMeldingHtml(d: LeadMeldingInvoer): string {
  const wie = d.company?.trim() || d.name;
  const vervolg = [
    d.taak ? `Er staat een taak voor ${escapeHtml(d.taak.persoon ?? 'het team')} op ${escapeHtml(d.taak.datum)} om ${escapeHtml(d.taak.tijd)}.` : '',
    d.offerte ? `Concept-offerte ${escapeHtml(d.offerte.nummer ?? '')} staat klaar.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return emailLayout({
    heading: `Nieuwe aanvraag van ${wie}`,
    preheader: [d.name, d.ingang, d.phone].filter(Boolean).join(', '),
    bodyHtml: `
      ${d.dbFout ? emailKader(`<strong>Deze aanvraag staat niet in het KMS.</strong> Opslaan in de database lukte niet${d.fout ? ` (${escapeHtml(d.fout)})` : ''}. Voer hem met de hand in bij Leads, anders valt hij buiten de opvolging.`, 'fout') : ''}
      ${!d.dbFout && d.waarschuwingen.length ? emailKader(`Staat in het KMS, maar: ${escapeHtml(d.waarschuwingen.join(' '))}`, 'let-op') : ''}
      <p style="${P}">${escapeHtml(d.name)}${d.company ? ` van <strong style="color:${INK};">${escapeHtml(d.company)}</strong>` : ''} vroeg via de website een offerte of advies aan.${vervolg ? ` ${vervolg}` : ''}</p>
      ${d.kmsLink ? emailKnop('Open in het KMS', d.kmsLink) : ''}
      ${emailGegevens([
        ['Ingang', escapeHtml(d.ingang)],
        ['Naam', escapeHtml(d.name)],
        ['Bedrijf', escapeHtml(d.company ?? '')],
        ['E-mail', mailLink(d.email)],
        ['Telefoon', telLink(d.phone)],
        ['Branche', escapeHtml(d.branche ?? '')],
        ['Medewerkers', escapeHtml(d.aantal ?? '')],
        ['Herkomst', escapeHtml(d.bron ?? '')],
        ...(d.landingspagina ? [['Eerste pagina', `${escapeHtml(d.landingspagina)}${d.paginasBekeken ? ` <span style="color:#8a8785;">(${d.paginasBekeken} pagina's bekeken)</span>` : ''}`] as [string, string]] : []),
      ])}
      ${d.bericht ? `${kopje('Bericht')}${emailKader(tekstMetRegels(d.bericht))}` : ''}
      ${
        d.regels.length
          ? `${kopje('Gekozen artikelen')}${artikelTabel(
              d.regels.map((r) => ({
                naam: r.omschrijving,
                detail: [r.kleur, r.maat ? `maat ${r.maat}` : null, r.opmerking].filter(Boolean).join(', '),
                aantal: r.aantal,
              })),
            )}`
          : ''
      }
    `,
  });
}

export function leadBevestigingHtml(naam: string): string {
  const voornaam = naam.trim().split(/\s+/)[0] || naam;
  return emailLayout({
    heading: 'Bedankt voor je aanvraag',
    preheader: 'We nemen zo snel mogelijk persoonlijk contact met je op.',
    bodyHtml: `
        <p style="margin:0;">Hoi ${escapeHtml(voornaam)},</p>
        <p style="${P}">Bedankt voor je aanvraag bij Frederiks Bedrijfskleding. We nemen zo snel mogelijk persoonlijk contact met je op om je wensen door te nemen en je te adviseren.</p>
        <p style="${P}">Heb je een dringende vraag? Bel of WhatsApp gerust: ${telLink(site.phone)}.</p>
        <p style="margin:20px 0 0;">Groet,<br/>Frederiks Bedrijfskleding</p>
      `,
  });
}

/* ------------------------------------------------------------------ */
/* "Mail jezelf je ontwerp" uit de pakketsamensteller                   */
/* ------------------------------------------------------------------ */

/** Content-ID van de ontwerp-PNG als inline-afbeelding in de klantmail. */
export const ONTWERP_CID = 'ontwerp-frederiks';

export type OntwerpMeldingInvoer = {
  dbFout: boolean;
  fout?: string | null;
  kmsLink: string | null;
  email: string;
  name?: string | null;
  bron?: string | null;
  bericht?: string | null;
  heeftOntwerp?: boolean;
};

export function ontwerpMeldingHtml(d: OntwerpMeldingInvoer): string {
  const wie = d.name?.trim() || d.email;
  return emailLayout({
    heading: 'Ontwerp gemaild, nog geen aanvraag',
    preheader: `${wie} mailde zichzelf een ontwerp uit de pakketsamensteller.`,
    bodyHtml: `
      ${d.dbFout ? emailKader(`<strong>Deze lead staat niet in het KMS.</strong> Opslaan lukte niet${d.fout ? ` (${escapeHtml(d.fout)})` : ''}. Voer hem met de hand in bij Leads.`, 'fout') : ''}
      <p style="${P}"><strong style="color:${INK};">${escapeHtml(wie)}</strong> heeft het ontwerp uit de pakketsamensteller naar zichzelf gemaild, maar nog geen offerte aangevraagd. Een mooi moment om proactief te bellen of mailen.</p>
      ${d.kmsLink ? emailKnop('Open in het KMS', d.kmsLink) : ''}
      ${emailGegevens([
        ['Naam', escapeHtml(d.name ?? '')],
        ['E-mail', mailLink(d.email)],
        ['Herkomst', escapeHtml(d.bron ?? '')],
      ])}
      ${d.bericht ? `${kopje('Pakket')}${emailKader(tekstMetRegels(d.bericht))}` : ''}
      ${d.heeftOntwerp ? `<p style="${P}font-size:13px;color:#8a8785;">Het ontwerp zit als afbeelding in de bijlage.</p>` : ''}
    `,
  });
}

export type OntwerpKlantInvoer = {
  name?: string | null;
  bericht?: string | null;
  /** Al gecontroleerde hervat-link op de eigen site (of leeg). */
  resumeUrl: string;
  /** Er gaat een PNG mee met contentId ONTWERP_CID. */
  heeftOntwerp: boolean;
  /** Gekozen kleding uit de samensteller (al opgeschoond). */
  regels?: { omschrijving: string; kleur: string | null; aantal: number | null; opmerking: string | null }[];
};

/** Kopregels uit het pakketbericht (branche, team, logo) die iets zeggen. */
function pakketKenmerken(bericht: string | null | undefined): string[] {
  const uit: string[] = [];
  for (const regel of String(bericht ?? '').split(/\r?\n/)) {
    const m = /^(Branche|Teamgrootte|Logo):\s*(.+)$/.exec(regel.trim());
    if (!m || /niet opgegeven/i.test(m[2])) continue;
    uit.push(m[1] === 'Teamgrootte' ? `${m[2]} medewerkers` : m[1] === 'Logo' ? `logo ${m[2]}` : m[2]);
  }
  return uit;
}

export function ontwerpKlantHtml(d: OntwerpKlantInvoer): string {
  const voornaam = (d.name ?? '').trim().split(/\s+/)[0];
  const regels = d.regels ?? [];
  const kenmerken = pakketKenmerken(d.bericht);
  const resume = d.resumeUrl;

  const pakket = regels.length
    ? `${kopje('Jouw pakket')}${kenmerken.length ? `<p style="margin:6px 0 0;font-size:13px;color:#52504e;">${escapeHtml(kenmerken.join(' · '))}</p>` : ''}${artikelTabel(
        regels.map((r) => ({ naam: r.omschrijving, detail: [r.kleur, r.opmerking].filter(Boolean).join(', '), aantal: r.aantal })),
      )}`
    : d.bericht
      ? `${kopje('Jouw pakket')}${emailKader(tekstMetRegels(d.bericht))}`
      : '';

  const beeld = d.heeftOntwerp
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;"><tr><td style="border:1px solid #e4e2e0;border-radius:10px;overflow:hidden;line-height:0;">
        ${resume ? `<a href="${escapeHtml(resume)}" target="_blank" style="display:block;">` : ''}<img src="cid:${ONTWERP_CID}" width="542" alt="Je ontwerp met je logo op de kleding" style="display:block;width:100%;max-width:542px;height:auto;border:0;border-radius:10px;">${resume ? '</a>' : ''}
      </td></tr></table>`
    : '';

  return emailLayout({
    heading: 'Je werkkledingontwerp',
    preheader: 'Je ontwerp en pakket op een rij. Ga verder waar je gebleven was of vraag vrijblijvend een offerte aan.',
    bodyHtml: `
        <p style="margin:0;">${voornaam ? `Hoi ${escapeHtml(voornaam)},` : 'Hoi,'}</p>
        <p style="${P}">Hier is het pakket dat je hebt samengesteld${d.heeftOntwerp ? ', met je logo op de kleding' : ''}. Je kunt het altijd verder aanpassen.</p>
        ${beeld}
        ${resume ? emailKnop('Ga verder met je ontwerp', resume, { marge: '22px 0 0' }) : ''}
        ${pakket}
        <p style="margin:22px 0 0;">Liever meteen een offerte? ${resume ? `<a href="${escapeHtml(resume)}" target="_blank" style="color:#b04318;font-weight:700;">Open je ontwerp</a> en kies <strong style="color:${INK};">Vraag je offerte vrijblijvend aan</strong>.` : 'Neem gerust contact op.'} We denken graag mee en komen langs om te passen.</p>
        <p style="${P}">Liever even bellen of WhatsAppen? ${telLink(site.phone)}</p>
        ${d.heeftOntwerp ? `<p style="${P}font-size:13px;color:#8a8785;">Het ontwerp zit ook als afbeelding bij deze mail, handig om door te sturen.</p>` : ''}
        <p style="margin:20px 0 0;">Groet,<br/>Jessi Frederiks</p>
      `,
  });
}

/* ------------------------------------------------------------------ */
/* Kennismakingspagina en QR-scan van de brief                          */
/* ------------------------------------------------------------------ */

export type PasdagInvoer = {
  bedrijf: string;
  naam: string;
  telefoon?: string | null;
  email?: string | null;
  aantal?: string | null;
  opmerking?: string | null;
  prospectUrl: string | null;
};

export function pasdagMeldingHtml(d: PasdagInvoer): string {
  return emailLayout({
    heading: `${d.bedrijf} wil een pasdag`,
    preheader: `${d.naam} vroeg een gratis pasdag aan via je brief.`,
    bodyHtml: `
        <p style="${P}">${escapeHtml(d.naam)} van <strong style="color:${INK};">${escapeHtml(d.bedrijf)}</strong> vroeg zojuist een gratis pasdag aan via de pagina uit je brief.</p>
        ${emailGegevens([
          ['Telefoon', telLink(d.telefoon)],
          ['E-mail', mailLink(d.email)],
          ['Medewerkers', escapeHtml(d.aantal ?? '')],
        ])}
        ${d.opmerking ? `${kopje('Voorkeur of opmerking')}${emailKader(tekstMetRegels(d.opmerking))}` : ''}
        ${d.prospectUrl ? emailKnop('Open prospect', d.prospectUrl) : ''}
      `,
  });
}

export function pasdagBevestigingHtml(d: { naam: string; bedrijf: string }): string {
  const voornaam = d.naam.trim().split(/\s+/)[0] || d.naam;
  return emailLayout({
    heading: 'Bedankt, ik bel je snel',
    preheader: 'Je aanvraag voor een gratis pasdag is binnen.',
    bodyHtml: `
          <p style="margin:0;">Hoi ${escapeHtml(voornaam)},</p>
          <p style="${P}">Leuk dat je een pasdag wilt plannen voor ${escapeHtml(d.bedrijf)}. Ik neem ${escapeHtml(site.beloftKort)} contact met je op om een moment te prikken.</p>
          <p style="${P}">Liever meteen schakelen? Bel of app me op ${telLink(site.phone)}.</p>
          <p style="margin:20px 0 0;">Groet,<br/>Jessi Frederiks</p>
        `,
  });
}

export function prospectAfgemeldHtml(bedrijf: string): string {
  return emailLayout({
    heading: `${bedrijf} heeft zich afgemeld`,
    preheader: 'Geen interesse: ze krijgen geen brief of mail meer.',
    bodyHtml: `<p style="${P}">${escapeHtml(bedrijf)} klikte op "Geen interesse?" op hun pagina. Ze staan nu op afgemeld en krijgen geen brief meer.</p>`,
  });
}

export type ScanInvoer = {
  bedrijf: string;
  tijd: string;
  telefoon?: string | null;
  plaats?: string | null;
  branche?: string | null;
  website?: string | null;
  websiteHref?: string | null;
  prospectUrl: string;
  kennismakingUrl: string;
};

export function briefGescandHtml(p: ScanInvoer): string {
  const tel = p.telefoon?.trim();
  const tel18 = tel
    ? `<a href="tel:${escapeHtml(tel.replace(/[^0-9+]/g, ''))}" style="color:${INK};text-decoration:none;">${escapeHtml(tel)}</a>`
    : 'Geen telefoonnummer bekend';
  const wie = [p.plaats, p.branche].filter(Boolean).map((x) => escapeHtml(x)).join(' &middot; ');
  return emailLayout({
    heading: `${p.bedrijf} heeft net je brief gescand`,
    preheader: tel ? `Bel ze nu het nog vers is: ${tel}` : 'Ze kijken nu naar hun persoonlijke pagina.',
    bodyHtml: `
        <p style="${P}">Zojuist (${escapeHtml(p.tijd)}) is de QR-code op je brief gescand. Ze kijken nu naar de pagina met hun eigen logo op de kleding.</p>
        <div style="margin:18px 0 0;padding:16px 18px;border:1px solid #e4e2e0;border-radius:10px;">
          <div style="font-size:20px;font-weight:800;color:${INK};line-height:1.3;">${tel18}</div>
          ${wie || p.website ? `<div style="margin-top:4px;font-size:14px;">${wie}${p.website ? `${wie ? '<br/>' : ''}<a href="${escapeHtml(p.websiteHref ?? '')}" style="color:#b04318;">${escapeHtml(p.website)}</a>` : ''}</div>` : ''}
        </div>
        <p style="${P}">Er staat een beltaak voor morgen klaar. Bellen terwijl het nog vers is werkt het best.</p>
        ${emailKnop('Open prospect', p.prospectUrl)}
        <p style="${P}font-size:14px;"><a href="${escapeHtml(p.kennismakingUrl)}" style="color:#b04318;">Bekijk wat zij zien</a></p>
      `,
  });
}

/* ------------------------------------------------------------------ */
/* Klantportaal: herbestelling en ontwerpaanvraag                       */
/* ------------------------------------------------------------------ */

export type HerbestellingInvoer = {
  organisatie: string;
  door: string;
  medewerkerNaam: string | null;
  waarde: number;
  regels: { item_naam: string; maat: string; aantal: number }[];
  notitie: string;
};

export function herbestellingMeldingHtml(d: HerbestellingInvoer): string {
  const stuks = d.regels.reduce((n, r) => n + (Number(r.aantal) || 0), 0);
  return emailLayout({
    heading: `Herbestelling van ${d.organisatie}`,
    preheader: `${stuks} ${stuks === 1 ? 'stuk' : 'stuks'} via het klantportaal, geschat € ${d.waarde.toFixed(2)}.`,
    bodyHtml: `
      <p style="${P}">Er is een nieuwe herbestelling geplaatst via het klantportaal.</p>
      ${emailGegevens([
        ['Bedrijf', escapeHtml(d.organisatie)],
        ['Door', mailLink(d.door.includes('@') ? d.door : '') || escapeHtml(d.door)],
        ...(d.medewerkerNaam ? [['Voor medewerker', escapeHtml(d.medewerkerNaam)] as [string, string]] : []),
        ['Geschatte waarde', `&euro; ${d.waarde.toFixed(2)}`],
      ])}
      ${kopje('Regels')}
      ${artikelTabel(d.regels.map((r) => ({ naam: r.item_naam, detail: r.maat ? `maat ${r.maat}` : null, aantal: r.aantal })))}
      ${d.notitie ? `${kopje('Opmerking')}${emailKader(tekstMetRegels(d.notitie))}` : ''}
    `,
  });
}

export type OntwerpaanvraagInvoer = {
  organisatie: string;
  door: string;
  logoUrl: string | null;
  regels: { item_naam: string; kleur: string | null; aantal: number }[];
};

export function ontwerpaanvraagMeldingHtml(d: OntwerpaanvraagInvoer): string {
  return emailLayout({
    heading: `Ontwerpaanvraag van ${d.organisatie}`,
    preheader: 'Via de pakketsamensteller in het klantportaal. De concept-order staat klaar.',
    bodyHtml: `
      <p style="${P}">${escapeHtml(d.organisatie)} heeft via de pakketsamensteller in het klantportaal een ontwerp aangevraagd. De concept-order staat klaar in het dashboard om uit te werken tot producten, maten en een offerte.</p>
      ${emailGegevens([
        ['Bedrijf', escapeHtml(d.organisatie)],
        ['Door', mailLink(d.door.includes('@') ? d.door : '') || escapeHtml(d.door)],
        ...(d.logoUrl ? [['Logo', `<a href="${escapeHtml(d.logoUrl)}" style="color:#b04318;">Logo bekijken</a>`] as [string, string]] : []),
      ])}
      ${kopje('Onderdelen')}
      ${artikelTabel(d.regels.map((r) => ({ naam: r.item_naam, detail: r.kleur, aantal: r.aantal })))}
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Drukproeven                                                          */
/* ------------------------------------------------------------------ */

export function drukproefVerstuurHtml(d: { naam: string; link: string; plekken: string[] }): string {
  const plekkenHtml = d.plekken.length
    ? `${kopje('Waar het logo komt')}<ul style="margin:8px 0 0;padding-left:20px;color:${INK};">${d.plekken.map((p) => `<li style="margin:2px 0;">${escapeHtml(p)}</li>`).join('')}</ul>`
    : '';
  return emailLayout({
    heading: 'Bekijk en keur je drukproef',
    preheader: 'We hebben een drukproef voor je klaargezet.',
    bodyHtml: `<p style="${P}">We hebben een drukproef voor <strong style="color:${INK};">${escapeHtml(d.naam)}</strong> klaargezet. Bekijk hoe je logo op de kleding komt en keur de proef goed, of geef je opmerkingen door.</p>${plekkenHtml}
${emailKnop('Drukproef bekijken', d.link)}
<p style="margin:18px 0 0;font-size:13px;color:#8a8785;">Werkt de knop niet? Open dan deze link:<br/><a href="${escapeHtml(d.link)}" style="color:#8a8785;word-break:break-all;">${escapeHtml(d.link)}</a></p>
<p style="margin:20px 0 0;">Groet,<br/>Frederiks Bedrijfskleding</p>`,
  });
}

function besluitLabel(akkoord: boolean): string {
  return akkoord
    ? `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background-color:#e7f4ea;color:#1e6b34;font-size:12px;font-weight:700;">Goedgekeurd</span>`
    : `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background-color:#fdecea;color:#8a1c14;font-size:12px;font-weight:700;">Afgekeurd</span>`;
}

export function drukproefBesluitPortaalHtml(d: { akkoord: boolean; wie: string | null; naam: string; opmerking: string | null }): string {
  const heading = d.akkoord ? 'Drukproef goedgekeurd' : 'Drukproef afgekeurd';
  return emailLayout({
    heading,
    preheader: `${d.wie ?? 'Een klant'} heeft gereageerd op een drukproef.`,
    bodyHtml: `
        <p style="${P}">${escapeHtml(d.wie ?? 'Een klant')} heeft drukproef <strong style="color:${INK};">${escapeHtml(d.naam)}</strong> ${d.akkoord ? 'goedgekeurd' : 'afgekeurd'} in het klantportaal.</p>
        ${emailGegevens([
          ['Drukproef', escapeHtml(d.naam)],
          ['Besluit', besluitLabel(d.akkoord)],
        ])}
        ${d.opmerking ? `${kopje('Opmerking')}${emailKader(tekstMetRegels(d.opmerking))}` : ''}
      `,
  });
}

export function drukproefBesluitLinkHtml(d: { akkoord: boolean; bedrijf: string; naam: string; opmerking: string | null }): string {
  const heading = d.akkoord ? 'Drukproef goedgekeurd' : 'Drukproef afgekeurd';
  return emailLayout({
    heading,
    preheader: `${d.bedrijf} heeft gereageerd op een drukproef.`,
    bodyHtml: `
      <p style="${P}">${escapeHtml(d.bedrijf)} heeft een drukproef ${d.akkoord ? 'goedgekeurd' : 'afgekeurd'}.</p>
      ${emailGegevens([
        ['Klant', escapeHtml(d.bedrijf)],
        ['Drukproef', escapeHtml(d.naam)],
        ['Besluit', besluitLabel(d.akkoord)],
      ])}
      ${d.opmerking ? `${kopje('Opmerking van de klant')}${emailKader(tekstMetRegels(d.opmerking))}` : `<p style="${P}color:#8a8785;">Geen opmerking meegegeven.</p>`}
    `,
  });
}
