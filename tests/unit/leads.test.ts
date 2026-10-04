import { describe, expect, it } from 'vitest';
import {
  berekenScore,
  bedrijfSleutel,
  bronKanaal,
  duurKort,
  leadKans,
  leadWaarde,
  ontleedAanvraag,
  opvolgStand,
  schoneStatus,
  scoreNiveau,
  teamGrootte,
  telLink,
  vandaagNl,
  vindDubbelen,
  whatsappLink,
  type LeadRij,
} from '@/lib/kms/leadsModel';

const nu = new Date('2026-10-04T10:00:00Z');

function lead(over: Partial<LeadRij> = {}): LeadRij {
  return {
    id: 'l1',
    created_at: '2026-10-04T08:00:00Z',
    name: 'Jan',
    company: 'Bouwbedrijf Test',
    email: 'jan@test.nl',
    phone: '0612345678',
    branche: 'Bouw',
    aantal: '25-50',
    bericht: '',
    bron: null,
    status: 'nieuw',
    ...over,
  } as LeadRij;
}

describe('leadscore', () => {
  it('sterke lead: groot team, kernbranche, compleet, vers', () => {
    const s = berekenScore(lead(), { eersteContact: null, klantReageerde: false, nu });
    // bedrijfsgrootte 22, bouw 15, volledig 10, concreet 0, gedrag 3 (geen data), recent 10, reactie 5 (nog vers)
    expect(s.totaal).toBe(65);
    expect(scoreNiveau(s.totaal)).toBe('hoog');
    expect(s.delen.map((d) => d.label)).toEqual(['Bedrijfsgrootte', 'Branche', 'Volledigheid', 'Concreetheid', 'Gedrag op de site', 'Recentheid', 'Reactie']);
  });
  it('maximum per onderdeel wordt nooit overschreden', () => {
    const bericht = 'Pakket samengesteld via de website\nPassen op locatie gewenst: ja\nLogo: aangeleverd\nKledingstukken:\n- Polo, Zwart, logo borst links, 10x\n- Jas, Marine, 5x';
    const s = berekenScore(lead({ aantal: '50+', bericht }), { eersteContact: null, klantReageerde: true, nu });
    for (const d of s.delen) expect(d.punten).toBeLessThanOrEqual(d.max);
    expect(s.totaal).toBeLessThanOrEqual(100);
    // passen op locatie 6, twee artikelen 4, logo 2
    expect(s.delen.find((d) => d.label === 'Concreetheid')?.punten).toBe(12);
  });
  it('lege lead scoort laag en noemt wat er mist', () => {
    const s = berekenScore(lead({ company: '', email: '', phone: '', branche: '', aantal: '', created_at: '2026-08-01T00:00:00Z' }), { eersteContact: null, klantReageerde: false, nu });
    expect(scoreNiveau(s.totaal)).toBe('laag');
    expect(s.delen.find((d) => d.label === 'Volledigheid')?.uitleg).toBe('mist telefoon, bedrijf, e-mail');
  });
  it('reactietijd: binnen 24 uur 6 punten, later 3', () => {
    const snel = berekenScore(lead({ created_at: '2026-10-01T08:00:00Z' }), { eersteContact: '2026-10-01T10:00:00Z', klantReageerde: false, nu });
    const traag = berekenScore(lead({ created_at: '2026-10-01T08:00:00Z' }), { eersteContact: '2026-10-03T10:00:00Z', klantReageerde: false, nu });
    expect(snel.delen.find((d) => d.label === 'Reactie')?.punten).toBe(6);
    expect(traag.delen.find((d) => d.label === 'Reactie')?.punten).toBe(3);
  });
  it('niveaugrenzen', () => {
    expect(scoreNiveau(65)).toBe('hoog');
    expect(scoreNiveau(64)).toBe('midden');
    expect(scoreNiveau(40)).toBe('midden');
    expect(scoreNiveau(39)).toBe('laag');
  });
});

describe('teamgrootte, waarde en kans', () => {
  it.each([
    ['1-5', 3],
    ['5-10 medewerkers', 8],
    ['2 tot 10', 6],
    ['50+', 65],
    ['14', 14],
    ['', null],
    ['onbekend', null],
  ])('teamGrootte(%s) = %s', (invoer, uit) => {
    expect(teamGrootte(invoer)).toBe(uit);
  });
  it('waarde: offertewaarde wint, anders schatting per medewerker', () => {
    expect(leadWaarde({ offertewaarde: 1200, aantal: '10' })).toEqual({ waarde: 1200, geschat: false });
    expect(leadWaarde({ offertewaarde: null, aantal: '10' })).toEqual({ waarde: 1750, geschat: true });
    expect(leadWaarde({ offertewaarde: 0, aantal: null })).toEqual({ waarde: 0, geschat: true });
  });
  it('kans: gewonnen 100, verloren 0, eigen kans begrensd, anders standaard', () => {
    expect(leadKans({ kans: 30, status: 'geaccordeerd' })).toBe(100);
    expect(leadKans({ kans: 80, status: 'afgewezen' })).toBe(0);
    expect(leadKans({ kans: 140, status: 'contact' })).toBe(100);
    expect(leadKans({ kans: null, status: 'onbekend' })).toBe(10);
  });
  it('schoneStatus accepteert alleen bekende statussen', () => {
    expect(schoneStatus('offerte')).toBe('offerte');
    expect(schoneStatus('hack')).toBeNull();
  });
});

