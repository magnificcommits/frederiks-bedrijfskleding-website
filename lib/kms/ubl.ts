import { bedrijf } from '@/content/bedrijf';
import { btwTarief, factuurTotalen, regelBedrag } from '@/lib/kms/facturen';

/**
 * UBL 2.1-factuur volgens SI-UBL 2.0 (NLCIUS, de Nederlandse invulling van de
 * Europese norm EN 16931). Dit formaat lezen Exact Online, e-Boekhouden,
 * Snelstart, Moneybird en de meeste accountantspakketten in.
 *
 * Bedragen en btw komen uit factuurTotalen(), dus precies zoals op de factuur
 * zelf: btw per tarief over de som van de regels. Een regelkorting staat als
 * korting (AllowanceCharge) op de regel, zodat aantal x prijs - korting klopt.
 */

export type UblKlant = {
  naam: string;
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
  land: string | null;
  kvk: string | null;
  btw_nummer: string | null;
  klantnummer: string | null;
  email: string | null;
};

export type UblFactuur = {
  factuurnummer: string;
  factuurdatum: string | null;
  vervaldatum: string | null;
  regels: { omschrijving: string; aantal: number | null; stukprijs: number | null; korting_pct?: number | null; btw_pct: number | null }[];
  klant: UblKlant;
  orderReferentie?: string | null;
};

const CUSTOMIZATION = 'urn:cen.eu:en16931:2017#compliant#urn:fdc:nen.nl:nlcius:v1.0';
const PROFILE = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';

function x(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Tekens die in XML 1.0 niet mogen (stuurtekens behalve tab en nieuwe regel).
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const bedrag = (n: number) => r2(n).toFixed(2);
const getal = (n: number, dec = 4) => String(Math.round(n * 10 ** dec) / 10 ** dec);
const cijfers = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');
const zonderSpaties = (s: string | null | undefined) => (s ?? '').replace(/\s/g, '').toUpperCase();
const datum = (d: string | null | undefined) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : new Date().toISOString().slice(0, 10));

function landCode(land: string | null | undefined): string {
  const l = (land ?? '').trim().toLowerCase();
  if (/^[a-z]{2}$/.test(l)) return l.toUpperCase();
  if (l.includes('belg')) return 'BE';
  if (l.includes('duits') || l.includes('deutsch') || l.includes('germany')) return 'DE';
  return 'NL';
}

/** Btw-categorie: S = standaard of verlaagd tarief, Z = nultarief. */
const categorie = (pct: number) => (pct > 0 ? 'S' : 'Z');

function taxCategory(tag: 'cac:TaxCategory' | 'cac:ClassifiedTaxCategory', pct: number): string {
  return `<${tag}><cbc:ID>${categorie(pct)}</cbc:ID><cbc:Percent>${getal(pct, 2)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></${tag}>`;
}

function adresBlok(adres: string | null, postcode: string | null, plaats: string | null, land: string): string {
  return [
    '<cac:PostalAddress>',
    adres ? `<cbc:StreetName>${x(adres)}</cbc:StreetName>` : '',
    plaats ? `<cbc:CityName>${x(plaats)}</cbc:CityName>` : '',
    postcode ? `<cbc:PostalZone>${x(postcode)}</cbc:PostalZone>` : '',
    `<cac:Country><cbc:IdentificationCode>${land}</cbc:IdentificationCode></cac:Country>`,
    '</cac:PostalAddress>',
  ].join('');
}

