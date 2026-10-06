/**
 * Verdieping per branche: de branche in de regio, functies, uitdagingen, wat er
 * verandert en de kansen. Eén bestand per branche, zodat elk bestand los te
 * onderhouden is. Regels: alleen controleerbare feiten (bron in `bronnen` of bij
 * het feit), geen em-dashes, geen clichéwoorden, Nederlands, "we" en "je".
 */
export type BrancheVerdieping = {
  slug: string;
  /** Datum van de laatste inhoudelijke controle, YYYY-MM-DD. */
  bijgewerkt: string;
  /** Twee tot vier zinnen: wat deze branche in de Achterhoek en omgeving is. */
  regioIntro: string;
  /** 3 tot 4 kerncijfers met bron (tegel-weergave). */
  kerncijfers: { waarde: string; label: string; bron: string; bronUrl: string }[];
  /** 5 tot 8 functies: wat ze doen, wat ze dragen, welke normen, hoeveel sets. */
  functies: { functie: string; werk: string; kleding: string; normen: string; sets: string; vakgebied?: string }[];
  /** 4 tot 6 problemen uit de praktijk, met hoe wij het oplossen. */
  uitdagingen: { titel: string; probleem: string; aanpak: string }[];
  /** 2 tot 4 dingen die veranderen (regels, normen, markt), met bron. */
  veranderingen: { titel: string; tekst: string; bronUrl?: string }[];
  /** 3 tot 4 kansen voor de werkgever. */
  kansen: { titel: string; tekst: string }[];
  /** 3 tot 5 extra vragen en antwoorden, aanvullend op de bestaande FAQ. */
  extraFaq: { q: string; a: string }[];
  /** Alle gebruikte bronnen. */
  bronnen: { titel: string; url: string }[];
  /** Vragen voor Jessi om de pagina met praktijkervaring te verrijken. Wordt niet getoond. */
  vragenVoorJessi: string[];
};
