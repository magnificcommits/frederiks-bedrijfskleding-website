/**
 * Meldingen op de productiepagina's (?melding=...). Gewone bevestigingen
 * (?ok=opgeslagen) toont de algemene toast; hier staan de meldingen waar uitleg
 * bij hoort, of die zeggen dat er iets misging. Die horen in een rood vlak: een
 * groene balk met "niet gelukt" leest als goed nieuws.
 */
const MELDINGEN: Record<string, { tekst: string; fout?: boolean }> = {
  mislukt: { tekst: 'Opslaan is niet gelukt. Probeer het nog een keer.', fout: true },
  geen_klant: { tekst: 'Kies eerst een klant, dan komt het logo in de juiste bibliotheek.', fout: true },
  geen_naam: { tekst: 'Geef het logo eerst een naam.', fout: true },
  geen_bestand: { tekst: 'Kies een bestand of plak een link die met https:// begint.', fout: true },
  migratie: {
    tekst: 'Naam en opmerkingen zijn bewaard. Kleuren, posities, technieken en steken kunnen pas worden opgeslagen na de database-update (migratie 20261004_productie_logos_werkbonnen). Vraag Tim die te draaien.',
    fout: true,
  },
  migratie_bestand: {
    tekst: 'De vaste plek voor dit soort bestand is al bezet. Een tweede bestand kan pas na de database-update (migratie 20261004_productie_logos_werkbonnen). Verwijder anders eerst het oude bestand.',
    fout: true,
  },
  werkbon_tabel: {
    tekst: 'De status kan pas worden bewaard na de database-update (migratie 20261004_productie_logos_werkbonnen). Tot die tijd volgt de planning de orderstatus en de drukproeven.',
    fout: true,
  },
  werkbon_tabel_order: {
    tekst: 'De orderstatus is bijgewerkt. De werkbonstatus zelf kan pas worden bewaard na de database-update (migratie 20261004_productie_logos_werkbonnen).',
    fout: true,
  },
  order_bedrukken: { tekst: 'Status bijgewerkt. De order staat nu op bedrukken.' },
  order_borduren: { tekst: 'Status bijgewerkt. De order staat nu op borduren.' },
  order_verpakken: { tekst: 'Klaar gemeld. De order staat nu op verpakken.' },
};

export default function Melding({ code }: { code?: string | null }) {
  const m = code ? MELDINGEN[code] : null;
  if (!m) return null;
  return (
    <p
      role={m.fout ? 'alert' : 'status'}
      className={`mt-4 rounded-xl border px-5 py-3 text-sm font-semibold ${
        m.fout ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'
      }`}
    >
      {m.tekst}
    </p>
  );
}
