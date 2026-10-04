import { describe, expect, it } from 'vitest';
import { factuurNaarUbl, ublBestandsnaam, type UblFactuur } from '@/lib/kms/ubl';
import { facturenNaarCsv, isIsoDatum, type ExportFactuur } from '@/lib/kms/boekhoudExport';
import { boekhoudWeergave, koppelBtwTarieven, landCode, moneybirdRegels } from '@/lib/kms/boekhouding';
import { isMoneybirdGeconfigureerd, mbVerzoek, moneybirdFactuurUrl, type MbBtwTarief } from '@/lib/kms/moneybird';
import type { FactuurDetail, Factuurregel } from '@/lib/kms/facturen';

const klant = {
  naam: 'Bouwbedrijf Voorbeeld & Zn',
  adres: 'Dorpsstraat 1',
  postcode: '7255 AB',
  plaats: 'Hengelo Gld',
  land: 'Nederland',
  kvk: '1234 5678',
  btw_nummer: 'nl 123456789 b01',
  klantnummer: 'K-1001',
  email: 'factuur@voorbeeld.nl',
};

function ubl(over: Partial<UblFactuur> = {}): string {
  return factuurNaarUbl({
    factuurnummer: '2026-0042',
    factuurdatum: '2026-10-01',
    vervaldatum: '2026-10-16',
    regels: [
      { omschrijving: 'Polo <logo>', aantal: 10, stukprijs: 20, korting_pct: 10, btw_pct: 21 },
      { omschrijving: 'Werkschoen', aantal: 1, stukprijs: 100, btw_pct: 9 },
    ],
    klant,
    orderReferentie: '1001',
    ...over,
  });
}

const tag = (xml: string, naam: string) => [...xml.matchAll(new RegExp(`<${naam}[^>]*>([^<]*)</${naam}>`, 'g'))].map((m) => m[1]);

describe('UBL (SI-UBL 2.0 / NLCIUS)', () => {
  it('is welgevormd genoeg: XML-kop, Invoice-root en NLCIUS-customization', () => {
    const xml = ubl();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:nen.nl:nlcius:v1.0</cbc:CustomizationID>');
    expect(xml.trim().endsWith('</Invoice>')).toBe(true);
  });
  it('totalen kloppen met factuurTotalen: 180 + 100 excl., btw 37,80 + 9,00', () => {
    const xml = ubl();
    expect(tag(xml, 'cbc:LineExtensionAmount')[0]).toBe('280.00');
    expect(tag(xml, 'cbc:TaxInclusiveAmount')[0]).toBe('326.80');
    expect(tag(xml, 'cbc:PayableAmount')[0]).toBe('326.80');
    expect(tag(xml, 'cbc:TaxAmount')[0]).toBe('46.80');
  });
  it('regelkorting staat als AllowanceCharge op de regel', () => {
    const xml = ubl();
    expect(xml).toContain('<cbc:AllowanceChargeReason>Korting 10%</cbc:AllowanceChargeReason>');
    expect(xml).toContain('<cbc:Amount currencyID="EUR">20.00</cbc:Amount>');
    expect(xml).toContain('<cbc:BaseAmount currencyID="EUR">200.00</cbc:BaseAmount>');
  });
  it('escapet speciale tekens in namen en omschrijvingen', () => {
    const xml = ubl();
    expect(xml).toContain('Bouwbedrijf Voorbeeld &amp; Zn');
    expect(xml).toContain('Polo &lt;logo&gt;');
    expect(xml).not.toContain('Polo <logo>');
  });
  it('haalt stuurtekens weg die in XML 1.0 niet mogen', () => {
    const xml = ubl({ regels: [{ omschrijving: 'Jas\u0007 met\u0000 rits', aantal: 1, stukprijs: 10, btw_pct: 21 }] });
    expect(xml).toContain('Jas met rits');
  });
  it('KvK van de klant (8 cijfers) als endpoint 0106; btw-nummer genormaliseerd', () => {
    const xml = ubl();
    expect(xml).toContain('<cbc:EndpointID schemeID="0106">12345678</cbc:EndpointID>');
    expect(xml).toContain('<cbc:CompanyID>NL123456789B01</cbc:CompanyID>');
  });
  it('zonder KvK valt het endpoint terug op het Nederlandse btw-nummer (9944)', () => {
    const xml = ubl({ klant: { ...klant, kvk: null } });
    expect(xml).toContain('<cbc:EndpointID schemeID="9944">NL123456789B01</cbc:EndpointID>');
  });
  it('land: naam wordt ISO-code, standaard NL', () => {
    expect(ubl({ klant: { ...klant, land: 'België' } })).toContain('<cbc:IdentificationCode>BE</cbc:IdentificationCode></cac:Country></cac:PostalAddress><cac:PartyTaxScheme><cbc:CompanyID>NL123456789B01');
    expect(ubl({ klant: { ...klant, land: null } })).not.toContain('<cbc:IdentificationCode>BE');
  });
  it('btw-categorie S bij 21% en 9%, Z bij 0%', () => {
    const xml = ubl({ regels: [{ omschrijving: 'Export', aantal: 1, stukprijs: 50, btw_pct: 0 }] });
    expect(xml).toContain('<cbc:ID>Z</cbc:ID><cbc:Percent>0</cbc:Percent>');
    expect(ubl()).toContain('<cbc:ID>S</cbc:ID><cbc:Percent>9</cbc:Percent>');
  });
  it('minregel: prijs positief, aantal negatief (prijs mag niet negatief zijn)', () => {
    const xml = ubl({ regels: [{ omschrijving: 'Creditering', aantal: 1, stukprijs: -25, btw_pct: 21 }] });
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="C62">-1</cbc:InvoicedQuantity>');
    expect(xml).toContain('<cbc:PriceAmount currencyID="EUR">25</cbc:PriceAmount>');
    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="EUR">-25.00</cbc:LineExtensionAmount>');
  });
  it('kopersreferentie = klantnummer, anders het factuurnummer', () => {
    expect(tag(ubl(), 'cbc:BuyerReference')[0]).toBe('K-1001');
    expect(tag(ubl({ klant: { ...klant, klantnummer: null } }), 'cbc:BuyerReference')[0]).toBe('2026-0042');
  });
  it('orderreferentie alleen als die er is', () => {
    expect(ubl()).toContain('<cac:OrderReference><cbc:ID>1001</cbc:ID></cac:OrderReference>');
    expect(ubl({ orderReferentie: null })).not.toContain('OrderReference');
  });
  it('bestandsnaam bevat alleen veilige tekens', () => {
    expect(ublBestandsnaam('2026/0042 a')).toBe('factuur-2026_0042_a.xml');
  });
});

