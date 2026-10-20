import type { PortaalRol } from '@/lib/portaal/team';
import { getSpaarInstellingen } from '@/lib/kms/sparen';
import PortaalNavKlant from './PortaalNavKlant';

/**
 * Portaalnavigatie. Leest op de server of het spaarprogramma aan staat
 * (KMS > Sparen > Instellingen); staat het uit, dan verdwijnt "Sparen" uit het
 * menu. Jessi biedt voorlopig geen spaarprogramma aan (werkdocument 20 okt 2026).
 */
export default async function PortaalNav({ rol, actief }: { rol: PortaalRol | null; actief?: string }) {
  let sparen = false;
  try {
    sparen = (await getSpaarInstellingen()).actief;
  } catch {
    sparen = false;
  }
  return <PortaalNavKlant rol={rol} actief={actief} sparen={sparen} />;
}
