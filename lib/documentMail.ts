import { escapeHtml } from '@/lib/email';
import { env } from '@/lib/env';
import { bedrijf } from '@/content/bedrijf';
import { formatEuro } from '@/lib/format';
import { offerteTotalen } from '@/components/dashboard/OfferteDocument';
import { datumLang, getalNL, regelKenmerken } from '@/components/dashboard/DocumentOnderdelen';

/**
 * HTML-mails voor offerte en factuur, in dezelfde stijl als de documenten:
 * logo bovenaan, gestikte oranje lijn, rustige tabel, donkere voet met de
 * bedrijfsgegevens. Alles inline gestyled en in tabellen, zodat ook Outlook
 * en Gmail het netjes tonen.
 *
 * Alleen server-side gebruiken.
 */

/**
 * Basis-url voor plaatjes en links in mails (logo, productfoto's).
 *
 * De www-site draait nog op het oude domein; daar staat het logo niet. Daarom:
 *  1. DOCUMENT_BASIS_URL als die is ingesteld (bijv. na de domeinverhuizing),
 *  2. anders de productie-host van Vercel (VERCEL_PROJECT_PRODUCTION_URL, door Vercel gezet),
 *  3. anders NEXT_PUBLIC_SITE_URL.
 */
export function documentBasisUrl(): string {
  const eigen = process.env.DOCUMENT_BASIS_URL?.trim();
  if (eigen) return eigen.replace(/\/+$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  return env.siteUrl.replace(/\/+$/, '');
}

/** Maakt een pad als /merken/x.jpg absoluut; https-urls blijven zoals ze zijn. */
function absoluut(pad: string | null | undefined): string | null {
  if (!pad) return null;
  if (/^https:\/\//i.test(pad)) return pad;
  if (pad.startsWith('/')) return `${documentBasisUrl()}${pad}`;
  return null;
}

const FONT = 'Arial,Helvetica,sans-serif';
const INK = '#1c1c1c';
const WARM = '#52504e';
const LIJN = '#e4e2e0';
const MIST = '#f6f5f4';
const ORANJE = '#ec6726';
const ORANJE_DONKER = '#b04318';

/** Kader van de mail: logo met soort en nummer, stiksellijn, inhoud, voet. */
export function documentMailLayout({ soort, nummer, preheader, bodyHtml }: { soort: string; nummer: string; preheader: string; bodyHtml: string }): string {
  const logo = `${documentBasisUrl()}/documenten/frederiks-logo-mail.png`;
  return `
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${MIST};margin:0;padding:24px 12px;font-family:${FONT};">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#ffffff;border:1px solid ${LIJN};border-radius:14px;overflow:hidden;">
      <tr><td style="padding:28px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="middle"><img src="${escapeHtml(logo)}" width="190" height="55" alt="${escapeHtml(bedrijf.naam)}" style="display:block;border:0;outline:none;height:55px;width:190px;"></td>
            <td align="right" valign="middle" style="font-family:${FONT};">
              <div style="font-size:22px;font-weight:800;color:${INK};line-height:1;">${escapeHtml(soort)}</div>
              <div style="margin-top:6px;font-size:13px;color:${WARM};">nr. <strong style="color:${INK};">${escapeHtml(nummer)}</strong></div>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:18px 32px 0;"><div style="border-top:2px dashed ${ORANJE};font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td style="padding:24px 32px 30px;color:${WARM};font-size:15px;line-height:1.6;font-family:${FONT};">
        ${bodyHtml}
      </td></tr>
      <tr><td style="background-color:${INK};padding:22px 32px;font-family:${FONT};">
        <p style="margin:0;color:#ffffff;font-size:13px;font-weight:700;">${escapeHtml(bedrijf.naam)}</p>
        <p style="margin:6px 0 0;color:#adadad;font-size:12px;line-height:1.6;">
          ${escapeHtml(bedrijf.adres)}, ${escapeHtml(bedrijf.postcode)} ${escapeHtml(bedrijf.plaats)}<br>
          ${escapeHtml(bedrijf.telefoon)} &middot; <a href="mailto:${escapeHtml(bedrijf.email)}" style="color:#adadad;">${escapeHtml(bedrijf.email)}</a><br>
          KvK ${escapeHtml(bedrijf.kvk)} &middot; Btw ${escapeHtml(bedrijf.btw)} &middot; IBAN ${escapeHtml(bedrijf.iban)}
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

/** Knop die ook in Outlook een knop blijft. */
function knop(tekst: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;"><tr><td bgcolor="${INK}" style="border-radius:8px;background-color:${INK};">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(tekst)}</a>
  </td></tr></table>`;
}

type MailRegel = {
  omschrijving: string | null;
  aantal: number | null;
  stukprijs: number | null;
  korting_pct?: number | null;
  kleur?: string | null;
  maat?: string | null;
  afbeelding?: string | null;
  /** Bedrag excl. btw na korting. */
  bedrag: number;
  /** Alleen op de factuur. */
  btw_pct?: number | null;
};

/** Regels als compacte tabel: foto, omschrijving met aantal x prijs, bedrag. Leest ook goed op een telefoon. */
function regelTabel(regels: MailRegel[]): string {
  if (regels.length === 0) return `<p style="margin:16px 0 0;color:${WARM};">Er staan nog geen regels op.</p>`;
  const metFoto = regels.some((r) => absoluut(r.afbeelding));
  const rijen = regels
    .map((r) => {
      const kort = Number(r.korting_pct) || 0;
      const kenmerken = regelKenmerken(r).map((k) => `${k.label} ${k.waarde}`);
      const detail = [
        `${getalNL(r.aantal)} &times; ${escapeHtml(formatEuro(Number(r.stukprijs) || 0))}`,
        kort ? `<span style="color:${ORANJE_DONKER};">${escapeHtml(getalNL(kort))}% korting</span>` : '',
        r.btw_pct != null ? `btw ${escapeHtml(getalNL(r.btw_pct))}%` : '',
        ...kenmerken.map((k) => escapeHtml(k)),
      ]
        .filter(Boolean)
        .join(' &middot; ');
      const foto = absoluut(r.afbeelding);
      const td = `padding:12px 0;border-bottom:1px solid ${LIJN};vertical-align:middle;`;
      return `<tr>
        ${metFoto ? `<td width="56" style="${td}padding-right:12px;">${foto ? `<img src="${escapeHtml(foto)}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;object-fit:contain;border:1px solid ${LIJN};border-radius:4px;background:#ffffff;">` : ''}</td>` : ''}
        <td style="${td}">
          <div style="font-size:14px;font-weight:700;color:${INK};line-height:1.35;">${escapeHtml(r.omschrijving || '-')}</div>
          <div style="margin-top:3px;font-size:12px;color:${WARM};line-height:1.4;">${detail}</div>
        </td>
        <td align="right" style="${td}padding-left:12px;white-space:nowrap;font-size:14px;font-weight:700;color:${INK};">${escapeHtml(formatEuro(r.bedrag))}</td>
      </tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;border-collapse:collapse;border-top:2px solid ${INK};">${rijen}</table>`;
}

/** Totalen rechts uitgelijnd, met het eindbedrag in een donkere balk. */
function totaalTabel(rijen: { label: string; waarde: string; oranje?: boolean }[], totaalLabel: string, totaal: number): string {
  const r = rijen
    .map(
      (x) =>
        `<tr><td style="padding:3px 16px 3px 0;font-size:13px;color:${WARM};">${escapeHtml(x.label)}</td><td align="right" style="padding:3px 0;font-size:13px;color:${x.oranje ? ORANJE_DONKER : INK};white-space:nowrap;">${escapeHtml(x.waarde)}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="right" style="margin:14px 0 0;min-width:260px;">
    ${r}
    <tr><td colspan="2" style="padding-top:8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td bgcolor="${INK}" style="background-color:${INK};border-radius:6px 0 0 6px;padding:10px 14px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff;">${escapeHtml(totaalLabel)}</td>
        <td bgcolor="${INK}" align="right" style="background-color:${INK};border-radius:0 6px 6px 0;padding:10px 14px;font-size:18px;font-weight:800;color:#ffffff;white-space:nowrap;">${escapeHtml(formatEuro(totaal))}</td>
      </tr></table>
    </td></tr>
  </table>
  <div style="clear:both;font-size:0;line-height:0;">&nbsp;</div>`;
}

export type OfferteMailData = {
  offertenummer: number | null;
  organisatie_naam: string | null;
  contactpersoon: string | null;
  geldig_tot: string | null;
  notitie: string | null;
  btw_pct: number | null;
  regels: { omschrijving: string | null; aantal: number | null; stukprijs: number | null; korting_pct: number | null; kleur: string | null; maat: string | null; afbeelding?: string | null }[];
};

/** De mail bij een offerte: complete offerte in de mail en een akkoordknop. */
export function offerteMailHtml(off: OfferteMailData): string {
  const { subtotaal, korting, btw, totaal } = offerteTotalen(off.regels, off.btw_pct);
  const nummer = off.offertenummer != null ? String(off.offertenummer) : 'concept';
  const naam = off.contactpersoon?.trim() || off.organisatie_naam?.trim() || '';
  const regels: MailRegel[] = off.regels.map((r) => {
    const aantal = Number(r.aantal) || 0;
    const stuk = Number(r.stukprijs) || 0;
    const kort = Number(r.korting_pct) || 0;
    return { ...r, bedrag: Math.round(aantal * stuk * (1 - kort / 100) * 100) / 100 };
  });
  const akkoordHref =
    `mailto:${bedrijf.email}?subject=${encodeURIComponent(`Akkoord offerte ${nummer}`)}` +
    `&body=${encodeURIComponent(`Wij gaan akkoord met offerte ${nummer}${off.organisatie_naam ? ` voor ${off.organisatie_naam}` : ''}.\n\nNaam:\n`)}`;

  const bodyHtml = `
    <p style="margin:0;color:${INK};">${naam ? `Beste ${escapeHtml(naam)},` : 'Goedendag,'}</p>
    <p style="margin:12px 0 0;">Bedankt voor je aanvraag. Hieronder staat offerte <strong style="color:${INK};">${escapeHtml(nummer)}</strong>${off.organisatie_naam ? ` voor ${escapeHtml(off.organisatie_naam)}` : ''}. De stukprijzen zijn exclusief btw.</p>
    ${off.notitie ? `<div style="margin:16px 0 0;padding:12px 16px;background-color:${MIST};border-left:3px solid ${ORANJE};color:${INK};white-space:pre-wrap;">${escapeHtml(off.notitie)}</div>` : ''}
    ${regelTabel(regels)}
    ${totaalTabel(
      [
        ...(korting > 0 ? [{ label: 'Korting', waarde: `- ${formatEuro(korting)}`, oranje: true }] : []),
        { label: 'Subtotaal excl. btw', waarde: formatEuro(subtotaal) },
        { label: `Btw ${getalNL(off.btw_pct ?? 21)}%`, waarde: formatEuro(btw) },
      ],
      'Totaal incl. btw',
      totaal,
    )}
    ${off.geldig_tot ? `<p style="margin:20px 0 0;">Deze offerte is geldig tot en met <strong style="color:${INK};">${escapeHtml(datumLang(off.geldig_tot))}</strong>.</p>` : ''}
    ${knop('Akkoord geven', akkoordHref)}
    <p style="margin:14px 0 0;font-size:14px;">Of antwoord gewoon op deze mail. Liever eerst even overleggen? Bel <strong style="color:${INK};">${escapeHtml(bedrijf.telefoon)}</strong>.</p>
    <p style="margin:22px 0 0;">Met vriendelijke groet,<br><strong style="color:${INK};">${escapeHtml(bedrijf.naam)}</strong></p>
  `;
  return documentMailLayout({ soort: 'Offerte', nummer, preheader: `Offerte ${nummer} van ${bedrijf.naam}: ${formatEuro(totaal)} incl. btw`, bodyHtml });
}

export type FactuurMailData = {
  factuurnummer: string | null;
  factuurdatum: string | null;
  vervaldatum: string | null;
  status: string;
  betaaldatum: string | null;
  organisatie_naam: string | null;
  klantnummer: string | null;
  regels: MailRegel[];
  totalen: { excl: number; btw: number; incl: number; korting: number; perTarief: { pct: number; grondslag: number; btw: number }[] };
};

/** De mail bij een factuur: "Te betalen" bovenaan, daarna de regels en de btw. */
export function factuurMailHtml(f: FactuurMailData): string {
  const nummer = f.factuurnummer || 'concept';
  const t = f.totalen;
  const kenmerk = [f.factuurnummer, f.klantnummer ? `deb. ${f.klantnummer}` : null].filter(Boolean).join(' / ') || nummer;
  const kv = (label: string, waarde: string, vet = false) =>
    `<tr><td style="padding:2px 16px 2px 0;font-size:13px;color:${WARM};white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:2px 0;font-size:13px;color:${INK};${vet ? 'font-weight:700;' : ''}">${escapeHtml(waarde)}</td></tr>`;

  const betaalBlok =
    f.status === 'betaald'
      ? `<div style="margin:20px 0 0;padding:14px 18px;border:2px solid ${INK};border-radius:8px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${ORANJE_DONKER};">Betaald</div>
          <div style="margin-top:4px;font-size:15px;color:${INK};">Deze factuur is al betaald${f.betaaldatum ? ` op ${escapeHtml(datumLang(f.betaaldatum))}` : ''}. Dank u wel.</div>
        </div>`
      : `<div style="margin:20px 0 0;padding:16px 20px;border:2px solid ${INK};border-radius:8px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${ORANJE_DONKER};">Te betalen</div>
          <div style="margin-top:2px;font-size:26px;font-weight:800;color:${INK};line-height:1.25;">${escapeHtml(formatEuro(t.incl))}</div>
          ${f.vervaldatum ? `<div style="font-size:14px;color:${INK};">vóór <strong>${escapeHtml(datumLang(f.vervaldatum))}</strong></div>` : ''}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;">
            ${kv('IBAN', bedrijf.iban, true)}
            ${kv('Ten name van', bedrijf.naam)}
            ${kv('Kenmerk', kenmerk, true)}
          </table>
        </div>`;

  const btwRijen = t.perTarief.length
    ? t.perTarief.map((x) => ({ label: t.perTarief.length > 1 ? `Btw ${getalNL(x.pct)}% over ${formatEuro(x.grondslag)}` : `Btw ${getalNL(x.pct)}%`, waarde: formatEuro(x.btw) }))
    : [{ label: 'Btw', waarde: formatEuro(0) }];

  const bodyHtml = `
    <p style="margin:0;color:${INK};">Beste relatie,</p>
    <p style="margin:12px 0 0;">Hierbij factuur <strong style="color:${INK};">${escapeHtml(nummer)}</strong>${f.factuurdatum ? ` van ${escapeHtml(datumLang(f.factuurdatum))}` : ''}${f.organisatie_naam ? ` voor ${escapeHtml(f.organisatie_naam)}` : ''}.</p>
    ${betaalBlok}
    ${regelTabel(f.regels)}
    ${totaalTabel(
      [
        ...(t.korting > 0 ? [{ label: 'Waarvan korting', waarde: `- ${formatEuro(t.korting)}`, oranje: true }] : []),
        { label: 'Subtotaal excl. btw', waarde: formatEuro(t.excl) },
        ...btwRijen,
      ],
      'Totaal incl. btw',
      t.incl,
    )}
    <p style="margin:22px 0 0;">Vragen over deze factuur? Antwoord gerust op deze mail of bel <strong style="color:${INK};">${escapeHtml(bedrijf.telefoon)}</strong>.</p>
    <p style="margin:18px 0 0;font-size:12px;color:${WARM};">${escapeHtml(bedrijf.betaalvoorwaarde)}</p>
  `;
  return documentMailLayout({
    soort: 'Factuur',
    nummer,
    preheader: f.status === 'betaald' ? `Factuur ${nummer} van ${bedrijf.naam} (betaald)` : `Factuur ${nummer}: ${formatEuro(t.incl)} te betalen${f.vervaldatum ? ` vóór ${datumLang(f.vervaldatum)}` : ''}`,
    bodyHtml,
  });
}