function regel(over: Partial<Factuurregel>): Factuurregel {
  return { id: 'r', factuur_id: 'f1', omschrijving: 'Polo', aantal: 1, stukprijs: 10, btw_pct: 21, bedrag: 10, ...over };
}

function exportFactuur(over: Partial<ExportFactuur> = {}): ExportFactuur {
  return {
    id: 'f1',
    factuurnummer: '2026-0001',
    organisatie_id: 'o1',
    order_id: null,
    factuurdatum: '2026-09-30',
    vervaldatum: '2026-10-15',
    status: 'verzonden',
    betaaldatum: null,
    factuur_email: null,
    moneybird_factuur_id: null,
    org: { id: 'o1', naam: 'Klant BV', adres: null, postcode: null, plaats: null, land: null, kvk: '12345678', btw_nummer: null, klantnummer: 'K1', factuur_email: null, email_algemeen: null },
    regels: [regel({ aantal: 2, stukprijs: 50 }), regel({ aantal: 1, stukprijs: 100, btw_pct: 9 })],
    ...over,
  };
}

describe('CSV-export voor de boekhouder', () => {
  it('UTF-8 BOM, puntkomma en Windows-regeleinden (Nederlandse Excel)', () => {
    const csv = facturenNaarCsv([exportFactuur()]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('\r\n');
    expect(csv.split('\r\n')[0]).toContain('Factuurnummer;Factuurdatum;Vervaldatum');
  });
  it('vaste kolommen voor 21%, 9% en 0%, decimale komma', () => {
    const regels = facturenNaarCsv([exportFactuur()]).slice(1).split('\r\n');
    expect(regels[0]).toContain('Omzet 21%;Btw 21%;Omzet 9%;Btw 9%;Omzet 0%;Btw 0%');
    expect(regels[1]).toBe('2026-0001;30-09-2026;15-10-2026;Klant BV;K1;12345678;;200,00;100,00;21,00;100,00;9,00;;;30,00;230,00;Verzonden;;nee');
  });
  it('totaalregel telt alle facturen op', () => {
    const csv = facturenNaarCsv([exportFactuur(), exportFactuur({ id: 'f2', factuurnummer: '2026-0002', moneybird_factuur_id: 'mb1' })]);
    const laatste = csv.split('\r\n').pop()!;
    expect(laatste.startsWith('Totaal;;;2 facturen;')).toBe(true);
    expect(laatste).toContain(';400,00;200,00;42,00;200,00;18,00;;;60,00;460,00;');
    expect(csv).toContain(';ja');
  });
  it('voorkomt formule-injectie en zet tekst met puntkomma tussen aanhalingstekens', () => {
    const csv = facturenNaarCsv([exportFactuur({ org: { ...exportFactuur().org!, naam: '=HYPERLINK("x");kwaad' } })]);
    expect(csv).toContain(`"'=HYPERLINK(""x"");kwaad"`);
  });
  it('een afwijkend tarief krijgt een eigen kolom', () => {
    const csv = facturenNaarCsv([exportFactuur({ regels: [regel({ btw_pct: 6 })] })]);
    expect(csv.split('\r\n')[0]).toContain('Omzet 6%;Btw 6%');
  });
  it('isIsoDatum accepteert alleen echte JJJJ-MM-DD', () => {
    expect(isIsoDatum('2026-10-04')).toBe(true);
    expect(isIsoDatum('04-10-2026')).toBe(false);
    expect(isIsoDatum('2026-13-01')).toBe(false);
    expect(isIsoDatum(null)).toBe(false);
  });
});

const tarief = (id: string, percentage: string, name: string): MbBtwTarief => ({ id, name, percentage, tax_rate_type: 'sales_invoice', active: true });

function detail(regels: Partial<Factuurregel>[]): FactuurDetail {
  return {
    id: 'f1', factuurnummer: '2026-0001', organisatie_id: 'o1', order_id: null, factuurdatum: '2026-10-01', vervaldatum: null,
    bedrag_excl: null, btw_bedrag: null, bedrag_incl: null, status: 'verzonden', factuur_email: null, betaaldatum: null,
    toegepaste_prijsafspraken: null, gemaild_op: null, created_at: '2026-10-01', organisatie: null,
    regels: regels.map((r, i) => regel({ id: `r${i}`, ...r })),
  };
}

describe('Moneybird-regelmapping (zonder netwerk)', () => {
  const btw = koppelBtwTarieven([tarief('1', '21.0', '21% btw'), tarief('2', '9.0', '9% btw'), tarief('3', '0.0', 'Btw verlegd'), tarief('4', '0.0', '0% btw')]);

  it('koppelt op percentage en kiest bij 0% een gewoon tarief boven "verlegd"', () => {
    expect(btw.get(21)?.id).toBe('1');
    expect(btw.get(9)?.id).toBe('2');
    expect(btw.get(0)?.id).toBe('4');
  });
  it('gewone regel: aantal, prijs, tarief, grootboek en volgorde', () => {
    const r = moneybirdRegels(detail([{ omschrijving: 'Polo', aantal: 3, stukprijs: 12.5 }]), btw, 'gb1');
    expect(r).toEqual({ ok: true, regels: [{ description: 'Polo', amount: '3', price: '12.50', row_order: 1, tax_rate_id: '1', ledger_account_id: 'gb1' }] });
  });
  it('korting: nettoprijs met korting in de omschrijving', () => {
    const r = moneybirdRegels(detail([{ omschrijving: 'Jas', aantal: 2, stukprijs: 100, korting_pct: 10 }]), btw, '');
    expect(r.ok && r.regels[0]).toMatchObject({ description: 'Jas (incl. 10% korting)', amount: '2', price: '90.00' });
  });
  it('afrondingsverschil: één regel met het exacte regelbedrag, zodat het totaal gelijk blijft', () => {
    // 3 x 9,99 met 15% korting = 25,4745 -> regelbedrag 25,47; nettoprijs 8,49 x 3 = 25,47 klopt,
    // maar 7 x 9,99 met 15% = 59,4405 -> 59,44 terwijl 8,49 x 7 = 59,43.
    const r = moneybirdRegels(detail([{ omschrijving: 'Polo', aantal: 7, stukprijs: 9.99, korting_pct: 15 }]), btw, '');
    expect(r.ok && r.regels[0]).toMatchObject({ amount: '1', price: '59.44', description: '7 x Polo (incl. 15% korting)' });
  });
  it('ontbrekend tarief in Moneybird: duidelijke melding, niets doorzetten', () => {
    const r = moneybirdRegels(detail([{ btw_pct: 6 }]), btw, '');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.melding).toContain('6%');
  });
  it('zonder tarief op de regel wordt 21% gebruikt (niet 0%)', () => {
    const r = moneybirdRegels(detail([{ btw_pct: null as unknown as number }]), btw, '');
    expect(r.ok && r.regels[0].tax_rate_id).toBe('1');
  });
  it('landCode: namen en codes', () => {
    expect(landCode('Nederland')).toBe('NL');
    expect(landCode('be')).toBe('BE');
    expect(landCode('Duitsland')).toBe('DE');
    expect(landCode('Luxemburg')).toBe('LU');
    expect(landCode(null)).toBe('NL');
  });
  it('boekhoudWeergave', () => {
    expect(boekhoudWeergave({ moneybird_factuur_id: 'x' })).toBe('doorgezet');
    expect(boekhoudWeergave({ moneybird_factuur_id: 'x', boekhouding_status: 'fout' })).toBe('fout');
    expect(boekhoudWeergave({ boekhouding_status: 'bezig' })).toBe('bezig');
    expect(boekhoudWeergave({})).toBe('niet');
  });
  it('zonder token: geen netwerkverzoek maar een melding in gewone taal', async () => {
    expect(isMoneybirdGeconfigureerd()).toBe(false);
    const r = await mbVerzoek('GET', 'contacts.json');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.melding).toContain('MONEYBIRD_API_TOKEN');
  });
  it('factuur-url codeert de id', () => {
    expect(moneybirdFactuurUrl('a/b')).toContain('/sales_invoices/a%2Fb');
  });
});
