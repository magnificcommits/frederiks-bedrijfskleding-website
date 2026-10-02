/**
 * Afdrukinstellingen voor een drukproef: A4, alleen het element met `doelId` komt op
 * papier (menu, kop en voet van de site vallen weg) en kleuren blijven behouden.
 */
export default function AfdrukStijl({ doelId }: { doelId: string }) {
  const css = `
@page { size: A4; margin: 12mm; }
@media print {
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  #${doelId}, #${doelId} * { visibility: visible !important; }
  #${doelId} { position: absolute; left: 0; top: 0; width: 100%; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; }
  #${doelId} .print\\:hidden { display: none !important; }
  #${doelId} .afdruk-blok { break-inside: avoid; page-break-inside: avoid; }
  #${doelId} .afdruk-nieuwe-pagina { break-before: page; page-break-before: always; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