describe('aanvraag ontleden', () => {
  it('configurator: velden, stukken met kleur/logo/aantal en voorkeur', () => {
    const a = ontleedAanvraag(
      'Pakket samengesteld via de configurator\nBranche: Bouw\nPassen op locatie gewenst: ja\nKledingstukken:\n- Polo, Zwart, logo borst links, 10x - voorkeur: Tricorp\n- Softshell, Marine, 5x\nGraag snel contact',
    );
    expect(a.soort).toBe('configurator');
    expect(a.passenOpLocatie).toBe(true);
    expect(a.stukken[0]).toEqual({ naam: 'Polo', kleur: 'Zwart', logo: 'borst links', aantal: 10, voorkeur: 'Tricorp' });
    expect(a.stukken[1]).toMatchObject({ naam: 'Softshell', kleur: 'Marine', aantal: 5, logo: null });
    expect(a.vrijeTekst).toBe('Graag snel contact');
  });
  it('vrije tekst blijft vrije tekst', () => {
    const a = ontleedAanvraag('Hoi, wij zoeken 20 jassen.\nPassen op locatie gewenst: ja');
    expect(a.soort).toBe('vrij');
    expect(a.passenOpLocatie).toBe(true);
  });
  it('leeg bericht', () => {
    expect(ontleedAanvraag(null)).toMatchObject({ soort: 'vrij', vrijeTekst: null, stukken: [] });
  });
});

describe('herkomst, contact en dubbelen', () => {
  it.each([
    ['', 'Direct of onbekend'],
    ['bron=google, medium=cpc', 'Google Ads'],
    ['verwijzing: facebook.com', 'Social media'],
    ['bron=nieuwsbrief, medium=email', 'Nieuwsbrief of mailing'],
    ['verwijzing: www.google.com', 'Zoekmachine'],
    ['Telefonisch', 'Telefonisch'],
    ['verwijzing: bouwnieuws.nl', 'Andere website'],
    ['bron=beursvloer', 'Beurs of evenement'],
    ['bron=tiktok', 'Tiktok'],
  ])('bronKanaal(%s) = %s', (bron, kanaal) => {
    expect(bronKanaal(bron)).toBe(kanaal);
  });
  it('telLink en WhatsApp alleen voor mobiel', () => {
    expect(telLink('06 12 34 56 78')).toBe('+31612345678');
    expect(telLink('0031 314 123456')).toBe('+31314123456');
    expect(telLink('123')).toBeNull();
    expect(whatsappLink('06-12345678', 'Hoi')).toBe('https://wa.me/31612345678?text=Hoi');
    expect(whatsappLink('0314 123456')).toBeNull();
  });
  it('bedrijfSleutel negeert rechtsvorm en leestekens', () => {
    expect(bedrijfSleutel('Bouwbedrijf Hendriks B.V.')).toBe(bedrijfSleutel('bouwbedrijf hendriks'));
    expect(bedrijfSleutel('BV')).toBeNull();
  });
  it('vindDubbelen groepeert via e-mail en bedrijfsnaam (ook transitief)', () => {
    const d = vindDubbelen([
      { id: 'a', email: 'x@y.nl', company: 'Alfa BV' },
      { id: 'b', email: 'X@Y.nl ', company: 'Beta' },
      { id: 'c', email: 'c@c.nl', company: 'beta' },
      { id: 'd', email: 'd@d.nl', company: 'Delta' },
    ]);
    expect(d.get('a')?.sort()).toEqual(['b', 'c']);
    expect(d.has('d')).toBe(false);
  });
});

describe('datum en opvolging', () => {
  it('vandaagNl in Nederlandse tijd (na 22:00 UTC al de volgende dag in de zomer)', () => {
    expect(vandaagNl(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02');
    expect(vandaagNl(new Date('2026-12-31T22:30:00Z'))).toBe('2026-12-31');
  });
  it('opvolgStand', () => {
    expect(opvolgStand(null, '2026-10-04')).toBe('geen');
    expect(opvolgStand('2026-10-03', '2026-10-04')).toBe('verlopen');
    expect(opvolgStand('2026-10-04T15:00:00', '2026-10-04')).toBe('vandaag');
    expect(opvolgStand('2026-10-05', '2026-10-04')).toBe('gepland');
  });
  it('duurKort', () => {
    expect(duurKort(0.2)).toBe('12 min');
    expect(duurKort(5)).toBe('5 uur');
    expect(duurKort(72)).toBe('3 dagen');
    expect(duurKort(24 * 30)).toBe('4 wk');
  });
});
