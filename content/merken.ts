/**
 * Merken die Jessi levert maar die (nog) niet in het KMS staan.
 *
 * De merkenrij op de homepage leest primair uit de catalogus, zodat er nooit meer
 * een merk in staat waarvan geen enkel artikel te vinden is. Maar sommige merken
 * verkoopt ze wel degelijk terwijl er nog geen artikelen van geïmporteerd zijn.
 * Die vul je hier aan; ze verschijnen zonder doorklik.
 *
 * Zodra er artikelen van zo'n merk in het KMS staan, haal je de naam hier weg -
 * anders komt hij dubbel in de rij.
 */
export const extraMerken: string[] = [
  'Mascot',
  'Chaud Devant',
  'De Berkel',
];

/**
 * Logobestanden per merkslug. Momenteel ongebruikt in de merkenrij: we hebben er
 * maar van een handvol merken één, en twee logo's tussen zestien namen leest als
 * een fout. Zodra er van alle merken een logo is, kan de rij hierop over.
 */
export const merkLogos: Record<string, string> = {
  'snickers-workwear': '/merken/snickers.webp',
  'upower': '/merken/u-power.webp',
  'tricorp': '/merken/tricorp.webp',
  'fhb': '/merken/fhb.jpg',
  'mascot': '/merken/mascot.png',
  'chaud-devant': '/merken/chaud-devant.png',
  'de-berkel': '/merken/de-berkel.svg',
};
