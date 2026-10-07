// Zet de assortimentprofielen om naar één SQL-query die per pagina ALLE passende
// artikelen toont (niet alleen de 8 die op de pagina komen). Plak de uitvoer in de
// Supabase SQL Editor en loop per pagina na of er iets tussen staat dat er niet hoort.
// Gebruik: node scripts/check-assortiment.mjs > check.sql
// Node 22.18+ leest TypeScript met alleen types direct.
const { PROFIELEN, ALTIJD_NIET } = await import('../lib/assortimentProfielen.ts');
const CAT = {
  'truien-en-vesten': 'Truien & vesten', jassen: 'Jassen', broeken: 'Broeken', 'korte-broeken': 'Korte broeken',
  'blouses-en-overhemden': 'Blouses, overhemden & blazers', werkschoenen: 'Werkschoenen', bodywarmers: 'Bodywarmers',
  accessoires: 'Accessoires', overalls: 'Overalls', 'rokken-en-jurken': 'Rokken & jurken', 't-shirts-en-polos': "T-shirts & polo's",
};
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const delen = Object.entries(PROFIELEN).map(([k, p]) => {
  const tekst = "lower(coalesce(merk,'') || ' ' || naam || ' ' || coalesce(subcategorie,''))";
  return `select ${q(k)} as pagina, count(distinct naam) as aantal, string_agg(distinct coalesce(merk,'?') || ': ' || naam, ' ; ') as artikelen
from producten where actief and afbeeldingen is not null and length(trim(coalesce(omschrijving,''))) > 60
and categorie in (${p.categorieen.map((c) => q(CAT[c])).join(', ')})
and ${tekst} ~* ${q(p.wel)}${p.niet ? ` and not ${tekst} ~* ${q(p.niet)}` : ''} and not ${tekst} ~* ${q(ALTIJD_NIET)}`;
});
console.log(delen.join('\nunion all\n') + '\norder by pagina;');
