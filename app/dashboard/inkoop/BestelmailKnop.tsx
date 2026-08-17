'use client';

import { bestelBijLeverancierActie } from './actions';

/**
 * Knop die de bestelmail naar een merk stuurt en alle openstaande regels van dat
 * merk op besteld zet.
 *
 * Er zit bewust een bevestiging op. De mail gaat echt de deur uit en is niet
 * terug te halen, en deze knop staat in het formulier van de inkooppartij vóór
 * de knop onderaan. De eerste verzendknop in een formulier is de standaardknop:
 * een Enter tussen de vinkjes zou hier anders zonder waarschuwing een
 * bestelling versturen.
 *
 * De actie wordt met formAction meegegeven in plaats van met een eigen
 * formulier, want een formulier in een formulier mag niet van HTML.
 */
export default function BestelmailKnop({
  leverancierId,
  merk,
  email,
  aantalRegels,
}: {
  leverancierId: string;
  merk: string;
  email: string;
  aantalRegels: number;
}) {
  const regels = aantalRegels === 1 ? '1 regel' : `${aantalRegels} regels`;

  return (
    <button
      type="submit"
      name="leverancierId"
      value={leverancierId}
      formAction={bestelBijLeverancierActie}
      onClick={(gebeurtenis) => {
        const akkoord = window.confirm(
          `Bestelmail voor ${merk} sturen naar ${email}? Alle ${regels} van ${merk} komen daarna op besteld te staan.`,
        );
        if (!akkoord) gebeurtenis.preventDefault();
      }}
      className="knop-stil"
    >
      Bestelmail sturen en alles afvinken
    </button>
  );
}
