/**
 * Logo's per merk. De sleutel is de slug zoals `slugify()` in lib/kms/catalogus.ts
 * hem maakt, zodat de merkenrij mee kan lopen met wat er écht in de catalogus zit.
 *
 * Niet elk merk heeft een logobestand, en dat is geen probleem: de merkenrij valt
 * dan terug op de naam als woordmerk. Beter een eerlijk woordmerk dan een leeg
 * kader, en veel beter dan een logo tonen van een merk waarvan geen enkel artikel
 * op de site staat - dat was hier de situatie voor Mascot, Chaud Devant en De Berkel.
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