export function factuurNaarUbl(f: UblFactuur): string {
  const totalen = factuurTotalen(f.regels);
  const k = f.klant;
  const kvkLev = cijfers(bedrijf.kvk);
  const kvkKlant = cijfers(k.kvk);
  const btwKlant = zonderSpaties(k.btw_nummer);
  const klantLand = landCode(k.land);

  // Verplicht in Peppol BIS: kopersreferentie of orderreferentie.
  const kopersRef = (k.klantnummer ?? '').trim() || f.factuurnummer;

  const leverancier = [
    '<cac:AccountingSupplierParty><cac:Party>',
    `<cbc:EndpointID schemeID="0106">${kvkLev}</cbc:EndpointID>`,
    `<cac:PartyIdentification><cbc:ID schemeID="0106">${kvkLev}</cbc:ID></cac:PartyIdentification>`,
    `<cac:PartyName><cbc:Name>${x(bedrijf.naam)}</cbc:Name></cac:PartyName>`,
    adresBlok(bedrijf.adres, bedrijf.postcode, bedrijf.plaats, 'NL'),
    `<cac:PartyTaxScheme><cbc:CompanyID>${x(zonderSpaties(bedrijf.btw))}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`,
    `<cac:PartyLegalEntity><cbc:RegistrationName>${x(bedrijf.naam)}</cbc:RegistrationName><cbc:CompanyID schemeID="0106">${kvkLev}</cbc:CompanyID></cac:PartyLegalEntity>`,
    `<cac:Contact><cbc:Telephone>${x(bedrijf.telefoon)}</cbc:Telephone><cbc:ElectronicMail>${x(bedrijf.email)}</cbc:ElectronicMail></cac:Contact>`,
    '</cac:Party></cac:AccountingSupplierParty>',
  ].join('');

  // Endpoint van de klant: KvK (0106), anders Nederlands btw-nummer (9944).
  let klantEndpoint = '';
  if (kvkKlant.length === 8) klantEndpoint = `<cbc:EndpointID schemeID="0106">${kvkKlant}</cbc:EndpointID>`;
  else if (/^NL\d{9}B\d{2}$/.test(btwKlant)) klantEndpoint = `<cbc:EndpointID schemeID="9944">${btwKlant}</cbc:EndpointID>`;

  const klant = [
    '<cac:AccountingCustomerParty><cac:Party>',
    klantEndpoint,
    k.klantnummer ? `<cac:PartyIdentification><cbc:ID>${x(k.klantnummer)}</cbc:ID></cac:PartyIdentification>` : '',
    `<cac:PartyName><cbc:Name>${x(k.naam)}</cbc:Name></cac:PartyName>`,
    adresBlok(k.adres, k.postcode, k.plaats, klantLand),
    btwKlant ? `<cac:PartyTaxScheme><cbc:CompanyID>${x(btwKlant)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : '',
    `<cac:PartyLegalEntity><cbc:RegistrationName>${x(k.naam)}</cbc:RegistrationName>${kvkKlant.length === 8 ? `<cbc:CompanyID schemeID="0106">${kvkKlant}</cbc:CompanyID>` : ''}</cac:PartyLegalEntity>`,
    k.email ? `<cac:Contact><cbc:ElectronicMail>${x(k.email)}</cbc:ElectronicMail></cac:Contact>` : '',
    '</cac:Party></cac:AccountingCustomerParty>',
  ].join('');

  const betaling = [
    '<cac:PaymentMeans>',
    '<cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>',
    `<cbc:PaymentID>${x(f.factuurnummer)}</cbc:PaymentID>`,
    `<cac:PayeeFinancialAccount><cbc:ID>${x(zonderSpaties(bedrijf.iban))}</cbc:ID><cbc:Name>${x(bedrijf.naam)}</cbc:Name></cac:PayeeFinancialAccount>`,
    '</cac:PaymentMeans>',
    `<cac:PaymentTerms><cbc:Note>${x(`Betalen binnen ${bedrijf.betaaltermijnDagen} dagen onder vermelding van factuurnummer ${f.factuurnummer}.`)}</cbc:Note></cac:PaymentTerms>`,
  ].join('');

  const btwTotaal = [
    `<cac:TaxTotal><cbc:TaxAmount currencyID="EUR">${bedrag(totalen.btw)}</cbc:TaxAmount>`,
    ...totalen.perTarief.map(
      (t) =>
        `<cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">${bedrag(t.grondslag)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">${bedrag(t.btw)}</cbc:TaxAmount>${taxCategory('cac:TaxCategory', t.pct)}</cac:TaxSubtotal>`,
    ),
    '</cac:TaxTotal>',
  ].join('');

  const totaal = [
    '<cac:LegalMonetaryTotal>',
    `<cbc:LineExtensionAmount currencyID="EUR">${bedrag(totalen.excl)}</cbc:LineExtensionAmount>`,
    `<cbc:TaxExclusiveAmount currencyID="EUR">${bedrag(totalen.excl)}</cbc:TaxExclusiveAmount>`,
    `<cbc:TaxInclusiveAmount currencyID="EUR">${bedrag(totalen.incl)}</cbc:TaxInclusiveAmount>`,
    `<cbc:PayableAmount currencyID="EUR">${bedrag(totalen.incl)}</cbc:PayableAmount>`,
    '</cac:LegalMonetaryTotal>',
  ].join('');

  const regels = f.regels.map((r, i) => {
    const aantal = Number(r.aantal) || 0;
    const stuk = Number(r.stukprijs) || 0;
    const pct = btwTarief(r.btw_pct);
    const netto = regelBedrag(r);
    const bruto = r2(aantal * stuk);
    const korting = r2(bruto - netto);
    const kortPct = Number(r.korting_pct) || 0;
    // Prijs mag niet negatief zijn: een minregel krijgt een negatief aantal.
    const prijs = Math.abs(stuk);
    const hoeveel = stuk < 0 ? -aantal : aantal;
    return [
      '<cac:InvoiceLine>',
      `<cbc:ID>${i + 1}</cbc:ID>`,
      `<cbc:InvoicedQuantity unitCode="C62">${getal(hoeveel)}</cbc:InvoicedQuantity>`,
      `<cbc:LineExtensionAmount currencyID="EUR">${bedrag(netto)}</cbc:LineExtensionAmount>`,
      korting !== 0
        ? `<cac:AllowanceCharge><cbc:ChargeIndicator>false</cbc:ChargeIndicator><cbc:AllowanceChargeReasonCode>95</cbc:AllowanceChargeReasonCode><cbc:AllowanceChargeReason>Korting${kortPct ? ` ${getal(kortPct, 2).replace('.', ',')}%` : ''}</cbc:AllowanceChargeReason><cbc:Amount currencyID="EUR">${bedrag(korting)}</cbc:Amount><cbc:BaseAmount currencyID="EUR">${bedrag(bruto)}</cbc:BaseAmount></cac:AllowanceCharge>`
        : '',
      `<cac:Item><cbc:Name>${x((r.omschrijving || 'Regel').slice(0, 250))}</cbc:Name>${taxCategory('cac:ClassifiedTaxCategory', pct)}</cac:Item>`,
      `<cac:Price><cbc:PriceAmount currencyID="EUR">${getal(prijs)}</cbc:PriceAmount></cac:Price>`,
      '</cac:InvoiceLine>',
    ].join('');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">',
    `<cbc:CustomizationID>${CUSTOMIZATION}</cbc:CustomizationID>`,
    `<cbc:ProfileID>${PROFILE}</cbc:ProfileID>`,
    `<cbc:ID>${x(f.factuurnummer)}</cbc:ID>`,
    `<cbc:IssueDate>${datum(f.factuurdatum)}</cbc:IssueDate>`,
    f.vervaldatum ? `<cbc:DueDate>${datum(f.vervaldatum)}</cbc:DueDate>` : '',
    '<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>',
    '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>',
    `<cbc:BuyerReference>${x(kopersRef)}</cbc:BuyerReference>`,
    f.orderReferentie ? `<cac:OrderReference><cbc:ID>${x(f.orderReferentie)}</cbc:ID></cac:OrderReference>` : '',
    leverancier,
    klant,
    betaling,
    btwTotaal,
    totaal,
    ...regels,
    '</Invoice>',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Bestandsnaam voor een UBL-bestand: alleen veilige tekens. */
export function ublBestandsnaam(factuurnummer: string): string {
  return `factuur-${factuurnummer.replace(/[^A-Za-z0-9._-]/g, '_')}.xml`;
}
