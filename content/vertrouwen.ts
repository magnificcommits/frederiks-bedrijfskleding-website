/**
 * Vertrouwensblokken voor homepage, branche- en regiopagina's.
 *
 * Alles wat hier staat moet waar zijn. Waar we iets nog niet zeker weten staat
 * een TODO en tonen we liever niets of een neutrale tekst dan een verzonnen getal.
 * Bedrijfsgegevens (adres, KvK, telefoon) komen uit content/site.ts en
 * content/bedrijf.ts, niet uit dit bestand.
 */

/** Wie je aan de lijn krijgt. */
export const contactpersoon = {
  naam: 'Jessi Frederiks',
  rol: 'Eigenaar, adviseur en je vaste aanspreekpunt',
  /**
   * Nu een uitsnede van de showroomfoto die ook in de hero staat.
   * TODO(Jessi): een losse portretfoto aanleveren (staand, minimaal 900 px breed,
   * gezicht in beeld), dan staat er niet twee keer dezelfde foto op de homepage.
   * Zet hem in /public en vul hier het pad in. Leeg = initialen-tegel, geen stock.
   */
  foto: '/Frederiks-bedrijfskleding-1.jpg' as string,
  /** Uitsnede rond het gezicht op de huidige foto; leeg laten bij een echt portret. */
  fotoUitsnede: 'scale-[2.1] origin-[58%_40%]' as string,
  tekst:
    'Ik kom zelf langs om te passen, ik bel je terug en ik weet over een jaar nog welke maat je voorman heeft. Geen callcenter, geen ticketnummer.',
};

/** Het verschil met een webshop, in gewone taal. Geen superlatieven. */
export const verschilMetWebshop: { onderwerp: string; webshop: string; wij: string }[] = [
  {
    onderwerp: 'Maten',
    webshop: 'Je bestelt op de maattabel en stuurt terug wat niet past.',
    wij: 'We passen bij jou op de zaak. Iedereen krijgt meteen de goede maat.',
  },
  {
    onderwerp: 'Logo',
    webshop: 'Uitbesteed, vaak weken wachten en weinig zicht op de kwaliteit.',
    wij: 'Bedrukken en borduren in eigen huis in Hengelo. Je ziet eerst een drukproef.',
  },
  {
    onderwerp: 'Contact',
    webshop: 'Een formulier, een klantenservice, elke keer iemand anders.',
    wij: 'Eén vast aanspreekpunt dat je bedrijf en je mensen kent.',
  },
  {
    onderwerp: 'Nabestellen',
    webshop: 'Opnieuw zoeken welk artikel, welke kleur en welke maat het ook alweer was.',
    wij: 'Je kledinglijn ligt vast. Een nieuwe collega regelen we in een paar dagen.',
  },
];

/**
 * Korte garantie- en retourbelofte bij de CTA. De volledige tekst staat in
 * content/klantenservice.ts (retourbeleid en garantie); dit is de samenvatting.
 */
export const zekerheden: { titel: string; tekst: string; href?: string }[] = [
  {
    titel: 'Vrijblijvend',
    tekst: 'Advies, passen en de offerte kosten niets. Je betaalt pas na akkoord.',
  },
  {
    titel: 'Garantie op de uitvoering',
    tekst: 'Laat een naad los of bladdert je logo af terwijl je het wasvoorschrift volgde? Dan herstellen of vervangen we het.',
    href: '/klantenservice#garantie',
  },
  {
    titel: 'Ruilen kan',
    tekst: 'Onbedrukte artikelen in originele staat neem je binnen de afgesproken termijn terug.',
    href: '/klantenservice/retourneren',
  },
];

/**
 * Teaser voor het spaarprogramma van zakelijke klanten (portaal, /portaal/sparen).
 *
 * TODO(Jessi): bevestigen dat het programma live gaat en dat deze omschrijving
 * klopt. De niveaus en beloningen staan in het KMS (spaar_niveaus,
 * spaar_beloningen) en kunnen daar wijzigen; daarom noemen we hier bewust geen
 * percentages of puntenaantallen. Zet `actief` op false om de teaser te verbergen.
 */
export const spaarprogramma = {
  actief: true,
  titel: 'Vaste klant? Dan spaar je mee',
  tekst:
    'Zakelijke klanten met een kledingportaal sparen punten op elke bestelling. Die wissel je in voor korting op je factuur of een gratis logo op een nabestelling. Hoe langer je klant bent, hoe meer voordeel er bij komt.',
  punten: ['Punten op elke bestelling', 'Inwisselen voor korting of gratis logowerk', 'Hogere niveaus met extra voordelen'],
};
